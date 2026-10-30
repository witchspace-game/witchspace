// Flying the ship (moved from main.ts): the four views and glancing, roll assist and the
// autopilot, hit feedback, and each frame of flight in a system (updateSpace).

import { danube, music, sfx } from '../audio/sound';
import { setListener } from '../audio/spatial';
import { isWorking, type Mount } from '../game/commander';
import { controlScheme, flightInput, isMouseCaptured, isTouch, type FlightInput } from '../game/input';
import { SENSITIVITY as AIM_SENSITIVITY } from '../game/mouseAim';
import { PLAYER_LASERS } from '../game/weapons';
import { camera, isRetro } from '../render/renderer';
import { heatShip } from '../render/shipModel';
import { flash, setInterference, toggleScannerRange, updateHud, type Blip } from '../ui/hud';
import { onTap, updateTouch } from '../ui/touch';
import { $, cmdr, game } from '../core';
import { aim, engineSound, dockingComputer, gimbalHold, dust, explosions, flight, missiles, sharedSpace, npcs, planetPos, player, space, station } from '../scene';
import { updateIdentities, updateLegends } from './traffic';
import { carrier, riftInterference, updateMarshals } from './marshals';
import { netMissiles, sightedNpc, updateMissileButton, updateSeekerBox } from './missiles';
import { drifters, updateCaseRaid, updateDrifters, updateSun } from './adrift';
import { clearanceRefused, lockedDown, updateClearance, updateJob } from './comms';
import { commanderColour, updateSharedSpace } from './sharedSpace';
import { checkCombatComputer, flySurvey, stopCombatComputer, stopSurveyPilot, updateRouteAutopilot, updateTravel } from './travel';
import { HIDDEN_BEYOND, YARD_COLOUR, bumpCover, exploring, inClutter, updateExplore } from './explore';
import { damagePlayer, darkRefused, updateHail, updateResponses, updateStationDefence } from './law';
import { gimbalRide, updateCombat } from './combat';
import { npcColour, updateAimDisplay, updateCombatHud, updateMarkers } from './hud';
import { holdForSurrender, updateRadio, updateSurrender } from './beacon';
import * as THREE from 'three';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  dock: () => Promise<void>;
  recordTrack: () => void;
  die: () => void;
};
export const initFlying = (hooks: typeof main) => Object.assign(main, hooks);

// --- Views: look front, rear, left or right while the ship flies on ---------------
// Each view fires the laser on that mount. Classic mounts are fixed, as in
// 1984; Modern rear and side mounts are turrets that hit the nearest ship
// near the middle of the view.

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
const VIEW_TURN: Record<Mount, number> = { front: 0, rear: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };

export function setView(next: Mount, glance = false) {
  flight.view = next;
  // The touch view button points where you're looking; its picker marks the view and closes.
  const turn: Record<Mount, number> = { front: 0, right: 90, rear: 180, left: -90 };
  $('#view-button svg').style.transform = `rotate(${turn[flight.view]}deg)`;
  $('#view-button').classList.toggle('away', flight.view !== 'front');
  for (const b of document.querySelectorAll<HTMLButtonElement>('#view-picker [data-view]')) b.classList.toggle('on', b.dataset.view === flight.view);
  if (!glance) showViewPicker(false);
  const label = $('#view-label');
  label.hidden = flight.view === 'front';
  label.textContent = `${flight.view} view`;
  if (flight.view !== 'front' && !glance) {
    const laser = cmdr().lasers[flight.view];
    flash(laser ? `${flight.view} view · ${PLAYER_LASERS[laser].name}` : `${flight.view} view · no ${flight.view} laser fitted`, 1.4);
  }
}

// Tap the scanner to switch its range (R on a keyboard; a phone had no way: Mark).
onTap($('#scanner'), () => flash(`Scanner range ${toggleScannerRange() / 1000} km`, 1.2));

