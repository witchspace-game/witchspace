import * as THREE from 'three';
import { danube, preloadRecording, sfx, toggleMute, unlockAudio } from './audio/sound';
import { boomAt, EngineSound, setListener, ShipVoice, tailWarning, zapAt } from './audio/spatial';
import { shipById, ships } from './content/ships';
import {
  cargoTonnes,
  DIFFICULTIES,
  deleteCommander,
  EQUIPMENT,
  hasEquipment,
  loadCommander,
  newCommander,
  removeEquipment,
  saveCommander,
  type Commander,
  type Difficulty,
} from './game/commander';
import { DockingComputer } from './game/dockingComputer';
import {
  controlScheme,
  flightInput,
  gamepadPresses,
  isMouseCaptured,
  setFlying,
  toggleControlScheme,
  toggleInvertPitch,
  wantsMouseCapture,
} from './game/input';
import { MouseAim } from './game/mouseAim';
import { NpcShip } from './game/npc';
import { Beams, POLICE_LASER, PULSE_LASER, rayHit, type Target } from './game/weapons';
import { PlayerShip } from './game/playerShip';
import { Station } from './game/station';
import { ATMOSPHERE_SCALE, buildPlanet, buildSun } from './render/bodies';
import { SpaceDust } from './render/dust';
import { Explosion } from './render/explosion';
import { camera, isRetro, makeSpace, render, setRetro } from './render/renderer';
import { buildShip, disposeShip, heatShip, type ShipModel } from './render/shipModel';
import { clearFlash, flash, updateHud, type Blip } from './ui/hud';
import { clearIndicators, showHitDirection, updateIndicators, type Marker } from './ui/indicators';
import { playTunnel } from './ui/tunnel';
import './style.css';

type State = 'title' | 'newgame' | 'docked' | 'flying' | 'transition' | 'dead';
let state: State = 'title';
let inSpace = false;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function setState(next: State) {
  state = next;
  document.body.dataset.state = next;
  document.querySelectorAll<HTMLElement>('[data-screen]').forEach((el) => {
    el.hidden = !el.dataset.screen!.split(' ').includes(next);
  });
  if (next !== 'flying') $('#dock-aid').hidden = true;
  setFlying(next === 'flying');
  if (next === 'flying') {
    showControlsCardOnce();
    engineSound.start();
  } else {
    engineSound.stop();
    clearIndicators();
    for (const v of voices.values()) v.dispose();
    voices.clear();
  }
}

let commander: Commander | null = null;
const cmdr = () => commander!;

// --- Showroom (title, new game and docked screens) --------------------------

const showroom = makeSpace();
const showroomModels = ships.map(buildShip);
for (const m of showroomModels) showroom.scene.add(m.root);
const cobraIndex = Math.max(0, showroomModels.findIndex((m) => m.def.id === 'cobra-mk3'));
let shipIndex = cobraIndex;
let flyIn = 0; // 0 = far away, 1 = arrived
const spin = { x: 0.25, y: 0, dragging: false, lastX: 0, lastY: 0, idle: 0 };

function showShip(index: number) {
  shipIndex = (index + showroomModels.length) % showroomModels.length;
  showroomModels.forEach((m, i) => (m.root.visible = i === shipIndex));
  flyIn = 0;
  spin.x = 0.25;
  spin.y = 0;
  updateShipPanel();
}

function updateShipPanel() {
  const { def } = showroomModels[shipIndex];
  const s = def.stats;
  $('#ship-name').textContent = def.name;
  $('#ship-meta').textContent = [def.manufacturer, def.role].filter(Boolean).join(' · ');
  $('#ship-desc').textContent = def.description;
  const rows: [string, string][] = [
    ['Max speed', `${s.maxSpeed} m/s`],
    ['Hull', `${s.hull}`],
    ['Shields', `${s.shields}`],
    ['Cargo', `${s.cargo} t`],
    ['Missiles', `${s.missiles ?? 0}`],
    ['Price', s.price ? `${s.price.toLocaleString()} Cr` : 'Not for sale'],
  ];
  $('#ship-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#ship-credits').textContent = `Design: ${def.credits.authors.join(', ')}${def.credits.aiAssisted ? ' (AI-assisted)' : ''} · ${def.credits.license}`;
}

function updateShowroom(dt: number) {
  const model = showroomModels[shipIndex];
  const dist = model.radius * 3.4;
  flyIn = Math.min(1, flyIn + dt * 0.7);
  const ease = 1 - Math.pow(1 - flyIn, 3);
  model.root.position.set(0, 0, -dist * 12 * (1 - ease));
  if (!spin.dragging) {
    spin.idle += dt;
    if (spin.idle > 1.5) spin.y += dt * 0.5;
  }
  model.root.rotation.set(spin.x, spin.y, 0);
  camera.position.set(0, model.radius * 0.35, dist);
  camera.lookAt(0, 0, 0);
  showroom.stars.position.copy(camera.position);
}

