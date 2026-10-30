// Flying between and within systems (moved from main.ts): the combat computer and the explorer's
// autopilots, the route autopilot, fuel, the hyperspace countdown and jump, the galactic
// hyperdrive, and the in-system jump.

import { SurveyPilot, type SurveyGoal } from '../game/surveyPilot';
import { sfx } from '../audio/sound';
import { fuelCapacity, hasEquipment, isWorking, removeEquipment, saveCommander } from '../game/commander';
import { coolRecords, legalStatus } from '../game/law';
import { type FlightInput } from '../game/input';
import { chooseTarget, CombatPilot } from '../game/combatPilot';
import { afterJump } from '../game/contracts';
import { takenByPirates } from '../game/assignments';
import { SIGNAL_REACH, isFound, isSurveyed } from '../game/explore';
import { flash } from '../ui/hud';
import { isMapOpen } from '../ui/galaxyMap';
import { distanceLy, ECONOMIES, GOVERNMENTS, nearestTo, systemAt, type StarSystem } from '../galaxy/generate';
import { activeEvent, EVENT_KINDS } from '../economy/events';
import { fadeFromWhite, playTunnel } from '../ui/tunnel';
import { $, cmdr, currentSystem, game, modern } from '../core';
import { aim, gimbalHold, flight, npcs, planetPos, player, station, SUN_POS, SUN_RADIUS } from '../scene';
import { routeTo } from '../ui/contracts';
import { carrier, scheduleMarshals } from './marshals';
import { checkAdrift } from './adrift';
import { distresses, messageIds, radio, radioMessages } from './comms';
import * as THREE from 'three';

import type { State } from '../core';
import type { Mount } from '../game/commander';
import type { NpcShip } from '../game/npc';
/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  setState: (next: State) => void;
  buildSystemScene: (sys: StarSystem) => void;
  arrivalNote: (sys: StarSystem) => string;
  forgetResponses: () => void;
  reportedBy: (npc: NpcShip) => void;
  setView: (next: Mount, glance?: boolean) => void;
  setAutopilot: (on: boolean, message?: string | undefined) => void;
  hitFeedback: (strength: number) => void;
  toggleGalaxyMap: () => void;
};
export const initTravel = (hooks: typeof main) => Object.assign(main, hooks);

// --- The combat computer ----------------------------------------------------
// Modern rules: it flies the ship in a fight (see game/combatPilot.ts) while
// you man a turret or the gimballed front laser. Touch any flight control
// and you have the ship back.

const COMBAT_COMPUTER_MIN_HULL = 0.25; // fraction of full hull: below this, you fly

const hasTurret = () => (['rear', 'left', 'right'] as const).some((m) => Boolean(cmdr().lasers[m]));

// --- The explorer's autopilots (docs/design/exploration.md, stage 1b) ------------

const SURVEY_PILOT_HOSTILES = 5000; // metres: a hostile this close hands control back

export function toggleSurveyPilot() {
  const c = cmdr();
  if (flight.surveyPilot) return stopSurveyPilot('Survey autopilot off · you have control');
  if (!hasEquipment(c, 'survey-autopilot')) return flash(c.difficulty === 'modern' ? 'Survey autopilot not fitted · sold to Pathfinders' : 'No survey autopilot under Classic rules', 2);
  if (!isWorking(c, 'survey-autopilot')) return flash('Survey autopilot damaged · repair at a station', 2);
  const next = surveyGoal();
  if (!next) return flash('Nothing left to survey or find here · the star is yours, if you want it', 3);
  if (flight.autopilot) main.setAutopilot(false);
  stopCombatComputer();
  flight.surveyPilot = new SurveyPilot();
  surveyGoalName = next.name;
  sfx.lock();
  flash(`Survey autopilot · ${next.name}`, 2.5);
}

/** Hand back control. Letting go on its own (not for your hands on the stick), it stops the ship first: never left coasting into a moon. */
export function stopSurveyPilot(message?: string, allStop = false) {
  if (!flight.surveyPilot) return;
  flight.surveyPilot = null;
  if (allStop) player.speed = 0;
  aim.reset(player);
  if (message) flash(message, 2.5);
}