/** The touch view picker: four directions round the view button, one tap each (Mark). */
function showViewPicker(show: boolean) {
  $('#view-picker').hidden = !show;
  $('#view-button').setAttribute('aria-expanded', String(show));
}
// Tap: the four open, to choose a view that stays. Press and hold: they open under your thumb, the
// view follows it onto a direction, and letting go looks ahead again: a glance (Mark).
const GLANCE_HOLD = 220; // ms
let glanceTimer = 0;
let glancing: Mount | null = null; // the view to go back to
const viewButton = $<HTMLButtonElement>('#view-button');
viewButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try {
    viewButton.setPointerCapture(e.pointerId); // keep the press if the thumb slides off
  } catch {
    /* no such pointer (a synthetic event): carry on without */
  }
  glanceTimer = window.setTimeout(() => {
    glancing = flight.view;
    showViewPicker(true);
  }, GLANCE_HOLD);
});
viewButton.addEventListener('pointermove', (e) => {
  if (!glancing) return;
  const over = (document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null)?.closest<HTMLElement>('#view-picker [data-view]');
  const next = (over?.dataset.view as Mount | undefined) ?? glancing;
  if (next !== flight.view) setView(next, true);
});
const endGlance = (tap: boolean) => {
  clearTimeout(glanceTimer);
  viewButton.blur();
  if (glancing) {
    const back = glancing;
    glancing = null;
    setView(back); // let go: eyes front again (or wherever you were)
    return;
  }
  if (tap) showViewPicker($('#view-picker').hidden === true);
};
viewButton.addEventListener('pointerup', () => endGlance(true));
viewButton.addEventListener('pointercancel', () => endGlance(false));
for (const b of document.querySelectorAll<HTMLButtonElement>('#view-picker [data-view]'))
  onTap(b, () => {
    b.blur();
    setView(b.dataset.view as Mount);
  });
// A tap anywhere else closes it.
document.addEventListener('pointerdown', (e) => {
  const t = e.target as Node;
  if (!glancing && !$('#view-picker').hidden && !$('#view-picker').contains(t) && !$('#view-button').contains(t)) showViewPicker(false);
}, true);

/**
 * Steering in a rear or side view (Mark: dragging did nothing there). The drag turns the view you're
 * looking through, as it turns the nose ahead: across, the ship yaws (the same in every view, all
 * turning about her up); up and down, she pitches (the other way, looking back) or rolls (looking aside).
 */
function steerInView(input: FlightInput, dt: number) {
  const k = AIM_SENSITIVITY / Math.max(dt, 1e-3);
  const across = input.aimDx * k; // how fast the view should swing right, radians a second
  const up = -input.aimDy * k; // and tip up
  const rate = (r: number, max: number) => THREE.MathUtils.clamp(r / max, -1, 1);
  input.yaw = rate(across, player.yawRate);
  if (flight.view === 'rear') input.pitch = rate(-up, player.def.stats.pitchRate ?? 1.5);
  else input.roll = rate(flight.view === 'left' ? up : -up, player.def.stats.rollRate ?? 2);
}

/** Which way the current view looks, in the world. */
export function viewDirection(): THREE.Vector3 {
  switch (flight.view) {
    case 'rear':
      return player.forward().negate();
    case 'left':
      return player.right().negate();
    case 'right':
      return player.right();
    default:
      return player.forward();
  }
}
let lastAltitudeWarning = -Infinity;
export const deathCam = { centre: new THREE.Vector3(), offset: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0), t: 0 };


// Modern rules: near the station and pointing roughly at the slot, the ship
// matches the station's spin by itself whenever the pilot isn't rolling.
// Classic rules leave it all to you, as in 1984.
const ROLL_ASSIST_RANGE = 2500; // metres
const ROLL_ASSIST_HEADING = THREE.MathUtils.degToRad(35);
const ROLL_ASSIST_GAIN = 3; // holds within ~3° of the slot (tested in simulation)
const AUTO_LEVEL_GAIN = 2.5; // levels 50° of tilt in about half a second (tested in simulation)
let rollAssist = false;
/** The pilot rolled with the mouse: hold that bank until they tap to level. */
let bankHeld = false;
export function releaseBank() {
  bankHeld = false;
}

