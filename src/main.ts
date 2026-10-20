import * as THREE from 'three';
import { cycleSoundMode, danube, preloadRecording, sfx, unlockAudio } from './audio/sound';
import { boomAt, EngineSound, setListener, ShipVoice, tailWarning, zapAt } from './audio/spatial';
import { shipById, ships } from './content/ships';
import {
  cargoTonnes,
  DIFFICULTIES,
  deleteCommander,
  EQUIPMENT,
  FUEL_CAPACITY,
  FUEL_PRICE,
  hasEquipment,
  isWorking,
  loadCommander,
  REPAIR_FRACTION,
  rollEquipmentDamage,
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
  setFlightInputSuppressed,
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
import { ATMOSPHERE_SCALE, buildPlanet, buildSun, disposePlanet } from './render/bodies';
import { SpaceDust } from './render/dust';
import { Explosion } from './render/explosion';
import { camera, isRetro, makeSpace, render, setRetro } from './render/renderer';
import { buildShip, disposeShip, heatShip, type ShipModel } from './render/shipModel';
import { buildHangar } from './render/hangar';
import { clearFlash, flash, updateHud, type Blip } from './ui/hud';
import { clearIndicators, showHitDirection, updateIndicators, type Marker } from './ui/indicators';
import { closeMap, chooseCursor, isMapOpen, moveCursor, openMap, toggleMapMode } from './ui/galaxyMap';
import { distanceLy, ECONOMIES, GOVERNMENTS, systemAt, type StarSystem } from './galaxy/generate';
import { commodityById, UNITS_PER_TONNE } from './economy/commodities';
import { buy, freeTonnes, maxBuyable, quotes, sell, type TradeContext } from './economy/trade';
import { fadeFromWhite, playTunnel } from './ui/tunnel';
import './style.css';

type State = 'title' | 'newgame' | 'docked' | 'flying' | 'transition' | 'dead';
let state: State = 'title';
let inSpace = false;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function setState(next: State) {
  if (next !== 'flying') {
    countdown = null; // leaving flight cancels a hyperspace countdown
    // Overlays that only make sense in flight; they're updated each frame while flying.
    for (const id of ['#mouse-prompt', '#reticle', '#target-info', '#countdown']) $(id).hidden = true;
  }
  if (isMapOpen()) {
    closeMap();
    setFlightInputSuppressed(false);
  }
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
let zoom = 1; // showroom zoom: >1 is closer
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;

function showShip(index: number) {
  shipIndex = (index + showroomModels.length) % showroomModels.length;
  showroomModels.forEach((m, i) => (m.root.visible = i === shipIndex));
  flyIn = 0;
  resetShowroomView();
  updateShipPanel();
}

function resetShowroomView() {
  spin.x = 0.25;
  spin.y = 0;
  spin.idle = 0;
  zoom = 1;
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

// When docked, the ship sits in a berth and the camera walks around it.
const hangar = buildHangar();
hangar.visible = false;
showroom.scene.add(hangar);

function updateBerth(dt: number, model: ShipModel) {
  hangar.visible = true;
  showroom.stars.visible = false;
  // Rest the ship on the pad: its lowest point at floor level.
  const lowest = Math.min(...model.def.geometry.vertices.map((v) => v[1]));
  model.root.position.set(0, -lowest + 1, 0);
  model.root.rotation.set(0, 0.5, 0);
  if (!spin.dragging) {
    spin.idle += dt;
    if (spin.idle > 1.5) spin.y += dt * 0.12; // a slow walk around the ship
  }
  const dist = (model.radius * 3.2) / zoom;
  const elevation = THREE.MathUtils.clamp(0.28 + spin.x * 0.5, 0.05, 1.1);
  const centre = new THREE.Vector3(0, -lowest * 0.6 + 4, 0);
  camera.position.set(
    Math.sin(spin.y) * Math.cos(elevation) * dist,
    centre.y + Math.sin(elevation) * dist,
    Math.cos(spin.y) * Math.cos(elevation) * dist,
  );
  camera.lookAt(centre);
}

function updateShowroom(dt: number) {
  const model = showroomModels[shipIndex];
  if (state === 'docked') {
    updateBerth(dt, model);
    return;
  }
  hangar.visible = false;
  showroom.stars.visible = true;
  const dist = (model.radius * 3.4) / zoom;
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

// Inspect the ship on the title and docked screens: drag to rotate, scroll
// (or swipe on a Magic Mouse or trackpad) to zoom, double-click to reset.
const inShowroom = () => state === 'title' || state === 'docked' || state === 'newgame';
const onControl = (e: Event) => Boolean((e.target as HTMLElement).closest('button, a, input, #galaxy-map, #controls-card'));

addEventListener('pointerdown', (e) => {
  if (!inShowroom() || onControl(e)) return;
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
addEventListener(
  'wheel',
  (e) => {
    if (!inShowroom() || onControl(e)) return;
    const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1;
    zoom = THREE.MathUtils.clamp(zoom * Math.exp(-e.deltaY * scale * 0.0015), ZOOM_MIN, ZOOM_MAX);
    spin.idle = 0;
    e.preventDefault();
  },
  { passive: false },
);
addEventListener('dblclick', (e) => {
  if (inShowroom() && !onControl(e)) resetShowroomView();
});

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
  ensureSystemScene();
  inSpace = false;
  player.repair();
  showShip(cobraIndex);
  renderDocked();
  setState('docked');
}

// --- Docked tabs and the market ---------------------------------------------------

type DockTab = 'station' | 'market';
let dockTab: DockTab = 'station';

function setDockTab(tab: DockTab) {
  dockTab = tab;
  document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#tab-station').hidden = tab !== 'station';
  $('#tab-market').hidden = tab !== 'market';
  $('.panel.docked').classList.toggle('wide', tab === 'market');
  if (tab === 'market') renderMarket();
}
document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    b.blur();
    setDockTab(b.dataset.tab as DockTab);
  }),
);

function tradeContext(): TradeContext {
  return { commander: cmdr(), system: currentSystem(), capacity: player.def.stats.cargo, now: Date.now() };
}

function renderMarket(message = '') {
  const ctx = tradeContext();
  const c = ctx.commander;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $('#market-summary').innerHTML =
    `Credits <b>${fmt(c.credits)} Cr</b> · Hold <b>${fmt(ctx.capacity - freeTonnes(ctx))} / ${ctx.capacity} t</b>` +
    (c.difficulty === 'classic' ? ' · 1984 prices' : '');
  const rows = quotes(ctx)
    .map((q) => {
      const id = q.commodity.id;
      const held = c.cargo[id] ?? 0;
      const canBuy = maxBuyable(ctx, id);
      const illegal = q.commodity.legality === 'illegal' ? '<span class="illegal">Illegal</span>' : '';
      return `<tr class="${held ? 'held' : ''}">
        <td>${q.commodity.name}${illegal}</td>
        <td class="num">${fmt(q.price)} Cr/${q.commodity.unit}</td>
        <td class="num">${q.stock}${q.commodity.unit === 't' ? 't' : q.commodity.unit}</td>
        <td class="num">${held || '-'}</td>
        <td class="actions">
          <button data-buy="${id}" data-qty="1" ${canBuy >= 1 ? '' : 'disabled'} title="Buy one">+1</button>
          <button data-buy="${id}" data-qty="${canBuy}" ${canBuy >= 1 ? '' : 'disabled'} title="Buy as much as you can">Max</button>
          <button data-sell="${id}" data-qty="1" ${held >= 1 ? '' : 'disabled'} title="Sell one">-1</button>
          <button data-sell="${id}" data-qty="${held}" ${held >= 1 ? '' : 'disabled'} title="Sell all">All</button>
        </td>
      </tr>`;
    })
    .join('');
  $('#market-table').innerHTML = `<thead><tr><th>Goods</th><th>Price</th><th>Stock</th><th>Hold</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  $('#market-message').textContent = message;
}

$('#market-table').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || b.disabled) return;
  b.blur();
  const ctx = tradeContext();
  const qty = Number(b.dataset.qty);
  const result = b.dataset.buy ? buy(ctx, b.dataset.buy, qty) : sell(ctx, b.dataset.sell!, qty);
  if (result.ok) {
    saveCommander(ctx.commander);
    sfx.beep();
  }
  renderMarket(result.message);
});

function renderDocked() {
  const c = cmdr();
  const here = currentSystem();
  $('#dock-location').textContent = `Coriolis Station · ${here.name}`;
  if (dockTab === 'market') renderMarket();
  const rows: [string, string][] = [
    ['Commander', c.name],
    ['Rules', DIFFICULTIES[c.difficulty].name],
    ['Credits', `${c.credits.toLocaleString(undefined, { minimumFractionDigits: 1 })} Cr`],
    ['Ship', player.def.name],
    ['Cargo', `${+cargoTonnes(c).toFixed(1)} / ${player.def.stats.cargo} t`],
    ['Legal status', c.legal === 'fugitive' ? 'Fugitive' : c.legal === 'offender' ? 'Offender' : 'Clean'],
    ['Destination', c.target === null ? 'None (press G)' : systemAt(here.galaxy, c.target).name],
    ['Rating', 'Harmless'],
  ];
  $('#cmdr').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');

  // Fuel: top up to a full tank at the station.
  const missing = Math.round((FUEL_CAPACITY - c.fuel) * 10) / 10;
  const fuelCost = Math.round(missing * FUEL_PRICE * 10) / 10;
  const affordable = Math.min(missing, Math.floor((c.credits / FUEL_PRICE) * 10) / 10);
  $('#fuel').innerHTML = `<span>Fuel <b>${c.fuel.toFixed(1)} / ${FUEL_CAPACITY} LY</b></span>`;
  const refuel = document.createElement('button');
  refuel.textContent = missing <= 0 ? 'Full' : affordable < missing ? `Refuel ${affordable.toFixed(1)} LY · ${(affordable * FUEL_PRICE).toFixed(1)} Cr` : `Refuel · ${fuelCost.toFixed(1)} Cr`;
  refuel.disabled = missing <= 0 || affordable <= 0;
  refuel.addEventListener('click', () => {
    c.credits = Math.round((c.credits - affordable * FUEL_PRICE) * 10) / 10;
    c.fuel = Math.round((c.fuel + affordable) * 10) / 10;
    saveCommander(c);
    sfx.beep();
    renderDocked();
  });
  $('#fuel').append(refuel);

  const list = $('#equip');
  list.innerHTML = '';
  for (const item of EQUIPMENT) {
    if (item.classicOnly && c.difficulty !== 'classic') continue;
    if (item.modernOnly && c.difficulty !== 'modern') continue;
    const li = document.createElement('li');
    const owned = hasEquipment(c, item.id);
    const damaged = c.damaged.includes(item.id);
    const repairCost = Math.round(item.price * REPAIR_FRACTION);
    li.innerHTML = `<span>${item.name}${damaged ? ' <em class="damaged">Damaged</em>' : ''}</span><small>${item.blurb}</small>`;
    const buy = document.createElement('button');
    if (damaged) {
      buy.textContent = `Repair · ${repairCost.toLocaleString()} Cr`;
      buy.disabled = c.credits < repairCost;
    } else {
      buy.textContent = owned ? 'Fitted' : `Buy · ${item.price.toLocaleString()} Cr`;
      buy.disabled = owned || c.credits < item.price;
    }
    buy.addEventListener('click', () => {
      if (damaged) {
        c.credits -= repairCost;
        c.damaged = c.damaged.filter((id) => id !== item.id);
      } else {
        c.credits -= item.price;
        c.equipment.push(item.id);
      }
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
// The station sits at the origin with its slot facing the planet, as in the
// original. Everything else about the system is rebuilt on arrival.
const planetPos = new THREE.Vector3(0, 0, 14000);
let planetRadius = 5000;
let atmosphere = planetRadius * ATMOSPHERE_SCALE;
let planetGM = 0.05 * 14000 ** 2; // debris pull; see updateDrifters
let planet: THREE.Group | null = null;
const SUN_POS = new THREE.Vector3(-60000, 22000, -40000);
space.sun.position.copy(SUN_POS);

const station = new Station(shipById('coriolis')!);
space.scene.add(station.root);
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
const VOICE_RANGE = 2000; // hear other ships' engines within this distance
let tailWarningTimer = 0;
const beams = new Beams(space.scene);
let laserCooldown = 0;
let laserHeat = 0; // 0..100, the original's "LT" gauge
let overheated = false;
let reinforceTimer = 0;
let stationFlash = 0; // seconds of white-hot glow after being hit
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
// --- Building a star system -------------------------------------------------------

/** Planet line colour by economy: industrial worlds violet, farm worlds blue-green. */
function planetColour(sys: StarSystem): string {
  return new THREE.Color().setHSL((270 - sys.economy * 17) / 360, 0.75, 0.62).getStyle();
}

/** Police patrols by government: none in anarchies, most in democracies and corporate states. */
const PATROLS_BY_GOVERNMENT = [0, 1, 1, 2, 2, 2, 3, 3];

let builtSystem: StarSystem | null = null;

/** Rebuild the planet, police and debris for a star system. */
function buildSystemScene(sys: StarSystem) {
  builtSystem = sys;
  if (planet) disposePlanet(planet);
  planetRadius = sys.radius * 1.2;
  atmosphere = planetRadius * ATMOSPHERE_SCALE;
  planetPos.set(0, 0, planetRadius + 9000);
  planetGM = 0.05 * planetPos.z ** 2;
  planet = buildPlanet(planetRadius, planetColour(sys));
  planet.position.copy(planetPos);
  planet.rotation.set(((sys.extraSeed[0] / 255) - 0.5) * 0.8, sys.extraSeed[1] / 40, ((sys.extraSeed[2] / 255) - 0.5) * 0.8);
  space.scene.add(planet);
  // The sun sits somewhere different in each system.
  const a = (sys.extraSeed[3] / 255) * Math.PI * 2;
  SUN_POS.set(Math.cos(a) * 70000, 20000 + sys.extraSeed[1] * 40, Math.sin(a) * 70000 - 30000);
  sun.position.copy(SUN_POS);
  space.sun.position.copy(SUN_POS);

  for (const npc of police) npc.dispose();
  police.length = 0;
  for (const d of drifters) disposeShip(d.model);
  drifters.length = 0;
  for (const e of explosions) e.dispose();
  explosions.length = 0;
  for (let i = 0; i < PATROLS_BY_GOVERNMENT[sys.government]; i++) spawnViper(false);
  reinforceTimer = repopulateTimer = 0;
}

/** Make sure the scene matches where the commander is. */
function ensureSystemScene() {
  const here = currentSystem();
  if (builtSystem !== here) buildSystemScene(here);
}

/**
 * Damage the player's ship. Shields soak hits first; once a hit reaches the
 * hull it may take out fitted equipment. Returns true if the ship is destroyed.
 */
function damagePlayer(amount: number): boolean {
  const hullBefore = player.hull;
  const destroyed = player.damage(amount);
  if (!destroyed && player.hull < hullBefore && commander) {
    const hit = rollEquipmentDamage(cmdr());
    if (hit) {
      sfx.scrape();
      flash(cmdr().difficulty === 'classic' ? `${hit.name} destroyed!` : `${hit.name} damaged · repair at a station`, 2.5);
      if (hit.id === 'docking-computer' && autopilot) setAutopilot(false);
    }
  }
  return destroyed;
}

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
  return controlScheme() === 'mouse' && isMouseCaptured() && Boolean(commander) && isWorking(cmdr(), 'gimbal-mount');
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
  } else if (shot.kind === 'station') {
    // Coriolis stations shrug off lasers, but firing on one is a serious
    // crime: you're a Fugitive at once and the police launch immediately.
    stationFlash = 0.25;
    sfx.hit();
    if (!isFugitive()) {
      becomeFugitive();
      flash('Station under attack · Police launching', 2.5);
    }
    if (police.length < MAX_POLICE && reinforceTimer > 1) reinforceTimer = 0.5;
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
        if (damagePlayer(npc.laser.damage)) {
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
      if (damagePlayer(25)) {
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
      tailWarningTimer = 2.5;
    }
  }

  // The station sends more police after a fugitive, and replaces patrols otherwise.
  const nearStation = player.obj.position.distanceTo(station.root.position) < 9000;
  if (alive && isFugitive() && nearStation && currentSystem().government > 0) {
    reinforceTimer -= dt;
    if (reinforceTimer <= 0 && police.length < MAX_POLICE) {
      spawnViper(true);
      flash('Police launching', 1.5);
      reinforceTimer = 20;
    }
  } else if (!isFugitive() && police.length < PATROLS_BY_GOVERNMENT[currentSystem().government]) {
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
  /** What's inside, for whoever scoops it up. */
  contents: { id: string; qty: number } | null;
}
const drifters: Drifter[] = [];
const MAX_DRIFTERS = 40;
// Pull at the station's distance is about 0.05 m/s², so debris lingers for
// several minutes (a window for scavengers) before falling in.
// Simulated: canisters spilled near the station burn up after ~9 minutes
// (2.5–13). The pull scales with each system's station-to-planet distance.
const DRIFT_DRAG = 0.05;
const BURN_TIME = 2.5; // seconds from first glow to break-up
const LOST_IN_SPACE = 40000; // drifters further than this from the planet are removed

/** Pack a cargo manifest into canisters: one per tonne, precious goods together. */
function packCanisters(cargo: Record<string, number>): { id: string; qty: number }[] {
  const out: { id: string; qty: number }[] = [];
  for (const [id, qty] of Object.entries(cargo)) {
    if (qty <= 0) continue;
    const perCanister = UNITS_PER_TONNE[commodityById(id)?.unit ?? 't'];
    for (let left = qty; left > 0; left -= perCanister) out.push({ id, qty: Math.min(perCanister, left) });
  }
  return out;
}

function spillCargo(at: THREE.Vector3, velocity: THREE.Vector3, cargo: Record<string, number> | number) {
  const def = shipById('cargo-canister');
  if (!def) return;
  const loads = typeof cargo === 'number' ? Array.from({ length: cargo }, () => null) : packCanisters(cargo);
  // Don't fill the sky: at most a dozen canisters from one wreck.
  for (const contents of loads.slice(0, 12)) {
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
      contents,
    });
  }
  while (drifters.length > MAX_DRIFTERS) disposeShip(drifters.shift()!.model);
}

function updateDrifters(dt: number) {
  const toPlanet = new THREE.Vector3();
  for (let i = drifters.length - 1; i >= 0; i--) {
    const d = drifters[i];
    const root = d.model.root;
    toPlanet.copy(planetPos).sub(root.position);
    const r = toPlanet.length();
    toPlanet.normalize();
    d.velocity.addScaledVector(toPlanet, (planetGM / (r * r)) * dt);
    // Sideways and outward drift slowly dies away; the fall itself doesn't.
    // Without this, wrecks at speed would fling canisters off into deep space.
    const falling = Math.max(0, d.velocity.dot(toPlanet));
    d.velocity.addScaledVector(toPlanet, -falling).multiplyScalar(Math.exp(-DRIFT_DRAG * dt)).addScaledVector(toPlanet, falling);

    if (r < atmosphere) {
      // Re-entry: air drag, faster tumbling, and the hull glows towards white-hot.
      d.burn += dt;
      d.velocity.multiplyScalar(Math.exp(-dt * 0.3));
      d.spinRate += dt * 3;
      heatShip(d.model, Math.min(1, d.burn / BURN_TIME));
    }
    root.position.addScaledVector(d.velocity, dt);
    root.rotateOnAxis(d.axis, d.spinRate * dt);

    if (d.burn >= BURN_TIME || r < planetRadius) {
      const flare = new Explosion(d.model.def, root, d.velocity);
      space.scene.add(flare.group);
      explosions.push(flare);
    }
    if (d.burn >= BURN_TIME || r < planetRadius || r > LOST_IN_SPACE) {
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

    const altitude = player.obj.position.distanceTo(planetPos) - planetRadius;
    if (altitude < 0) {
      sfx.thud();
      die();
      return;
    }
    if (altitude < planetRadius * 0.12 && elapsed - lastAltitudeWarning > 4) {
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
      if (cmdr().difficulty === 'classic' || damagePlayer(contact.damage)) {
        die();
      } else {
        hitFeedback(0.8);
        flash(contact.kind === 'scrape' ? 'Slot impact' : 'Hull impact', 1.2);
      }
    }
  }

  updateCombat(dt, input);
  if (stationFlash > 0) {
    stationFlash = Math.max(0, stationFlash - dt);
    heatShip(station.model, stationFlash / 0.25);
  }

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
    updateTravel(dt);
    updateMarkers();
    const turn = Math.abs(player.pitchGauge) + Math.abs(player.yawGauge) + Math.abs(player.rollGauge) * 0.6;
    engineSound.update(player.speed / player.maxSpeed, Math.min(1, turn / 1.2), dt);
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
  mouse: 'Mouse aim · Click fire · W/S throttle · A/D roll · G galaxy map · H hyperspace · J jump · C docking computer · F1 controls',
  keyboard: 'W/S pitch · A/D roll · Space/Shift throttle · F fire · G galaxy map · H hyperspace · J jump · C docking computer · F1 controls',
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
          ['Left click / F', gimballed() || (commander && isWorking(cmdr(), 'gimbal-mount')) ? 'Fire: gimballed lasers hit what\'s under the ring' : 'Fire: lasers fire straight ahead at the centre cross'],
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
      ['H', 'Hyperspace to your destination (10 s countdown; H again cancels)'],
      ['J', 'In-system jump: leap ~10 km ahead (not near ships, the station or the planet)'],
      ['G', 'Galaxy map (Tab: local chart, arrows + Enter: choose destination)'],
      ['K', 'Switch control scheme'],
      ['I', 'Invert pitch'],
      ['M', '1984 mode'],
      ['N', 'Sound: full / effects only / off'],
      ['F1', 'Show / hide this card'],
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
  ensureSystemScene();
  setState('transition');
  if (!isRetro() && isWorking(cmdr(), 'docking-computer')) preloadRecording();
  sfx.tunnel();
  await playTunnel();
  inSpace = true;
  player.repair();
  station.placeForLaunch(player);
  aim.reset(player);
  player.speed = player.maxSpeed * 0.3;
  setState('flying');
  flash(`${currentSystem().name} · Coriolis Station`, 2.5);
}

async function dock() {
  setAutopilot(false);
  setState('transition');
  sfx.tunnel();
  await playTunnel();
  cmdr().visits += 1; // Classic markets change with each visit
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
  spillCargo(player.obj.position, velocity, c.cargo);
  c.cargo = {};
  // A new ship, a clean slate: the police lose interest.
  c.legal = 'clean';
  for (const p of police) p.hostile = false;
  laserHeat = 0;
  overheated = false;

  deathCam.centre.copy(player.obj.position).addScaledVector(velocity, 0.6);
  // Watch from the side away from the nearest big body, so it never blocks the view.
  const fromStation = deathCam.centre.distanceTo(station.root.position);
  const fromPlanet = deathCam.centre.distanceTo(planetPos) - planetRadius;
  const away = deathCam.centre.clone().sub(fromPlanet < fromStation ? planetPos : station.root.position);
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
    c.damaged = []; // the insurers' replacement ship comes with everything working
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

// --- Witchspace travel: fuel, hyperspace and the in-system jump --------------------

const HYPERSPACE_COUNTDOWN = 10; // seconds
const MASS_LOCK_SHIPS = 2500; // metres: hostile ships this close stop a hyperspace jump
const J_DISTANCE = 10000; // metres per in-system jump
const J_LOCK_SHIPS = 3000;
const J_LOCK_STATION = 4000;
const J_LOCK_PLANET = 3000; // above the surface

let countdown: number | null = null;
let lastTick = 0;
let jumpCooldown = 0;

function destination(): StarSystem | null {
  const c = cmdr();
  return c.target === null ? null : systemAt(currentSystem().galaxy, c.target);
}

function toggleHyperspace() {
  if (countdown !== null) {
    countdown = null;
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
  const near = police.some((p) => p.hostile && p.obj.position.distanceTo(player.obj.position) < MASS_LOCK_SHIPS);
  if (near) {
    flash('Mass locked · hostile ships too close', 2);
    return;
  }
  countdown = HYPERSPACE_COUNTDOWN;
  lastTick = Math.ceil(countdown);
  flash(`Hyperspace to ${dest.name} · ${d.toFixed(1)} LY`, 2);
}

function updateTravel(dt: number) {
  jumpCooldown = Math.max(0, jumpCooldown - dt);
  $('#g-fuel').style.setProperty('--v', String(cmdr().fuel / FUEL_CAPACITY));
  const el = $('#countdown');
  if (countdown === null) {
    el.hidden = true;
    return;
  }
  countdown -= dt;
  const shown = Math.max(0, Math.ceil(countdown));
  el.hidden = false;
  el.textContent = String(shown);
  if (shown < lastTick) {
    lastTick = shown;
    sfx.tick();
  }
  if (countdown <= 0) {
    countdown = null;
    el.hidden = true;
    void hyperspace();
  }
}

async function hyperspace() {
  const c = cmdr();
  const dest = destination();
  if (!dest) return;
  const from = currentSystem();
  setAutopilot(false);
  setState('transition');
  sfx.hyperspace();
  await playTunnel(3.2, 'hyperspace');

  c.fuel = Math.max(0, Math.round((c.fuel - distanceLy(from, dest)) * 10) / 10);
  c.location = { galaxy: dest.galaxy, system: dest.index };
  c.target = null;
  // Records stay in the system where the crime happened (the law arrives in stage 4).
  c.legal = 'clean';
  saveCommander(c);
  buildSystemScene(dest);

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
  setState('flying');
  fadeFromWhite();
  flash(`${dest.name} · ${GOVERNMENTS[dest.government]} · ${ECONOMIES[dest.economy]}`, 4);
}

/** The original's J key: leap ahead when nothing is near enough to mass-lock you. */
function inSystemJump() {
  if (jumpCooldown > 0) return;
  const pos = player.obj.position;
  const shipsNear = police.some((p) => p.obj.position.distanceTo(pos) < J_LOCK_SHIPS);
  const stationNear = pos.distanceTo(station.root.position) < J_LOCK_STATION;
  const planetNear = pos.distanceTo(planetPos) - planetRadius < J_LOCK_PLANET;
  if (shipsNear || stationNear || planetNear) {
    flash(`Mass locked · ${shipsNear ? 'ships' : stationNear ? 'station' : 'planet'} too close`, 1.5);
    return;
  }
  // Leap forward, but stop short of the station or the planet if they're ahead.
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
  limit(planetPos, planetRadius + J_LOCK_PLANET - 200);
  if (dist < 500) {
    flash('Mass locked · too close ahead', 1.5);
    return;
  }
  pos.addScaledVector(fwd, dist);
  jumpCooldown = 1.2;
  sfx.jump();
  hitFeedback(0.15);
  flash('Jump', 0.6);
}

// --- Where you are, and the galaxy charts ---------------------------------------


function currentSystem(): StarSystem {
  const loc = commander?.location ?? { galaxy: 0, system: 7 };
  return systemAt(loc.galaxy, loc.system);
}

function toggleGalaxyMap() {
  if (isMapOpen()) {
    closeMap();
    setFlightInputSuppressed(false);
    return;
  }
  const c = cmdr();
  const here = currentSystem();
  openMap({
    current: here,
    range: c.fuel,
    target: c.target === null ? null : systemAt(here.galaxy, c.target),
    onTarget: (s) => {
      c.target = s.index;
      saveCommander(c);
      sfx.beep();
      if (state === 'docked') renderDocked();
      else flash(`Destination: ${s.name}`, 1.5);
    },
  });
  setFlightInputSuppressed(true);
}

/** Keys while a chart is open. Returns true if the key was used. */
function handleMapKey(code: string): boolean {
  if (!isMapOpen()) return false;
  if (code === 'KeyG' || code === 'Escape') toggleGalaxyMap();
  else if (code === 'Tab') toggleMapMode();
  else if (code === 'ArrowLeft') moveCursor(-1, 0);
  else if (code === 'ArrowRight') moveCursor(1, 0);
  else if (code === 'ArrowUp') moveCursor(0, -1);
  else if (code === 'ArrowDown') moveCursor(0, 1);
  else if (code === 'Enter' || code === 'NumpadEnter') chooseCursor();
  else return false;
  return true;
}

function handleKey(code: string) {
  unlockAudio();
  if (handleMapKey(code)) return;
  if (code === 'KeyG' && (state === 'docked' || state === 'flying') && commander) {
    toggleGalaxyMap();
    return;
  }
  if (code === 'KeyM') {
    setRetro(!isRetro());
    updateModeLabel();
    if (state === 'newgame') showNewGame(); // the default rules follow the mode
    return;
  }
  if (code === 'KeyN' && state !== 'title') {
    const mode = cycleSoundMode();
    flash(mode === 'full' ? 'Sound: full' : mode === 'effects' ? 'Sound: effects only (no engine hum)' : 'Sound: off', 1.6);
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
      else if (code === 'KeyT') setDockTab(dockTab === 'market' ? 'station' : 'market');
      break;
    case 'flying':
      if (code === 'F1') {
        toggleControlsCard();
      } else if (code === 'KeyH') {
        toggleHyperspace();
      } else if (code === 'KeyJ') {
        inSystemJump();
      } else if (code === 'KeyK') {
        const s = toggleControlScheme();
        renderControlsCard();
        flash(s === 'mouse' ? 'Mouse + keyboard · click to aim' : 'Keyboard only (classic)', 2);
      } else if (code === 'KeyI') {
        flash(toggleInvertPitch() ? 'Pitch inverted' : 'Pitch normal', 2);
      } else if (code === 'KeyC') {
        if (autopilot) setAutopilot(false, 'Docking computer off');
        else if (!hasEquipment(cmdr(), 'docking-computer')) flash('Docking computer not fitted', 2);
        else if (!isWorking(cmdr(), 'docking-computer')) flash('Docking computer damaged · repair at a station', 2);
        else if (player.obj.position.distanceTo(station.root.position) > 10000) flash('Too far from the station', 2);
        else setAutopilot(true, 'Docking computer on');
      }
      break;
  }
}

addEventListener('keydown', (e) => {
  if (e.code === 'Tab' && isMapOpen()) e.preventDefault(); // Tab switches charts, not focus
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
      player, station, dockingComputer, drifters, explosions, spillCargo, police, becomeFugitive, damagePlayer,
      get commander() { return commander; },
      get state() { return state; },
      get autopilot() { return autopilot; },
    },
  });
}

setRetro(false);
updateModeLabel();
setDockTab('station');
showTitle();
frame();