/** The nearest thing here still to survey or find: the planet, a moon, a detected signal. Never the star. */
function surveyGoal(): { goal: SurveyGoal; name: string } | null {
  const c = cmdr();
  const here = currentSystem();
  const pos = player.obj.position;
  const options: { goal: SurveyGoal; name: string; d: number }[] = [];
  for (const b of flight.sceneBodies) {
    if (b.body.kind === 'star' || isSurveyed(c, here, b.body.id)) continue;
    // Hold halfway into survey range, on the near side.
    const point = b.centre.clone().add(pos.clone().sub(b.centre).setLength(b.radius + b.range * 0.5));
    options.push({ goal: { point, within: b.range * 0.3 }, name: b.body.name, d: pos.distanceTo(point) });
  }
  for (const p of flight.scenePois) {
    if (!p.revealed || isFound(c, here, p.poi.id)) continue;
    options.push({ goal: { point: p.position, within: SIGNAL_REACH * 0.6 }, name: p.poi.name, d: pos.distanceTo(p.position) });
  }
  options.sort((a, b) => a.d - b.d);
  return options[0] ?? null;
}

let surveyGoalName = '';
export function flySurvey(dt: number, pilot: SurveyPilot) {
  if (!isWorking(cmdr(), 'survey-autopilot')) return stopSurveyPilot('Survey autopilot damaged · all stop · you have control', true);
  if (npcs.some((n) => n.hostile && n.obj.position.distanceTo(player.obj.position) < SURVEY_PILOT_HOSTILES)) return stopSurveyPilot('Hostiles near · survey autopilot off · all stop · you have control', true);
  const next = surveyGoal();
  if (!next) return stopSurveyPilot('Survey autopilot · nothing left here to survey or find · all stop · the star is yours, if you want it', true);
  if (next.name !== surveyGoalName) {
    if (surveyGoalName) flash(`Survey autopilot · next: ${next.name}`, 2.5);
    surveyGoalName = next.name;
  }
  const { left, lined } = pilot.update(dt, player, next.goal, { centre: planetPos, radius: flight.planetRadius });
  // A long straight run: jump most of it.
  if (lined && left > J_DISTANCE + 3000) inSystemJump(true);
}

const ROUTE_PAUSE = 12; // seconds after arriving (and after the arrival news) before the route autopilot jumps on
const ROUTE_HOSTILES = 6000; // metres: hostiles this close hold the jump

export function updateRouteAutopilot() {
  if (flight.routeJumpAt === null || flight.elapsed < flight.routeJumpAt || flight.countdown !== null) return;
  const c = cmdr();
  const dest = destination();
  if (!dest || !isWorking(c, 'route-autopilot')) {
    flight.routeJumpAt = null;
    return;
  }
  const d = distanceLy(currentSystem(), dest);
  if (d > c.fuel) {
    flight.routeJumpAt = null;
    return flash(`Route autopilot · not enough fuel for ${dest.name} (${d.toFixed(1)} LY) · refuel at the station`, 3.5);
  }
  if (npcs.some((n) => n.hostile && n.obj.position.distanceTo(player.obj.position) < ROUTE_HOSTILES)) {
    flight.routeJumpAt = flight.elapsed + 5;
    return flash('Route autopilot holding · hostiles near', 2);
  }
  flight.routeJumpAt = null;
  toggleHyperspace();
}

export function toggleCombatComputer() {
  const c = cmdr();
  if (flight.combatComputer) return stopCombatComputer('Combat computer off · you have control');
  if (!hasEquipment(c, 'combat-computer')) return flash(c.difficulty === 'modern' ? 'Combat computer not fitted' : 'No combat computers under Classic rules', 2);
  if (!isWorking(c, 'combat-computer')) return flash('Combat computer damaged · repair at a station', 2);
  if (!hasTurret()) return flash('Fit a rear or side laser to use the combat computer: it flies, you man the turret', 3);
  const target = chooseTarget(player.obj.position, npcs, flight.locked);
  if (!target) return flash('No hostiles in range', 1.5);
  if (flight.autopilot) main.setAutopilot(false);
  flight.surveyPilot = null;
  flight.combatComputer = new CombatPilot();
  aim.reset(player);
  gimbalHold.set(0, 0, 1);
  sfx.lock();
  flash(`Strap in, Commander · combat computer engaged · ${target.def.name} · you have the guns`, 3);
}