export function rollAssistApplies() {
  return (
    player.obj.position.distanceTo(station.root.position) < ROLL_ASSIST_RANGE &&
    station.headingError(player) < ROLL_ASSIST_HEADING
  );
}

export function setAutopilot(on: boolean, message?: string) {
  flight.autopilot = on;
  if (on) {
    flight.surveyPilot = null;
    dockingComputer.reset();
    danube.start(!isRetro());
  } else {
    danube.stop();
  }
  if (message) flash(message, 2);
}

export function hitFeedback(strength: number) {
  flight.shake = Math.max(flight.shake, strength);
  const el = $('#hit');
  el.classList.remove('on');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('on');
}

export function updateSpace(dt: number) {
  flight.elapsed += dt;
  station.update(dt);
  updateDrifters(dt);
  updateCaseRaid(dt);
  updateResponses();
  updateStationDefence(dt);
  updateHail();
  updateMissileButton();
  for (let i = explosions.length - 1; i >= 0; i--) if (!explosions[i].update(dt)) explosions.splice(i, 1);
  updateMarshals(dt);

  let input: ReturnType<typeof flightInput> | null = null;
  if (game.state === 'flying') {
    const prev = station.toLocal(player.obj.position);
    input = flightInput();
    if (flight.autopilot && input.active) setAutopilot(false, 'Docking computer off');
    if (flight.surveyPilot && input.active) stopSurveyPilot('Survey autopilot off · you have control');
    checkCombatComputer(input);

    // Mouse aim: steer the nose towards the reticle. Turning with keys or
    // while the computer flies puts the reticle back on the nose.
    const keysTurning = input.pitch !== 0 || input.yaw !== 0;
    if (input.recentre) aim.reset(player);
    if (flight.combatComputer) {
      // The computer flies; the mouse (or aim pad) only aims the guns, relative to the nose.
      aim.move(player, input.aimDx, input.aimDy);
      aim.clamp(player);
      gimbalHold.copy(aim.dir).applyQuaternion(player.obj.quaternion.clone().invert());
    } else if (controlScheme() === 'mouse' && isMouseCaptured() && !flight.autopilot && !flight.surveyPilot && !keysTurning && flight.view === 'front') {
      aim.move(player, input.aimDx, input.aimDy);
      const s = aim.steer(player);
      input.pitch = s.pitch;
      input.yaw = s.yaw;
    } else if (flight.view !== 'front' && controlScheme() === 'mouse' && (isMouseCaptured() || isTouch) && !flight.autopilot && !flight.surveyPilot && !keysTurning) {
      aim.reset(player);
      steerInView(input, dt);
    } else {
      aim.reset(player);
    }

    // A roll you make (mouse or keys) holds its bank until you tap to level: the flight
    // assist mustn't undo it the moment you let go (a Stardot pilot found the keys "obstinate").
    if (input.mouseRoll || input.roll !== 0) bankHeld = true;
    if (input.level) bankHeld = false;
    rollAssist = !flight.autopilot && !flight.surveyPilot && !flight.combatComputer && cmdr().difficulty === 'modern' && input.roll === 0 && rollAssistApplies();
    if (rollAssist) {
      input.roll = THREE.MathUtils.clamp(-ROLL_ASSIST_GAIN * station.rollError(player), -1, 1);
    } else if (!flight.autopilot && !flight.surveyPilot && !flight.combatComputer && controlScheme() === 'mouse' && input.roll === 0 && !bankHeld) {
      // Flight assist: with no roll input, level the wings with the star
      // system's "up" so there's always a horizon. Weaker when pointing
      // steeply up or down, where "level" stops meaning much.
      const steep = Math.abs(player.forward().y);
      input.roll = THREE.MathUtils.clamp(AUTO_LEVEL_GAIN * player.right().y * (1 - steep), -1, 1);
    }
    if (flight.autopilot) dockingComputer.update(dt, player, station);
    else if (flight.combatComputer) {
      const hit = flight.lastHitBy && npcs.includes(flight.lastHitBy.npc) ? flight.lastHitBy : null;
      const status = { heat: Math.min(1, flight.laserHeat / 100), hitBy: hit?.npc ?? null, hitAgo: hit ? flight.elapsed - hit.at : Infinity };
      if (!flight.combatComputer.fly(dt, player, npcs, flight.locked, { centre: planetPos, radius: flight.planetRadius }, status)) stopCombatComputer('No hostiles · combat computer standing down · you have control');
      else if (flight.combatComputer.announce) {
        flash(`Combat computer · ${flight.combatComputer.announce}`, 1.8);
        flight.combatComputer.announce = null;
      }
    } else if (flight.surveyPilot) flySurvey(dt, flight.surveyPilot);
    else {
      holdForSurrender(input);
      player.steer(dt, input);
    }
    player.move(dt);
    if (flight.combatComputer) gimbalRide(dt);
    player.recharge(dt, isWorking(cmdr(), 'extra-energy') ? 2 : 1);

    if (updateSun(dt)) {
      sfx.thud();
      main.die();
      return;
    }
    const altitude = player.obj.position.distanceTo(planetPos) - flight.planetRadius;
    if (altitude < 0 || updateExplore(dt)) {
      sfx.thud();
      main.die();
      return;
    }
    if (altitude < flight.planetRadius * 0.12 && flight.elapsed - lastAltitudeWarning > 4) {
      lastAltitudeWarning = flight.elapsed;
      sfx.beep();
      flash('Altitude warning', 1.5);
    }

    const wreck = bumpCover(player.obj.position, 20);
    if (wreck) {
      sfx.thud();
      const damage = 10 + player.speed * 0.15;
      player.speed *= 0.2;
      if (damagePlayer(damage)) {
        main.die();
        return;
      }
      hitFeedback(0.8);
      flash(`Hull impact · ${wreck}`, 1.2);
    }

    // The yard: the constructor is as solid as a moon, the rest bounces you off.
    const bumped = flight.yardScene?.contact(player.obj.position, player.speed);
    if (bumped?.kind === 'crash') {
      sfx.thud();
      hitFeedback(1);
      flash(`Collision with the ${bumped.what}`, 3);
      main.die();
      return;
    }
    if (bumped) {
      sfx.thud();
      player.speed *= 0.2;
      if (damagePlayer(bumped.damage)) {
        main.die();
        return;
      }
      hitFeedback(0.8);
      flash(`Hull impact · ${bumped.what}`, 1.2);
    }

    const contact = station.contact(player, prev, cmdr().difficulty === 'classic');
    if (contact?.kind === 'docked' && lockedDown()) {
      station.turnAway(player);
      sfx.thud();
      setAutopilot(false);
      flash('Docking refused · station in lockdown · containment breach', 3);
    } else if (contact?.kind === 'docked' && darkRefused()) {
      station.turnAway(player);
      sfx.thud();
      setAutopilot(false);
      flash('Docking refused · unidentified ship · switch on your transponder (0)', 3);
    } else if (contact?.kind === 'docked' && clearanceRefused()) {
      station.turnAway(player);
      sfx.thud();
      setAutopilot(false);
      flash('Docking refused · Fugitive · U to surrender', 3);
    } else if (contact?.kind === 'docked') {
      void main.dock();
    } else if (contact) {
      if (contact.kind === 'scrape') sfx.scrape();
      else sfx.thud();
      if (cmdr().difficulty === 'classic' || damagePlayer(contact.damage)) {
        main.die();
      } else {
        hitFeedback(0.8);
        flash(contact.kind === 'scrape' ? 'Slot impact' : 'Hull impact', 1.2);
      }
    }
  }

  updateCombat(dt, input);
  updateSharedSpace(dt, input);
  if (game.state === 'flying' || game.state === 'dead') main.recordTrack();
  // A cue ends with its moment: the Falcon gone (jumped, driven off), the Marshals gone.
  if (music.playing === 'falcon' && !npcs.some((n) => n.def.id === 'falcon')) music.stop('falcon');
  if (music.playing === 'marshals' && !carrier) music.stop('marshals');
  if (game.state === 'flying') {
    updateClearance();
    updateSurrender(dt);
    updateRouteAutopilot();
    updateIdentities();
    updateLegends(dt);
    updateRadio(dt);
  }
  if (flight.stationFlash > 0) {
    flight.stationFlash = Math.max(0, flight.stationFlash - dt);
    heatShip(station.model, flight.stationFlash / 0.25);
  }

  if (game.state === 'dead') {
    // Watch the wreck from outside, slowly circling, as the original did.
    deathCam.t += dt;
    const orbit = deathCam.offset.clone().applyAxisAngle(deathCam.axis, deathCam.t * 0.25);
    camera.position.copy(deathCam.centre).add(orbit);
    camera.lookAt(deathCam.centre);
  } else {
    camera.position.copy(player.obj.position);
    camera.quaternion.copy(player.obj.quaternion).multiply(FLIP);
    if (flight.view !== 'front') camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), VIEW_TURN[flight.view]));
    if (flight.shake > 0.01) {
      camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(flight.shake * 2.5));
      flight.shake *= Math.exp(-dt * 6);
    }
  }
  space.stars.position.copy(camera.position);
  camera.updateMatrixWorld();
  setListener(camera);
  dust.update(camera.position, game.state === 'flying' ? player.forward().multiplyScalar(player.speed) : new THREE.Vector3());

  const sighted = game.state === 'flying' ? sightedNpc() : null;
  // In a wreck field your scanner is cluttered too: far contacts drop off it.
  const cluttered = game.state === 'flying' && exploring() && inClutter(player.obj.position);
  const blips: Blip[] = [
    { position: station.root.position, color: '#ffb347', kind: 'station' },
    ...npcs
      .filter((p) => !cluttered || p.obj.position.distanceTo(player.obj.position) < HIDDEN_BEYOND)
      .map((p): Blip => ({ position: p.obj.position, color: npcColour(p), kind: 'ship', sighted: p === sighted, locked: p === flight.locked })),
    ...drifters.map((d): Blip => ({ position: d.model.root.position, color: '#ffd166', kind: 'cargo' })),
    ...missiles.map((m): Blip => ({ position: m.position, color: '#ff6b6b', kind: 'missile' })),
  ];
  if (carrier?.rift) blips.push({ position: carrier.rift.group.position, color: '#cfe0ff', kind: 'station' });
  if (flight.yardScene) {
    blips.push({ position: flight.yardScene.centre, color: YARD_COLOUR, kind: 'station' });
    for (const h of flight.yardScene.haulers) blips.push({ position: h.root.position, color: YARD_COLOUR, kind: 'ship' });
  }
  for (const r of sharedSpace.remotes.values()) blips.push({ position: r.position, color: commanderColour(r), kind: 'commander', locked: r === flight.lockedCommander });
  for (const n of netMissiles.values()) blips.push({ position: n.missile.position, color: '#ff6b6b', kind: 'missile' });
  // Near a rift, contacts jitter about on the scanner.
  const noise = game.state === 'flying' ? riftInterference() : 0;
  if (noise > 0) for (const b of blips) b.position = b.position.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(noise * 600 * Math.random()));
  setInterference(noise);
  updateSeekerBox();
  if (game.state === 'flying') {
    updateHud(player, station, blips, flight.autopilot || Boolean(flight.combatComputer), rollAssist);
    updateTouch(dt, player.speed / player.maxSpeed);
    updateAimDisplay();
    updateCombatHud();
    updateJob(dt);
    updateTravel(dt);
    updateMarkers();
    const turn = Math.abs(player.pitchGauge) + Math.abs(player.yawGauge) + Math.abs(player.rollGauge) * 0.6;
    engineSound.update(player.speed / player.maxSpeed, Math.min(1, turn / 1.2), dt);
  }
}