addEventListener('pointerdown', (e) => {
  if (state !== 'title' || (e.target as HTMLElement).closest('button')) return;
  spin.dragging = true;
  spin.lastX = e.clientX;
  spin.lastY = e.clientY;
});
addEventListener('pointermove', (e) => {
  if (!spin.dragging) return;
  spin.y += (e.clientX - spin.lastX) * 0.01;
  spin.x += (e.clientY - spin.lastY) * 0.01;
  spin.lastX = e.clientX;
  spin.lastY = e.clientY;
  spin.idle = 0;
});
addEventListener('pointerup', () => (spin.dragging = false));

// --- Title, new commander and docked screens --------------------------------

function showTitle() {
  inSpace = false;
  showShip(cobraIndex);
  const saved = loadCommander();
  const load = $<HTMLButtonElement>('#load-button');
  load.hidden = !saved;
  if (saved) load.textContent = `Y · Load ${saved.name} (${DIFFICULTIES[saved.difficulty].name})`;
  $('#new-button').classList.toggle('primary', !saved);
  setState('title');
}

/** Classic is the natural default for anyone playing in 1984 mode. */
const defaultDifficulty = (): Difficulty => (isRetro() ? 'classic' : 'modern');

function showNewGame() {
  const list = $('#rules');
  list.innerHTML = '';
  (['classic', 'modern'] as Difficulty[]).forEach((d, i) => {
    const b = document.createElement('button');
    const isDefault = d === defaultDifficulty();
    b.classList.toggle('primary', isDefault);
    b.innerHTML = `<b>${i + 1} · ${DIFFICULTIES[d].name}</b><small>${DIFFICULTIES[d].blurb}</small>${isDefault ? '<em>Default · Enter</em>' : ''}`;
    b.addEventListener('click', () => startCommander(d));
    list.append(b);
  });
  setState('newgame');
}

function startCommander(difficulty: Difficulty) {
  commander = newCommander(difficulty);
  saveCommander(commander);
  sfx.beep();
  enterDocked();
}

function enterDocked() {
  inSpace = false;
  player.repair();
  showShip(cobraIndex);
  renderDocked();
  setState('docked');
}