export function stopCombatComputer(message?: string) {
  if (!flight.combatComputer) return;
  flight.combatComputer = null;
  aim.reset(player);
  if (message) flash(message, 2.5);
}

/** Hand the ship back when the pilot takes the controls, or things get bad. */
export function checkCombatComputer(input: FlightInput) {
  if (!flight.combatComputer) return;
  if (input.pitch || input.roll || input.yaw || input.throttle || input.speedStep) stopCombatComputer('Combat computer off · you have control');
  else if (player.hull < player.def.stats.hull * COMBAT_COMPUTER_MIN_HULL) stopCombatComputer('Hull critical · combat computer off · you have control');
  else if (!isWorking(cmdr(), 'combat-computer')) stopCombatComputer('Combat computer damaged · you have control');
}

// --- Witchspace travel: fuel, hyperspace and the in-system jump --------------------

const HYPERSPACE_COUNTDOWN = 10; // seconds
const MASS_LOCK_SHIPS = 2500; // metres: hostile ships this close stop a hyperspace jump
const J_DISTANCE = 10000; // metres per in-system jump
const J_LOCK_SHIPS = 3000;
const J_LOCK_STATION = 4000;
const J_LOCK_PLANET = 3000; // above the surface
const J_LOCK_SUN = 6000; // above the surface: jumps stop short of the heat
const J_LOCK_MOON = 2000; // above the surface
const J_LOCK_YARD = 3000; // beyond the constructor's length

let lastTick = 0;
let jumpCooldown = 0;

function destination(): StarSystem | null {
  const c = cmdr();
  return c.target === null ? null : systemAt(currentSystem().galaxy, c.target);
}

/** Set while a galactic hyperdrive countdown is running. */
let galacticJump = false;

/** Y, or the button on the galaxy chart: jump to the next galaxy. */
export function toggleGalacticJump() {
  if (flight.countdown !== null) {
    flight.countdown = null;
    galacticJump = false;
    flash('Galactic jump cancelled', 1.5);
    return;
  }
  if (!hasEquipment(cmdr(), 'galactic-hyperdrive')) {
    flash('No galactic hyperdrive fitted', 1.5);
    return;
  }
  if (npcs.some((p) => p.hostile && p.obj.position.distanceTo(player.obj.position) < MASS_LOCK_SHIPS)) {
    flash('Mass locked · hostile ships too close', 2);
    return;
  }
  if (isMapOpen()) main.toggleGalaxyMap();
  galacticJump = true;
  flight.countdown = HYPERSPACE_COUNTDOWN;
  lastTick = Math.ceil(flight.countdown);
  flash(`Galactic hyperdrive · to Galaxy ${((currentSystem().galaxy + 1) % 8) + 1}`, 2.5);
}

export function toggleHyperspace() {
  if (flight.countdown !== null) {
    flight.countdown = null;
    galacticJump = false;
    flash('Hyperspace cancelled', 1.5);
    return;
  }
  const c = cmdr();
  const dest = destination();
  if (!dest || dest === currentSystem()) {
    flash('No destination · choose one on the galaxy map (G)', 2.5);
    return;
  }
  const d = distanceLy(currentSystem(), dest);
  if (d > c.fuel) {
    flash(`${dest.name} is ${d.toFixed(1)} LY away · fuel for ${c.fuel.toFixed(1)} LY`, 2.5);
    return;
  }
  const near = npcs.some((p) => p.hostile && p.obj.position.distanceTo(player.obj.position) < MASS_LOCK_SHIPS);
  if (near) {
    flash('Mass locked · hostile ships too close', 2);
    return;
  }
  flight.countdown = HYPERSPACE_COUNTDOWN;
  lastTick = Math.ceil(flight.countdown);
  flash(`Hyperspace to ${dest.name} · ${d.toFixed(1)} LY`, 2);
}

export function updateTravel(dt: number) {
  jumpCooldown = Math.max(0, jumpCooldown - dt);
  $('#g-fuel').style.setProperty('--v', String(cmdr().fuel / fuelCapacity(cmdr())));
  const el = $('#countdown');
  if (flight.countdown === null) {
    el.hidden = true;
    return;
  }
  flight.countdown -= dt;
  const shown = Math.max(0, Math.ceil(flight.countdown));
  el.hidden = false;
  el.textContent = String(shown);
  if (shown < lastTick) {
    lastTick = shown;
    sfx.tick();
  }
  if (flight.countdown <= 0) {
    flight.countdown = null;
    el.hidden = true;
    void hyperspace();
  }
}

export async function hyperspace() {
  const c = cmdr();
  const from = currentSystem();
  const galactic = galacticJump;
  galacticJump = false;
  // The galactic hyperdrive lands you near the middle of the next galaxy's
  // chart, at the system nearest (96, 96), as in the original.
  const dest = galactic ? nearestTo((from.galaxy + 1) % 8, 96, 96) : destination();
  if (!dest) return;
  main.setAutopilot(false);
  main.setState('transition');
  sfx.hyperspace();
  await playTunnel(3.2, 'hyperspace');

  // Traders you attacked unseen, still alive as you leave: they report it, in the system you're leaving.
  for (const npc of npcs) if (npc.unreported) main.reportedBy(npc);
  if (galactic) removeEquipment(c, 'galactic-hyperdrive');
  else c.fuel = Math.max(0, Math.round((c.fuel - distanceLy(from, dest)) * 10) / 10);
  c.location = { galaxy: dest.galaxy, system: dest.index };
  c.target = null;
  // On a plotted route: the next hop, or arrived.
  let routeNote = '';
  if (c.courseTo !== null && c.courseTo !== undefined) {
    const end = systemAt(dest.galaxy, c.courseTo);
    const hop = routeTo(dest, end)?.[0];
    if (hop) {
      c.target = hop.index;
      routeNote = `Next jump plotted: ${hop.name}${hop === end ? '' : ` (on the way to ${end.name})`}${distanceLy(dest, hop) > c.fuel ? ' · refuel first' : ''}`;
    } else c.courseTo = null;
  }
  c.visits += 1; // Classic markets are set on arrival in a system, as in 1984
  // Records stay in the system where the crime happened, and cool as you travel.
  coolRecords(c);
  // A new system, a cold trail: the computer switches the transponder back on.
  if (flight.transponderOff) {
    flight.transponderOff = false;
    flight.switchOnWhenClear = false;
    setTimeout(() => game.state === 'flying' && flash('Transponder on · new system (0 to run dark again)', 3), 6500);
  }
  // The Route Autopilot takes the next jump by itself, after a moment to look around.
  if (routeNote && isWorking(c, 'route-autopilot') && c.target !== null && distanceLy(dest, systemAt(dest.galaxy, c.target)) <= c.fuel) {
    flight.routeJumpAt = flight.elapsed + ROUTE_PAUSE;
    routeNote += ' · route autopilot jumps shortly (H to stop)';
  }
  const seen = messageIds();
  const jumpNotes = afterJump(c);
  const adriftNotes = checkAdrift();
  // Under Modern rules the companies' notes come over the radio; the route is the ship's computer.
  const contractNotes = modern() ? adriftNotes : [...jumpNotes, ...adriftNotes];
  if (contractNotes.length || routeNote) setTimeout(() => game.state === 'flying' && flash([routeNote, ...contractNotes].filter(Boolean).join(' · '), 4), 9000);
  setTimeout(() => game.state === 'flying' && radioMessages(seen), 9000);
  distresses.length = 0;
  flight.escort = null;
  flight.arrayTimer = 12; // the array picks up the new system's boards once you're settled
  flight.distressTimer = 60 + Math.random() * 90;
  flight.surrenderTimer = null;
  saveCommander(c);
  const slipped = carrier !== null && (carrier.phase === 'arriving' || carrier.phase === 'emerging');
  // Pirates who had your case when you left have got away with it.
  for (const npc of npcs) if (npc.carrying) takenByPirates(c, npc.carrying, Date.now());
  main.forgetResponses();
  main.buildSystemScene(dest);

  // Arrive some way out, off to one side of the station-planet line, so the
  // station is ahead and the planet clearly beside it rather than behind it.
  // Drifting slowly: take in the new system, then throttle up or use J.
  const side = dest.extraSeed[2] & 1 ? 1 : -1;
  const out = new THREE.Vector3(side, 0.3, -0.25).normalize();
  player.obj.position.copy(out.multiplyScalar(26000));
  player.obj.up.set(0, 1, 0);
  player.obj.lookAt(station.root.position);
  aim.reset(player);
  player.speed = player.maxSpeed * 0.1;
  main.setView('front');
  main.setState('flying');
  fadeFromWhite();
  const wanted = legalStatus(c);
  const note = main.arrivalNote(dest);
  saveCommander(c);
  if (note) setTimeout(() => game.state === 'flying' && flash(note, 3), 4200);
  flash(
    `${dest.name} · ${GOVERNMENTS[dest.government]} · ${ECONOMIES[dest.economy]}` +
      (wanted === 'fugitive' ? (c.warrant ? ' · Marshals warrant: police hostile' : ' · You are wanted here') : wanted === 'offender' ? ' · Offender here' : ''),
    4,
  );
  announceEvent(dest, note ? 7800 : 4500);
  if (slipped) setTimeout(() => game.state === 'flying' && flash('You slipped away before the Marshals came through', 3.5), 5000);
  scheduleMarshals();
}