function renderDocked() {
  const c = cmdr();
  const rows: [string, string][] = [
    ['Commander', c.name],
    ['Rules', DIFFICULTIES[c.difficulty].name],
    ['Credits', `${c.credits.toLocaleString(undefined, { minimumFractionDigits: 1 })} Cr`],
    ['Ship', player.def.name],
    ['Cargo', `${cargoTonnes(c)} / ${player.def.stats.cargo} t`],
    ['Legal status', c.legal === 'fugitive' ? 'Fugitive' : c.legal === 'offender' ? 'Offender' : 'Clean'],
    ['Rating', 'Harmless'],
  ];
  $('#cmdr').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  const list = $('#equip');
  list.innerHTML = '';
  for (const item of EQUIPMENT) {
    if (item.classicOnly && c.difficulty !== 'classic') continue;
    if (item.modernOnly && c.difficulty !== 'modern') continue;
    const li = document.createElement('li');
    const owned = hasEquipment(c, item.id);
    li.innerHTML = `<span>${item.name}</span><small>${item.blurb}</small>`;
    const buy = document.createElement('button');
    buy.textContent = owned ? 'Fitted' : `Buy · ${item.price.toLocaleString()} Cr`;
    buy.disabled = owned || c.credits < item.price;
    buy.addEventListener('click', () => {
      c.credits -= item.price;
      c.equipment.push(item.id);
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    li.append(buy);
    list.append(li);
  }
}

// --- Space ------------------------------------------------------------------

const space = makeSpace();
const PLANET_POS = new THREE.Vector3(0, 0, 14000); // the slot faces the planet, as in the original
const PLANET_RADIUS = 5000;
const ATMOSPHERE = PLANET_RADIUS * ATMOSPHERE_SCALE;
const SUN_POS = new THREE.Vector3(-60000, 22000, -40000);
space.sun.position.copy(SUN_POS);

const station = new Station(shipById('coriolis')!);
space.scene.add(station.root);
const planet = buildPlanet(PLANET_RADIUS, '#4aa8ff');
planet.position.copy(PLANET_POS);
planet.rotation.z = 0.4;
space.scene.add(planet);
const sun = buildSun(4000);
sun.position.copy(SUN_POS);
space.scene.add(sun);
const dust = new SpaceDust();
space.scene.add(dust.group);

const player = new PlayerShip(shipById('cobra-mk3')!);
space.scene.add(player.obj);
const dockingComputer = new DockingComputer();
let autopilot = false;

// --- Police and combat ------------------------------------------------------

const police: NpcShip[] = [];
const engineSound = new EngineSound();
const voices = new Map<NpcShip, ShipVoice>();
const VOICE_RANGE = 3500; // hear other ships' engines within this distance
let tailWarningTimer = 0;
const beams = new Beams(space.scene);
let laserCooldown = 0;
let laserHeat = 0; // 0..100, the original's "LT" gauge
let overheated = false;
let reinforceTimer = 0;
let repopulateTimer = 0;
const MAX_POLICE = 4;

const isFugitive = () => commander?.legal === 'fugitive';

function spawnViper(fromSlot: boolean) {
  const i = police.length;
  const npc = new NpcShip(shipById('viper')!, POLICE_LASER, {
    centre: station.root.position.clone(),
    radius: 900 + (i % 3) * 450,
    height: [200, -250, 60][i % 3],
    rate: (i % 2 ? -1 : 1) * 0.14,
    angle: i * 2.1,
  });
  if (fromSlot) {
    station.placeForLaunch(npc.ship);
    npc.ship.speed = 120;
  } else {
    const p = npc.patrol;
    npc.obj.position.set(Math.cos(p.angle) * p.radius, p.height, Math.sin(p.angle) * p.radius).add(p.centre);
    npc.ship.speed = Math.abs(p.rate) * p.radius;
  }
  npc.hostile = isFugitive();
  space.scene.add(npc.obj);
  police.push(npc);
}
spawnViper(false);
spawnViper(false);

function becomeFugitive() {
  if (isFugitive()) return;
  cmdr().legal = 'fugitive';
  for (const p of police) p.hostile = true;
  reinforceTimer = 6;
  flash('You are now a FUGITIVE', 2.5);
}

function destroyNpc(npc: NpcShip) {
  const boom = new Explosion(npc.def, npc.obj, npc.ship.forward().multiplyScalar(npc.ship.speed));
  space.scene.add(boom.group);
  explosions.push(boom);
  boomAt(npc.obj.position, 2.2, 1600, 1.6);
  voices.get(npc)?.dispose();
  voices.delete(npc);
  police.splice(police.indexOf(npc), 1);
  npc.dispose();
  flash(`${npc.def.name} destroyed`, 1.5);
}

type Shot = { kind: 'npc'; npc: NpcShip } | { kind: 'drifter'; drifter: Drifter } | { kind: 'station' };

// Lasers fire straight ahead unless a gimballed mount is fitted, in which
// case (with mouse aim) they swivel to hit what's under the ring. The ring
// never strays more than 30° from the nose. Gimbals trade a little damage
// for that convenience.
const GIMBAL_DAMAGE = 0.8;

function gimballed() {
  return controlScheme() === 'mouse' && isMouseCaptured() && Boolean(commander) && hasEquipment(cmdr(), 'gimbal-mount');
}

function laserDirection() {
  return gimballed() ? aim.dir.clone() : player.forward();
}

function firePlayerLaser() {
  laserCooldown = PULSE_LASER.interval;
  laserHeat += PULSE_LASER.heat;
  if (laserHeat >= 100) {
    overheated = true;
    flash('Laser overheated', 1.2);
  }
  const dir = laserDirection();
  const origin = player.obj.position.clone().addScaledVector(dir, 5);
  const targets: Target<Shot>[] = [
    ...police.map((npc) => ({ value: { kind: 'npc' as const, npc }, position: npc.obj.position, radius: npc.radius * 0.75 })),
    ...drifters.map((drifter) => ({ value: { kind: 'drifter' as const, drifter }, position: drifter.model.root.position, radius: 7 })),
    { value: { kind: 'station' as const }, position: station.root.position, radius: 90 },
  ];
  const hit = rayHit(origin, dir, PULSE_LASER.range, targets);
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, PULSE_LASER.range);
  for (const side of [-1, 1]) beams.fire(player.obj.localToWorld(new THREE.Vector3(side * 7, -3, 12)), end, PULSE_LASER.color);
  sfx.laser();
  if (!hit) return;
  const shot = hit.target.value;
  if (shot.kind === 'npc') {
    sfx.hit();
    becomeFugitive();
    const damage = gimballed() ? PULSE_LASER.damage * GIMBAL_DAMAGE : PULSE_LASER.damage;
    if (shot.npc.hit(damage)) destroyNpc(shot.npc);
  } else if (shot.kind === 'drifter') {
    const d = shot.drifter;
    const flare = new Explosion(d.model.def, d.model.root, d.velocity);
    space.scene.add(flare.group);
    explosions.push(flare);
    disposeShip(d.model);
    drifters.splice(drifters.indexOf(d), 1);
  }
}

function updateCombat(dt: number, input: { fire: boolean } | null) {
  const alive = state === 'flying';
  beams.update(dt);

  if (alive && input) {
    laserCooldown -= dt;
    laserHeat = Math.max(0, laserHeat - PULSE_LASER.cooling * dt);
    if (overheated && laserHeat < 40) overheated = false;
    if (input.fire && !overheated && laserCooldown <= 0) firePlayerLaser();
  }

  for (const npc of [...police]) {
    const shot = npc.update(dt, player, alive);
    // Keep police from flying through the station.
    const fromStation = npc.obj.position.clone().sub(station.root.position);
    if (fromStation.length() < 120) npc.obj.position.copy(station.root.position).add(fromStation.setLength(120));

    if (shot && alive) {
      const origin = npc.obj.position.clone().addScaledVector(shot, 20);
      const hit = rayHit(origin, shot, npc.laser.range, [
        { value: 'player', position: player.obj.position, radius: 22 },
        { value: 'station', position: station.root.position, radius: 90 },
      ]);
      beams.fire(origin, hit ? hit.point : origin.clone().addScaledVector(shot, npc.laser.range), npc.laser.color);
      zapAt(origin, 700, 120, 0.15, 0.5);
      if (hit?.target.value === 'player') {
        sfx.hit();
        hitFeedback(0.35);
        showHitDirection(camera, npc.obj.position);
        if (player.damage(npc.laser.damage)) {
          die();
          return;
        }
      }
    }

    // Ramming hurts both ships.
    if (alive && npc.obj.position.distanceTo(player.obj.position) < npc.radius * 0.6 + 20) {
      const away = player.obj.position.clone().sub(npc.obj.position).setLength(npc.radius + 30);
      player.obj.position.copy(npc.obj.position).add(away);
      sfx.thud();
      hitFeedback(0.9);
      becomeFugitive();
      if (npc.hit(25)) destroyNpc(npc);
      if (player.damage(25)) {
        die();
        return;
      }
    }
  }

  // Engine sounds for nearby ships, positioned in 3D.
  for (const npc of police) {
    const near = alive && npc.obj.position.distanceTo(player.obj.position) < VOICE_RANGE;
    let voice = voices.get(npc);
    if (near && !voice) voices.set(npc, (voice = new ShipVoice(npc.obj.position)));
    if (!near && voice) {
      voice.dispose();
      voices.delete(npc);
    }
    voice?.update(npc.obj.position, npc.ship.speed / npc.ship.maxSpeed);
  }

  // A soft double beep when a hostile is close behind you.
  tailWarningTimer -= dt;
  if (alive && tailWarningTimer <= 0) {
    const fwd = player.forward();
    const onTail = police.find((npc) => {
      if (!npc.hostile) return false;
      const to = npc.obj.position.clone().sub(player.obj.position);
      return to.length() < 900 && fwd.angleTo(to) > THREE.MathUtils.degToRad(120);
    });
    if (onTail) {
      tailWarning(onTail.obj.position);
      tailWarningTimer = 1.2;
    }
  }

  // The station sends more police after a fugitive, and replaces patrols otherwise.
  const nearStation = player.obj.position.distanceTo(station.root.position) < 9000;
  if (alive && isFugitive() && nearStation) {
    reinforceTimer -= dt;
    if (reinforceTimer <= 0 && police.length < MAX_POLICE) {
      spawnViper(true);
      flash('Police launching', 1.5);
      reinforceTimer = 20;
    }
  } else if (!isFugitive() && police.length < 2) {
    repopulateTimer -= dt;
    if (repopulateTimer <= 0) {
      spawnViper(true);
      repopulateTimer = 30;
    }
  }
}

/**
 * Things adrift: cargo canisters spilled from wrecks. They tumble near where
 * they were lost for a while, then the planet slowly pulls them in and they
 * burn up in the atmosphere. That keeps space tidy without anything vanishing
 * out of thin air.
 */
interface Drifter {
  model: ShipModel;
  velocity: THREE.Vector3;
  axis: THREE.Vector3;
  spinRate: number;
  /** Seconds spent burning in the atmosphere; 0 until it gets there. */
  burn: number;
}
const drifters: Drifter[] = [];
const MAX_DRIFTERS = 40;
// Pull at the station's distance is about 0.05 m/s², so debris lingers for
// several minutes (a window for scavengers) before falling in.
// Simulated: canisters spilled near the station burn up after ~9 minutes (2.5–13).
const PLANET_GM = 0.05 * 14000 ** 2;
const DRIFT_DRAG = 0.05;
const BURN_TIME = 2.5; // seconds from first glow to break-up
const LOST_IN_SPACE = 40000; // drifters further than this from the planet are removed

function spillCargo(at: THREE.Vector3, velocity: THREE.Vector3, tonnes: number) {
  const def = shipById('cargo-canister');
  if (!def) return;
  // One canister per tonne, but don't fill the sky.
  for (let i = 0; i < Math.min(tonnes, 12); i++) {
    const model = buildShip(def);
    model.root.position.copy(at).add(new THREE.Vector3().randomDirection().multiplyScalar(10));
    model.root.quaternion.random();
    space.scene.add(model.root);
    drifters.push({
      model,
      velocity: velocity.clone().multiplyScalar(0.4).add(new THREE.Vector3().randomDirection().multiplyScalar(8 + Math.random() * 18)),
      axis: new THREE.Vector3().randomDirection(),
      spinRate: 0.3 + Math.random() * 1.2,
      burn: 0,
    });
  }
  while (drifters.length > MAX_DRIFTERS) disposeShip(drifters.shift()!.model);
}

function updateDrifters(dt: number) {
  const toPlanet = new THREE.Vector3();
  for (let i = drifters.length - 1; i >= 0; i--) {
    const d = drifters[i];
    const root = d.model.root;
    toPlanet.copy(PLANET_POS).sub(root.position);
    const r = toPlanet.length();
    toPlanet.normalize();
    d.velocity.addScaledVector(toPlanet, (PLANET_GM / (r * r)) * dt);
    // Sideways and outward drift slowly dies away; the fall itself doesn't.
    // Without this, wrecks at speed would fling canisters off into deep space.
    const falling = Math.max(0, d.velocity.dot(toPlanet));
    d.velocity.addScaledVector(toPlanet, -falling).multiplyScalar(Math.exp(-DRIFT_DRAG * dt)).addScaledVector(toPlanet, falling);

    if (r < ATMOSPHERE) {
      // Re-entry: air drag, faster tumbling, and the hull glows towards white-hot.
      d.burn += dt;
      d.velocity.multiplyScalar(Math.exp(-dt * 0.3));
      d.spinRate += dt * 3;
      heatShip(d.model, Math.min(1, d.burn / BURN_TIME));
    }
    root.position.addScaledVector(d.velocity, dt);
    root.rotateOnAxis(d.axis, d.spinRate * dt);

    if (d.burn >= BURN_TIME || r < PLANET_RADIUS) {
      const flare = new Explosion(d.model.def, root, d.velocity);
      space.scene.add(flare.group);
      explosions.push(flare);
    }
    if (d.burn >= BURN_TIME || r < PLANET_RADIUS || r > LOST_IN_SPACE) {
      disposeShip(d.model);
      drifters.splice(i, 1);
    }
  }
}

const explosions: Explosion[] = [];

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
let elapsed = 0;
let shake = 0;
let lastAltitudeWarning = -Infinity;
const deathCam = { centre: new THREE.Vector3(), offset: new THREE.Vector3(), axis: new THREE.Vector3(0, 1, 0), t: 0 };


// Modern rules: near the station and pointing roughly at the slot, the ship
// matches the station's spin by itself whenever the pilot isn't rolling.
// Classic rules leave it all to you, as in 1984.
const ROLL_ASSIST_RANGE = 2500; // metres
const ROLL_ASSIST_HEADING = THREE.MathUtils.degToRad(35);
const ROLL_ASSIST_GAIN = 3; // holds within ~3° of the slot (tested in simulation)
const AUTO_LEVEL_GAIN = 2.5; // levels 50° of tilt in about half a second (tested in simulation)
let rollAssist = false;

function rollAssistApplies() {
  return (
    player.obj.position.distanceTo(station.root.position) < ROLL_ASSIST_RANGE &&
    station.headingError(player) < ROLL_ASSIST_HEADING
  );
}

function setAutopilot(on: boolean, message?: string) {
  autopilot = on;
  if (on) {
    dockingComputer.reset();
    danube.start(!isRetro());
  } else {
    danube.stop();
  }
  if (message) flash(message, 2);
}

function hitFeedback(strength: number) {
  shake = Math.max(shake, strength);
  const el = $('#hit');
  el.classList.remove('on');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('on');
}

function updateSpace(dt: number) {
  elapsed += dt;
  station.update(dt);
  updateDrifters(dt);
  for (let i = explosions.length - 1; i >= 0; i--) if (!explosions[i].update(dt)) explosions.splice(i, 1);

  let input: ReturnType<typeof flightInput> | null = null;
  if (state === 'flying') {
    const prev = station.toLocal(player.obj.position);
    input = flightInput();
    if (autopilot && input.active) setAutopilot(false, 'Docking computer off');

    // Mouse aim: steer the nose towards the reticle. Turning with keys or
    // while the computer flies puts the reticle back on the nose.
    const keysTurning = input.pitch !== 0 || input.yaw !== 0;
    if (input.recentre) aim.reset(player);
    if (controlScheme() === 'mouse' && isMouseCaptured() && !autopilot && !keysTurning) {
      aim.move(player, input.aimDx, input.aimDy);
      const s = aim.steer(player);
      input.pitch = s.pitch;
      input.yaw = s.yaw;
    } else {
      aim.reset(player);
    }

    rollAssist = !autopilot && cmdr().difficulty === 'modern' && input.roll === 0 && rollAssistApplies();
    if (rollAssist) {
      input.roll = THREE.MathUtils.clamp(-ROLL_ASSIST_GAIN * station.rollError(player), -1, 1);
    } else if (!autopilot && controlScheme() === 'mouse' && input.roll === 0) {
      // Flight assist: with no roll input, level the wings with the star
      // system's "up" so there's always a horizon. Weaker when pointing
      // steeply up or down, where "level" stops meaning much.
      const steep = Math.abs(player.forward().y);
      input.roll = THREE.MathUtils.clamp(AUTO_LEVEL_GAIN * player.right().y * (1 - steep), -1, 1);
    }
    if (autopilot) dockingComputer.update(dt, player, station);
    else player.steer(dt, input);
    player.move(dt);
    player.recharge(dt);

    const altitude = player.obj.position.distanceTo(PLANET_POS) - PLANET_RADIUS;
    if (altitude < 0) {
      sfx.thud();
      die();
      return;
    }
    if (altitude < PLANET_RADIUS * 0.12 && elapsed - lastAltitudeWarning > 4) {
      lastAltitudeWarning = elapsed;
      sfx.beep();
      flash('Altitude warning', 1.5);
    }

    const contact = station.contact(player, prev);
    if (contact?.kind === 'docked') {
      void dock();
    } else if (contact) {
      if (contact.kind === 'scrape') sfx.scrape();
      else sfx.thud();
      if (cmdr().difficulty === 'classic' || player.damage(contact.damage)) {
        die();
      } else {
        hitFeedback(0.8);
        flash(contact.kind === 'scrape' ? 'Slot impact' : 'Hull impact', 1.2);
      }
    }
  }

  updateCombat(dt, input);

  if (state === 'dead') {
    // Watch the wreck from outside, slowly circling, as the original did.
    deathCam.t += dt;
    const orbit = deathCam.offset.clone().applyAxisAngle(deathCam.axis, deathCam.t * 0.25);
    camera.position.copy(deathCam.centre).add(orbit);
    camera.lookAt(deathCam.centre);
  } else {
    camera.position.copy(player.obj.position);
    camera.quaternion.copy(player.obj.quaternion).multiply(FLIP);
    if (shake > 0.01) {
      camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(shake * 2.5));
      shake *= Math.exp(-dt * 6);
    }
  }
  space.stars.position.copy(camera.position);
  camera.updateMatrixWorld();
  setListener(camera);
  dust.update(camera.position, state === 'flying' ? player.forward().multiplyScalar(player.speed) : new THREE.Vector3());

  const blips: Blip[] = [
    { position: station.root.position, color: '#ffb347', big: true },
    ...police.map((p) => ({ position: p.obj.position, color: p.hostile ? '#ff4d6d' : '#4aa8ff' })),
    ...drifters.map((d) => ({ position: d.model.root.position, color: '#ffd166' })),
  ];
  if (state === 'flying') {
    updateHud(player, station, blips, autopilot, rollAssist);
    updateAimDisplay();
    updateCombatHud();
    updateMarkers();
    const turn = Math.abs(player.pitchGauge) + Math.abs(player.yawGauge) + Math.abs(player.rollGauge) * 0.6;
    engineSound.update(player.speed / player.maxSpeed, Math.min(1, turn / 1.2));
  }
}

// --- Situational awareness markers ----------------------------------------------

function updateMarkers() {
  const km = (p: THREE.Vector3) => {
    const d = p.distanceTo(player.obj.position);
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  };
  const markers: Marker[] = police.map((npc) => ({
    position: npc.obj.position,
    color: npc.hostile ? '#ff4d6d' : '#4aa8ff',
    radius: npc.radius,
    label: npc.hostile || npc.obj.position.distanceTo(player.obj.position) < 1500 ? km(npc.obj.position) : undefined,
  }));
  markers.push({ position: station.root.position, color: '#ffb347', radius: station.model.radius, label: `Station ${km(station.root.position)}` });
  const view = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  updateIndicators(camera, view, markers);
}

// --- Combat HUD ------------------------------------------------------------------

const laserGauge = $('#g-laser');
const crosshair = $('.crosshair');
const targetInfo = $('#target-info');

function updateCombatHud() {
  laserGauge.style.setProperty('--v', String(laserHeat / 100));
  laserGauge.classList.toggle('hot', overheated || laserHeat > 75);
  // Name whatever is closest to where the guns point, if it's near enough.
  const fwd = laserDirection();
  // Whichever sight the lasers follow (ring if gimballed, centre cross if
  // fixed) turns red when a shot would hit.
  const onTarget = Boolean(
    rayHit(player.obj.position, fwd, PULSE_LASER.range, police.map((npc) => ({ value: npc, position: npc.obj.position, radius: npc.radius * 0.75 }))),
  );
  reticle.classList.toggle('on-target', onTarget && gimballed());
  crosshair.classList.toggle('on-target', onTarget && !gimballed());
  let best: NpcShip | null = null;
  let bestAngle = THREE.MathUtils.degToRad(6);
  for (const npc of police) {
    const to = npc.obj.position.clone().sub(player.obj.position);
    if (to.length() > 5000) continue;
    const a = fwd.angleTo(to);
    if (a < bestAngle) {
      best = npc;
      bestAngle = a;
    }
  }
  targetInfo.hidden = !best;
  if (best) {
    const hull = Math.max(0, (best.ship.shields + best.ship.hull) / (best.def.stats.shields + best.def.stats.hull));
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    targetInfo.textContent = `${best.def.name} · ${km} km · ${Math.round(hull * 100)}%${best.hostile ? ' · HOSTILE' : ''}`;
    targetInfo.classList.toggle('hostile', best.hostile);
  }
}