/** Arriving somewhere in the middle of a crisis: say so. */
export function announceEvent(sys: StarSystem, delay: number) {
  const e = activeEvent(sys, Date.now());
  if (e) setTimeout(() => game.state === 'flying' && (modern() ? radio('news', `${sys.name} news`, EVENT_KINDS[e.type].headline(sys.name), { flash: 4, urgent: true, line: EVENT_KINDS[e.type].headline(sys.name) }) : flash(EVENT_KINDS[e.type].headline(sys.name), 4)), delay);
}

/** The original's J key: leap ahead when nothing is near enough to mass-lock you. */
export function inSystemJump(quiet = false): boolean {
  if (jumpCooldown > 0) return false;
  const pos = player.obj.position;
  const shipsNear = npcs.some((p) => p.obj.position.distanceTo(pos) < J_LOCK_SHIPS);
  const stationNear = pos.distanceTo(station.root.position) < J_LOCK_STATION;
  const planetNear = pos.distanceTo(planetPos) - flight.planetRadius < J_LOCK_PLANET;
  const sunNear = pos.distanceTo(SUN_POS) - SUN_RADIUS < J_LOCK_SUN;
  const moons = flight.sceneBodies.filter((b) => b.body.kind === 'moon');
  const moonNear = moons.some((m) => pos.distanceTo(m.centre) - m.radius < J_LOCK_MOON);
  const yardNear = flight.yardScene !== null && pos.distanceTo(flight.yardScene.centre) - flight.yardScene.radius < J_LOCK_YARD;
  if (shipsNear || stationNear || planetNear || sunNear || moonNear || yardNear) {
    if (!quiet) flash(`Mass locked · ${shipsNear ? 'ships' : stationNear ? 'station' : planetNear ? 'planet' : sunNear ? 'sun' : moonNear ? 'moon' : 'yard'} too close`, 1.5);
    return false;
  }
  // Leap forward, but stop short of the station, the planet, its moons or the sun if they're ahead.
  const fwd = player.forward();
  let dist = J_DISTANCE;
  const limit = (target: THREE.Vector3, keepOut: number) => {
    const to = target.clone().sub(pos);
    const along = to.dot(fwd);
    if (along <= 0) return;
    const miss = to.clone().addScaledVector(fwd, -along).length();
    if (miss < keepOut) dist = Math.min(dist, Math.max(0, along - Math.sqrt(keepOut * keepOut - miss * miss)));
  };
  limit(station.root.position, J_LOCK_STATION - 200);
  limit(planetPos, flight.planetRadius + J_LOCK_PLANET - 200);
  limit(SUN_POS, SUN_RADIUS + J_LOCK_SUN - 200);
  for (const m of moons) limit(m.centre, m.radius + J_LOCK_MOON - 200);
  if (flight.yardScene) limit(flight.yardScene.centre, flight.yardScene.radius + J_LOCK_YARD - 200);
  if (dist < 500) {
    if (!quiet) flash('Mass locked · too close ahead', 1.5);
    return false;
  }
  pos.addScaledVector(fwd, dist);
  jumpCooldown = 1.2;
  sfx.jump();
  main.hitFeedback(0.15);
  flash('Jump', 0.6);
  return true;
}