// --- Mouse aim display and controls help -------------------------------------

const aim = new MouseAim();
const reticle = $('#reticle');
const mousePrompt = $('#mouse-prompt');
let wasCaptured = false;

function updateAimDisplay() {
  const captured = isMouseCaptured();
  if (captured !== wasCaptured && controlScheme() === 'mouse') {
    flash(captured ? 'Mouse aim · Esc to release' : 'Mouse released · click to fly', 1.5);
  }
  wasCaptured = captured;
  mousePrompt.hidden = !wantsMouseCapture();
  reticle.hidden = !captured || controlScheme() !== 'mouse';
  if (reticle.hidden) return;
  // Project the aim direction onto whichever canvas is showing.
  const p = camera.position.clone().addScaledVector(aim.dir, 1000).project(camera);
  const rect = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  const x = rect.left + ((p.x + 1) / 2) * rect.width;
  const y = rect.top + ((1 - p.y) / 2) * rect.height;
  reticle.style.transform = `translate(${x}px, ${y}px)`;
}

const KEYS_HINT = {
  mouse: 'Mouse aim · Click fire · Right-click centre · W/S throttle · A/D roll · H controls · C docking computer',
  keyboard: 'W/S pitch · A/D roll · Space/Shift throttle · F fire · H controls · C docking computer',
};

function renderControlsCard() {
  const mouse = controlScheme() === 'mouse';
  $('#keys-hint').textContent = KEYS_HINT[controlScheme()];
  $('#controls-scheme').textContent = mouse ? 'Mouse + keyboard' : 'Keyboard only (classic)';
  $('#controls-list').innerHTML = (
    mouse
      ? [
          ['Click', 'Capture the mouse (Esc releases it)'],
          ['Mouse', 'Aim: the ship turns to follow the ring'],
          ['Left click / F', gimballed() || (commander && hasEquipment(cmdr(), 'gimbal-mount')) ? 'Fire: gimballed lasers hit what\'s under the ring' : 'Fire: lasers fire straight ahead at the centre cross'],
          ['Right click', 'Centre the aim (stop turning)'],
          ['W / S', 'Throttle up / down'],
          ['A / D', 'Roll'],
          ['Q / E', 'Yaw (fine sideways adjustment)'],
          ['Swipe / scroll', 'Throttle; sideways swipe rolls (Magic Mouse, trackpad)'],
        ]
      : [
          ['W / S', 'Dive / climb (I inverts)'],
          ['A / D', 'Roll'],
          ['Space / Shift', 'Throttle up / down'],
          ['F', 'Fire laser'],
          ['Swipe / scroll', 'Throttle; sideways swipe rolls'],
        ]
  )
    .concat([
      ['C', 'Docking computer'],
      ['K', 'Switch control scheme'],
      ['I', 'Invert pitch'],
      ['M', '1984 mode'],
      ['N', 'Sound on / off'],
      ['H', 'Show / hide this card'],
    ])
    .map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`)
    .join('');
}

function toggleControlsCard(show = $('#controls-card').hidden) {
  renderControlsCard();
  $('#controls-card').hidden = !show;
}

function showControlsCardOnce() {
  renderControlsCard();
  try {
    if (localStorage.getItem('witchspace.seenControls')) return;
    localStorage.setItem('witchspace.seenControls', '1');
  } catch {
    // Storage blocked: show it anyway.
  }
  toggleControlsCard(true);
}

async function launch() {
  setState('transition');
  if (!isRetro() && hasEquipment(cmdr(), 'docking-computer')) preloadRecording();
  sfx.tunnel();
  await playTunnel();
  inSpace = true;
  player.repair();
  station.placeForLaunch(player);
  aim.reset(player);
  player.speed = player.maxSpeed * 0.3;
  setState('flying');
  flash('Lave · Coriolis Station', 2.5);
}

async function dock() {
  setAutopilot(false);
  setState('transition');
  sfx.tunnel();
  await playTunnel();
  saveCommander(cmdr());
  enterDocked();
}

function die() {
  const c = cmdr();
  setAutopilot(false);
  setState('dead');
  sfx.explosion();
  hitFeedback(1.5);

  const velocity = player.forward().multiplyScalar(player.speed);
  const boom = new Explosion(player.def, player.obj, velocity);
  space.scene.add(boom.group);
  explosions.push(boom);
  // Whatever was in the hold is now floating free for anyone with fuel scoops.
  spillCargo(player.obj.position, velocity, cargoTonnes(c));
  c.cargo = {};
  // A new ship, a clean slate: the police lose interest.
  c.legal = 'clean';
  for (const p of police) p.hostile = false;
  laserHeat = 0;
  overheated = false;

  deathCam.centre.copy(player.obj.position).addScaledVector(velocity, 0.6);
  // Watch from the side away from the nearest big body, so it never blocks the view.
  const fromStation = deathCam.centre.distanceTo(station.root.position);
  const fromPlanet = deathCam.centre.distanceTo(PLANET_POS) - PLANET_RADIUS;
  const away = deathCam.centre.clone().sub(fromPlanet < fromStation ? PLANET_POS : station.root.position);
  if (away.lengthSq() < 1) away.copy(player.up());
  away.normalize();
  deathCam.axis.copy(away);
  deathCam.offset.copy(away).multiplyScalar(280).addScaledVector(new THREE.Vector3().randomDirection().cross(away).normalize(), 110);
  deathCam.t = 0;
  player.speed = 0;

  const classic = c.difficulty === 'classic';
  const pod = classic && hasEquipment(c, 'escape-pod');
  const gameOver = classic && !pod;
  setTimeout(() => flash(gameOver ? 'GAME OVER' : pod ? 'Escape pod launched' : 'Ship destroyed', 0), 1200);

  setTimeout(() => {
    clearFlash();
    if (gameOver) {
      deleteCommander();
      commander = null;
      showTitle();
      return;
    }
    if (pod) removeEquipment(c, 'escape-pod');
    saveCommander(c);
    enterDocked();
    flash(pod ? 'Picked up. Your insurers have replaced the ship.' : 'Insurance paid out. Fly safer, Commander.', 3.5);
  }, 5000);
}

// --- Input ------------------------------------------------------------------

function updateModeLabel() {
  $('#mode').textContent = isRetro() ? '1984 MODE' : 'NEO-VECTOR';
}

/** Gamepad buttons map onto the keyboard action for the current screen. */
function padToKey(button: 'PadA' | 'PadB' | 'PadY' | 'PadStart'): string | null {
  if (button === 'PadY') return 'KeyM';
  if (button === 'PadB') return state === 'newgame' ? 'Escape' : null;
  switch (state) {
    case 'title':
    case 'newgame':
      return 'Enter';
    case 'docked':
      return 'KeyL';
    case 'flying':
      return button === 'PadA' ? 'KeyC' : null;
    default:
      return null;
  }
}

function handleKey(code: string) {
  unlockAudio();
  if (code === 'KeyM') {
    setRetro(!isRetro());
    updateModeLabel();
    if (state === 'newgame') showNewGame(); // the default rules follow the mode
    return;
  }
  if (code === 'KeyN' && state !== 'title') {
    const muted = toggleMute();
    if (state === 'flying') flash(muted ? 'Sound off' : 'Sound on', 1.2);
    return;
  }
  switch (state) {
    case 'title':
      if (code === 'ArrowRight') showShip(shipIndex + 1);
      else if (code === 'ArrowLeft') showShip(shipIndex - 1);
      else if (code === 'KeyY' || code === 'Enter') {
        commander = loadCommander();
        if (commander) enterDocked();
        else showNewGame();
      } else if (code === 'KeyN') showNewGame();
      break;
    case 'newgame':
      if (code === 'Digit1') startCommander('classic');
      else if (code === 'Digit2') startCommander('modern');
      else if (code === 'Enter') startCommander(defaultDifficulty());
      else if (code === 'Escape') showTitle();
      break;
    case 'docked':
      if (code === 'KeyL' || code === 'Enter') void launch();
      break;
    case 'flying':
      if (code === 'KeyH') {
        toggleControlsCard();
      } else if (code === 'KeyK') {
        const s = toggleControlScheme();
        renderControlsCard();
        flash(s === 'mouse' ? 'Mouse + keyboard · click to aim' : 'Keyboard only (classic)', 2);
      } else if (code === 'KeyI') {
        flash(toggleInvertPitch() ? 'Pitch inverted' : 'Pitch normal', 2);
      } else if (code === 'KeyC') {
        if (autopilot) setAutopilot(false, 'Docking computer off');
        else if (!hasEquipment(cmdr(), 'docking-computer')) flash('Docking computer not fitted', 2);
        else if (player.obj.position.distanceTo(station.root.position) > 10000) flash('Too far from the station', 2);
        else setAutopilot(true, 'Docking computer on');
      }
      break;
  }
}

addEventListener('keydown', (e) => {
  if (!e.repeat) handleKey(e.code);
});
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) =>
  b.addEventListener('click', () => {
    b.blur(); // otherwise Space (throttle) would click it again
    handleKey(b.dataset.key!);
  }),
);

// --- Main loop --------------------------------------------------------------

const clock = new THREE.Clock();

function frame() {
  const dt = Math.min(clock.getDelta(), 0.1);
  for (const button of gamepadPresses()) {
    const code = padToKey(button);
    if (code) handleKey(code);
  }
  if (inSpace) {
    if (state !== 'transition') updateSpace(dt);
    render(space.scene);
  } else {
    updateShowroom(dt);
    render(showroom.scene);
  }
  requestAnimationFrame(frame);
}

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, {
    witchspace: {
      player, station, dockingComputer, drifters, explosions, spillCargo, police, becomeFugitive,
      get commander() { return commander; },
      get state() { return state; },
      get autopilot() { return autopilot; },
    },
  });
}

setRetro(false);
updateModeLabel();
showTitle();
frame();
