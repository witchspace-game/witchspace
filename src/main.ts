import * as THREE from 'three';
import { SurveyPilot, type SurveyGoal } from './game/surveyPilot';
import { cycleSoundMode, danube, preloadRecording, sfx, unlockAudio } from './audio/sound';
import { boomAt, EngineSound, rocketAt, setListener, ShipVoice, tailWarning, zapAt } from './audio/spatial';
import { shipById, ships } from './content/ships';
import type { ShipDef } from './content/types';
import {
  cargoCapacity,
  cargoTonnes,
  DIFFICULTIES,
  deleteCommander,
  EQUIPMENT,
  FUEL_PRICE,
  fuelCapacity,
  MISSILE_PRICE,
  hasEquipment,
  isWorking,
  loadCommander,
  markStolen,
  REPAIR_FRACTION,
  type Mount,
  rollEquipmentDamage,
  rollFragileDamage,
  newCommander,
  onSave,
  removeEquipment,
  saveCommander,
  type Commander,
  type Difficulty,
} from './game/commander';
import { DockingComputer } from './game/dockingComputer';
import { fitCompartment, weighsShips, WEIGHBRIDGE_CHANCE } from './game/compartment';
import {
  carriesContraband,
  checksClearance,
  coolRecords,
  fineDue,
  hasLaw,
  hidingSomething,
  illegalEquipment,
  legalStatus,
  recordCrime,
  redeemImpound,
  scansCargo,
  settle,
  systemKey,
  type Settlement,
} from './game/law';
import { claimInsurance } from './game/insurance';
import {
  controlScheme,
  flightInput,
  gamepadPresses,
  isMouseCaptured,
  isTouch,
  setFlightInputSuppressed,
  setFlying,
  setTouchSpeed,
  toggleControlScheme,
  toggleInvertPitch,
  wantsMouseCapture,
  type FlightInput,
} from './game/input';
import { MouseAim } from './game/mouseAim';
import { allies, NpcShip, type NpcRole } from './game/npc';
import { chooseTarget, CombatPilot } from './game/combatPilot';
import { SharedSpace, type Remote, type SpaceEvent } from './net/space';
import { sessionToken, signedIn, currentAccount } from './net/account';
import { claimCallsign, commanderSaved, initAccount, isAccountPanelOpen, toggleAccountPanel } from './ui/accountPanel';
import { cleanName } from '../server/src/protocol';
import { ARRIVAL, ARRIVAL_WARNINGS, closingOpenness, EMERGE_SPEED, FIRST_LAUNCH, LAUNCH_GAP, MAX_OUT, marshalsDelay, RIFT_DISTANCE, RIFT_RADIUS, riftOpenness, WARNING, WING } from './game/marshals';
import { think } from './game/ai';
import { Missile, MISSILE } from './game/missile';
import { combatRating, rankInsignia } from './game/rating';
import { mountExchange } from './ui/exchange';
import { buildFittings, disposeFittings, type Fittings, type Loadout } from './render/fittings';
import { Beams, MARSHAL_LASER, PIRATE_LASER, PLAYER_LASERS, POLICE_LASER, rayHit, TRADER_LASER, type LaserId, type Target } from './game/weapons';
import { PlayerShip } from './game/playerShip';
import { SLOT, Station } from './game/station';
import { ATMOSPHERE_SCALE, buildPlanet, buildSun, disposePlanet } from './render/bodies';
import { blinkBeacon, buildBeacon, buildMoon, buildRings, disposeWorldPart } from './render/worlds';
import { abandon, addStanding, afterJump, amendsCost, board, BOARD_SLOT, SIGNING_BONUS, welcome, cannotReserve, cannotTake, cargoName, collect, COLLECT_JUMPS, deliver, destinationOf, forgive, jumpsBetween, loseContracts, makeAmends, nextHop, reserve, reservedTonnes, standing, surveyDone, take, wyWorks, type Contract } from './game/contracts';
import { ADRIFT_HOLD, assignmentFor, caseLost, checkMessages, collectHeld, companyHere, decide, incidentChoices, STATION_CREW_RANGE, takenByPirates, type Choice, expireCases, fileOn, recoverCase, RIVAL, rivalPrice, sellToRival, setAdrift, thanksFrom, type AdriftCase } from './game/assignments';
import { COMPANIES, COMPANY_IDS, pickCompany, standingName, type CompanyId } from './game/companies';
import { applyCompanyBand } from './render/livery';
import { advanceTrail, bodiesOf, COURIER_POINTS, courierPoiOf, courierRumour, RANK_NEWS, rankReached, trailTip, dataValue, describeWorld, exploreOf, explorerRank, isFound, isSurveyed, poisOf, publishReports, recordDiscovery, recordSurvey, recordVisit, NINEFOLD_REPORT, REPORT_PRICE, sellData, SURVEY, trailPoisOf, trailsUnderWay, worldOf, type Body, type Poi, type SurveyData } from './game/explore';
import { SpaceDust } from './render/dust';
import { Explosion } from './render/explosion';
import { Rift } from './render/rift';
import { riftClose, riftDrone, riftGroan, type Drone } from './audio/rift';
import { camera, isRetro, lens, makeSpace, render, setRetro } from './render/renderer';
import { buildShip, disposeShip, heatShip, showUnidentified, UNIDENTIFIED, type ShipModel } from './render/shipModel';
import { buildHangar } from './render/hangar';
import { stationName } from './galaxy/stationNames';
import { takePhoto } from './ui/photo';
import { clearFlash, flash, setInterference, toggleScannerRange, updateHud, type Blip } from './ui/hud';
import { clearIndicators, showHitDirection, updateIndicators, type Marker } from './ui/indicators';
import { countDevice, countNewCommander } from './net/stats';
import { claimFirsts, firstsIn, loadFirsts } from './net/firsts';
import { closeMap, chooseCursor, focusFind, isMapOpen, moveCursor, openMap, toggleMapMode } from './ui/galaxyMap';
import { distanceLy, ECONOMIES, galaxy, GOVERNMENTS, nearestTo, systemAt, type StarSystem } from './galaxy/generate';
import { commodityById, UNITS_PER_TONNE } from './economy/commodities';
import { buy, freeTonnes, marketState, maxBuyable, quotes, sell, type TradeContext } from './economy/trade';
import { loseDelivery, upcomingDeliveries } from './economy/market';
import { activeEvent, eventsAt, EVENT_KINDS, newsArrives, newsAt, newsOf, setCausedEvents } from './economy/events';
import { inspectionChance } from './economy/legality';
import { escapeHtml } from './ui/escape';
import { fadeFromWhite, playTunnel } from './ui/tunnel';
import { closeDrawer, initTouch, onTap, updateTouch } from './ui/touch';
import { COMPANY_SHORT, jobStrip, routeWork, workInReach, type JobStep } from './game/jobs';
import { BEACON_CALLS, beacon, distressReward, hailReply, newBeacon, newsInReach, pirateAnswer, pirateThreat, RADIO_RANGE, type BeaconCall, type HailContext, type Speaker } from './game/radio';
import { acceptLatest, clearRadio, initRadio, say, setRadioFight, toggleRadio, wakeRadio, type RadioAction, type RadioKind } from './ui/radio';
import './style.css';

type State = 'title' | 'newgame' | 'docked' | 'flying' | 'transition' | 'dead';
let state: State = 'title';
let inSpace = false;

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

function setState(next: State) {
  if (next !== 'title' && isAccountPanelOpen()) toggleAccountPanel(false);
  if (next !== 'flying') {
    countdown = null; // leaving flight cancels a hyperspace countdown
    combatComputer = null;
    surveyPilot = null;
    routeJumpAt = null;
    sharedSpace.leave(); // back in when flying again, wherever that is
    lockedCommander = null;
    for (const n of netMissiles.values()) n.missile.dispose();
    netMissiles.clear();
    // Overlays that only make sense in flight; they're updated each frame while flying.
    for (const id of ['#mouse-prompt', '#reticle', '#seeker', '#target-info', '#countdown', '#hail', '#job', '#beacon']) $(id).hidden = true;
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
  layoutForScreen();
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

/**
 * Panels sit above the row of buttons, whose height depends on the screen
 * width (they wrap on phones), so measure it rather than guess.
 */
function layoutForScreen() {
  const controls = [...document.querySelectorAll<HTMLElement>('nav.controls')].find((el) => !el.hidden);
  document.documentElement.style.setProperty('--controls-h', `${controls?.offsetHeight ?? 0}px`);
  fitDashboard();
  updateTurnHint();
}

/**
 * On a touch screen in landscape the dashboard sits at the top, between the
 * flight buttons on the left and the readouts on the right: size it to fit
 * that gap, so nothing covers the scanner on any phone.
 */
function fitDashboard() {
  const dash = document.querySelector<HTMLElement>('.dash');
  const actions = document.querySelector<HTMLElement>('#touch .touch-actions');
  if (!dash || !document.body.classList.contains('touch')) return;
  const natural = dash.offsetWidth; // unscaled: transforms don't change offsetWidth
  if (!natural) return;
  const landscape = innerHeight < 500;
  const left = landscape && actions ? actions.getBoundingClientRect().right + 10 : 10;
  const room = innerWidth - 2 * left; // centred, so the same margin both sides
  const most = landscape ? 0.62 : 0.72;
  document.documentElement.style.setProperty('--dash-scale', String(Math.max(0.4, Math.min(most, room / natural))));
}
addEventListener('resize', layoutForScreen);

// Coming back to the app (or turning the phone), iPhone can leave the page
// shifted, so what you tap isn't what you see. Put everything back.
function realign() {
  window.scrollTo(0, 0);
  // Some resizes land a moment late; lay out again once they have.
  setTimeout(() => {
    window.scrollTo(0, 0);
    dispatchEvent(new Event('resize'));
  }, 350);
}
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && realign());
addEventListener('pageshow', realign);
addEventListener('orientationchange', realign);
visualViewport?.addEventListener('resize', realign);
// The row also changes height when its buttons change or fonts load, so watch it.
const controlsWatch = new ResizeObserver(layoutForScreen);
for (const nav of document.querySelectorAll<HTMLElement>('nav.controls')) controlsWatch.observe(nav);
// The dashboard and flight buttons appear on launch: fit them then too.
for (const el of document.querySelectorAll<HTMLElement>('.dash, #touch .touch-actions')) controlsWatch.observe(el);

// --- Which way up --------------------------------------------------------------
// On a phone the title and station screens are laid out upright, and flight
// sideways. Safari can't turn the screen for us, so when it's the wrong way
// round we say so: once per screen, for a few seconds or until it's turned.

let turnSeen = '';
let turnTimer: ReturnType<typeof setTimeout> | undefined;

function updateTurnHint() {
  const hint = $('#turn');
  const phone = document.body.classList.contains('touch') && Math.min(innerWidth, innerHeight) < 500;
  const upright = innerHeight > innerWidth;
  const want = state === 'flying' ? 'sideways' : state === 'title' || state === 'docked' ? 'upright' : null;
  if (!phone || !want || upright === (want === 'upright')) {
    hint.hidden = true;
    turnSeen = '';
    return;
  }
  if (turnSeen === state) return; // already said, for this screen
  turnSeen = state;
  hint.className = `turn ${want}`;
  hint.textContent = state === 'flying' ? 'Turn your phone sideways to fly' : state === 'docked' ? 'Turn your phone upright in the station' : 'Best upright here · sideways to fly';
  hint.hidden = false;
  clearTimeout(turnTimer);
  turnTimer = setTimeout(() => (hint.hidden = true), 5000);
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
    if (camera.view?.enabled) camera.clearViewOffset();
    updateBerth(dt, model);
    return;
  }
  hangar.visible = false;
  showroom.stars.visible = true;
  const dist = (showroomDistance(model.radius) ?? model.radius * 3.4) / zoom;
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
  frameShipInSpace();
}

/** Phones on their side: the title screen's card and buttons share a column on the left (style.css). */
const sideways = matchMedia('(max-height: 500px) and (orientation: landscape)');

/**
 * The open space the title-screen ship should fill, on a phone: between the
 * title and the panel when upright, right of the column on its side; null otherwise.
 */
function showroomSpace(): { left: number; right: number; top: number; bottom: number } | null {
  const panel = document.querySelector<HTMLElement>('.panel[data-screen="title"]');
  const title = document.querySelector<HTMLElement>('header.title');
  if (!panel || panel.hidden || !title) return null;
  if (sideways.matches) return { left: panel.getBoundingClientRect().right, right: innerWidth, top: 0, bottom: innerHeight };
  if (innerHeight <= innerWidth) return null;
  return { left: 0, right: innerWidth, top: title.getBoundingClientRect().bottom, bottom: panel.getBoundingClientRect().top };
}

/** How far back the camera stands so the ship fits that space, side to side and top to bottom. */
function showroomDistance(radius: number): number | null {
  const space = showroomSpace();
  if (!space) return null;
  const room = Math.min(space.bottom - space.top, space.right - space.left) * 0.85; // pixels for the ship's full width
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  return (radius * 2 * innerHeight) / (room * 2 * Math.tan(halfFov));
}

/**
 * On a phone the ship would sit behind the panel: shift the view so it's
 * centred in the open space instead.
 */
function frameShipInSpace() {
  const w = innerWidth;
  const h = innerHeight;
  const space = showroomSpace();
  if (!space) {
    if (camera.view?.enabled) camera.clearViewOffset();
    return;
  }
  // How far the ship should move left and up, in pixels.
  const shiftX = w / 2 - (space.left + space.right) / 2;
  const shiftY = h / 2 - (space.top + space.bottom) / 2;
  camera.setViewOffset(w, h, Math.round(shiftX), Math.round(shiftY), w, h);
}

// Inspect the ship on the title and docked screens: drag to rotate, scroll
// (or swipe on a Magic Mouse or trackpad) to zoom, double-click to reset.
const inShowroom = () => state === 'title' || state === 'docked' || state === 'newgame';
const onControl = (e: Event) => Boolean((e.target as HTMLElement).closest('button, a, input, .panel, #galaxy-map, #controls-card'));

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
  showFittings(null);
  showShip(cobraIndex);
  const saved = loadCommander();
  const load = $<HTMLButtonElement>('#load-button');
  load.hidden = !saved;
  if (saved) load.innerHTML = `<span class="key">Y · Load </span><span class="touch-word">Play as CMDR </span>${escapeHtml(saved.name)} <small>(${DIFFICULTIES[saved.difficulty].name})</small>`;
  $('#new-button').classList.toggle('primary', !saved);
  countDevice(saved?.difficulty ?? 'none', isRetro() ? '1984' : 'neo');
  updateSharedButton();
  disarmNewCommander();
  setState('title');
}

// There's one commander at a time, and their rules can't change, so starting
// again deletes them. That takes a second press.
let newCommanderArmed = false;

function armNewCommander(saved: Commander) {
  newCommanderArmed = true;
  const b = $('#new-button');
  b.classList.add('armed');
  b.innerHTML = `<span class="key">N again · </span><span class="touch-word">Tap again to </span>delete ${escapeHtml(saved.name)} (${DIFFICULTIES[saved.difficulty].name} · ${saved.credits.toLocaleString()} Cr · ${combatRating(saved.kills)})`;
}

function disarmNewCommander() {
  newCommanderArmed = false;
  const b = $('#new-button');
  b.classList.remove('armed');
  b.innerHTML = '<span class="key">N · </span>New commander';
}

/**
 * Modern is Witchspace: the default for everyone. Classic (the 1984 rules) is
 * kept as it was, but frozen: bug fixes only, no new features. The original
 * itself is a click away for anyone who wants pure 1984.
 */
const defaultDifficulty = (): Difficulty => 'modern';

function showNewGame() {
  const list = $('#rules');
  list.innerHTML = '';
  (['modern', 'classic'] as Difficulty[]).forEach((d, i) => {
    const b = document.createElement('button');
    const isDefault = d === defaultDifficulty();
    b.classList.toggle('primary', isDefault);
    b.innerHTML = `<b>${i + 1} · ${DIFFICULTIES[d].name}</b><strong>${DIFFICULTIES[d].tagline}</strong><small>${DIFFICULTIES[d].blurb}</small>${isDefault ? '<em>Default · Enter</em>' : ''}`;
    b.addEventListener('click', () => startCommander(d));
    list.append(b);
  });
  setState('newgame');
}

function startCommander(difficulty: Difficulty) {
  commander = newCommander(difficulty);
  clearRadio();
  countNewCommander(difficulty, isRetro() ? '1984' : 'neo');
  setCausedEvents([]);
  // Your callsign: what other commanders see. Blank keeps your account's, or the original's Jameson.
  const typed = $<HTMLInputElement>('#callsign').value.trim();
  commander.name = cleanName(typed || currentAccount()?.callsign || commander.name);
  if (signedIn() && commander.name !== currentAccount()?.callsign) {
    const wanted = commander.name;
    claimCallsign(wanted).catch((e: Error) => {
      // Taken or reserved: keep the account's callsign, if it has one.
      const kept = currentAccount()?.callsign;
      commander!.name = kept ?? 'Jameson';
      saveCommander(commander!);
      flash(kept ? `${e.message} · you're CMDR ${kept}` : `${e.message} · choose a callsign at the station`, 4);
    });
  }
  saveCommander(commander);
  sfx.beep();
  enterDocked();
  if (recruiter && difficulty === 'modern') setDockTab('contracts');
}

function enterDocked() {
  boughtHere = { equipment: new Set(), lasers: {}, missiles: 0 };
  ensureSystemScene();
  inSpace = false;
  player.repair();
  showShip(cobraIndex);
  forgive(cmdr(), Date.now());
  // The companies may have been in touch while you were away.
  if (checkMessages(cmdr(), currentSystem(), Date.now()).length) saveCommander(cmdr());
  markInbox(cmdr());
  renderDocked();
  setState('docked');
}

// What was bought on this visit, so a change of mind before launch gets the
// full price back. Anything older sells for half, like a laser part exchange.
let boughtHere: {
  equipment: Set<string>;
  /** Per mount: what was fitted before, and what the swap cost. */
  lasers: Partial<Record<Mount, { previous?: LaserId; paid: number }>>;
  missiles: number;
} = { equipment: new Set(), lasers: {}, missiles: 0 };

/** A sale at half price loses money, so it asks for a second click. */
function confirmSale(button: HTMLButtonElement, label: string, sell: () => void) {
  button.addEventListener('click', () => {
    if (button.dataset.armed) return sell();
    button.dataset.armed = '1';
    button.textContent = label;
    button.classList.add('armed');
  });
  button.addEventListener('blur', () => {
    if (button.dataset.armed) renderDocked();
  });
}

// --- Docked tabs and the market ---------------------------------------------------

type DockTab = 'station' | 'contracts' | 'market' | 'news';
let dockTab: DockTab = 'station';

function setDockTab(tab: DockTab) {
  dockTab = tab;
  document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#tab-station').hidden = tab !== 'station';
  $('#tab-market').hidden = tab !== 'market';
  $('#tab-news').hidden = tab !== 'news';
  $('#tab-contracts').hidden = tab !== 'contracts';
  if (tab === 'news') renderNews();
  if (tab === 'contracts') renderContracts();
  if (tab === 'market') {
    exchange.selectHeld(cmdr().cargo);
    renderMarket();
  } else {
    $('.panel.docked').classList.remove('wide', 'exchange');
    document.body.classList.remove('exchange-open');
    exchange.stop();
  }
  if (tab === 'contracts') $('.panel.docked').classList.add('wide');
}
document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    b.blur();
    setDockTab(b.dataset.tab as DockTab);
  }),
);

function tradeContext(): TradeContext {
  return { commander: cmdr(), system: currentSystem(), capacity: cargoCapacity(cmdr(), player.def.stats.cargo), now: Date.now() };
}

// --- News --------------------------------------------------------------------------

const ago = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** A line for the galaxy map: the latest news of a system that has reached here. */
function newsLine(s: StarSystem): string | null {
  const n = newsOf(s, currentSystem(), Date.now());
  if (!n) return null;
  const over = Date.now() > n.event.end;
  return `${EVENT_KINDS[n.event.type].name}${over ? ' (may be over)' : ''} · heard ${ago(Date.now() - n.heard)} ago`;
}

/**
 * News of traders being picked off: three or more deliveries lost near one
 * system within two hours. It spreads like any other news.
 */
function attackNews(here: StarSystem, now: number) {
  const out: { where: StarSystem; distance: number; heard: number; lost: number }[] = [];
  for (const [key, market] of Object.entries(cmdr().markets)) {
    const recent = (market.lost ?? []).filter((l) => l.t <= now && l.t > now - 2 * 3600_000);
    if (recent.length < 3) continue;
    const [g, i] = key.split(':').map(Number);
    if (g !== here.galaxy) continue;
    const where = systemAt(g, i);
    const distance = distanceLy(where, here);
    if (distance > 25) continue;
    const heard = newsArrives(where, here, recent[2].t);
    if (heard <= now) out.push({ where, distance, heard, lost: recent.length });
  }
  return out;
}

// --- Company contracts (Modern) -----------------------------------------------------

const companyMark = (id: CompanyId) => `<b class="company" style="--company:${COMPANIES[id].colour}">${escapeHtml(COMPANIES[id].name)}</b>`;
const riskTag = (s: StarSystem) => (s.government <= 1 ? ` <em class="risk high">${GOVERNMENTS[s.government]} · pirates</em>` : s.government <= 3 ? ` <em class="risk">${GOVERNMENTS[s.government]}</em>` : '');
let contractMessage = '';
let justTaken: string | null = null; // after taking a contract, show it at the top, highlighted

// Arriving from a company's advert (witchspace.org.uk/careers/, /play/?company=hexon):
// straight to the Contracts tab, with a starter job from that company at the top.
let recruiter: CompanyId | null = null;

function answerAdvert() {
  const url = new URL(location.href);
  const id = url.searchParams.get('company') as CompanyId | null;
  if (!id || !COMPANY_IDS.includes(id)) return;
  url.searchParams.delete('company');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  recruiter = id;
  const saved = loadCommander();
  if (saved && saved.difficulty !== 'modern') return; // Classic has no companies: just the title
  if (!saved) {
    showNewGame(); // pick a callsign; the welcome waits at the station
    return;
  }
  commander = saved;
  setCausedEvents(saved.caused);
  enterDocked();
  setDockTab('contracts');
}

/** The welcome job from the company whose advert brought you here, if it's still to be taken. */
const welcomeHere = (c: Commander, here: StarSystem, now: number) => (recruiter && c.difficulty === 'modern' ? welcome(c, here, recruiter, now) : null);

/**
 * Set a course to a system, however many jumps away: the first hop now, the
 * next after each jump (see hyperspace). Returns what to tell the commander.
 */
function plotCourse(c: Commander, system: number): string {
  const here = currentSystem();
  const end = systemAt(here.galaxy, system);
  const hop = nextHop(here, end);
  if (!hop) return `${end.name} is out of reach from here`;
  c.target = hop.index;
  c.courseTo = hop === end ? null : end.index;
  const jumps = jumpsBetween(here, end);
  return hop === end ? `Course set: ${end.name}` : `Course plotted to ${end.name}: ${jumps} jumps, first ${hop.name}${distanceLy(here, hop) > c.fuel ? ' (refuel first)' : ''}`;
}
let openFile: CompanyId | null = null;

/** Special assignments you could take at this station now. */
const specialsHere = (c: Commander, here: StarSystem, now: number) =>
  COMPANY_IDS.filter((id) => companyHere(id, here))
    .map((id) => assignmentFor(c, id, here, now))
    .filter((o): o is Contract & { expires: number } => o !== null);

/** Unread messages, on the Contracts tab's button. */
function markInbox(c: Commander) {
  const unread = (c.messages ?? []).filter((m) => !m.read).length;
  $('.tabs [data-tab="contracts"]').textContent = unread ? `Contracts · ${unread} new` : 'Contracts';
}

function renderContracts() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  const free = cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c);
  const hoursLeft = (t: number) => Math.max(1, Math.round((t - now) / 3600_000));
  const goodName = (id: string) => escapeHtml(commodityById(id)?.name ?? id);
  const place = (s: StarSystem) => `${escapeHtml(s.name)} <small>${distanceLy(here, s).toFixed(1)} LY</small>${riskTag(s)}`;
  const messages = (c.messages ?? [])
    .slice(0, 5)
    .map((m) => `<li class="message${m.read ? '' : ' unread'}">${m.from ? `<b class="company">${escapeHtml(m.from)}</b>` : companyMark(m.company)} · <b>${escapeHtml(m.subject)}</b><br><small>${escapeHtml(m.body)}</small></li>`)
    .join('');
  for (const m of c.messages ?? []) m.read = true;
  markInbox(c);
  const hello = welcomeHere(c, here, now);
  const welcomeCard = hello
    ? `<li class="special welcome" style="--company:${COMPANIES[hello.company].colour}">${companyMark(hello.company)} <em class="risk">Welcome aboard</em> · ${hello.qty} t ${escapeHtml(cargoName(hello))} → ${place(destinationOf(hello))}<br>
        <small>${escapeHtml(COMPANIES[hello.company].motto)} Your first job with us, within ${hello.jumps} jumps · <b class="pay">${hello.pay.toLocaleString()} Cr</b>, including a ${SIGNING_BONUS} Cr signing bonus</small>
        <span class="actions"><button data-take="${hello.id}" ${cannotTake(c, hello, free) ? 'disabled' : ''}>Take</button></span></li>`
    : '';
  const specials = specialsHere(c, here, now)
    .map((o) => {
      const to = destinationOf(o);
      const why = cannotTake(c, o, free);
      const compartment = o.company !== 'mutual' && !c.compartment ? ' <em class="risk" title="Hides up to 4 t from police scans. Yours to keep.">Shielded compartment fitted</em>' : '';
      return `<li class="special">${companyMark(o.company)} <em class="risk">Special assignment</em>${compartment} · ${o.qty} t ${escapeHtml(cargoName(o))} → ${place(to)}<br>
        <small>within ${o.jumps} jumps · <b class="pay">${o.pay.toLocaleString()} Cr</b> · offer closes in ${hoursLeft(o.expires)} h</small>
        <span class="actions"><button data-take="${o.id}" ${why ? `disabled title="${escapeHtml(why)}"` : ''}>Take</button></span>${why ? `<small class="why">${escapeHtml(why)}</small>` : ''}</li>`;
    })
    .join('');
  // Lost cases that put a choice to you: the police, a blackmailer, pirates.
  const incidents = (c.adrift ?? [])
    .filter((k) => k.fate && k.fate !== 'honest')
    .map((k) => {
      const a = c.contracts?.find((x) => x.id === k.contract);
      if (!a) return '';
      const there = k.galaxy === here.galaxy && k.system === here.index;
      const station = systemAt(k.galaxy, k.system).name;
      const title = { police: `${station} station police: a word about your ${k.label}`, blackmail: `Someone at ${station} station has your ${k.label}`, ransom: `Pirates have your ${k.label}` }[k.fate as 'police'];
      const needsStation = (ch: Choice) => (k.fate === 'police' || ch === 'find') && !there;
      const buttons = incidentChoices(k, a.pay)
        .map((o) => `<button data-incident="${k.contract}" data-choice="${o.choice}" ${needsStation(o.choice) || (o.cost && c.credits < o.cost) ? 'disabled' : ''} ${needsStation(o.choice) ? `title="At ${escapeHtml(station)} station"` : ''}>${escapeHtml(o.label)}</button>`)
        .join('');
      return `<li class="special">${companyMark(a.company)} · <b>${escapeHtml(title)}</b>${k.fate === 'police' && !there ? `<br><small>Report to ${escapeHtml(station)} station</small>` : ''}<span class="actions incident">${buttons}</span></li>`;
    })
    .join('');
  const file = openFile ? fileOn(c, openFile, here, now) : null;
  const fileHtml = file
    ? `<div class="file" style="--company:${COMPANIES[openFile!].colour}"><h4>${escapeHtml(file.title)}</h4>${file.lines
        .map((l) => (l.redacted ? `<p><span class="redacted" title="Redacted">${'█'.repeat(Math.min(40, l.text.length))}</span></p>` : `<p>${escapeHtml(l.text)}</p>`))
        .join('')}<button data-close-file>Close file</button></div>`
    : '';
  const fileButtons = COMPANY_IDS.filter((id) => standing(c, id) > 0)
    .map((id) => `<button data-file="${id}">${escapeHtml(COMPANIES[id].name)}: your file</button>`)
    .join('');
  const mine = (c.contracts ?? [])
    .map((a) => {
      const to = destinationOf(a);
      const k = c.adrift?.find((x) => x.contract === a.id);
      const falls = k ? Math.max(0, Math.round((k.lost + ADRIFT_HOLD - now) / 3600_000)) : 0;
      const where = k ? systemAt(k.galaxy, k.system) : null;
      const left =
        (k?.held
          ? `<span class="late">Held by the station crew at ${escapeHtml(where!.name)}: dock there to collect it</span> · `
          : k
            ? `<span class="late">Adrift near ${escapeHtml(where!.name)}, beaconing: ${falls ? `${falls} h before it starts to fall` : 'falling'}</span> · `
            : '') +
        (a.jumpsLeft >= 0 ? `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'} left` : `<span class="late">late: half pay</span>`);
      const rival = RIVAL[a.company];
      const sale = a.special && !k && rival && companyHere(rival, here) ? `<button data-rival="${a.id}" title="${escapeHtml(COMPANIES[a.company].name)} will find out">Offer to ${escapeHtml(COMPANIES[rival].name)} · ${rivalPrice(a).toLocaleString()} Cr</button>` : '';
      const course = c.target === to.index ? '<span class="on-course">On course</span>' : `<button data-course="${to.index}">Set course</button>`;
      // Accepted over the comms array: waiting at its station to be collected.
      if (a.reserved) {
        const from = systemAt(a.from.galaxy, a.from.system);
        const here_ = from === here;
        const wait = a.jumpsLeft === 0 ? 'collect it before your next jump' : `collect within ${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'}`;
        const fits = a.qty <= free + 1e-9;
        return `<li class="${a.id === justTaken ? 'fresh' : ''}">${companyMark(a.company)} · ${a.qty} t ${escapeHtml(cargoName(a))} → ${place(to)}<br>
        <small>Reserved over the comms array · waiting at ${escapeHtml(stationName(from).name)}, ${escapeHtml(from.name)} · ${wait} · ${a.pay.toLocaleString()} Cr on delivery, ${a.jumps} jumps from loading</small>
        <span class="actions">${here_ ? `<button data-collect="${a.id}" ${fits ? '' : `disabled title="Needs ${a.qty} t free"`}>Load · ${a.qty} t</button>` : c.target === from.index ? '<span class="on-course">On course</span>' : `<button data-course="${from.index}">Set course</button>`}<button data-abandon="${a.id}" title="The company gives it to someone else, and remembers">Abandon</button></span>${here_ && !fits ? `<small class="why">Make ${+(a.qty - free).toFixed(1)} t more room in the hold to load it</small>` : ''}</li>`;
      }
      const what = a.survey
        ? `Survey the moons of ${place(to)}<br><small>${left} · ${worldOf(to).moons.filter((_, i) => isSurveyed(c, to, `moon${i}`)).length} of ${worldOf(to).moons.length} surveyed${surveyDone(c, a) ? ' · hand in at any Wexley-Yorozu station' : ''} · ${a.pay.toLocaleString()} Cr</small>`
        : `${a.qty} t ${escapeHtml(cargoName(a))} → ${place(to)}<br><small>${left} · ${a.pay.toLocaleString()} Cr on delivery</small>`;
      return `<li class="${a.special ? 'special' : ''}${a.id === justTaken ? ' fresh' : ''}">${companyMark(a.company)} · ${what}
        <span class="actions">${k && where!.index !== here.index ? `<button data-course="${where!.index}">Set course</button>` : course}${sale}<button data-abandon="${a.id}" title="The company takes its cargo back, and remembers">Abandon</button></span></li>`;
    })
    .join('');
  const offers = board(c, here, Date.now())
    .map((o) => {
      const to = destinationOf(o);
      const why = cannotTake(c, o, free);
      return `<li>${companyMark(o.company)}${o.rush ? ' <em class="risk">Rush</em>' : ''} · ${o.survey ? `Survey the moons of ${place(to)} <small>(${worldOf(to).moons.length}) · data to any Wexley-Yorozu station</small>` : `${o.qty} t ${goodName(o.good)} → ${place(to)}`}<br>
        <small>within ${o.jumps} jump${o.jumps === 1 ? '' : 's'} · <b class="pay">${o.pay.toLocaleString()} Cr</b>${o.danger ? ` (${o.danger} danger bonus)` : ''}${o.needs !== 'Casual' ? ` · needs ${o.needs}` : ''}</small>
        <span class="actions"><button data-take="${o.id}" ${why ? `disabled title="${escapeHtml(why)}"` : ''}>Take</button></span>${why ? `<small class="why">${escapeHtml(why)}</small>` : ''}</li>`;
    })
    .join('');
  const standings = COMPANY_IDS.filter((id) => (c.standing?.[id] ?? 0) !== 0)
    .map((id) => {
      const cost = amendsCost(standing(c, id));
      // Badly out of favour with a company that works here: you can pay to be taken back.
      const amends = cost && companyHere(id, here) ? ` <button data-amends="${id}" ${c.credits < cost ? 'disabled' : ''}>Make amends · ${cost.toLocaleString()} Cr</button>` : '';
      return `${companyMark(id)} ${standingName(standing(c, id))}${amends}`;
    })
    .join(' · ');
  $('#contracts').innerHTML = `
    ${incidents ? `<h3>Incidents</h3><ul class="contracts">${incidents}</ul>` : ''}
    ${messages ? `<h3>Messages</h3><ul class="contracts">${messages}</ul>` : ''}
    ${mine ? `<h3>Your contracts</h3><ul class="contracts">${mine}</ul>` : ''}
    <h3>On offer at ${escapeHtml(stationName(here).name)}</h3>
    ${welcomeCard || specials || offers ? `<ul class="contracts">${welcomeCard}${specials}${offers}</ul>` : '<p class="meta">Nothing on the board. New work is posted every half hour.</p>'}
    ${fileHtml || (fileButtons ? `<p class="files">${fileButtons}</p>` : '')}
    <p class="meta">Hold: ${+(free).toFixed(1)} t free · new work every half hour${standings ? `<br>Standing: ${standings}` : ''}</p>
    <p class="market-message" aria-live="polite">${escapeHtml(contractMessage)}</p>`;
  if (justTaken) {
    // Bring the contract you just took into view, with what happened.
    const fresh = $('#contracts').querySelector<HTMLElement>('li.fresh');
    const note = $('#contracts').querySelector<HTMLElement>('.market-message');
    if (fresh && note) fresh.after(Object.assign(document.createElement('p'), { className: 'market-message', textContent: contractMessage }));
    note?.remove();
    fresh?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    justTaken = null;
  }
}

$('#contracts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  b.blur();
  const c = cmdr();
  if (b.dataset.take) {
    const now = Date.now();
    const hello = welcomeHere(c, currentSystem(), now);
    const offer = [...(hello ? [hello] : []), ...specialsHere(c, currentSystem(), now), ...board(c, currentSystem(), now)].find((o) => o.id === b.dataset.take);
    if (offer && offer.id === hello?.id) recruiter = null; // welcomed
    if (!offer) return;
    const why = take(c, offer, cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
    contractMessage = why ?? (offer.survey ? `Survey contract taken: the moons of ${destinationOf(offer).name}, data to any Wexley-Yorozu station` : `Contract taken: ${offer.qty} t ${cargoName(offer)} for ${destinationOf(offer).name}, loaded`);
    if (!why) {
      const fitted = fitCompartment(c, offer);
      if (fitted) contractMessage += ` · ${fitted}`;
      contractMessage += ` · ${plotCourse(c, offer.to.system)}`;
      justTaken = offer.id;
      sfx.beep();
    }
  } else if (b.dataset.collect) {
    const notes = collect(c, currentSystem(), cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
    contractMessage = notes.join(' · ');
    const loaded = c.contracts?.find((a) => a.id === b.dataset.collect);
    if (loaded && !loaded.reserved) {
      contractMessage += ` · ${plotCourse(c, loaded.to.system)}`;
      justTaken = loaded.id;
      sfx.beep();
    }
  } else if (b.dataset.abandon) {
    contractMessage = abandon(c, b.dataset.abandon);
  } else if (b.dataset.incident) {
    contractMessage = decide(c, b.dataset.incident, b.dataset.choice as Choice, currentSystem()) ?? '';
    sfx.beep();
  } else if (b.dataset.amends) {
    contractMessage = makeAmends(c, b.dataset.amends as CompanyId);
    sfx.beep();
  } else if (b.dataset.rival) {
    contractMessage = sellToRival(c, b.dataset.rival, currentSystem()) ?? '';
    sfx.beep();
  } else if (b.dataset.file) {
    openFile = b.dataset.file as CompanyId;
  } else if (b.dataset.closeFile !== undefined) {
    openFile = null;
  } else if (b.dataset.course) {
    contractMessage = plotCourse(c, Number(b.dataset.course));
    sfx.beep();
  }
  saveCommander(c);
  renderDocked(); // the hold, credits and standing all change with a contract
});

function renderNews() {
  const here = currentSystem();
  const now = Date.now();
  // Ongoing news first, then what's probably over; the latest eight.
  const items = newsAt(here, now)
    .sort((a, b) => Number(now > a.event.end) - Number(now > b.event.end) || b.heard - a.heard)
    .slice(0, 8);
  const attacks = attackNews(here, now)
    .map(
      (n) => `<li class="${n.where === here ? 'here' : ''}"><b>${escapeHtml(`Traders attacked near ${n.where.name}: ${n.lost} shipments lost`)}</b>
        <small>${escapeHtml(n.where === here ? 'Here' : `${n.distance.toFixed(1)} LY away`)} · heard ${ago(now - n.heard)} ago · Wanted: whatever it imports</small></li>`,
    )
    .join('');
  $('#news-list').innerHTML = (attacks || items.length)
    ? attacks + items
        .map((n) => {
          const kind = EVENT_KINDS[n.event.type];
          const local = n.where === here;
          const over = now > n.event.end;
          const status = local ? (over ? 'Over' : 'Here, now') : over ? 'May be over by now' : `${n.distance.toFixed(1)} LY away · news ${ago(n.heard - n.event.start)} old when it arrived`;
          return `<li class="${local ? 'here' : ''}${over ? ' over' : ''}"><b>${escapeHtml(kind.headline(n.where.name))}</b>
            <small>${escapeHtml(status)} · heard ${ago(now - n.heard)} ago · Wanted: ${escapeHtml(kind.wanted)}</small></li>`;
        })
        .join('')
    : '<li class="quiet">No news. All quiet within 25 light years.</li>';
}

// Modern markets in neo-vector mode get the full exchange; Classic and 1984
// mode keep the plain price list.
const exchange = mountExchange($('#exchange'), {
  context: tradeContext,
  setCourse(dest) {
    cmdr().target = dest.index;
    saveCommander(cmdr());
    sfx.beep();
    flash(`Course set: ${dest.name} · ${distanceLy(currentSystem(), dest).toFixed(1)} LY`, 2);
  },
  traded(result) {
    if (result.ok) {
      saveCommander(cmdr());
      sfx.beep();
    }
    renderMarket(result.message);
  },
  dealt(result) {
    if (result.ok) saveCommander(cmdr());
    if (result.caught) {
      recordCrime(cmdr(), 'offender');
      saveCommander(cmdr());
      sfx.explosion();
    } else if (result.ok) sfx.beep();
    renderMarket();
  },
});
const useExchange = () => cmdr().difficulty === 'modern' && !isRetro();

function renderMarket(message = '') {
  const ex = useExchange();
  $('.panel.docked').classList.toggle('exchange', ex);
  $('.panel.docked').classList.toggle('wide', !ex);
  document.body.classList.toggle('exchange-open', ex);
  if (ex) {
    const ctx = tradeContext();
    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    $('#dock-funds').innerHTML = `Credits <b>${fmt(ctx.commander.credits)} Cr</b> · Hold <b>${fmt(ctx.capacity - freeTonnes(ctx))} / ${ctx.capacity} t</b>`;
  }
  $('#exchange').hidden = !ex;
  for (const id of ['#market-summary', '#market-table', '#market-message']) $(id).hidden = ex;
  if (ex) {
    exchange.render(message || undefined);
    exchange.start();
    return;
  }
  exchange.stop();
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

// The commander's lasers, missiles and equipment, drawn on the hangar ship.
let fittings: Fittings | null = null;

function showFittings(c: Commander | null) {
  if (fittings) disposeFittings(fittings);
  fittings = null;
  const model = showroomModels.find((m) => m.def.id === player.def.id);
  if (!c || !model) return;
  const size = { pulse: 1, beam: 2, military: 3 };
  const lasers: Loadout['lasers'] = {};
  for (const mount of VIEWS) {
    const id = c.lasers[mount];
    if (id) lasers[mount] = { color: PLAYER_LASERS[id].color, size: size[id] };
  }
  fittings = buildFittings(model.def, { lasers, missiles: c.missiles, equipment: c.equipment });
  model.root.add(fittings.group);
}

/** Change your callsign at a station: the name becomes a little form until you save or cancel. */
function startRename() {
  const c = cmdr();
  const dd = $('#cmdr .rename').parentElement!;
  dd.innerHTML = `<form class="rename-form"><input maxlength="24" value="${escapeHtml(c.name).replace(/"/g, '&quot;')}" aria-label="Callsign" /> <button type="submit">Save</button> <button type="button" data-cancel>Cancel</button></form>`;
  const input = dd.querySelector('input')!;
  input.focus();
  input.select();
  dd.querySelector('[data-cancel]')!.addEventListener('click', () => renderDocked());
  dd.querySelector('form')!.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(input.value);
    if (name === c.name) return renderDocked();
    // Signed in, your callsign is your account's: it has to be free.
    claimCallsign(name)
      .then((claimed) => {
        c.name = claimed;
        saveCommander(c);
        flash(`Callsign changed: CMDR ${claimed}`, 2);
      })
      .catch((err: Error) => flash(err.message, 3))
      .finally(() => renderDocked());
  });
}

/** What's in the hold, company cargo included, for the Station tab. */
function holdList(c: Commander): string {
  const own = Object.entries(c.cargo)
    .filter(([, q]) => q > 0)
    .map(([id, q]) => `${q}${commodityById(id)?.unit === 't' ? ' t' : ' ' + commodityById(id)?.unit} ${escapeHtml(commodityById(id)?.name ?? id)}`);
  const company = (c.contracts ?? []).filter((a) => !a.adrift).map((a) => `${a.qty} t ${escapeHtml(cargoName(a))} <small>(${escapeHtml(COMPANIES[a.company].name)}, for ${escapeHtml(destinationOf(a).name)})</small>`);
  const all = [...own, ...company];
  return all.length ? `<br><small class="hold-list">${all.join(' · ')}</small>` : '';
}

function renderDocked() {
  const c = cmdr();
  showFittings(c);
  const here = currentSystem();
  const st = stationName(here);
  $('#dock-location').textContent = `${st.name} · ${here.name}`;
  $('#dock-location').title = st.honours ? `Named for ${st.honours}` : '';
  // Company contracts are Modern work; Classic stays as 1984.
  $('.tabs [data-tab="contracts"]').hidden = c.difficulty !== 'modern';
  if (dockTab === 'contracts') renderContracts();
  if (dockTab === 'market') renderMarket();
  if (dockTab === 'news') renderNews();
  const rows: [string, string][] = [
    ['Commander', `${escapeHtml(c.name)} <button type="button" class="rename" title="Change your callsign">Rename</button>`],
    ['Rules', DIFFICULTIES[c.difficulty].name],
    ['Credits', `${c.credits.toLocaleString(undefined, { minimumFractionDigits: 1 })} Cr`],
    ['Ship', player.def.name],
    ['Cargo', `${+cargoTonnes(c).toFixed(1)} / ${cargoCapacity(c, player.def.stats.cargo)} t${c.compartment ? ` · ${c.compartment.tonnes} t shielded` : ''}${holdList(c)}`],
    ['Lasers', VIEWS.filter((m) => c.lasers[m]).map((m) => `${m[0].toUpperCase()}${m.slice(1)} ${PLAYER_LASERS[c.lasers[m]!].name.replace(' laser', '').toLowerCase()}`).join(' · ') || 'None'],
    ['Legal status', `${legalLabel()}${canSettle(c) ? ` <button type="button" class="settle" title="Pay the fine here (never more than half of what you have above 100 Cr): a clean record in this system, any warrant lifted, contraband confiscated">${fineDue(c) ? `Settle · ${fineDue(c).toLocaleString()} Cr` : 'Settle · no charge'}</button>` : ''}`],
    ['Destination', c.target === null ? 'None (press G)' : systemAt(here.galaxy, c.target).name],
    ['Rating', combatRating(c.kills)],
    ['Explorer', `${explorerRank(exploreOf(c).points)} · ${exploreOf(c).visited.length} system${exploreOf(c).visited.length === 1 ? '' : 's'} visited${myFirsts(here.galaxy) ? ` · ${myFirsts(here.galaxy)} first${myFirsts(here.galaxy) === 1 ? '' : 's'} on the chart` : ''}`],
    ...trailsUnderWay(c, here.galaxy).map((t): [string, string] => ['Trail', `${escapeHtml(t.title)} · ${t.found} of ${t.of} found · the clue points to ${escapeHtml(t.next)}`]),
    ...explorerTips(c, here),
  ];
  $('#cmdr').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#cmdr .rename').addEventListener('click', () => startRename());
  document.querySelector<HTMLButtonElement>('#cmdr .tip-course')?.addEventListener('click', (e) => {
    flash(plotCourse(c, Number((e.currentTarget as HTMLButtonElement).dataset.system)), 3);
    saveCommander(c);
    renderDocked();
  });
  document.querySelector('#cmdr .settle')?.addEventListener('click', () => {
    const settlement = settle(c);
    saveCommander(c);
    sfx.beep();
    renderDocked();
    flash(settlementMessage(settlement, 'Settled with the law'), 5);
  });

  // Fuel: top up to a full tank at the station.
  const missing = Math.round((fuelCapacity(c) - c.fuel) * 10) / 10;
  const fuelCost = Math.round(missing * FUEL_PRICE * 10) / 10;
  const affordable = Math.min(missing, Math.floor((c.credits / FUEL_PRICE) * 10) / 10);
  $('#fuel').innerHTML = `<span>Fuel <b>${c.fuel.toFixed(1)} / ${fuelCapacity(c)} LY</b></span>`;
  const refuel = document.createElement('button');
  refuel.textContent = missing <= 0 ? 'Full' : affordable < missing ? `${affordable.toFixed(1)} LY · ${(affordable * FUEL_PRICE).toFixed(1)} Cr` : `Refuel · ${fuelCost.toFixed(1)} Cr`;
  refuel.disabled = missing <= 0 || affordable <= 0;
  refuel.title = affordable < missing ? `Refuel as far as your credits allow` : `Fill the tank`;
  refuel.addEventListener('click', () => {
    c.credits = Math.round((c.credits - affordable * FUEL_PRICE) * 10) / 10;
    c.fuel = Math.round((c.fuel + affordable) * 10) / 10;
    saveCommander(c);
    sfx.beep();
    renderDocked();
  });
  $('#fuel').append(refuel);

  // Survey data: sold here, for more the further it's come.
  const dataRow = $('#data-row');
  const data = exploreOf(c).data;
  dataRow.hidden = c.difficulty !== 'modern';
  if (!dataRow.hidden) {
    // Wexley-Yorozu pays best, and is the only one the Science Division's report goes to.
    const wy = wyWorks(here);
    const sellable = data.filter((d) => wy || !d.report);
    const worth = sellable.reduce((sum, d) => sum + dataValue(d, here, wy), 0);
    dataRow.innerHTML = `<span>Survey data <b>${data.length ? `${data.length} record${data.length === 1 ? '' : 's'}` : 'None'}</b>${wy && data.length ? ' <small>Wexley-Yorozu pays a quarter more</small>' : ''}</span>`;
    dataRow.title = data.length ? data.map((d) => `${d.name}: ${dataValue(d, here, wy)} Cr`).join('\n') : 'Fly low over planets, moons and the star to survey them, then sell the data at any station';
    const sell = document.createElement('button');
    sell.textContent = sellable.length ? `Sell · ${worth.toLocaleString()} Cr` : 'Nothing to sell';
    sell.disabled = !sellable.length;
    if (wy && data.some((d) => d.report)) sell.title = `Includes the Ninefold report: the Science Division pays ${REPORT_PRICE.wy.toLocaleString()} Cr, remembers you kindly, and goes looking for Sam Dray`;
    sell.addEventListener('click', () => {
      const held = [...data];
      const { credits, reports } = sellData(c, here, wy);
      bringHome(held);
      if (reports) addStanding(c, 'wy', 3);
      saveCommander(c);
      sfx.beep();
      flash(reports ? `The Science Division takes the Ninefold report · ${credits.toLocaleString()} Cr with your data · Wexley-Yorozu is grateful, and the relay keeps saying all well` : `Survey data sold · ${credits.toLocaleString()} Cr`, 4);
      renderDocked();
    });
    dataRow.append(sell);
    // The report: read it before you decide who gets it.
    if (data.some((d) => d.report)) {
      const read = document.createElement('button');
      read.className = 'read-report';
      read.textContent = 'Read the Ninefold report';
      read.addEventListener('click', () => {
        sfx.beep();
        showLog(NINEFOLD_REPORT.title, NINEFOLD_REPORT.lines.join('\n\n'), 60000);
      });
      dataRow.querySelector('span')!.append(read);
    }
    // The report, anywhere else: publish it, and live with it.
    if (!wy && data.some((d) => d.report)) {
      const publish = document.createElement('button');
      publish.textContent = `Publish the Ninefold report · ${REPORT_PRICE.published} Cr`;
      publish.title = "The Mutual's newsletter pays, the families learn what happened to the Ninefold, and Mira's message reaches her gran. Wexley-Yorozu will remember. Or keep it for a Wexley-Yorozu station.";
      confirmSale(publish, 'Publish it? Wexley-Yorozu will remember', () => {
        const held = [...data];
        const paid = publishReports(c);
        bringHome(held);
        addStanding(c, 'wy', -3);
        saveCommander(c);
        sfx.beep();
        flash(`The Ninefold report is published · ${paid} Cr · the families know now, and so does Wexley-Yorozu`, 5);
        renderDocked();
      });
      dataRow.append(publish);
    }
  }

  // Missiles: top up the rails.
  const rails = player.def.stats.missiles ?? 0;
  const short = rails - c.missiles;
  const canAfford = Math.min(short, Math.floor(c.credits / MISSILE_PRICE));
  $('#missile-row').innerHTML = `<span>Missiles <b>${c.missiles} / ${rails}</b></span>`;
  const rearm = document.createElement('button');
  rearm.textContent = short <= 0 ? 'Full' : `Buy ${canAfford || short} · ${(canAfford || short) * MISSILE_PRICE} Cr`;
  rearm.disabled = short <= 0 || canAfford <= 0;
  rearm.addEventListener('click', () => {
    c.credits -= canAfford * MISSILE_PRICE;
    c.missiles += canAfford;
    boughtHere.missiles += canAfford;
    saveCommander(c);
    sfx.beep();
    renderDocked();
  });
  const missileButtons = document.createElement('div');
  missileButtons.className = 'buttons';
  missileButtons.append(rearm);
  $('#missile-row').append(missileButtons);
  if (c.missiles > 0) {
    const undo = boughtHere.missiles > 0;
    const back = undo ? MISSILE_PRICE : MISSILE_PRICE / 2;
    const sell = document.createElement('button');
    sell.textContent = `Sell 1 · +${back} Cr`;
    sell.title = undo ? 'Bought here: full refund' : 'Sells for half price';
    sell.addEventListener('click', () => {
      c.credits += back;
      c.missiles -= 1;
      if (undo) boughtHere.missiles -= 1;
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    missileButtons.append(sell);
  }

  const list = $('#equip');
  list.innerHTML = '';
  // Equipment held here until a fine is paid.
  if (c.impound) {
    const imp = c.impound;
    const li = document.createElement('li');
    const names = imp.items.map((id) => EQUIPMENT.find((e) => e.id === id)?.name ?? id).join(', ') || 'Nothing';
    const atHere = imp.at === systemKey(here);
    const where = atHere ? 'this station' : systemAt(Number(imp.at.split(':')[0]), Number(imp.at.split(':')[1])).name;
    li.innerHTML = `<span>Impounded <em class="damaged">${imp.owed.toLocaleString()} Cr owed</em></span><small>${names}, held at ${where} until it's paid.</small>`;
    const pay = document.createElement('button');
    pay.textContent = atHere ? `Pay · ${imp.owed.toLocaleString()} Cr` : 'Pay there';
    pay.disabled = !atHere || c.credits < imp.owed;
    pay.addEventListener('click', () => {
      if (!redeemImpound(c)) return;
      saveCommander(c);
      sfx.beep();
      renderDocked();
    });
    li.append(pay);
    list.append(li);
  }
  // Lasers, for each of the four mounts. Whatever was on the mount is taken
  // in part exchange at half its price.
  for (const laser of Object.values(PLAYER_LASERS)) {
    const li = document.createElement('li');
    const sold = here.techLevel >= laser.minTech;
    li.innerHTML = `<span>${laser.name}</span><small>${laser.blurb} ${laser.price.toLocaleString()} Cr per mount.</small>`;
    const mounts = document.createElement('div');
    mounts.className = 'mounts';
    for (const mount of VIEWS) {
      const old = c.lasers[mount];
      const tradeIn = old ? Math.round(PLAYER_LASERS[old].price / 2) : 0;
      const cost = laser.price - tradeIn;
      const fit = document.createElement('button');
      const fitted = old === laser.id;
      fit.classList.toggle('fitted', fitted);
      fit.textContent = mount;
      if (fitted) {
        // Fitted this visit: put back what was there and refund the swap.
        // Otherwise take it off for half price.
        const undo = boughtHere.lasers[mount];
        const back = undo ? undo.paid : Math.round(laser.price / 2);
        fit.title = undo
          ? `Undo: ${undo.previous ? `refit the ${PLAYER_LASERS[undo.previous].name.toLowerCase()} and ` : ''}refund ${back.toLocaleString()} Cr`
          : `Remove from the ${mount} mount: sells for ${back.toLocaleString()} Cr`;
        const remove = () => {
          c.credits += back;
          if (undo?.previous) c.lasers[mount] = undo.previous;
          else delete c.lasers[mount];
          delete boughtHere.lasers[mount];
          saveCommander(c);
          sfx.beep();
          renderDocked();
        };
        if (undo) fit.addEventListener('click', remove);
        // Selling the only laser leaves the ship unarmed: say so.
        else confirmSale(fit, Object.values(c.lasers).filter(Boolean).length === 1 ? `Your only laser! Sell · +${back.toLocaleString()} Cr?` : `Sell · +${back.toLocaleString()} Cr?`, remove);
        mounts.append(fit);
        continue;
      }
      fit.disabled = !sold || c.credits < cost;
      fit.title = !sold
          ? `Needs tech level ${laser.minTech}`
          : `Fit to the ${mount} mount: ${cost.toLocaleString()} Cr${tradeIn ? ` after ${tradeIn.toLocaleString()} Cr for the ${PLAYER_LASERS[old!].name.toLowerCase()}` : ''}`;
      fit.addEventListener('click', () => {
        c.credits -= cost;
        // Swapping twice in one visit undoes back to what was fitted on arrival.
        const earlier = boughtHere.lasers[mount];
        boughtHere.lasers[mount] = { previous: earlier ? earlier.previous : old, paid: (earlier?.paid ?? 0) + cost };
        c.lasers[mount] = laser.id as LaserId;
        saveCommander(c);
        sfx.beep();
        renderDocked();
      });
      mounts.append(fit);
    }
    if (!sold) li.querySelector('small')!.append(` Needs tech level ${laser.minTech}.`);
    li.append(mounts);
    list.append(li);
  }

  for (const item of EQUIPMENT) {
    if (item.classicOnly && c.difficulty !== 'classic') continue;
    if (item.modernOnly && c.difficulty !== 'modern') continue;
    const li = document.createElement('li');
    const owned = hasEquipment(c, item.id);
    const damaged = c.damaged.includes(item.id);
    if (item.standard && !damaged) continue; // fitted to every ship: listed only when it needs repair
    if (item.found && !owned) continue; // never sold: found out there
    const repairCost = Math.round(item.price * REPAIR_FRACTION);
    const banned = Boolean(item.illegal) && scansCargo(here); // illegal here: not sold
    const unranked = Boolean(item.explorer) && exploreOf(c).points < item.explorer!; // explorers only
    const sold = here.techLevel >= item.minTech && !banned && !unranked;
    li.innerHTML = `<span>${item.name}${damaged ? ' <em class="damaged">Damaged</em>' : ''}</span><small>${item.blurb}</small>`;
    const buy = document.createElement('button');
    if (damaged) {
      buy.textContent = `Repair · ${repairCost.toLocaleString()} Cr`;
      buy.disabled = c.credits < repairCost;
    } else if (!owned && !sold) {
      // High-tech gear needs a high-tech world; illegal gear, a lawless one; explorer's gear, an explorer.
      buy.textContent = unranked ? `Needs explorer rank ${explorerRank(item.explorer!)}` : banned ? 'Illegal here' : `Needs tech level ${item.minTech}`;
      buy.title = unranked ? `You're ${explorerRank(exploreOf(c).points)}: survey, find signals and follow trails to rise` : banned ? 'Sold only where police don\'t scan: anarchies and feudal worlds' : `${here.name} is tech level ${here.techLevel}`;
      buy.disabled = true;
    } else if (owned && item.found) {
      buy.textContent = 'Fitted';
      buy.classList.add('fitted');
      buy.disabled = true;
      buy.title = 'Found, not bought: nobody will buy it from you, and you would not want them to';
      li.append(buy);
      list.append(li);
      continue;
    } else if (owned) {
      const undo = boughtHere.equipment.has(item.id);
      const back = undo ? item.price : Math.round(item.price / 2);
      const remove = () => {
        c.credits += back;
        removeEquipment(c, item.id);
        boughtHere.equipment.delete(item.id);
        saveCommander(c);
        sfx.beep();
        renderDocked();
      };
      // The hold can't shrink below what's in it.
      const full = item.id === 'large-cargo-bay' && cargoTonnes(c) > player.def.stats.cargo;
      buy.textContent = undo ? `Undo · +${back.toLocaleString()} Cr` : `Sell · +${back.toLocaleString()} Cr`;
      buy.classList.add('fitted');
      buy.disabled = full;
      buy.title = full ? 'Sell cargo first: it would not fit in the smaller hold' : undo ? 'Bought here: full refund' : 'Sells for half price';
      if (undo) buy.addEventListener('click', remove);
      else confirmSale(buy, `Sell for ${back.toLocaleString()} Cr?`, remove);
      li.append(buy);
      list.append(li);
      continue;
    } else {
      buy.textContent = `Buy · ${item.price.toLocaleString()} Cr`;
      buy.disabled = c.credits < item.price;
    }
    buy.addEventListener('click', () => {
      if (damaged) {
        c.credits -= repairCost;
        c.damaged = c.damaged.filter((id) => id !== item.id);
      } else {
        c.credits -= item.price;
        c.equipment.push(item.id);
        boughtHere.equipment.add(item.id);
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
const SUN_RADIUS = 4000;
space.sun.position.copy(SUN_POS);

const station = new Station(shipById('coriolis')!);
space.scene.add(station.root);
const sun = buildSun(SUN_RADIUS);
sun.position.copy(SUN_POS);
space.scene.add(sun);
const dust = new SpaceDust();
space.scene.add(dust.group);

const player = new PlayerShip(shipById('cobra-mk3')!);
space.scene.add(player.obj);
const dockingComputer = new DockingComputer();
let autopilot = false;

// --- Police and combat ------------------------------------------------------

/** Every computer-controlled ship in the system: police, traders and pirates. */
const npcs: NpcShip[] = [];
const ofRole = (role: NpcRole) => npcs.filter((n) => n.role === role);
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
let thinkTimer = 0;
const MAX_POLICE = 4;
const SCAN_RANGE = 1200; // metres
const SCAN_TIME = 3; // seconds within range for a police scan
let scanned = false; // once per visit to a system
let scanProgress = 0;

const isFugitive = () => Boolean(commander) && legalStatus(cmdr()) === 'fugitive';

/** Wanted here, you can pay your way clean at the station rather than launch into the police. */
const canSettle = (c: Commander) => hasLaw(currentSystem()) && legalStatus(c) !== 'clean';

function legalLabel() {
  const c = cmdr();
  const status = legalStatus(c);
  const label = status === 'fugitive' ? 'Fugitive' : status === 'offender' ? 'Offender' : 'Clean';
  if (c.warrant) return `${label} · Marshals warrant`;
  if (!hasLaw(currentSystem())) return `${label} · no law here`;
  return label;
}

function spawnViper(fromSlot: boolean) {
  const i = ofRole('police').length;
  const npc = new NpcShip(shipById('viper')!, 'police', POLICE_LASER, {
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
  npc.ecm = Math.random() < 0.6;
  space.scene.add(npc.obj);
  npcs.push(npc);
}

// --- Traffic: traders and pirates ----------------------------------------------------

/** Chance of pirates per encounter roll, by government: anarchies are rough, corporate states safe. */
const PIRATE_CHANCE = [0.75, 0.55, 0.4, 0.3, 0.25, 0.15, 0.1, 0.06];
const TRADERS_BY_GOVERNMENT = [1, 1, 2, 2, 2, 3, 3, 3];
const ENCOUNTER_INTERVAL = 40; // seconds between rolls for pirates
const MAX_PIRATES = 4;
const BOUNTIES: Record<string, number> = { sidewinder: 50, mamba: 80, falcon: 2000 };
/** The Falcon, the Legend of the lanes: a chance in each pirate encounter, by government (anarchies most). */
const FALCON_CHANCE = [0.04, 0.03, 0.02, 0.015, 0.01, 0.01, 0.005, 0.005];
const TRADE_GOODS = ['food', 'textiles', 'computers', 'machinery', 'liquor', 'luxuries', 'furs', 'minerals', 'alloys'];
let encounterTimer = 0;
let traderTimer = 0;

type Leg = 'inbound' | 'docking' | 'outbound';
const legs = new WeakMap<NpcShip, Leg>();

// Inbound traders carry the market's real upcoming deliveries (Modern rules):
// destroy one and those goods never reach the station.
type Delivery = { id: string; t: number; qty: number };
const deliveries = new WeakMap<NpcShip, Delivery[]>();
let carried = new Set<string>(); // deliveries already given to a trader in this system
const DELIVERY_WINDOW = [2 * 60_000, 15 * 60_000]; // ms ahead: due after the trader could dock

function loadDeliveries(npc: NpcShip): boolean {
  if (!commander || cmdr().difficulty !== 'modern') return false;
  const now = Date.now();
  const due = upcomingDeliveries(currentSystem(), marketState(tradeContext()), now + DELIVERY_WINDOW[0], now + DELIVERY_WINDOW[1]).filter(
    (d) => !carried.has(`${d.id}:${d.t}`),
  );
  const load: Delivery[] = [];
  for (const d of due) if (load.length < 3 && !load.some((x) => x.id === d.id)) load.push(d);
  if (!load.length) return false;
  for (const d of load) carried.add(`${d.id}:${d.t}`);
  deliveries.set(npc, load);
  npc.cargo = Object.fromEntries(load.map((d) => [d.id, d.qty]));
  return true;
}

/** The station's approach lane: points on the slot axis, which don't move as it spins. */
const onSlotAxis = (d: number) => station.toWorld(new THREE.Vector3(0, 0, SLOT.z + d));

/** A random direction that keeps well clear of the planet. */
function awayFromPlanet(): THREE.Vector3 {
  const toPlanet = planetPos.clone().sub(station.root.position).normalize();
  const d = new THREE.Vector3().randomDirection();
  if (d.dot(toPlanet) > -0.2) d.addScaledVector(toPlanet, -(d.dot(toPlanet) + 0.6)).normalize();
  return d;
}

function randomCargo(): Record<string, number> {
  const cargo: Record<string, number> = {};
  for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
    const id = TRADE_GOODS[Math.floor(Math.random() * TRADE_GOODS.length)];
    cargo[id] = (cargo[id] ?? 0) + 1 + Math.floor(Math.random() * 4);
  }
  return cargo;
}

function addNpc(def: string, role: NpcRole, at: THREE.Vector3, patrolCentre = station.root.position) {
  const laser = role === 'pirate' ? PIRATE_LASER : role === 'trader' ? TRADER_LASER : role === 'marshal' ? MARSHAL_LASER : POLICE_LASER;
  const npc = new NpcShip(shipById(def)!, role, laser, {
    centre: patrolCentre.clone(),
    radius: 1200 + Math.random() * 600,
    height: (Math.random() - 0.5) * 600,
    rate: (Math.random() < 0.5 ? -1 : 1) * 0.12,
    angle: Math.random() * Math.PI * 2,
  });
  npc.obj.position.copy(at);
  space.scene.add(npc.obj);
  npcs.push(npc);
  return npc;
}

/** Under Modern rules, most traders fly for one of the companies working this system, in its colours. */
function flyForCompany(npc: NpcShip) {
  if (!commander || cmdr().difficulty !== 'modern' || Math.random() < 0.2) return;
  npc.company = pickCompany(currentSystem(), Math.random());
  applyCompanyBand(npc.model, COMPANIES[npc.company].colour);
}

/** A trader either arriving from witchspace and heading in, or launching and heading out. */
function spawnTrader(arriving: boolean, distance = 14000 + Math.random() * 8000) {
  if (arriving) {
    const at = station.root.position.clone().addScaledVector(awayFromPlanet(), distance);
    const npc = addNpc('cobra-mk3', 'trader', at);
    flyForCompany(npc);
    npc.obj.lookAt(station.root.position);
    npc.ship.speed = npc.ship.maxSpeed * 0.5;
    npc.destination = onSlotAxis(900);
    legs.set(npc, 'inbound');
    if (!loadDeliveries(npc)) npc.cargo = randomCargo();
  } else {
    const npc = addNpc('cobra-mk3', 'trader', station.root.position);
    flyForCompany(npc);
    station.placeForLaunch(npc.ship);
    npc.ship.speed = 120;
    npc.destination = station.root.position.clone().addScaledVector(awayFromPlanet(), 22000);
    legs.set(npc, 'outbound');
    npc.cargo = randomCargo();
  }
}

/** A pirate band of one to three, somewhere ahead of the player and away from the station. */
function spawnPirates(near: THREE.Vector3): false | 'pirates' | 'falcon' {
  const dir = player.forward().add(new THREE.Vector3().randomDirection().multiplyScalar(0.8)).normalize();
  const centre = near.clone().addScaledVector(dir, 5000 + Math.random() * 2500);
  if (centre.distanceTo(station.root.position) < 5000 || centre.distanceTo(planetPos) < planetRadius * 1.3) return false;
  // Now and then, the Falcon: alone, running dark, and worth a fortune (Modern only).
  if (cmdr().difficulty === 'modern' && !npcs.some((n) => n.def.id === 'falcon') && Math.random() < FALCON_CHANCE[currentSystem().government]) {
    spawnFalcon(centre, near);
    return 'falcon';
  }
  const anarchy = currentSystem().government === 0;
  const count = Math.min(MAX_PIRATES - ofRole('pirate').length, 1 + Math.floor(Math.random() * (anarchy ? 3 : 2)));
  for (let i = 0; i < count; i++) {
    const def = Math.random() < 0.6 ? 'sidewinder' : 'mamba';
    const npc = addNpc(def, 'pirate', centre.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(300)), centre);
    npc.obj.lookAt(near);
    npc.ship.speed = npc.ship.maxSpeed * 0.4;
    npc.bounty = BOUNTIES[def] ?? 40;
    npc.ecm = Math.random() < 0.25;
    if (Math.random() < 0.4) npc.cargo = { [Math.random() < 0.5 ? 'narcotics' : 'firearms']: 1 + Math.floor(Math.random() * 2) };
  }
  return count > 0 ? 'pirates' : false;
}

/** The Falcon, a Legend: a lone pirate running dark, unidentified until you're close enough to read her hull. */
function spawnFalcon(at: THREE.Vector3, near: THREE.Vector3) {
  const npc = addNpc('falcon', 'pirate', at, at);
  npc.obj.lookAt(near);
  npc.ship.speed = npc.ship.maxSpeed * 0.5;
  npc.dark = true;
  npc.bounty = BOUNTIES.falcon;
  npc.ecm = true;
  npc.cargo = { gems: 1 + Math.floor(Math.random() * 3), gold: 1 + Math.floor(Math.random() * 2) };
  return npc;
}

/** Each frame: ships running dark stay a cold white unknown until you're close enough to read the hull. */
function updateIdentities() {
  for (const npc of npcs) {
    if (!npc.dark) continue;
    const unknown = !npcIdentified(npc);
    if (unknown === npc.shownUnidentified) continue;
    const first = npc.shownUnidentified === true; // was unknown: this is the hull read
    showUnidentified(npc.model, unknown);
    npc.shownUnidentified = unknown;
    if (first && !unknown) {
      sfx.lock();
      flash(npc.def.id === 'falcon' ? 'Hull read · FALCON · the one the haulers warn you about' : `Hull read · ${npc.def.name}`, 3.5);
    }
  }
}

/** Spawn and retire traffic. Traders dock or leave; pirates turn up by chance. */
function updateTraffic(dt: number) {
  const sys = currentSystem();
  for (const npc of [...npcs]) {
    const leg = legs.get(npc);
    if (!leg || npc.mode !== 'travel') continue;
    if (leg === 'inbound' && npc.obj.position.distanceTo(npc.destination!) < 150) {
      legs.set(npc, 'docking');
      npc.destination = onSlotAxis(-SLOT.z); // the station's centre, down the slot
    } else if (leg === 'docking' && station.toLocal(npc.obj.position).z < SLOT.z) {
      reportedBy(npc);
      removeNpc(npc); // safely inside
    } else if (leg === 'outbound' && npc.obj.position.distanceTo(npc.destination!) < 600) {
      reportedBy(npc);
      removeNpc(npc); // gone to witchspace
    }
  }
  traderTimer -= dt;
  if (traderTimer <= 0) {
    traderTimer = 25 + Math.random() * 35;
    if (ofRole('trader').length < TRADERS_BY_GOVERNMENT[sys.government]) spawnTrader(Math.random() < 0.6);
  }
  encounterTimer -= dt;
  if (encounterTimer <= 0 && state === 'flying') {
    encounterTimer = ENCOUNTER_INTERVAL * (0.6 + Math.random() * 0.8);
    if (ofRole('pirate').length < MAX_PIRATES && Math.random() < PIRATE_CHANCE[sys.government]) {
      const met = spawnPirates(player.obj.position);
      if (met) flash(met === 'falcon' ? 'Unidentified contact on scanner' : 'Contacts on scanner', 2);
    }
  }
}

function removeNpc(npc: NpcShip, dispose = true) {
  voices.get(npc)?.dispose();
  voices.delete(npc);
  npcs.splice(npcs.indexOf(npc), 1);
  for (const n of npcs) {
    if (n.target === npc.ship) n.target = null;
    if (n.attacker === npc.ship) n.attacker = null;
  }
  if (locked === npc) locked = null;
  if (dispose) npc.dispose();
}

// --- The Co-operative Marshals --------------------------------------------------------
//
// A commander with a warrant (Modern rules) is hunted by a Bastion carrier. It
// arrives slowly through a witchspace rift (see game/marshals.ts), launches its
// wing of Lancers in pairs, and leaves the same way once the warrant is
// cleared, its wing is gone, or it's badly hurt.

type CarrierPhase = 'arriving' | 'emerging' | 'deployed' | 'leaving';

interface Carrier {
  npc: NpcShip;
  rift: Rift | null;
  phase: CarrierPhase;
  /** Seconds in this phase. */
  t: number;
  /** Warnings already given during the arrival. */
  warned: number;
  /** Lancers still aboard. */
  bay: number;
  launchTimer: number;
  wing: Set<NpcShip>;
  /** How far the hull has come through (or gone into) the rift, in metres. */
  through: number;
  /** The rift's mouth: the hull is clipped here while it's passing through. */
  mouth: THREE.Plane;
  drone: Drone | null;
  /** The commander has been warned about the rift's pull, and when it last tore at them. */
  pullWarned: boolean;
  tornAt: number;
}

let carrier: Carrier | null = null;
let marshalTimer: number | null = null; // seconds of flight until a carrier comes
const BAY = new THREE.Vector3(0, -7, 450); // the Bastion's bow bay, in its own frame
const CARRIER_STANDOFF = 3000; // metres it keeps from its quarry
const CARRIER_WITHDRAW_HEALTH = 0.25;

/** Start the clock on a carrier, if a warrant here calls for one. */
function scheduleMarshals() {
  if (carrier || marshalTimer !== null || !commander) return;
  marshalTimer = marshalsDelay(cmdr(), currentSystem());
}

/** Clip a ship's hull to one side of a plane (or stop clipping, with null). */
function clipShip(npc: NpcShip, plane: THREE.Plane | null) {
  npc.obj.traverse((o) => {
    const m = (o as THREE.Mesh).material;
    for (const mat of Array.isArray(m) ? m : m ? [m] : []) mat.clippingPlanes = plane ? [plane] : null;
  });
}

/** A rift opens near the commander, ahead and to one side, where they can see it. */
function summonCarrier() {
  const from = player.obj.position;
  let at = new THREE.Vector3();
  for (let i = 0; i < 12; i++) {
    const dir = player.forward().add(new THREE.Vector3().randomDirection().multiplyScalar(0.6)).normalize();
    at = from.clone().addScaledVector(dir, RIFT_DISTANCE);
    if (at.distanceTo(planetPos) > planetRadius + RIFT_RADIUS * 3 && at.distanceTo(station.root.position) > RIFT_RADIUS * 3) break;
  }
  // The rift faces well off the commander's line of sight, so they watch the
  // whole length of the carrier slide out.
  const toward = from.clone().sub(at);
  // About 70° off the commander's line of sight: a broadside view of it coming through.
  const side = toward.clone().cross(player.up()).setLength(toward.length() * 2.7);
  const facing = new THREE.Object3D();
  facing.position.copy(at);
  facing.lookAt(from.clone().add(side));
  const rift = new Rift(at, facing.quaternion, RIFT_RADIUS);
  space.scene.add(rift.group);

  const npc = new NpcShip(shipById('bastion')!, 'marshal', MARSHAL_LASER, {
    centre: at.clone(),
    radius: 2000,
    height: 0,
    rate: 0.03,
    angle: 0,
  });
  npc.fights = false;
  npc.obj.quaternion.copy(facing.quaternion);
  // Waiting inside the rift, nose at the mouth.
  npc.obj.position.copy(at).addScaledVector(npc.ship.forward(), -BAY.z);
  npc.obj.visible = false;
  npc.model.root.userData.lights = 0; // dark until it's through
  space.scene.add(npc.obj);
  const normal = npc.ship.forward();
  carrier = {
    npc,
    rift,
    phase: 'arriving',
    t: 0,
    warned: 0,
    bay: WING,
    launchTimer: 0,
    wing: new Set(),
    through: 0,
    mouth: new THREE.Plane(normal, -normal.dot(at)),
    drone: riftDrone(WARNING),
    pullWarned: false,
    tornAt: -Infinity,
  };
}

/** The carrier turns for home: a rift opens ahead of it and it goes through. */
function carrierLeaves(c: Carrier, message: string) {
  if (c.phase === 'leaving') return;
  if (npcs.includes(c.npc)) removeNpc(c.npc, false);
  c.phase = 'leaving';
  c.t = 0;
  c.through = 0;
  const fwd = c.npc.ship.forward();
  const at = c.npc.obj.position.clone().addScaledVector(fwd, BAY.z + 500);
  c.rift?.dispose();
  c.rift = new Rift(at, c.npc.obj.quaternion, RIFT_RADIUS * 0.6);
  space.scene.add(c.rift.group);
  // Going in, the part past the mouth is gone.
  c.mouth = new THREE.Plane(fwd.clone().negate(), fwd.dot(at));
  clipShip(c.npc, c.mouth);
  c.drone = riftDrone(6);
  if (state === 'flying') flash(message, 3);
}

/** Their quarry is dead: the carrier and its wing quietly leave the system. */
function marshalsStandDown() {
  if (carrier) for (const l of carrier.wing) if (npcs.includes(l)) removeNpc(l);
  if (carrier && npcs.includes(carrier.npc)) removeNpc(carrier.npc, false);
  disposeCarrier();
  marshalTimer = null;
}

function disposeCarrier() {
  if (!carrier) return;
  carrier.rift?.dispose();
  carrier.drone?.stop();
  if (!npcs.includes(carrier.npc)) carrier.npc.dispose();
  carrier = null;
}

// An open rift scrambles sensors for kilometres around, and close in it drags
// at the ship: the pull grows the nearer you get, and too near it tears at
// the shields and hull.
const RIFT_PULL_RANGE = 4; // rift radii
const RIFT_PULL = 140; // m/s at the rim of a fully open rift
const RIFT_TEAR = 45; // damage per second inside the mouth

/** How badly the rift is scrambling the ship's sensors here, 0..1. */
function riftInterference(): number {
  const r = carrier?.rift;
  if (!r || r.open <= 0) return 0;
  const d = r.group.position.distanceTo(player.obj.position);
  return THREE.MathUtils.clamp(r.open * 1.4 * (1 - d / (r.radius * 12)), 0, 1);
}

function riftPull(c: Carrier, dt: number) {
  const r = c.rift;
  if (!r || r.open <= 0 || state !== 'flying') return;
  const to = r.group.position.clone().sub(player.obj.position);
  const d = to.length();
  const reach = r.radius * RIFT_PULL_RANGE;
  if (d > reach) return;
  const k = r.open * (1 - d / reach) ** 2;
  player.obj.position.addScaledVector(to.normalize(), RIFT_PULL * k * dt);
  shake = Math.max(shake, 0.3 * k); // a tremor, not enough to fight the controls
  if (!c.pullWarned) {
    c.pullWarned = true;
    flash('Gravitational shear · the rift is pulling you in', 3);
  }
  if (d < r.radius * r.open) {
    if (elapsed - c.tornAt > 4) {
      c.tornAt = elapsed;
      flash('Hull stress · the rift is tearing at the ship', 2.5);
    }
    if (damagePlayer(RIFT_TEAR * dt)) die();
  }
}

function updateMarshals(dt: number) {
  const flying = state === 'flying';
  if (marshalTimer !== null && flying) {
    marshalTimer -= dt;
    if (marshalTimer <= 0) {
      marshalTimer = null;
      if (cmdr().warrant) summonCarrier();
    }
  }
  const c = carrier;
  if (!c) return;
  c.t += dt;
  c.rift?.update(dt);
  riftPull(c, dt);
  if (locked && riftInterference() > 0.7) {
    locked = null;
    flash('Missile lock lost · rift interference', 1.5);
  }
  const fwd = c.npc.ship.forward();

  if (c.phase === 'arriving') {
    c.rift!.open = riftOpenness(c.t);
    const next = ARRIVAL_WARNINGS[c.warned];
    if (next && c.t >= next.at) {
      c.warned++;
      if (flying) flash(next.text((c.rift!.group.position.distanceTo(player.obj.position) / 1000).toFixed(1)), 3.5);
    }
    if (c.t >= WARNING) {
      c.phase = 'emerging';
      c.t = 0;
      c.npc.obj.visible = true;
      clipShip(c.npc, c.mouth);
      // The nose punches through, and the drone dies away as it comes.
      c.drone?.stop(ARRIVAL.emerging * 0.6);
      c.drone = null;
      riftGroan(ARRIVAL.emerging);
    }
  } else if (c.phase === 'emerging') {
    // It slides out slowly while the rift closes around it.
    c.through += EMERGE_SPEED * dt;
    c.npc.obj.position.addScaledVector(fwd, EMERGE_SPEED * dt);
    const length = BAY.z - c.npc.def.geometry.vertices.reduce((z, v) => Math.min(z, v[2]), 0);
    c.rift!.open = closingOpenness(c.through / length);
    if (c.through >= length + 20) {
      // The rift slams shut behind the stern.
      c.phase = 'deployed';
      c.t = 0;
      clipShip(c.npc, null);
      c.npc.ship.speed = EMERGE_SPEED;
      npcs.push(c.npc);
      c.launchTimer = FIRST_LAUNCH;
      c.rift!.dispose(); // shut
      c.rift = null;
      riftClose();
      if (flying) flash('Co-operative Marshals · Bastion carrier on scanner', 3);
    }
  } else if (c.phase === 'deployed') {
    // Its lights come up once it's clear of the rift.
    c.npc.model.root.userData.lights = Math.min(1, c.t / 3);
    if (!npcs.includes(c.npc)) {
      carrier = null; // destroyed: its wing fights on alone
      c.drone?.stop();
      return;
    }
    for (const l of c.wing) if (!npcs.includes(l)) c.wing.delete(l);
    // Close to its stand-off distance, then circle the quarry there: it's a
    // carrier, not a ram.
    const from = c.npc.obj.position.clone().sub(player.obj.position);
    const around = from.setLength(CARRIER_STANDOFF).applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.5);
    c.npc.destination = player.obj.position.clone().add(around);
    const wanted = Boolean(commander) && cmdr().warrant;
    // Never more than a few out at once: the rest wait to replace losses.
    if (wanted && flying && c.bay > 0 && c.wing.size < MAX_OUT) {
      c.launchTimer -= dt;
      if (c.launchTimer <= 0) {
        c.launchTimer = LAUNCH_GAP;
        launchLancers(c);
      }
    }
    // Stood down: Lancers fly home to the bay.
    if (!wanted) {
      const bay = c.npc.obj.localToWorld(BAY.clone());
      for (const l of c.wing) {
        l.destination = bay.clone();
        if (l.obj.position.distanceTo(bay) < 150) {
          removeNpc(l);
          c.wing.delete(l);
          c.bay++;
        }
      }
      if (!c.wing.size) carrierLeaves(c, 'Warrant cleared · the Marshals stand down');
    } else if (c.bay === 0 && !c.wing.size) {
      carrierLeaves(c, 'The Bastion has lost its wing · withdrawing to witchspace');
    } else if (c.npc.health < CARRIER_WITHDRAW_HEALTH) {
      for (const l of c.wing) l.destination = null; // left to fight on
      carrierLeaves(c, 'The Bastion is badly damaged · withdrawing to witchspace');
    }
  } else {
    // Leaving: the rift opens ahead, and in it goes, gathering speed.
    c.rift!.open = Math.min(1, c.t / 5);
    const speed = Math.min(260, EMERGE_SPEED + c.t * 25);
    c.npc.obj.position.addScaledVector(fwd, speed * dt);
    c.npc.ship.speed = speed;
    const past = -c.mouth.distanceToPoint(c.npc.obj.position); // how far the centre is beyond the mouth
    const stern = -c.npc.def.geometry.vertices.reduce((z, v) => Math.min(z, v[2]), 0);
    if (past > stern + 20 && c.through === 0) {
      c.through = 1;
      c.t = 0;
      c.drone?.stop(0.15);
      c.drone = null;
      riftClose();
      c.npc.obj.visible = false;
    }
    if (c.through) {
      c.rift!.open = Math.max(0, 1 - c.t / ARRIVAL.collapse);
      if (c.rift!.open <= 0) disposeCarrier();
    }
  }
}

/** Two Lancers out of the bow bay, side by side, at speed. */
function launchLancers(c: Carrier) {
  const first = c.bay === WING;
  for (const side of [-1, 1]) {
    if (c.bay <= 0) break;
    const at = c.npc.obj.localToWorld(new THREE.Vector3(side * 12, BAY.y, BAY.z + 30));
    const lancer = addNpc('lancer', 'marshal', at, c.npc.obj.position);
    lancer.obj.quaternion.copy(c.npc.obj.quaternion);
    lancer.ship.speed = lancer.ship.maxSpeed * 0.8;
    lancer.ecm = true;
    c.wing.add(lancer);
    c.bay--;
  }
  if (state === 'flying') flash(first ? 'The Bastion is launching Lancers' : `Lancers launching · ${c.bay} still aboard`, 2);
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

  disposeCarrier();
  marshalTimer = null;
  for (const npc of npcs) {
    voices.get(npc)?.dispose();
    npc.dispose();
  }
  voices.clear();
  npcs.length = 0;
  for (const m of missiles) m.dispose();
  missiles.length = 0;
  locked = null;
  seeker = null;
  for (const d of drifters) disposeShip(d.model);
  drifters.length = 0;
  for (const e of explosions) e.dispose();
  explosions.length = 0;
  for (let i = 0; i < PATROLS_BY_GOVERNMENT[sys.government]; i++) spawnViper(false);
  reinforceTimer = repopulateTimer = 0;
  carried = new Set();
  // Some traffic already about, and maybe trouble soon after arrival.
  for (let i = 0; i < TRADERS_BY_GOVERNMENT[sys.government] - 1; i++) spawnTrader(true, 5000 + Math.random() * 10000);
  traderTimer = 15;
  encounterTimer = 12 + Math.random() * 10;
  scanned = false;
  scanProgress = 0;
  unpinned = hail = null;
  hullChecked = defiedPolice = false;
  buildExploreScene(sys);
  restoreAdrift();
}

/** Make sure the scene matches where the commander is. */
function ensureSystemScene() {
  const here = currentSystem();
  if (builtSystem !== here) buildSystemScene(here);
}

// --- Exploring (game/explore.ts) -----------------------------------------------------
// Rings and moons are drawn for everyone; surveys and signals pay, so they're
// Modern only, like the rest of what we've added to 1984.

interface SceneBody {
  body: Body;
  centre: THREE.Vector3;
  radius: number;
  /** How low you need to be over its surface to survey it, in metres. */
  range: number;
}
interface ScenePoi {
  poi: Poi;
  position: THREE.Vector3;
  /** Shown on the HUD: after surveying the planet, or on flying near. */
  revealed: boolean;
  models: ShipModel[];
  beacon: THREE.Group | null;
}
let sceneBodies: SceneBody[] = [];
let scenePois: ScenePoi[] = [];
let worldParts: THREE.Group[] = [];
let survey: { target: SceneBody; progress: number } | null = null;
const SIGNAL_DETECT = 6000; // metres: close enough to notice a signal without a survey
const SIGNAL_REACH = 900; // metres: close enough to find out what it is
const SIGNAL_COLOUR = '#c9b3ff';
const DEAD_HULL = new THREE.Color(0.16, 0.16, 0.17); // no power, no glow
const exploring = () => cmdr().difficulty === 'modern';

function disposeExploreScene() {
  for (const g of worldParts) disposeWorldPart(g);
  for (const p of scenePois) {
    for (const m of p.models) disposeShip(m);
    if (p.beacon) disposeWorldPart(p.beacon);
  }
  worldParts = [];
  scenePois = [];
  sceneBodies = [];
  survey = null;
  $('#survey').hidden = true;
}

function buildExploreScene(sys: StarSystem) {
  disposeExploreScene();
  const w = worldOf(sys);
  const c = commander;
  if (w.rings) {
    const rings = buildRings(planetRadius, w.rings, planetColour(sys));
    rings.position.copy(planetPos);
    space.scene.add(rings);
    worldParts.push(rings);
  }
  const bodies = bodiesOf(sys);
  sceneBodies.push({ body: bodies[0], centre: planetPos, radius: planetRadius, range: planetRadius * SURVEY.planet.altitude });
  sceneBodies.push({ body: bodies[1], centre: SUN_POS, radius: SUN_RADIUS, range: SUN_RADIUS * SURVEY.star.altitude });
  w.moons.forEach((m, i) => {
    const radius = m.size * planetRadius;
    let angle = m.angle;
    const at = () => new THREE.Vector3(Math.cos(angle) * Math.cos(m.tilt), Math.sin(m.tilt), Math.sin(angle) * Math.cos(m.tilt)).multiplyScalar(m.orbit * planetRadius).add(planetPos);
    // Keep the station's approach clear.
    if (at().distanceTo(station.root.position) < planetRadius + radius) angle += Math.PI;
    const moon = buildMoon(radius);
    moon.position.copy(at());
    space.scene.add(moon);
    worldParts.push(moon);
    sceneBodies.push({ body: bodies[2 + i], centre: moon.position, radius, range: radius * SURVEY.moon.altitude });
  });
  if (!c || c.difficulty !== 'modern') return;
  const planetDone = isSurveyed(c, sys, 'planet');
  const courier = courierPoiOf(c, sys);
  for (const poi of [...poisOf(sys), ...trailPoisOf(c, sys), ...(courier ? [courier] : [])]) {
    const dir = new THREE.Vector3(...poi.direction);
    // Near enough that salvage isn't lost to space, and clear of the moons.
    const position = dir.clone().multiplyScalar(Math.min(poi.distance * planetRadius, 30000)).add(planetPos);
    for (const b of sceneBodies) if (b.body.kind === 'moon' && position.distanceTo(b.centre) < b.radius * 3) position.addScaledVector(dir, b.radius * 4);
    const found = isFound(c, sys, poi.id);
    // A trail's later steps are where its clue said: on the scanner from arrival.
    const sp: ScenePoi = { poi, position, revealed: planetDone || found || (poi.trail?.step ?? 0) > 0, models: [], beacon: null };
    if (poi.kind === 'beacon') {
      sp.beacon = buildBeacon();
      sp.beacon.position.copy(position);
      space.scene.add(sp.beacon);
    } else {
      const def = shipById(poi.ship ?? 'sidewinder');
      const hulls = poi.kind === 'wrecks' ? 4 : 1;
      for (let k = 0; def && k < hulls; k++) {
        const model = buildShip(def);
        // Dead ships: dark lines, slowly tumbling.
        for (const l of model.lines) l.material.color.copy(l.base).multiplyScalar(0.08).lerp(DEAD_HULL, 0.6);
        model.root.position.copy(position).add(new THREE.Vector3(Math.sin(k * 2.4), Math.cos(k * 1.7) * 0.5, Math.cos(k * 2.4)).multiplyScalar(k ? 120 + k * 40 : 0));
        model.root.rotation.set(k * 1.1 + poi.direction[0], k * 0.7, poi.direction[2] * 2);
        space.scene.add(model.root);
        sp.models.push(model);
      }
    }
    scenePois.push(sp);
  }
}

/** Surveys under way, signals found, and the moons' surfaces. Returns true if you hit a moon. */
function updateExplore(dt: number): boolean {
  const pos = player.obj.position;
  for (const b of sceneBodies) if (b.body.kind === 'moon' && pos.distanceTo(b.centre) < b.radius) return true;
  for (const p of scenePois) {
    for (const m of p.models) m.root.rotateOnAxis(TUMBLE_AXIS, dt * 0.03);
    if (p.beacon) blinkBeacon(p.beacon, elapsed);
  }
  if (!exploring()) return false;
  const c = cmdr();
  const here = currentSystem();

  // Surveying: hold close to something you haven't surveyed yet.
  const deep = isWorking(c, 'survey-scanner'); // twice the range, half the time
  const near = sceneBodies.find((b) => pos.distanceTo(b.centre) - b.radius < b.range * (deep ? 2 : 1) && !isSurveyed(c, here, b.body.id));
  if (near && survey?.target !== near) survey = { target: near, progress: 0 };
  if (survey) {
    survey.progress = THREE.MathUtils.clamp(survey.progress + (near === survey.target ? dt * (deep ? 2 : 1) : -dt * 0.5), 0, survey.target.body.time);
    if (survey.progress >= survey.target.body.time) {
      const done = survey.target.body;
      const before = exploreOf(c).points;
      recordSurvey(c, here, done);
      noteExplorerRank(before);
      saveCommander(c);
      sfx.beep();
      const grade = done.grade ? ` · ${done.grade === 'Candidate' ? 'terraforming CANDIDATE: Wexley-Yorozu will want this' : done.grade.toLowerCase()}` : '';
      flash(`Survey complete · ${done.name}${grade} · data worth ${dataValue(exploreOf(c).data.at(-1)!, here)} Cr here, more further away`, 4);
      survey = null;
      if (done.id === 'planet') {
        const hidden = scenePois.filter((p) => !p.revealed);
        for (const p of hidden) p.revealed = true;
        if (hidden.length) setTimeout(() => state === 'flying' && flash(hidden.length === 1 ? 'The survey picked up an unidentified signal' : `The survey picked up ${hidden.length} unidentified signals`, 3), 3800);
      }
    } else if (survey.progress <= 0 && near !== survey.target) survey = null;
  }
  const bar = $('#survey');
  bar.hidden = !survey;
  if (survey) {
    bar.querySelector('.survey-label')!.textContent = `Surveying ${survey.target.body.name} · ${Math.floor((survey.progress / survey.target.body.time) * 100)}%`;
    bar.style.setProperty('--v', String(survey.progress / survey.target.body.time));
  }

  // Signals: noticed close up, and found by flying to them.
  for (const p of scenePois) {
    if (isFound(c, here, p.poi.id)) continue;
    const d = pos.distanceTo(p.position);
    if (!p.revealed && d < SIGNAL_DETECT * (deep ? 4 : 1)) {
      p.revealed = true;
      flash('Unidentified signal nearby', 2.5);
    }
    if (d < SIGNAL_REACH) discover(p);
  }
  return false;
}
const TUMBLE_AXIS = new THREE.Vector3(0.3, 1, 0.2).normalize();

function discover(p: ScenePoi) {
  const c = cmdr();
  const before = exploreOf(c).points;
  recordDiscovery(c, currentSystem(), p.poi);
  // The lost courier's prototype: yours now.
  if (p.poi.prize && !hasEquipment(c, p.poi.prize)) {
    c.equipment.push(p.poi.prize);
    exploreOf(c).points += COURIER_POINTS;
    setTimeout(() => state === 'flying' && flash('Will-o’-the-Wisp fitted · enemy lasers miss half the time, half the missiles are spoofed · Wexley-Yorozu will want it back', 6), 5200);
  }
  if (p.poi.salvage.length) {
    const cargo: Record<string, number> = {};
    for (const s of p.poi.salvage) cargo[s.id] = (cargo[s.id] ?? 0) + s.qty * UNITS_PER_TONNE[commodityById(s.id)?.unit ?? 't'];
    spillCargo(p.position, new THREE.Vector3(), cargo);
  }
  // A trail step: the clue points on, and the course is plotted for you.
  const next = advanceTrail(c, p.poi);
  let trailNote = '';
  if (next) trailNote = ` · the trail leads to ${next.name}${next.index !== currentSystem().index ? ` · ${plotCourse(c, next.index)}` : ''}`;
  else if (p.poi.trail?.last) trailNote = ' · the end of the trail';
  saveCommander(c);
  sfx.beep();
  flash(`Discovered: ${p.poi.name}${p.poi.salvage.length ? ' · cargo drifting free' : ''}${trailNote}`, trailNote ? 5 : 3);
  showPoiLog(p.poi);
  noteExplorerRank(before);
}

/**
 * Data that has just left the hold at a station (sold, handed in, published):
 * claim it for the chart. The first commander to bring each body home has
 * their callsign on it (signed in only).
 */
function bringHome(held: SurveyData[]) {
  const c = cmdr();
  const gone = held.filter((d) => !exploreOf(c).data.includes(d));
  if (c.difficulty !== 'modern' || !gone.length) return;
  void claimFirsts(gone.map((d) => ({ galaxy: d.galaxy, system: d.system, body: d.body }))).then((won) => {
    if (!won.length) return;
    const one = gone.find((d) => d.galaxy === won[0].galaxy && d.system === won[0].system && d.body === won[0].body);
    const what = won.length === 1 ? (one?.name ?? 'one find') : `${won.length} finds`;
    setTimeout(() => flash(`First to bring it home · your callsign goes on the chart for ${what}`, 5), 2500);
    if (state === 'docked') renderDocked();
  });
}

/** The chart's line on who got somewhere first: names on the galaxy. */
function firstsLine(s: StarSystem): string | null {
  const firsts = firstsIn(s.galaxy, s.index);
  if (!firsts.size) return null;
  const bodies = bodiesOf(s);
  const parts: string[] = [];
  for (const [body, callsign] of firsts) {
    const b = bodies.find((x) => x.id === body);
    if (body === 'planet') parts.unshift(`Charted first by CMDR ${callsign}`);
    else if (b?.grade === 'Candidate') parts.push(`${b.name} charter: CMDR ${callsign}`);
    else if (b) parts.push(`${b.name}: CMDR ${callsign}`);
    else parts.push(`${body === 'courier' ? 'The lost courier' : 'A signal'} found first by CMDR ${callsign}`);
  }
  return parts.join(' · ');
}

/** Firsts of yours in this galaxy (from the chart's last look). */
function myFirsts(galaxy: number): number {
  const mine = currentAccount()?.callsign;
  if (!mine) return 0;
  let n = 0;
  for (let i = 0; i < 256; i++) for (const callsign of firstsIn(galaxy, i).values()) if (callsign === mine) n++;
  return n;
}

/** What explorers hear at a station: the nearest trail not yet started (Trailblazers), and bar talk of the courier. */
function explorerTips(c: Commander, here: StarSystem): [string, string][] {
  const rows: [string, string][] = [];
  const tip = trailTip(c, here);
  if (tip) rows.push(['Tip', `${escapeHtml(tip.title)} starts at ${escapeHtml(tip.at.name)}${tip.at === here ? ' (here)' : `, ${tip.ly.toFixed(1)} LY`} · survey the planet to find its first signal${tip.at === here ? '' : ` <button type="button" class="tip-course" data-system="${tip.at.index}">Set course</button>`}`]);
  const rumour = courierRumour(c, here);
  if (rumour) rows.push(['Rumour', escapeHtml(rumour)]);
  return rows;
}

/** Reaching an explorer rank: say what it opened. */
function noteExplorerRank(before: number) {
  const reached = rankReached(before, exploreOf(cmdr()).points);
  if (!reached) return;
  const news = RANK_NEWS[reached];
  setTimeout(() => flash(`Explorer rank: ${reached.toUpperCase()}${news ? ` · ${news}` : ''}`, 7), 4000);
}

let poiLogTimer = 0;
function showPoiLog(poi: Poi) {
  showLog(poi.name, poi.log, 14000);
}

/** A log, or a longer document, in the panel over the dashboard. */
function showLog(title: string, text: string, ms: number) {
  const log = $('#poi-log');
  log.querySelector('h3')!.textContent = title;
  log.querySelector('p')!.textContent = text;
  log.hidden = false;
  clearTimeout(poiLogTimer);
  poiLogTimer = window.setTimeout(() => (log.hidden = true), ms);
}
$('#poi-log').addEventListener('click', (e) => {
  if ((e.target as HTMLElement).closest('p:first-of-type')) return; // scrolling a long report
  clearTimeout(poiLogTimer);
  $('#poi-log').hidden = true;
});
addEventListener('keydown', () => {
  const log = $('#poi-log');
  if (!log.hidden) {
    clearTimeout(poiLogTimer);
    poiLogTimer = window.setTimeout(() => (log.hidden = true), 400); // let the key do its job too
  }
});

/** HUD markers for moons and signals. */
function exploreMarkers(km: (p: THREE.Vector3) => string): Marker[] {
  const out: Marker[] = [];
  // Moons, and (Modern) the planet: bright in the explorer's colour until
  // surveyed, then the plain grey of somewhere done, with a tick for anyone
  // who can't tell the colours apart. Named within 30 km of the surface.
  for (const b of sceneBodies) {
    if (b.body.kind === 'star' || (b.body.kind === 'planet' && !exploring())) continue;
    const near = player.obj.position.distanceTo(b.centre) - b.radius < 30000;
    const surveyed = !exploring() || isSurveyed(cmdr(), currentSystem(), b.body.id);
    const tick = exploring() && surveyed ? ' ✓' : '';
    out.push({ position: b.centre, color: surveyed ? '#9aa3ad' : SIGNAL_COLOUR, radius: b.radius, label: near ? `${b.body.name}${tick} ${km(b.centre)}` : undefined });
  }
  if (!exploring()) return out;
  for (const p of scenePois) {
    if (!p.revealed) continue;
    const found = isFound(cmdr(), currentSystem(), p.poi.id);
    out.push({ position: p.position, color: SIGNAL_COLOUR, radius: 30, label: found ? `${p.poi.name} ${km(p.position)}` : `Signal ${km(p.position)}` });
  }
  return out;
}

/** On arriving anywhere: note the visit, and say what's special here. */
function arrivalNote(sys: StarSystem): string {
  const before = exploreOf(cmdr()).points;
  const first = recordVisit(cmdr(), sys);
  noteExplorerRank(before);
  const world = describeWorld(worldOf(sys));
  return [world, first ? 'First visit' : ''].filter(Boolean).join(' · ');
}

// Fitted equipment is only at risk once the hull is badly hurt, and never
// more than one item in quick succession, so a scrape doesn't strip the ship.
const EQUIPMENT_RISK_HULL = 0.5; // fraction of full hull
const EQUIPMENT_HIT_GAP = 10; // seconds between items lost
let equipmentHitCooldown = 0;

/** The lost courier's prototype, the Will-o'-the-Wisp: enemy lasers miss half the time, half the missiles are spoofed. */
const EVADE_LASERS = 0.5;
const EVADE_MISSILES = 0.5;
const EVADE_MISSILE_RANGE = 400; // metres: where it decides whether a missile is fooled
const evadeChecked = new WeakSet<object>();
const evading = () => commander?.difficulty === 'modern' && isWorking(commander, 'wisp');

/**
 * Damage the player's ship. Shields soak hits first; once a hit reaches the
 * hull it may take out fitted equipment. Returns true if the ship is destroyed.
 */
function damagePlayer(amount: number, from?: NpcShip): boolean {
  const hullBefore = player.hull;
  const destroyed = player.damage(amount);
  const badlyHurt = player.hull < player.def.stats.hull * EQUIPMENT_RISK_HULL;
  // Pirates aim for the comms array: it's how you'd call for help.
  const aimed = from?.role === 'pirate';
  if (!destroyed && player.hull < hullBefore && !badlyHurt && equipmentHitCooldown <= 0 && commander) {
    const hit = rollFragileDamage(cmdr(), Math.random, aimed);
    if (hit) {
      equipmentHitCooldown = EQUIPMENT_HIT_GAP;
      sfx.scrape();
      flash(`${hit.name} damaged · plain radio until it's repaired at a station`, 2.5);
    }
  }
  if (!destroyed && player.hull < hullBefore && badlyHurt && equipmentHitCooldown <= 0 && commander) {
    const hit = rollEquipmentDamage(cmdr(), Math.random, aimed ? 'comms-array' : undefined);
    if (hit) {
      equipmentHitCooldown = EQUIPMENT_HIT_GAP;
      sfx.scrape();
      flash(cmdr().difficulty === 'classic' ? `${hit.name} destroyed!` : hit.id === 'comms-array' ? `${hit.name} damaged · plain radio until it's repaired at a station` : `${hit.name} damaged · repair at a station`, 2.5);
      if (hit.id === 'docking-computer' && autopilot) setAutopilot(false);
    }
  }
  return destroyed;
}

/**
 * Attacking police makes you a Fugitive here. Serious crimes (destroying
 * police, attacking the station) also bring a Marshals warrant under Modern
 * rules, which follows you to every system with a government.
 */
function becomeFugitive(serious = false) {
  const c = cmdr();
  if (!hasLaw(currentSystem())) return;
  if (!identified()) {
    // Running dark: seen, not known. Police who saw it come after the ship anyway.
    unpinnedCrime('fugitive', serious);
    if (ofRole('police').some((p) => p.obj.position.distanceTo(player.obj.position) < POLICE_SEE)) defiedPolice = true;
    return;
  }
  const hadWarrant = c.warrant;
  const was = isFugitive();
  recordCrime(c, 'fugitive', serious);
  surrenderTimer = null;
  if (c.warrant && !hadWarrant) {
    flash('Co-operative Marshals warrant issued', 2.5);
    scheduleMarshals();
  }
  if (was) return;
  reinforceTimer = 6;
  if (!c.warrant || hadWarrant) flash('You are now a FUGITIVE', 2.5);
}

function becomeOffender(message: string, unknown = !identified()) {
  if (unknown) return unpinnedCrime('offender', false);
  if (legalStatus(cmdr()) !== 'clean') return;
  recordCrime(cmdr(), 'offender');
  flash(message, 3);
}

/** A ship blows up. If the player did it, the law and the combat rating take note. */
function destroyNpc(npc: NpcShip, killer: THREE.Object3D | null) {
  const velocity = npc.ship.forward().multiplyScalar(npc.ship.speed);
  const boom = new Explosion(npc.def, npc.obj, velocity);
  space.scene.add(boom.group);
  explosions.push(boom);
  boomAt(npc.obj.position, 2.2, 1600, 1.6);
  // A pirate carrying your lost case drops it again.
  if (npc.carrying && commander) {
    const k = cmdr().adrift?.find((x) => x.contract === npc.carrying);
    if (k) {
      const p = npc.obj.position;
      k.position = [p.x, p.y, p.z];
      delete k.fate;
      saveCommander(cmdr());
      spillSpecial(k);
      flash(`The ${k.label} is adrift again`, 2.5);
    }
  }
  // Cargo from a clean ship you destroyed is stolen; from a pirate, or someone else's kill, it's salvage.
  if (Object.keys(npc.cargo).length) spillCargo(npc.obj.position, velocity, npc.cargo, killer === player.obj && npc.role !== 'pirate');
  const lost = deliveries.get(npc);
  if (lost && commander) {
    const market = marketState(tradeContext());
    for (const d of lost) loseDelivery(market, d, Date.now());
    saveCommander(cmdr());
    if (npc.obj.position.distanceTo(player.obj.position) < 8000) {
      const goods = lost.map((d) => `${d.qty}${commodityById(d.id)?.unit === 't' ? ' t' : ' ' + commodityById(d.id)?.unit} ${commodityById(d.id)?.name}`).join(', ');
      setTimeout(() => flash(`Delivery lost · ${goods} won't reach ${currentSystem().name}`, 3), 1600);
    }
  }
  // A trader that called for help, and didn't get it.
  if (distresses.some((d) => d.trader === npc && d.heard) && state === 'flying') radio('mayday', traderName(npc), 'Signal lost', { colour: traderColour(npc) });
  removeNpc(npc);
  if (carrier?.npc === npc) bastionDestroyed(carrier, velocity, killer === player.obj);
  if (killer !== player.obj) return;

  const c = cmdr();
  const before = combatRating(c.kills);
  // Kills made while the combat computer flies count for half: the rating
  // should mean you flew the fight yourself.
  c.kills += combatComputer ? 0.5 : 1;
  if (npc.role === 'pirate') {
    c.credits = Math.round((c.credits + npc.bounty) * 10) / 10;
    flash(`${npc.def.name} destroyed · Bounty ${npc.bounty} Cr`, 2.5);
  } else {
    flash(`${npc.def.name} destroyed`, 1.5);
    // Killing police or an innocent trader is a serious crime. Under Classic
    // rules, as in 1984, a trader only counts if the station sees it happen;
    // under Modern, only if anyone saw (the victim can't tell anyone now).
    if (npc.role !== 'trader') becomeFugitive(true);
    else if (c.difficulty === 'classic') {
      if (inSafeZone(npc.obj.position)) becomeFugitive(true);
    } else if (witnessed(npc.obj.position, npc)) becomeFugitive(true);
    else flash('No witnesses · but its cargo is stolen goods', 3);
  }
  // As in 1984, every 256th kill earns the old salute.
  if (Math.floor(c.kills / 256) > Math.floor((c.kills - (combatComputer ? 0.5 : 1)) / 256)) setTimeout(() => flash('Right On Commander!', 3), 1200);
  if (combatRating(c.kills) !== before) setTimeout(() => flash(`Combat rating: ${combatRating(c.kills)}`, 3), 2600);
  saveCommander(c);
}

/**
 * A Bastion destroyed: the Lancers still aboard go with it, those already out
 * fight on, and the wreck spills its alloys (stolen, if you did it). The
 * Marshals don't forget: each one destroyed brings the next sooner.
 */
function bastionDestroyed(c: Carrier, velocity: THREE.Vector3, byPlayer: boolean) {
  const aboard = c.bay;
  c.bay = 0;
  carrier = null;
  c.rift?.dispose();
  c.drone?.stop();
  for (let i = 0; i < 3; i++) {
    const at = c.npc.obj.localToWorld(new THREE.Vector3(0, 0, (i - 1) * 300));
    spillCargo(at, velocity, { alloys: 3 + Math.floor(Math.random() * 4) }, byPlayer);
    setTimeout(() => boomAt(at, 3, 2400, 2), 300 + i * 450);
  }
  if (!byPlayer || !commander) return;
  const cm = cmdr();
  cm.bastionsDestroyed = (cm.bastionsDestroyed ?? 0) + 1;
  setTimeout(() => flash(`Bastion carrier destroyed${aboard ? ` with ${aboard} Lancers aboard` : ''} · the Marshals will not forget`, 4), 1800);
}

/** The station's safe zone: close enough for its guns and its police to see. */
const SAFE_ZONE = 5000; // metres
const inSafeZone = (at: THREE.Vector3) => commander !== null && at.distanceTo(station.root.position) < SAFE_ZONE;

/** The player shot or rammed a ship. Pirates are fair game; anyone else is a crime. */
function playerHitNpc(npc: NpcShip, damage: number) {
  // Paid off, then shot at: the deal's off.
  if (npc.paid) Object.assign(npc, { paid: false, fights: true });
  if (npc.role === 'police' || npc.role === 'marshal') becomeFugitive();
  else if (npc.role === 'trader') {
    if (witnessed(npc.obj.position, npc)) becomeOffender('Firing on a trader · you are an OFFENDER');
    else {
      // Nobody saw. The trader knows, though, and it's calling for help.
      npc.unreported = true;
      npc.seenDark = !identified();
      mayday(npc);
    }
  }
  if (npc.hit(damage, player)) destroyNpc(npc, player.obj);
}

// --- The law beyond the station (docs/design/companies-and-contracts.md, section 4) ----
// Within station space the station sees everything. Out in the lanes, a crime
// needs a witness: police in sight, another ship, or a victim who gets away.
// Under Classic rules (frozen) every crime counts, as before.

const STATION_SPACE = 10000; // metres: the station sees everything inside this
const POLICE_SEE = 8000; // metres: a police ship witnesses anything this close
const SHIPS_SEE = 6000; // metres: another ship sees a crime this close (and lives to tell)

/** Would anyone see a crime here? (The victim doesn't count: it reports only if it gets away.) */
function witnessed(at: THREE.Vector3, victim: NpcShip | null): boolean {
  if (!commander || cmdr().difficulty !== 'modern') return true;
  if (at.distanceTo(station.root.position) < STATION_SPACE) return true;
  return npcs.some((n) => {
    if (n === victim || n.role === 'pirate') return false;
    const d = n.obj.position.distanceTo(at);
    return n.role === 'police' || n.role === 'marshal' ? d < POLICE_SEE : d < SHIPS_SEE;
  });
}

// A distress call: police launch from the station and fly to the scene. The
// further out, the longer they take: about 20 s at 12 km, a minute at 20 km.
const responses: { at: number; where: THREE.Vector3 }[] = [];

function mayday(npc: NpcShip) {
  if (npc.maydayCalled || !hasLaw(currentSystem())) return;
  npc.maydayCalled = true;
  if (isWorking(cmdr(), 'distress-jammer')) return flash(`Distress call jammed · the ${npc.def.name} can't reach the police`, 2.5);
  const where = npc.obj.position.clone();
  const delay = Math.max(10, 10 + (where.distanceTo(station.root.position) - STATION_SPACE) / 200);
  responses.push({ at: elapsed + delay, where });
  const line = `Mayday from the ${npc.company ? COMPANIES[npc.company].name : ''} ${npc.def.name}`.replace('  ', ' ') + ` · police about ${Math.round(delay)} s away`;
  radio('mayday', traderName(npc), `Mayday! We're under attack · police about ${Math.round(delay)} s away`, { colour: traderColour(npc), flash: 3, urgent: true, line });
}

function updateResponses() {
  for (let i = responses.length - 1; i >= 0; i--) {
    if (elapsed < responses[i].at) continue;
    const { where } = responses.splice(i, 1)[0];
    // Two Vipers come out and patrol where the call came from: witnesses now, if anything's still going on.
    // The wait was their flight out: they arrive now, from the station's side.
    const fromStation = station.root.position.clone().sub(where).setLength(1800);
    for (let k = 0; k < 2 && ofRole('police').length < MAX_POLICE; k++) {
      spawnViper(false);
      const cop = npcs[npcs.length - 1];
      cop.patrol.centre.copy(where);
      cop.patrol.radius = 500 + k * 300;
      cop.obj.position.copy(where).add(fromStation).add(new THREE.Vector3().randomDirection().multiplyScalar(200));
      cop.obj.lookAt(where);
      cop.ship.speed = cop.ship.maxSpeed * 0.6;
    }
    radio('police', `${currentSystem().name} police`, 'Police arriving · answering a distress call', { flash: 2 });
  }
}

/** A trader you attacked, getting away: it reports you (in the system where it happened). */
function reportedBy(npc: NpcShip) {
  if (!npc.unreported || !commander) return;
  npc.unreported = false;
  becomeOffender('The trader you attacked got away, and reported you · you are an OFFENDER', npc.seenDark);
}

// --- Running dark and the police hail (section 4, Modern rules) -------------
// Switch the transponder off (0) and a witness sees only "an unidentified
// Cobra Mk III": the crime waits for a suspect, and switching back on near
// the law soon after makes you it. Close up (2 km) or in station space your
// hull still gives you away. Lawful stations won't dock a dark ship, and
// police hail one: switch on within 15 s or, if it's broken, cut your speed
// and let a Viper read your hull. Ignore them and they come after you.

const HULL_READ = 2000; // metres: close enough to read a hull registration, dark or not
const HAIL_TIME = 15; // seconds to answer a police hail
const HAIL_SLOW = 0.2; // fraction of top speed: slow enough for a Viper to read your hull
const SUSPECT_TIME = 180; // seconds after a crime that switching on near the law makes you the suspect

let transponderOff = false;
/** A crime seen but not pinned on you. Forgotten when you leave the system. */
let unpinned: { status: 'offender' | 'fugitive'; serious: boolean; at: number } | null = null;
let hail: { by: NpcShip; until: number } | null = null;
/** Police have read your hull this visit (a broken transponder): no more hails. */
let hullChecked = false;
/** You ignored a hail, or fired on police, while dark: they're after you, whoever you are. */
let defiedPolice = false;

const transponderBroken = () => commander !== null && cmdr().damaged.includes('transponder');
/** Nobody can read who you are from afar. */
const dark = () => commander !== null && cmdr().difficulty === 'modern' && (transponderOff || transponderBroken());

/** Whether the law knows it's you: transponder on, or the station or a police ship close enough to read your hull. */
function identified(): boolean {
  if (!dark()) return true;
  if (player.obj.position.distanceTo(station.root.position) < STATION_SPACE) return true;
  return npcs.some((n) => (n.role === 'police' || n.role === 'marshal') && n.obj.position.distanceTo(player.obj.position) < HULL_READ);
}

function unpinnedCrime(status: 'offender' | 'fugitive', serious: boolean) {
  unpinned = { status: unpinned?.status === 'fugitive' ? 'fugitive' : status, serious: serious || Boolean(unpinned?.serious), at: elapsed };
  flash(`Seen, but not identified · an unidentified ${player.def.name}`, 2.5);
}

// The ship's computer switches it back on for you when that's safe and
// needed: arriving in a new system, and approaching a lawful station to dock.
// Not when it would make you the suspect: then it says why, counts down on
// the DARK light, and switches on when the coast is clear.

/** Seconds until switching on here is safe; 0 if it is now (Infinity: you defied the police here). */
function suspectFor(): number {
  if (defiedPolice) return Infinity;
  return unpinned ? Math.max(0, SUSPECT_TIME - (elapsed - unpinned.at)) : 0;
}

/** Waiting for the coast to clear before switching on to dock. */
let switchOnWhenClear = false;

const clock = (secs: number) => {
  const t = Math.ceil(secs);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Switch on for docking if it's safe; otherwise say why not. Returns whether it's on. */
function transponderOnToDock(): boolean {
  if (!transponderOff) return true;
  const wait = suspectFor();
  if (wait > 0) {
    switchOnWhenClear = wait !== Infinity;
    flash(`Transponder left dark: switching on here would make you the suspect · ${wait === Infinity ? 'you ignored a police hail' : clock(wait)} · or jump out`, 4);
    return false;
  }
  switchOnWhenClear = false;
  transponderOff = false;
  showTransponder();
  flash('Transponder on for docking', 2);
  return true;
}

/** 0: switch the transponder off (run dark), or on again. */
function toggleTransponder() {
  if (cmdr().difficulty !== 'modern') return flash('Classic rules: the transponder stays on', 1.5);
  if (transponderBroken()) return flash('Transponder damaged · repair it at a station', 2);
  transponderOff = !transponderOff;
  switchOnWhenClear = false;
  showTransponder();
  if (transponderOff) return flash(hasLaw(currentSystem()) ? 'Transponder off · running dark' : 'Transponder off · nobody here cares', 2);
  // Back on where the law can see, soon after a crime nobody pinned on you: you're the suspect.
  const watched =
    player.obj.position.distanceTo(station.root.position) < STATION_SPACE ||
    ofRole('police').some((p) => p.obj.position.distanceTo(player.obj.position) < POLICE_SEE);
  const crime = unpinned && elapsed - unpinned.at < SUSPECT_TIME ? unpinned : null;
  unpinned = null; // switched on quietly, or too late: the trail goes cold
  if (watched && (crime || defiedPolice)) {
    defiedPolice = false;
    if (crime?.status === 'fugitive') becomeFugitive(crime.serious);
    else becomeOffender(crime ? 'Transponder on, near the scene · you are the suspect · OFFENDER' : 'Transponder on · you ignored a police hail · OFFENDER');
    return;
  }
  if (hail) radio('police', `${currentSystem().name} police`, 'Transponder read · thank you, Commander', { flash: 2, urgent: true, line: 'Transponder read · thank you, Commander' });
  else flash('Transponder on', 2);
}

function showTransponder() {
  const on = dark();
  // While a crime here is fresh, the light counts down to when switching on is safe.
  const wait = transponderOff ? suspectFor() : 0;
  const timer = wait > 0 && wait !== Infinity ? ` ${clock(wait)}` : '';
  const light = $('#dark-light');
  light.classList.toggle('on', on);
  if (light.textContent !== `DARK${timer}`) light.textContent = `DARK${timer}`;
  const button = $('#touch .dark-button');
  button.classList.toggle('armed', transponderOff);
  // The survey autopilot's button, once there's one fitted.
  const survey = $('#touch .survey-button');
  const fitted = hasEquipment(cmdr(), 'survey-autopilot');
  if (survey.hidden === fitted) survey.hidden = !fitted;
  survey.classList.toggle('armed', Boolean(surveyPilot));
  if (button.textContent !== `Dark${timer}`) button.textContent = `Dark${timer}`;
  // Waiting to dock and the coast is now clear: on it goes.
  if (switchOnWhenClear && transponderOff && wait === 0 && player.obj.position.distanceTo(station.root.position) < CLEARANCE_RANGE) {
    switchOnWhenClear = false;
    transponderOff = false;
    flash('Coast clear · transponder on for docking', 2.5);
  }
}

/** Each frame in flight: police hail a dark ship they can see. */
function updateHail() {
  showTransponder();
  const box = $('#hail');
  if (hail && !npcs.includes(hail.by)) hail = null; // the Viper's gone; another may ask
  if (!dark() || !hasLaw(currentSystem()) || defiedPolice || (hullChecked && !transponderOff)) {
    hail = null;
    box.hidden = true;
    return;
  }
  if (!hail) {
    const by = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(player.obj.position) < POLICE_SEE);
    if (!by) return;
    hail = { by, until: elapsed + HAIL_TIME };
    sfx.beep();
    radio('police', `${currentSystem().name} police`, `Unidentified ${player.def.name}, switch on your transponder.`, { flash: 4, urgent: true, line: `Unidentified ${player.def.name}, this is ${currentSystem().name} police. Switch on your transponder.` });
  }
  // The Viper that hailed you comes to look.
  hail.by.patrol.centre.copy(player.obj.position);
  hail.by.patrol.radius = 400;
  const broken = transponderBroken() && !transponderOff;
  if (broken && player.speed <= player.maxSpeed * HAIL_SLOW) {
    hail.until = Math.max(hail.until, elapsed + 5); // holding still for them: the clock waits
    if (hail.by.obj.position.distanceTo(player.obj.position) < HULL_READ) {
      hail = null;
      hullChecked = true;
      box.hidden = true;
      radio('police', `${currentSystem().name} police`, isFugitive() ? 'Hull read · you are wanted here' : 'Hull read · clean · get that transponder seen to at the next station', { flash: 3, urgent: true, line: isFugitive() ? 'Hull read · you are wanted here' : 'Hull read · clean · get that transponder seen to at the next station' });
      return;
    }
  }
  if (elapsed > hail.until) {
    hail = null;
    defiedPolice = true;
    box.hidden = true;
    sfx.beep();
    radio('police', `${currentSystem().name} police`, 'No answer · police are treating you as hostile', { flash: 3, urgent: true, line: 'No answer · police are treating you as hostile' });
    return;
  }
  box.hidden = false;
  const left = Math.ceil(hail.until - elapsed);
  const text = broken
    ? `Police hail · transponder damaged: cut your speed and let the Viper read your hull · ${left} s`
    : `Police hail · switch on your transponder${document.body.classList.contains('touch') ? '' : ' (0)'} · ${left} s`;
  const span = box.querySelector('span')!;
  if (span.textContent !== text) span.textContent = text;
  box.querySelector('button')!.hidden = broken;
}

/** Lawful stations won't dock a ship that has switched its transponder off. */
const darkRefused = () => transponderOff && checksClearance(currentSystem());

// The hail's own button: answer it in one tap.
$('#hail .hail-on').addEventListener('click', (e) => {
  (e.currentTarget as HTMLButtonElement).blur();
  if (transponderOff) toggleTransponder();
});

type Shot = { kind: 'npc'; npc: NpcShip } | { kind: 'drifter'; drifter: Drifter } | { kind: 'station' } | { kind: 'commander' };

// Lasers fire straight ahead unless a gimballed mount is fitted, in which
// case (with mouse aim) they swivel to hit what's under the ring. The ring
// never strays more than 30° from the nose. Gimbals trade a little damage
// for that convenience.
const GIMBAL_DAMAGE = 0.8;

function gimballed() {
  return controlScheme() === 'mouse' && isMouseCaptured() && Boolean(commander) && isWorking(cmdr(), 'gimbal-mount');
}

/** The laser on the mount you're looking along, if any. */
const mountLaser = () => {
  const id = cmdr().lasers[view];
  return id ? PLAYER_LASERS[id] : null;
};
/** For heat and range: the current mount's laser, or the front one. */
const playerLaser = () => mountLaser() ?? PLAYER_LASERS[cmdr().lasers.front ?? 'pulse'];

function laserDirection() {
  if (view === 'front') return gimballed() ? aim.dir.clone() : player.forward();
  const dir = viewDirection();
  if (cmdr().difficulty !== 'modern') return dir;
  // Modern turrets swing onto the nearest ship near the middle of the view.
  let best: THREE.Vector3 | null = null;
  let bestAngle = TURRET_CONE;
  for (const npc of npcs) {
    const to = npc.obj.position.clone().sub(player.obj.position);
    if (to.length() > playerLaser().range) continue;
    const a = dir.angleTo(to);
    if (a < bestAngle) {
      bestAngle = a;
      best = to.normalize();
    }
  }
  return best ?? dir;
}

/** Where the beams leave the hull for the current mount. */
function muzzles(): THREE.Vector3[] {
  const at = (x: number, y: number, z: number) => player.obj.localToWorld(new THREE.Vector3(x, y, z));
  switch (view) {
    case 'rear':
      return [at(-7, -3, -14), at(7, -3, -14)];
    case 'left':
      return [at(20, -2, -4)];
    case 'right':
      return [at(-20, -2, -4)];
    default:
      return [at(-7, -3, 12), at(7, -3, 12)];
  }
}

// Stray shots at the station are easy to make while lining up the slot.
// Under Modern rules the ship's computer holds fire when the station is in the
// line of fire, unless you hold the trigger to override it; under both rules
// the lasers are locked while the docking computer flies, and the station
// warns you before it calls you a Fugitive.
const FIRE_OVERRIDE = 1.5; // seconds holding fire to override the safety
const STATION_GRACE = 1.5; // seconds after a warning to take your finger off the trigger
const STATION_WARNING_MEMORY = 12; // seconds a station remembers its warning
let fireHeld = 0;
let lastSafetyFlash = -Infinity;
let stationWarnedAt = -Infinity;

function safetyFlash(text: string) {
  if (elapsed - lastSafetyFlash < 2) return;
  lastSafetyFlash = elapsed;
  flash(text, 1.6);
}

function firePlayerLaser() {
  const laser = mountLaser();
  if (!laser) {
    laserCooldown = 0.6;
    flash(`No ${view} laser fitted`, 1.2);
    return;
  }
  if (autopilot) {
    laserCooldown = 0.3;
    safetyFlash('Lasers locked · docking computer flying');
    return;
  }
  const dir = laserDirection();
  const origin = player.obj.position.clone().addScaledVector(dir, 5);
  const targets: Target<Shot>[] = [
    ...npcs.map((npc) => ({ value: { kind: 'npc' as const, npc }, position: npc.obj.position, radius: npc.radius * 0.75 })),
    ...drifters.map((drifter) => ({ value: { kind: 'drifter' as const, drifter }, position: drifter.model.root.position, radius: 7 })),
    { value: { kind: 'station' as const }, position: station.root.position, radius: 90 },
    // Other commanders stop the beam on screen; whether it hurt them is the server's call.
    ...[...sharedSpace.remotes.values()].map((r) => ({ value: { kind: 'commander' as const }, position: r.position, radius: 28 })),
  ];
  const hit = rayHit(origin, dir, laser.range, targets);
  if (hit?.target.value.kind === 'station' && cmdr().difficulty === 'modern' && fireHeld < FIRE_OVERRIDE && !isFugitive()) {
    laserCooldown = 0.1;
    safetyFlash('Safety on · station in line of fire · hold fire to override');
    return;
  }
  if (surrenderTimer !== null) breakSurrender();
  laserCooldown = laser.interval;
  laserHeat += laser.heat;
  if (laserHeat >= 100) {
    overheated = true;
    flash('Laser overheated', 1.2);
  }
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, laser.range);
  for (const muzzle of muzzles()) beams.fire(muzzle, end, laser.color);
  sfx.laser();
  if (sharedSpace.connected) sharedSpace.fire(dir, laser.id);
  if (!hit) return;
  const shot = hit.target.value;
  if (shot.kind === 'npc') {
    sfx.hit();
    playerHitNpc(shot.npc, gimballed() ? laser.damage * GIMBAL_DAMAGE : laser.damage);
  } else if (shot.kind === 'station') {
    stationFlash = 0.25;
    sfx.hit();
    playerHitStation();
  } else if (shot.kind === 'drifter') {
    const d = shot.drifter;
    const flare = new Explosion(d.model.def, d.model.root, d.velocity);
    space.scene.add(flare.group);
    explosions.push(flare);
    disposeShip(d.model);
    drifters.splice(drifters.indexOf(d), 1);
  }
}

/**
 * Coriolis stations shrug off lasers, but firing on one is a crime. The first
 * hit brings a warning and makes you an Offender; keep firing after that and
 * it's a serious crime: you're a Fugitive and the police launch at once.
 */
function playerHitStation() {
  if (!hasLaw(currentSystem())) return;
  const sinceWarning = elapsed - stationWarnedAt;
  if (!isFugitive() && sinceWarning > STATION_WARNING_MEMORY) {
    stationWarnedAt = elapsed;
    recordCrime(cmdr(), 'offender');
    flash('Cease fire, Commander · this is your only warning · you are an OFFENDER', 3);
    return;
  }
  if (!isFugitive() && sinceWarning < STATION_GRACE) return; // time to let go of the trigger
  if (!isFugitive() || !cmdr().warrant) {
    becomeFugitive(true);
    flash('Station under attack · Police launching', 2.5);
  }
  if (ofRole('police').length < MAX_POLICE && reinforceTimer > 1) reinforceTimer = 0.5;
}

/** How much a ship weighs in a collision: its hull and shields together. */
const heft = (def: ShipDef) => def.stats.hull + def.stats.shields;
const CRUSHING = 5; // a ship this many times heavier crushes you

function updateCombat(dt: number, input: { fire: boolean } | null) {
  const alive = state === 'flying';
  beams.update(dt);
  fireHeld = alive && input?.fire ? fireHeld + dt : 0;

  if (alive && input) {
    laserCooldown -= dt;
    laserHeat = Math.max(0, laserHeat - playerLaser().cooling * dt);
    if (overheated && laserHeat < 40) overheated = false;
    if (input.fire && !overheated && laserCooldown <= 0) firePlayerLaser();
  }

  // Decide who fights whom a few times a second.
  thinkTimer -= dt;
  if (thinkTimer <= 0) {
    thinkTimer = 0.25;
    const prices = commander ? new Map(quotes(tradeContext()).map((q) => [q.commodity.id, q.price])) : new Map<string, number>();
    const holdValue = (cargo: Record<string, number>) => Object.entries(cargo).reduce((v, [id, q]) => v + q * (prices.get(id) ?? 0), 0);
    const world = {
      player,
      playerPresent: alive,
      // Wanted here and known, or a dark ship that defied them.
      playerWanted: (isFugitive() && identified()) || defiedPolice,
      npcs,
      inSafeZone: (at: THREE.Vector3) => cmdr().difficulty === 'classic' && inSafeZone(at),
      cargoValue: (ship: PlayerShip) => (ship === player ? (commander ? holdValue(cmdr().cargo) : 0) : holdValue(npcs.find((n) => n.ship === ship)?.cargo ?? {})),
    };
    for (const npc of npcs) think(npc, world);
    for (const npc of npcs) maybeFireNpcMissile(npc);
  }
  updateMissiles(dt);
  updateTraffic(dt);

  for (const npc of [...npcs]) {
    if (!npcs.includes(npc)) continue; // destroyed earlier this frame
    const shot = npc.update(dt);
    if (shot && npc.target === player) npc.firedOnPlayer = true;
    // Keep ships from flying through the station, except traders docking down the slot.
    const fromStation = npc.obj.position.clone().sub(station.root.position);
    if (fromStation.length() < 120 && legs.get(npc) !== 'docking') npc.obj.position.copy(station.root.position).add(fromStation.setLength(120));

    if (shot) {
      const origin = npc.obj.position.clone().addScaledVector(shot, 20);
      type Struck = 'player' | 'station' | NpcShip;
      const targets: Target<Struck>[] = [
        { value: 'station', position: station.root.position, radius: 90 },
        // Ships don't shoot their own side.
        ...npcs.filter((n) => n !== npc && !allies(n.role, npc.role)).map((n) => ({ value: n as Struck, position: n.obj.position, radius: n.radius * 0.75 })),
      ];
      // The Will-o'-the-Wisp jinks the ship out of the way of half the shots.
      if (alive && !(evading() && Math.random() < EVADE_LASERS)) targets.push({ value: 'player', position: player.obj.position, radius: 22 });
      const hit = rayHit(origin, shot, npc.laser.range, targets);
      beams.fire(origin, hit ? hit.point : origin.clone().addScaledVector(shot, npc.laser.range), npc.laser.color);
      zapAt(origin, 700, 120, 0.15, 0.5);
      const struck = hit?.target.value;
      if (struck instanceof NpcShip) {
        // A trader calling for help puts everything into its shields, to last until help comes.
        const calling = struck.role === 'trader' && npc.role === 'pirate' && modern();
        if (calling) distressCall(struck, npc);
        if (struck.hit(npc.laser.damage * (calling ? DISTRESS_SHIELDING : 1), npc.ship)) destroyNpc(struck, npc.obj);
      } else if (struck === 'player') {
        sfx.hit();
        hitFeedback(0.35);
        showHitDirection(camera, npc.obj.position);
        if (damagePlayer(npc.laser.damage, npc)) {
          die();
          return;
        }
      }
    }

    // Ramming hurts both ships. Fly into something far heavier, like a
    // Bastion, and it's you that comes off worse: completely.
    if (alive && npc.touches(player.obj.position, 20)) {
      if (heft(npc.def) > heft(player.def) * CRUSHING) {
        sfx.thud();
        hitFeedback(1);
        flash(`Collision with the ${npc.def.name}`, 3);
        playerHitNpc(npc, 25);
        die();
        return;
      }
      // Back out along the line from its centre until clear of the hull.
      const away = player.obj.position.clone().sub(npc.obj.position).normalize();
      for (let i = 0; i < 100 && npc.touches(player.obj.position, 30); i++) player.obj.position.addScaledVector(away, 10);
      sfx.thud();
      hitFeedback(0.9);
      playerHitNpc(npc, 25);
      if (damagePlayer(25)) {
        die();
        return;
      }
    }
  }

  // Engine sounds for nearby ships, positioned in 3D.
  for (const npc of npcs) {
    const near = alive && npc.obj.position.distanceTo(player.obj.position) < VOICE_RANGE;
    let voice = voices.get(npc);
    if (near && !voice) voices.set(npc, (voice = new ShipVoice(npc.obj.position)));
    if (!near && voice) {
      voice.dispose();
      voices.delete(npc);
    }
    voice?.update(npc.obj.position, npc.ship.speed / npc.ship.maxSpeed);
  }

  // Police in lawful-ish systems scan ships that loiter near them.
  if (alive && !scanned && scansCargo(currentSystem())) {
    const scanner = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(player.obj.position) < SCAN_RANGE);
    scanProgress = scanner ? scanProgress + dt : Math.max(0, scanProgress - dt);
    if (scanProgress >= SCAN_TIME) {
      scanned = true;
      if (illegalEquipment(cmdr()).length) becomeOffender('Scanned by police · distress jammer found · you are an OFFENDER');
      else if (carriesContraband(cmdr())) becomeOffender('Scanned by police · contraband found · you are an OFFENDER');
      else radio('police', `${currentSystem().name} police`, 'Scanned · clean', { flash: 1.5, line: 'Scanned by police · clean' });
    }
  }

  // A soft double beep when a hostile is close behind you.
  tailWarningTimer -= dt;
  if (alive && tailWarningTimer <= 0) {
    const fwd = player.forward();
    const onTail = npcs.find((npc) => {
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
    if (reinforceTimer <= 0 && ofRole('police').length < MAX_POLICE) {
      spawnViper(true);
      flash('Police launching', 1.5);
      reinforceTimer = 20;
    }
  } else if (!isFugitive() && ofRole('police').length < PATROLS_BY_GOVERNMENT[currentSystem().government]) {
    repopulateTimer -= dt;
    if (repopulateTimer <= 0) {
      spawnViper(true);
      repopulateTimer = 30;
    }
  }
}

// --- Missiles and ECM ---------------------------------------------------------------

const missiles: Missile[] = [];
let locked: NpcShip | null = null; // the player's missile lock
let lockedCommander: Remote | null = null; // or a lock on another commander (shared space)
let ecmCooldown = 0;
let incomingTimer = 0;
const LOCK_RANGE = 5000; // metres: how far away you can lock on
const LOCK_HOLD = 8000; // the lock breaks beyond this
const LOCK_CONE = isTouch ? 14 : 6; // degrees off the sights a lock still takes (a thumb aims less finely than a mouse)
const ECM_RANGE = 4000;
const ECM_COOLDOWN = 4; // seconds
const NPC_ECM_RANGE = 1500; // NPCs trigger their ECM when a missile gets this close
const NPC_MISSILE_RANGE = [600, 2500]; // NPCs only fire within this band
const NPC_MISSILE_CHANCE = 0.015; // per decision tick (4 a second) while attacking in range

/** Whatever is nearest to where the guns point, if it's close enough to name. */
function sightedNpc(range = 5000, cone = 6): NpcShip | null {
  const fwd = laserDirection();
  let best: NpcShip | null = null;
  let bestAngle = THREE.MathUtils.degToRad(cone);
  for (const npc of npcs) {
    const to = npc.obj.position.clone().sub(player.obj.position);
    if (to.length() > range) continue;
    const a = fwd.angleTo(to);
    if (a < bestAngle) {
      best = npc;
      bestAngle = a;
    }
  }
  return best;
}

/** T: lock a missile onto the ship in your sights, or disarm. */
function toggleLock() {
  const c = cmdr();
  if (c.missiles <= 0) {
    flash('No missiles · buy more at a station', 1.5);
    return;
  }
  if (c.difficulty === 'modern') {
    // Arm, and the seeker does the rest: hold a ship in your sights and it locks.
    if (seeker || locked || lockedCommander) {
      seeker = null;
      locked = null;
      lockedCommander = null;
      flash('Missile disarmed', 1.2);
    } else {
      seeker = { on: null, progress: 0, beep: 0 };
      flash('Missile armed · hold a ship in your sights', 1.5);
    }
    return;
  }
  if (riftInterference() > 0.4) {
    flash('Lock failed · rift interference', 1.5);
    return;
  }
  const target = sightedNpc(LOCK_RANGE, LOCK_CONE);
  const commanderTarget = target ? null : sightedCommander(LOCK_RANGE, LOCK_CONE);
  if (commanderTarget) {
    locked = null;
    lockedCommander = commanderTarget;
    sfx.lock();
    flash(`Missile locked · CMDR ${commanderTarget.name}`, 1.5);
    return;
  }
  if (!target) {
    if (locked || lockedCommander) {
      locked = null;
      lockedCommander = null;
      flash('Missile disarmed', 1.2);
    } else {
      flash('No target in your sights', 1.2);
    }
    return;
  }
  locked = target;
  lockedCommander = null;
  sfx.lock();
  flash(`Missile locked · ${target.def.name}`, 1.5);
}

/** The commander nearest the middle of your sights, within range. */
function sightedCommander(range: number, cone = 6): Remote | null {
  const fwd = laserDirection();
  let best: Remote | null = null;
  let bestAngle = THREE.MathUtils.degToRad(cone);
  for (const r of sharedSpace.remotes.values()) {
    const to = r.position.clone().sub(player.obj.position);
    if (to.length() > range) continue;
    const a = fwd.angleTo(to);
    if (a < bestAngle) {
      best = r;
      bestAngle = a;
    }
  }
  return best;
}

// --- The seeker (Modern) -----------------------------------------------------------
// As in 1984 and the films: arm the missile and it seeks. Keep a ship in your
// sights and the box closes on it, growling higher, until the tone goes solid:
// locked. Then fire. Classic keeps the instant lock.

const SEEK_TIME = 1; // seconds a ship must stay in your sights to lock
type SeekTarget = NpcShip | Remote;
/** Armed and seeking: what's in the sights, and how close to a lock (0..1). */
let seeker: { on: SeekTarget | null; progress: number; beep: number } | null = null;
const seekPosition = (t: SeekTarget) => (t instanceof NpcShip ? t.obj.position : t.position);

function updateSeeker(dt: number) {
  if (!seeker) return;
  if (cmdr().missiles <= 0) {
    seeker = null;
    return;
  }
  const jammed = riftInterference() > 0.4;
  const npc = jammed ? null : sightedNpc(LOCK_RANGE, LOCK_CONE);
  const target: SeekTarget | null = npc ?? (jammed ? null : sightedCommander(LOCK_RANGE, LOCK_CONE));
  if (target !== seeker.on) seeker = { on: target, progress: 0, beep: 0 };
  if (!target) return;
  seeker.progress += dt / SEEK_TIME;
  seeker.beep -= dt;
  if (seeker.beep <= 0) {
    sfx.seek(seeker.progress);
    seeker.beep = 0.28 - 0.2 * Math.min(1, seeker.progress);
  }
  if (seeker.progress < 1) return;
  seeker = null;
  sfx.lockTone();
  if (npc) {
    locked = npc;
    flash(`Missile locked · ${npcIdentified(npc) ? npc.def.name : 'unidentified ship'} · fire`, 1.5);
  } else {
    lockedCommander = target as Remote;
    flash(`Missile locked · CMDR ${lockedCommander.name} · fire`, 1.5);
  }
}

/** The seeker's box: wide and dashed while it searches, closing on a ship, red when locked. */
const seekerBox = $('#seeker');
function updateSeekerBox() {
  const lockedAt = locked?.obj.position ?? lockedCommander?.position ?? null;
  const tracking = seeker?.on ? seekPosition(seeker.on) : null;
  if ((!seeker && !lockedAt) || state !== 'flying') {
    seekerBox.hidden = true;
    return;
  }
  const at = lockedAt ?? tracking ?? camera.position.clone().addScaledVector(laserDirection(), 1000);
  const p = at.clone().project(camera);
  if (p.z > 1) {
    seekerBox.hidden = true; // behind you
    return;
  }
  const rect = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  seekerBox.hidden = false;
  seekerBox.style.transform = `translate(${rect.left + ((p.x + 1) / 2) * rect.width}px, ${rect.top + ((1 - p.y) / 2) * rect.height}px)`;
  const size = lockedAt ? 34 : tracking ? 90 - 56 * Math.min(1, seeker!.progress) : 90;
  seekerBox.style.setProperty('--s', `${Math.round(size)}px`);
  seekerBox.classList.toggle('locked', Boolean(lockedAt));
  seekerBox.classList.toggle('tracking', !lockedAt && Boolean(tracking));
}

// On a touch screen, one missile button by FIRE: Arm (Lock in Classic), then (red) launch.
const missileButton = $<HTMLButtonElement>('#touch .missile');
onTap(missileButton, () => {
  missileButton.blur();
  if (locked || lockedCommander) fireMissile();
  else toggleLock();
  updateMissileButton();
});

/** Its label: how many missiles, and whether one is locked. */
function updateMissileButton() {
  if (!commander) return;
  const n = cmdr().missiles;
  const armed = Boolean(locked || lockedCommander);
  const modern = cmdr().difficulty === 'modern';
  missileButton.classList.toggle('armed', armed);
  missileButton.classList.toggle('seeking', Boolean(seeker) && !armed);
  missileButton.classList.toggle('empty', n <= 0);
  const label =
    n <= 0 ? 'No missiles' : armed ? (modern ? `Fire ×${n}` : `Missile ×${n}`) : seeker ? `Seeking ×${n}` : modern ? `Arm ×${n}` : `Lock ×${n}`;
  if (missileButton.textContent !== label) missileButton.textContent = label;
}

/** X: launch at the locked target. */
function fireMissile() {
  const c = cmdr();
  if (lockedCommander) {
    // The server flies missiles between commanders; we draw it when it says it's away.
    if (surrenderTimer !== null) breakSurrender();
    c.missiles -= 1;
    saveCommander(c);
    sharedSpace.launchMissile(lockedCommander.id);
    sfx.missileLaunch();
    flash(`Missile away · CMDR ${lockedCommander.name}`, 1.2);
    lockedCommander = null;
    return;
  }
  if (!locked) {
    const hint = c.difficulty !== 'modern' ? 'Lock a target first (T)' : seeker ? 'No lock yet · hold the ship in your sights' : 'Arm a missile first (T)';
    flash(c.missiles > 0 ? hint : 'No missiles', 1.5);
    return;
  }
  if (surrenderTimer !== null) breakSurrender();
  c.missiles -= 1;
  saveCommander(c);
  launchMissile(player, locked.ship);
  flash(`Missile away · ${locked.def.name}`, 1.2);
  locked = null;
}

function launchMissile(from: PlayerShip, target: PlayerShip) {
  const m = new Missile(shipById('missile')!, from, target);
  space.scene.add(m.model.root);
  missiles.push(m);
  if (from === player) sfx.missileLaunch();
  else rocketAt(m.position, 0.5);
  if (target === player) {
    sfx.incoming();
    incomingTimer = 1;
    flash('INCOMING MISSILE · break hard or use ECM (Z)', 2.5);
  }
}

function maybeFireNpcMissile(npc: NpcShip) {
  if (npc.missiles <= 0 || npc.mode !== 'attack' || !npc.target || npc.role === 'trader') return;
  if (npc.target === player && state !== 'flying') return;
  const d = npc.obj.position.distanceTo(npc.target.obj.position);
  if (d < NPC_MISSILE_RANGE[0] || d > NPC_MISSILE_RANGE[1] || Math.random() > NPC_MISSILE_CHANCE) return;
  npc.missiles -= 1;
  launchMissile(npc.ship, npc.target);
}

function explodeMissile(m: Missile) {
  const flare = new Explosion(m.model.def, m.model.root, m.dir.clone().multiplyScalar(m.speed * 0.3));
  space.scene.add(flare.group);
  explosions.push(flare);
  boomAt(m.position, 1.6, 1200, 1.1);
  missiles.splice(missiles.indexOf(m), 1);
  m.dispose();
}

const BOMB_RANGE = 6000;

/** B: the energy bomb destroys every ship and missile nearby. Whoever they are. */
function energyBomb() {
  const c = cmdr();
  if (!hasEquipment(c, 'energy-bomb')) {
    flash('No energy bomb fitted', 1.5);
    return;
  }
  if (surrenderTimer !== null) breakSurrender();
  removeEquipment(c, 'energy-bomb');
  saveCommander(c);
  sfx.explosion();
  sfx.ecm();
  hitFeedback(1.4);
  const el = $('#whiteout');
  el.classList.remove('fade');
  el.hidden = false;
  fadeFromWhite();
  const near = (p: THREE.Vector3) => p.distanceTo(player.obj.position) < BOMB_RANGE;
  for (const m of missiles.filter((m) => near(m.position))) explodeMissile(m);
  const victims = npcs.filter((n) => near(n.obj.position));
  for (const npc of victims) destroyNpc(npc, player.obj);
  flash(victims.length ? `Energy bomb · ${victims.length} ship${victims.length > 1 ? 's' : ''} destroyed` : 'Energy bomb', 2.5);
}

/** Z: the ECM destroys every missile in range, friend or foe. */
function playerEcm() {
  if (!isWorking(cmdr(), 'ecm')) {
    flash(hasEquipment(cmdr(), 'ecm') ? 'ECM damaged · repair at a station' : 'No ECM fitted', 1.5);
    return;
  }
  if (ecmCooldown > 0) return;
  ecmCooldown = ECM_COOLDOWN;
  sfx.ecm();
  hitFeedback(0.2);
  // Classic, as in 1984: ECM destroys every missile in flight, wherever it is.
  const range = cmdr().difficulty === 'classic' ? Infinity : ECM_RANGE;
  const hits = missiles.filter((m) => m.position.distanceTo(player.obj.position) < range);
  for (const m of hits) explodeMissile(m);
  if (sharedSpace.connected) sharedSpace.ecm(); // the server clears commanders' missiles
  flash(hits.length ? `ECM · ${hits.length} missile${hits.length > 1 ? 's' : ''} destroyed` : 'ECM', 1.5);
}

function updateMissiles(dt: number) {
  ecmCooldown = Math.max(0, ecmCooldown - dt);
  equipmentHitCooldown = Math.max(0, equipmentHitCooldown - dt);
  const alive = state === 'flying';
  // A lost lock goes back to seeking (Modern), so the next ship in your sights can be locked.
  const lockLost = () => {
    if (alive && commander && cmdr().difficulty === 'modern' && cmdr().missiles > 0) seeker = { on: null, progress: 0, beep: 0 };
    if (alive) flash(seeker ? 'Missile lock lost · seeking' : 'Missile lock lost', 1.2);
  };
  if (locked && (!npcs.includes(locked) || locked.obj.position.distanceTo(player.obj.position) > LOCK_HOLD)) {
    locked = null;
    lockLost();
  }
  if (lockedCommander && (![...sharedSpace.remotes.values()].includes(lockedCommander) || lockedCommander.position.distanceTo(player.obj.position) > LOCK_HOLD)) {
    lockedCommander = null;
    lockLost();
  }
  if (alive) updateSeeker(dt);
  else seeker = null;
  updateNetMissiles(dt);

  for (const m of [...missiles]) {
    // Lose track of targets that have gone: wrecks, docked ships, a dead player.
    if (m.target && (m.target === player ? !alive : !npcs.some((n) => n.ship === m.target))) m.target = null;
    const victim = m.target && m.target !== player ? npcs.find((n) => n.ship === m.target) : undefined;
    if (victim?.ecm && m.position.distanceTo(victim.obj.position) < NPC_ECM_RANGE) {
      if (m.position.distanceTo(player.obj.position) < 6000) {
        sfx.ecm();
        if (m.owner === player) flash(`${victim.def.name} used ECM · missile destroyed`, 1.8);
      }
      explodeMissile(m);
      continue;
    }

    // The Will-o'-the-Wisp spoofs half the missiles fired at you, once each, close in.
    if (m.target === player && evading() && !evadeChecked.has(m) && m.position.distanceTo(player.obj.position) < EVADE_MISSILE_RANGE) {
      evadeChecked.add(m);
      if (Math.random() < EVADE_MISSILES) {
        sfx.ecm();
        flash('Will-o’-the-Wisp · missile spoofed', 1.8);
        explodeMissile(m);
        continue;
      }
    }

    const result = m.update(dt);
    if (result === 'flying') continue;
    explodeMissile(m);
    if (result !== 'hit') continue;

    if (m.target === player) {
      sfx.hit();
      hitFeedback(1.2);
      showHitDirection(camera, m.position);
      if (damagePlayer(MISSILE.damage)) {
        die();
        return;
      }
    } else if (victim) {
      // Classic, as in 1984: a missile that reaches a ship destroys it outright.
      const damage = cmdr().difficulty === 'classic' ? Infinity : MISSILE.damage;
      if (m.owner === player) playerHitNpc(victim, damage);
      else if (victim.hit(damage, m.owner)) destroyNpc(victim, m.owner.obj);
    }
  }

  // Keep warning while something is homing in.
  incomingTimer -= dt;
  if (alive && incomingTimer <= 0 && (missiles.some((m) => m.target === player) || [...netMissiles.values()].some((n) => n.missile.target === player))) {
    sfx.incoming();
    incomingTimer = 1;
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
  /** From a clean ship you destroyed: whoever scoops it is holding stolen goods. */
  stolen?: boolean;
  /** A company's special cargo that survived its ship: it holds station, beacons, and answers your transponder. */
  special?: AdriftCase;
}
const drifters: Drifter[] = [];
const RECOVER_RANGE = 60; // metres: close enough for a lost case to answer your transponder
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

function spillCargo(at: THREE.Vector3, velocity: THREE.Vector3, cargo: Record<string, number> | number, stolen = false) {
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
      stolen,
    });
  }
  while (drifters.length > MAX_DRIFTERS) evictDrifter();
}

/** Make room, oldest first, but never a company's lost case. */
function evictDrifter() {
  const i = drifters.findIndex((d) => !d.special);
  if (i < 0) return;
  disposeShip(drifters[i].model);
  drifters.splice(i, 1);
}

/** A company's lost case, in its colours, holding station where it was lost. */
function spillSpecial(k: AdriftCase) {
  const def = shipById('cargo-canister');
  if (!def || drifters.some((d) => d.special?.contract === k.contract)) return;
  const model = buildShip(def);
  applyCompanyBand(model, COMPANIES[k.company].colour);
  model.root.position.set(...k.position);
  model.root.quaternion.random();
  space.scene.add(model.root);
  drifters.push({ model, velocity: new THREE.Vector3(), axis: new THREE.Vector3().randomDirection(), spinRate: 0.4, burn: 0, contents: null, special: k });
  while (drifters.length > MAX_DRIFTERS) evictDrifter();
}

// --- Pirates after a lost case -----------------------------------------------------
// A beaconing case is an advert. A while after you arrive, pirates come for it;
// get there first and it's yours. If they take it and get away, they want paying.

const RAID_DELAY = 75; // seconds in the system before the pirates turn up
const PIRATES_ESCAPE = 22000; // metres from the station: a pirate this far out with your case has got away
let raidClock = 0;
const raided = new Set<string>();

function updateCaseRaid(dt: number) {
  if (!commander || state !== 'flying') return;
  const c = cmdr();
  // The pirates arrive.
  raidClock += dt;
  for (const d of drifters) {
    if (!d.special || raided.has(d.special.contract) || raidClock < RAID_DELAY) continue;
    raided.add(d.special.contract);
    const at = d.model.root.position;
    const from = at.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(6000));
    for (let i = 0; i < 2; i++) {
      const def = i === 0 ? 'mamba' : 'sidewinder';
      const npc = addNpc(def, 'pirate', from.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(250)), at);
      npc.errand = true;
      npc.destination = at.clone();
      npc.obj.lookAt(at);
      npc.ship.speed = npc.ship.maxSpeed * 0.6;
      npc.bounty = BOUNTIES[def] ?? 40;
    }
    flash(`Pirates inbound for the ${d.special.label}`, 3);
  }
  // A pirate reaches the case and takes it aboard, then runs for deep space.
  for (const npc of npcs) {
    if (!npc.errand || npc.carrying) continue;
    const d = drifters.find((x) => x.special && x.model.root.position.distanceTo(npc.obj.position) < 70);
    if (!d) continue;
    npc.carrying = d.special!.contract;
    npc.destination = station.root.position.clone().addScaledVector(npc.obj.position.clone().sub(station.root.position).normalize(), PIRATES_ESCAPE + 2000);
    disposeShip(d.model);
    drifters.splice(drifters.indexOf(d), 1);
    flash(`Pirates have taken the ${d.special!.label}: stop them before they get away`, 3.5);
  }
  // One that gets away holds it for ransom.
  for (const npc of [...npcs]) {
    if (!npc.carrying || npc.obj.position.distanceTo(station.root.position) < PIRATES_ESCAPE) continue;
    const note = takenByPirates(c, npc.carrying, Date.now());
    saveCommander(c);
    removeNpc(npc);
    if (note) flash(`${note} · see Contracts`, 4);
  }
}

/** Back in a system where you lost a case: it's still there. */
function restoreAdrift() {
  raidClock = 0;
  raided.clear();
  if (!commander) return;
  const here = currentSystem();
  for (const k of cmdr().adrift ?? []) if (!k.held && !k.fate && k.galaxy === here.galaxy && k.system === here.index) spillSpecial(k);
}

/** Cases whose time ran out elsewhere: tell the commander. */
function checkAdrift() {
  if (!commander) return [];
  const notes = expireCases(cmdr(), Date.now(), (id) => drifters.some((d) => d.special?.contract === id));
  if (notes.length) saveCommander(cmdr());
  return notes;
}

// --- Fuel scoops: canisters and sun-skimming ----------------------------------------

const SCOOP_RANGE = 45; // metres from the ship's centre
const SCOOP_SPEED = 0.4; // fraction of top speed; any faster and the canister bounces off
const HEAT_RANGE = SUN_RADIUS * 2.5; // above the surface: the cabin starts to warm
const SKIM_RANGE = SUN_RADIUS * 0.8; // above the surface: close enough to scoop fuel
const SKIM_RATE = 0.12; // light years per second at full speed
let cabinTemp = 0; // 0..100+, over 100 the hull starts to burn
let lastHeatWarning = 0;
let skimming = false;

/** A lost case answers its own contract's transponder: no scoops needed, just come in slow. */
function recoverCaseNear(d: Drifter): boolean {
  if (!d.special || d.model.root.position.distanceTo(player.obj.position) > RECOVER_RANGE) return false;
  const c = cmdr();
  const a = c.contracts?.find((x) => x.id === d.special!.contract);
  if (!a) return false;
  if (player.speed > player.maxSpeed * SCOOP_SPEED) {
    if (elapsed - lastScoopWarning > 3) {
      lastScoopWarning = elapsed;
      flash(`${a.label ?? 'Case'} · slow to under ${Math.round(SCOOP_SPEED * 100)}% speed to take it aboard`, 2);
    }
    return false;
  }
  if (freeTonnes(tradeContext()) < a.qty - 1e-9) {
    if (elapsed - lastHoldFullWarning > 3) {
      lastHoldFullWarning = elapsed;
      flash(`No room for the ${a.label ?? 'case'}: ${a.qty} t needed`, 2);
    }
    return false;
  }
  flash(recoverCase(c, a.id), 3);
  saveCommander(c);
  sfx.beep();
  return true;
}

/** Scoop a canister if it's close, we're slow and the scoops work. Returns true if it went in the hold. */
function tryScoop(d: Drifter): boolean {
  if (d.model.root.position.distanceTo(player.obj.position) > SCOOP_RANGE) return false;
  const c = cmdr();
  if (!isWorking(c, 'fuel-scoops') || player.speed > player.maxSpeed * SCOOP_SPEED) {
    // Too fast, or no scoops: it bounces off, and we say why.
    d.velocity.copy(d.model.root.position).sub(player.obj.position).setLength(25).addScaledVector(player.forward(), player.speed);
    if (elapsed - lastScoopWarning > 3) {
      lastScoopWarning = elapsed;
      sfx.scrape();
      if (!hasEquipment(c, 'fuel-scoops')) flash('Canister bounced off · no fuel scoops fitted', 2);
      else if (!isWorking(c, 'fuel-scoops')) flash('Canister bounced off · fuel scoops damaged', 2);
      else flash(`Too fast to scoop · slow to under ${Math.round(SCOOP_SPEED * 100)}% speed`, 2);
    }
    return false;
  }
  // Unlabelled canisters (debris from police ships) hold whatever was going spare.
  const contents = d.contents ?? { id: TRADE_GOODS[Math.floor(Math.random() * TRADE_GOODS.length)], qty: 1 };
  const commodity = commodityById(contents.id);
  const tonnes = contents.qty / UNITS_PER_TONNE[commodity?.unit ?? 't'];
  if (freeTonnes(tradeContext()) < tonnes - 1e-9) {
    if (elapsed - lastHoldFullWarning > 3) {
      lastHoldFullWarning = elapsed;
      flash('Cargo hold full', 1.5);
    }
    return false;
  }
  c.cargo[contents.id] = (c.cargo[contents.id] ?? 0) + contents.qty;
  if (d.stolen) markStolen(c, contents.id, contents.qty);
  saveCommander(c);
  sfx.beep();
  const illegal = commodity?.legality === 'illegal' ? ' · illegal goods' : d.stolen ? ' · stolen goods' : '';
  flash(`Scooped ${contents.qty}${commodity?.unit === 't' ? ' t' : ' ' + commodity?.unit} ${commodity?.name ?? contents.id}${illegal}`, 2);
  return true;
}
let lastHoldFullWarning = 0;
let lastScoopWarning = -Infinity;

/** Heat from the sun; with scoops, fuel from skimming it. Returns true if the heat destroyed the ship. */
function updateSun(dt: number): boolean {
  const altitude = player.obj.position.distanceTo(SUN_POS) - SUN_RADIUS;
  if (altitude < 0) return true; // flew into the sun
  const exposure = THREE.MathUtils.clamp(1 - altitude / HEAT_RANGE, 0, 1);
  // Temperature heads towards a level set by how close you are, and cools off away from the star.
  const targetTemp = exposure ** 1.6 * 140;
  cabinTemp += (targetTemp - cabinTemp) * Math.min(1, dt * (targetTemp > cabinTemp ? 0.35 : 0.5));
  const gauge = $('#g-temp');
  gauge.style.setProperty('--v', String(Math.min(1, cabinTemp / 100)));
  gauge.classList.toggle('hot', cabinTemp > 75);
  if (cabinTemp > 80 && elapsed - lastHeatWarning > 4) {
    lastHeatWarning = elapsed;
    sfx.beep();
    flash(cabinTemp > 100 ? 'Cabin temperature critical · hull burning' : 'Cabin temperature high', 1.5);
  }
  if (cabinTemp > 100 && damagePlayer((cabinTemp - 100) * 0.6 * dt)) return true;

  const c = cmdr();
  const canSkim = altitude < SKIM_RANGE && isWorking(c, 'fuel-scoops') && player.speed > player.maxSpeed * 0.2;
  if (canSkim && c.fuel < fuelCapacity(c)) {
    if (!skimming) flash('Fuel scooping', 1.5);
    c.fuel = Math.min(fuelCapacity(c), c.fuel + SKIM_RATE * (player.speed / player.maxSpeed) * dt);
    if (c.fuel >= fuelCapacity(c)) {
      c.fuel = fuelCapacity(c);
      flash('Fuel tanks full', 1.5);
    }
  } else if (skimming) {
    c.fuel = Math.round(c.fuel * 10) / 10;
    saveCommander(c);
  }
  skimming = canSkim && c.fuel < fuelCapacity(c);
  return false;
}

function updateDrifters(dt: number) {
  const toPlanet = new THREE.Vector3();
  for (let i = drifters.length - 1; i >= 0; i--) {
    const d = drifters[i];
    const root = d.model.root;
    toPlanet.copy(planetPos).sub(root.position);
    const r = toPlanet.length();
    toPlanet.normalize();
    if (d.special && state === 'flying' && recoverCaseNear(d)) {
      disposeShip(d.model);
      drifters.splice(i, 1);
      continue;
    }
    if (d.special && Date.now() - d.special.lost < ADRIFT_HOLD) {
      // Holding station on its own thrusters until containment runs down.
      d.velocity.multiplyScalar(Math.exp(-dt));
      root.position.addScaledVector(d.velocity, dt);
      root.rotateOnAxis(d.axis, d.spinRate * dt);
      continue;
    }
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

    if (state === 'flying' && !d.special && tryScoop(d)) {
      disposeShip(d.model);
      drifters.splice(i, 1);
      continue;
    }

    if (d.burn >= BURN_TIME || r < planetRadius) {
      const flare = new Explosion(d.model.def, root, d.velocity);
      space.scene.add(flare.group);
      explosions.push(flare);
    }
    if (d.burn >= BURN_TIME || r < planetRadius || (r > LOST_IN_SPACE && !d.special)) {
      if (d.special && commander) {
        flash(caseLost(cmdr(), d.special.contract), 4);
        saveCommander(cmdr());
      }
      disposeShip(d.model);
      drifters.splice(i, 1);
    }
  }
}

const explosions: Explosion[] = [];

const FLIP = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);

// --- Views: look front, rear, left or right while the ship flies on ---------------
// Each view fires the laser on that mount. Classic mounts are fixed, as in
// 1984; Modern rear and side mounts are turrets that hit the nearest ship
// near the middle of the view.

const VIEWS: Mount[] = ['front', 'rear', 'left', 'right'];
const VIEW_TURN: Record<Mount, number> = { front: 0, rear: Math.PI, left: Math.PI / 2, right: -Math.PI / 2 };
const TURRET_CONE = THREE.MathUtils.degToRad(20);
let view: Mount = 'front';

function setView(next: Mount) {
  view = next;
  const label = $('#view-label');
  label.hidden = view === 'front';
  label.textContent = `${view} view`;
  if (view !== 'front') {
    const laser = cmdr().lasers[view];
    flash(laser ? `${view} view · ${PLAYER_LASERS[laser].name}` : `${view} view · no ${view} laser fitted`, 1.4);
  }
}

/** Which way the current view looks, in the world. */
function viewDirection(): THREE.Vector3 {
  switch (view) {
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
    surveyPilot = null;
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
  updateCaseRaid(dt);
  updateResponses();
  updateHail();
  updateMissileButton();
  for (let i = explosions.length - 1; i >= 0; i--) if (!explosions[i].update(dt)) explosions.splice(i, 1);
  updateMarshals(dt);

  let input: ReturnType<typeof flightInput> | null = null;
  if (state === 'flying') {
    const prev = station.toLocal(player.obj.position);
    input = flightInput();
    if (autopilot && input.active) setAutopilot(false, 'Docking computer off');
    if (surveyPilot && input.active) stopSurveyPilot('Survey autopilot off · you have control');
    checkCombatComputer(input);

    // Mouse aim: steer the nose towards the reticle. Turning with keys or
    // while the computer flies puts the reticle back on the nose.
    const keysTurning = input.pitch !== 0 || input.yaw !== 0;
    if (input.recentre) aim.reset(player);
    if (combatComputer) {
      // The computer flies; the mouse (or aim pad) only aims the guns.
      aim.move(player, input.aimDx, input.aimDy);
      aim.clamp(player);
    } else if (controlScheme() === 'mouse' && isMouseCaptured() && !autopilot && !surveyPilot && !keysTurning && view === 'front') {
      aim.move(player, input.aimDx, input.aimDy);
      const s = aim.steer(player);
      input.pitch = s.pitch;
      input.yaw = s.yaw;
    } else {
      aim.reset(player);
    }

    rollAssist = !autopilot && !surveyPilot && !combatComputer && cmdr().difficulty === 'modern' && input.roll === 0 && rollAssistApplies();
    if (rollAssist) {
      input.roll = THREE.MathUtils.clamp(-ROLL_ASSIST_GAIN * station.rollError(player), -1, 1);
    } else if (!autopilot && !surveyPilot && !combatComputer && controlScheme() === 'mouse' && input.roll === 0) {
      // Flight assist: with no roll input, level the wings with the star
      // system's "up" so there's always a horizon. Weaker when pointing
      // steeply up or down, where "level" stops meaning much.
      const steep = Math.abs(player.forward().y);
      input.roll = THREE.MathUtils.clamp(AUTO_LEVEL_GAIN * player.right().y * (1 - steep), -1, 1);
    }
    if (autopilot) dockingComputer.update(dt, player, station);
    else if (combatComputer) {
      if (!combatComputer.fly(dt, player, npcs, locked, { centre: planetPos, radius: planetRadius })) stopCombatComputer('No hostiles · combat computer standing down · you have control');
    } else if (surveyPilot) flySurvey(dt, surveyPilot);
    else {
      holdForSurrender(input);
      player.steer(dt, input);
    }
    player.move(dt);
    player.recharge(dt, isWorking(cmdr(), 'extra-energy') ? 2 : 1);

    if (updateSun(dt)) {
      sfx.thud();
      die();
      return;
    }
    const altitude = player.obj.position.distanceTo(planetPos) - planetRadius;
    if (altitude < 0 || updateExplore(dt)) {
      sfx.thud();
      die();
      return;
    }
    if (altitude < planetRadius * 0.12 && elapsed - lastAltitudeWarning > 4) {
      lastAltitudeWarning = elapsed;
      sfx.beep();
      flash('Altitude warning', 1.5);
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
  updateSharedSpace(dt, input);
  if (state === 'flying') {
    updateClearance();
    updateSurrender(dt);
    updateRouteAutopilot();
    updateIdentities();
    updateRadio(dt);
  }
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
    if (view !== 'front') camera.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), VIEW_TURN[view]));
    if (shake > 0.01) {
      camera.position.add(new THREE.Vector3().randomDirection().multiplyScalar(shake * 2.5));
      shake *= Math.exp(-dt * 6);
    }
  }
  space.stars.position.copy(camera.position);
  camera.updateMatrixWorld();
  setListener(camera);
  dust.update(camera.position, state === 'flying' ? player.forward().multiplyScalar(player.speed) : new THREE.Vector3());

  const sighted = state === 'flying' ? sightedNpc() : null;
  const blips: Blip[] = [
    { position: station.root.position, color: '#ffb347', kind: 'station' },
    ...npcs.map((p): Blip => ({ position: p.obj.position, color: npcColour(p), kind: 'ship', sighted: p === sighted, locked: p === locked })),
    ...drifters.map((d): Blip => ({ position: d.model.root.position, color: '#ffd166', kind: 'cargo' })),
    ...missiles.map((m): Blip => ({ position: m.position, color: '#ff6b6b', kind: 'missile' })),
  ];
  if (carrier?.rift) blips.push({ position: carrier.rift.group.position, color: '#cfe0ff', kind: 'station' });
  for (const r of sharedSpace.remotes.values()) blips.push({ position: r.position, color: commanderColour(r), kind: 'commander', locked: r === lockedCommander });
  for (const n of netMissiles.values()) blips.push({ position: n.missile.position, color: '#ff6b6b', kind: 'missile' });
  // Near a rift, contacts jitter about on the scanner.
  const noise = state === 'flying' ? riftInterference() : 0;
  if (noise > 0) for (const b of blips) b.position = b.position.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(noise * 600 * Math.random()));
  setInterference(noise);
  updateSeekerBox();
  if (state === 'flying') {
    updateHud(player, station, blips, autopilot || Boolean(combatComputer), rollAssist);
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

// --- Situational awareness markers ----------------------------------------------

/** Red if it's after you; otherwise police blue, Marshals gold, trader green, pirate orange. */
/** The display colour for a ship with no transponder that we can't yet read. */
const UNIDENTIFIED_HEX = `#${UNIDENTIFIED.getHexString()}`;

/** Can we say who this ship is? Yes, unless it's running dark and too far off to read its hull. */
const npcIdentified = (npc: NpcShip) => !npc.dark || npc.obj.position.distanceTo(player.obj.position) < HULL_READ;

function npcColour(npc: NpcShip) {
  // Unknown until the hull is read; but once it has fired on you, whoever it is, it's hostile.
  if (!npcIdentified(npc)) return npc.firedOnPlayer ? '#ff4d6d' : UNIDENTIFIED_HEX;
  if (npc.hostile) return '#ff4d6d';
  return npc.role === 'police' ? '#4aa8ff' : npc.role === 'marshal' ? '#ffd98a' : npc.role === 'pirate' ? '#ff9a3d' : '#9ef0c0';
}

function updateMarkers() {
  const km = (p: THREE.Vector3) => {
    const d = p.distanceTo(player.obj.position);
    return d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  };
  const calling = new Set(distresses.filter((d) => d.heard).map((d) => d.trader));
  const markers: Marker[] = npcs.map((npc) => ({
    position: npc.obj.position,
    color: npc === locked ? '#ff4d6d' : npcColour(npc),
    radius: npc.radius,
    // A trader's distress call gives its position away, wherever it is.
    label: calling.has(npc) ? `MAYDAY ${km(npc.obj.position)}` : npc.hostile || npc.obj.position.distanceTo(player.obj.position) < 1500 ? km(npc.obj.position) : undefined,
  }));
  markers.push({ position: station.root.position, color: '#ffb347', radius: station.model.radius, label: `Station ${km(station.root.position)}` });
  markers.push({ position: SUN_POS, color: '#ffe08a', radius: SUN_RADIUS, label: `Sun ${km(SUN_POS)}` });
  markers.push(...exploreMarkers(km));
  // Lost company cases beacon to anyone in the system.
  for (const d of drifters) {
    if (!d.special) continue;
    const short = { hexon: 'Hexon', vorg: 'Vorg', mutual: 'Mutual', wy: 'W-Y' }[d.special.company];
    markers.push({ position: d.model.root.position, color: COMPANIES[d.special.company].colour, radius: 6, label: `${short} property · sealed ${km(d.model.root.position)}` });
  }
  for (const r of sharedSpace.remotes.values()) markers.push({ position: r.position, color: commanderColour(r), radius: 30, label: callsignTag(r, km(r.position)) });
  if (carrier?.rift) markers.push({ position: carrier.rift.group.position, color: '#cfe0ff', radius: carrier.rift.radius, label: `Rift ${km(carrier.rift.group.position)}` });
  for (const m of missiles) if (m.target === player) markers.push({ position: m.position, color: '#ff4d6d', radius: 6, label: `MISSILE ${km(m.position)}` });
  const view = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  updateIndicators(camera, view, markers);
}

// --- Combat HUD ------------------------------------------------------------------

const laserGauge = $('#g-laser');
const crosshair = $('.crosshair');
const targetInfo = $('#target-info');
const CARGO_SCAN_RANGE = 2000; // metres: close enough to read another ship's hold

const missilePips = $('#missile-pips');

function updateCombatHud() {
  const rails = player.def.stats.missiles ?? 0;
  if (missilePips.childElementCount !== rails) missilePips.innerHTML = '<i></i>'.repeat(rails);
  missilePips.querySelectorAll('i').forEach((pip, i) => pip.classList.toggle('armed', i < cmdr().missiles));
  missilePips.classList.toggle('locked', Boolean(locked));
  laserGauge.style.setProperty('--v', String(laserHeat / 100));
  laserGauge.classList.toggle('hot', overheated || laserHeat > 75);
  // Name whatever is closest to where the guns point, if it's near enough.
  const fwd = laserDirection();
  // Whichever sight the lasers follow (ring if gimballed, centre cross if
  // fixed) turns red when a shot would hit.
  const onTarget = Boolean(
    rayHit(player.obj.position, fwd, playerLaser().range, npcs.map((npc) => ({ value: npc, position: npc.obj.position, radius: npc.radius * 0.75 }))),
  );
  reticle.classList.toggle('on-target', onTarget && gimballed());
  crosshair.classList.toggle('on-target', onTarget && !gimballed());
  const best = sightedNpc();
  targetInfo.hidden = !best;
  if (best && !npcIdentified(best)) {
    // No transponder, and too far for a hull read: a ship, and nothing more.
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    targetInfo.textContent = `Unidentified ship · no transponder · ${km} km${best.firedOnPlayer ? ' · HOSTILE' : ''}${best === locked ? ' · LOCKED' : ''}`;
    targetInfo.classList.toggle('hostile', Boolean(best.firedOnPlayer));
  } else if (best) {
    // The transponder: type, role, condition and standing.
    const km = (best.obj.position.distanceTo(player.obj.position) / 1000).toFixed(1);
    const standing = best.role === 'pirate' ? 'WANTED' : best.role === 'police' ? 'POLICE' : best.role === 'marshal' ? 'MARSHALS' : 'CLEAN';
    const owner = best.company ? COMPANIES[best.company].name.toUpperCase() : best.role.toUpperCase();
    targetInfo.textContent = `${best.def.name} · ${owner} · ${km} km · ${Math.round(best.health * 100)}% · ${best.hostile ? 'HOSTILE' : standing}${best === locked ? ' · LOCKED' : ''}`;
    // Close enough, the scanner reads the hold.
    if (best.obj.position.distanceTo(player.obj.position) < CARGO_SCAN_RANGE && best.role !== 'police' && best.role !== 'marshal') {
      const hold = Object.entries(best.cargo)
        .filter(([, q]) => q > 0)
        .map(([id, q]) => `${q}${commodityById(id)?.unit === 't' ? ' t' : ' ' + commodityById(id)?.unit} ${commodityById(id)?.name ?? id}`);
      const line = document.createElement('span');
      line.className = 'cargo';
      line.textContent = `Hold: ${hold.join(' · ') || 'empty'}`;
      targetInfo.append(line);
    }
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
  reticle.hidden = !captured || controlScheme() !== 'mouse' || view !== 'front';
  if (reticle.hidden) return;
  // Project the aim direction onto whichever canvas is showing.
  const p = camera.position.clone().addScaledVector(aim.dir, 1000).project(camera);
  const rect = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  const x = rect.left + ((p.x + 1) / 2) * rect.width;
  const y = rect.top + ((1 - p.y) / 2) * rect.height;
  reticle.style.transform = `translate(${x}px, ${y}px)`;
}

const KEYS_HINT = {
  mouse: 'Mouse aim · Click fire · W/S throttle · A/D roll · T arm missile · X fire it · G map · H hyperspace · J jump · C docking computer · F1 controls',
  keyboard: 'W/S pitch · A/D roll · Space/Shift throttle · F fire · T arm missile · X fire it · G map · H hyperspace · J jump · C docking · F1 controls',
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
      ['O', 'Combat computer: it flies, you man the turrets (needs one fitted; any flight control takes over)'],
      ['9', 'Survey autopilot: flies to whatever is left to survey or find here, and holds you in range (explorers; any flight control takes over)'],
      ['P', 'Take a photo of the view, without the HUD (saved, or shared on phones)'],
      ['J', 'In-system jump: leap ~10 km ahead (not near ships, the station or the planet)'],
      ['T', 'Arm a missile: hold a ship in your sights until the tone goes solid (Classic: lock at once). Again to disarm'],
      ['X', 'Launch the locked missile'],
      ['Z', 'ECM: destroy every missile nearby, yours included (needs an ECM)'],
      ['1 2 3 4 / V', 'Look front, rear, left or right (V cycles); fire uses that mount\'s laser'],
      ['R', 'Scanner range: 4 km for dogfights, 12 km for traffic'],
      ['B', 'Energy bomb: destroy every ship within 6 km (single use)'],
      ['Y', 'Galactic hyperdrive: jump to the next galaxy (single use)'],
      ['U', 'Surrender to the police: the ship stops itself, then 5 seconds (fine, record cleared)'],
      ...(commander?.difficulty === 'modern' ? [['0', 'Transponder off / on: run dark, unidentified (police will hail you; it switches back on after a jump, or to dock when it\'s safe)']] : []),
      ...(commander?.difficulty === 'modern'
        ? [
            ['L', 'Hail the ship in your sights (or the station, within 5 km; anywhere with a comms array)'],
            ["'", 'Radio log: open / close'],
            ['Enter', 'Accept the latest offer on the radio'],
            ['`', 'Emergency beacon: Mayday, out of fuel, hull failing, request escort (1–4 to send)'],
          ]
        : []),
      ['Scoop', `Fly slowly (under ${Math.round(SCOOP_SPEED * 100)}% speed) straight into a cargo canister, a yellow dot on the scanner (needs Fuel Scoops)`],
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

/** First flight: a nudge towards the controls card, rather than opening it over the view. */
function showControlsCardOnce() {
  renderControlsCard();
  if (isTouch) return; // touch has its own on-screen controls
  try {
    if (localStorage.getItem('witchspace.seenControls')) return;
    localStorage.setItem('witchspace.seenControls', '1');
  } catch {
    // Storage blocked: a nudge every launch is harmless.
  }
  setTimeout(() => state === 'flying' && flash('Press F1 for the controls', 4), 1500);
}

// --- Full screen on phones ---------------------------------------------------
// Android can go full screen from the page. iPhone Safari can't: its bars only
// go when the game is added to the Home Screen (manifest + apple meta in
// play/index.html), and only then can the companies reach an iPhone. So the
// title screen says how, until it's done or put off for a few days.

const standalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;
const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);

const INSTALL_LATER = 'witchspace.installLater';
const INSTALL_PAUSE = 3 * 86_400_000; // "Not now" holds for three days
/** Chrome's own install prompt, kept for our button (Android). */
let installPrompt: (Event & { prompt(): Promise<void> }) | null = null;

function showInstall() {
  let later = 0;
  try {
    later = Number(localStorage.getItem(INSTALL_LATER) ?? 0);
  } catch {
    // Storage blocked: offer it each visit, which is harmless.
  }
  const offer = isTouch && !standalone() && (isIos || installPrompt !== null) && Date.now() - later > INSTALL_PAUSE;
  $('#install').hidden = !offer;
  if (!offer) return;
  $('#install-go').hidden = !installPrompt;
  $('#install-how').innerHTML = installPrompt
    ? 'Install Witchspace and play from its icon, like an app.'
    : 'Tap <b>Share</b> (under <b>•••</b> on newer iPhones), then <b>Add to Home Screen</b>, and play from the icon.<span class="install-why"> The companies can only send notifications to an iPhone that way.</span>';
}
addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  installPrompt = e as typeof installPrompt;
  showInstall();
});
$('#install-go').addEventListener('click', async () => {
  await installPrompt?.prompt();
  installPrompt = null;
  showInstall();
});
$('#install-later').addEventListener('click', () => {
  try {
    localStorage.setItem(INSTALL_LATER, String(Date.now()));
  } catch {
    // Storage blocked: it's back next visit.
  }
  $('#install').hidden = true;
});
showInstall();

if (isTouch && !isIos) {
  addEventListener(
    'touchend',
    () => void document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }).catch(() => {}),
    { once: true },
  );
}

async function launch() {
  const repaired = fitTransponderForLaunch();
  ensureSystemScene();
  setState('transition');
  if (!isRetro() && isWorking(cmdr(), 'docking-computer')) preloadRecording();
  sfx.tunnel();
  await playTunnel();
  inSpace = true;
  closeDrawer(); // a clean screen to fly from
  sharedSpace.resume(); // launching here means flying here, even if another window had the ship
  player.repair();
  station.placeForLaunch(player);
  aim.reset(player);
  player.speed = player.maxSpeed * 0.3;
  cabinTemp = 0;
  locked = null;
  seeker = null;
  scheduleMarshals(); // still wanted? they'll be back
  raidClock = 0;
  setView('front');
  clearanceAnnounced = true; // you've just left; no need to tell you
  setState('flying');
  // The station that launched you knows exactly who you are: a broken
  // transponder is logged, not hailed, for the rest of this visit.
  if (repaired !== null) {
    flash(`${stationName(currentSystem()).name} · No launch clearance without a working transponder · repaired${repaired ? ` · ${repaired.toLocaleString()} Cr` : ' on the house'}`, 4.5);
  } else if (transponderBroken() && hasLaw(currentSystem())) {
    hullChecked = true;
    flash(`${stationName(currentSystem()).name} · Transponder damaged · your hull is logged, police won't hail you here · repair it when you dock`, 4.5);
  } else flash(`${stationName(currentSystem()).name} · ${currentSystem().name}`, 2.5);
  if (recordVisit(cmdr(), currentSystem())) saveCommander(cmdr()); // where you started counts
  // The radio (Modern): what was said while you were docked, and the array listening from the start.
  for (const b of document.querySelectorAll<HTMLElement>('#touch .radio-button')) b.hidden = !modern();
  wakeRadio();
  arrayTimer = 6;
  distresses.length = 0;
  escort = null;
  announceEvent(currentSystem(), 2800);
}

/**
 * Stations that check transponders won't clear a ship without a working one:
 * a broken transponder is fixed before launch, for what you can pay (and on
 * the house if you can't). Returns what it cost, or null if nothing was done.
 */
function fitTransponderForLaunch(): number | null {
  const c = cmdr();
  if (c.difficulty !== 'modern' || !checksClearance(currentSystem())) return null;
  transponderOff = false; // cleared out with it on; switch it off once you're away
  if (!transponderBroken()) return null;
  const cost = Math.min(c.credits, Math.round(EQUIPMENT.find((e) => e.id === 'transponder')!.price * REPAIR_FRACTION));
  c.credits = Math.round((c.credits - cost) * 10) / 10;
  c.damaged = c.damaged.filter((id) => id !== 'transponder');
  saveCommander(c);
  return cost;
}

async function dock() {
  setAutopilot(false);
  surrenderTimer = null;
  setState('transition');
  sfx.tunnel();
  await playTunnel();
  const c = cmdr();
  // Offenders are fined on arrival; lawful stations also inspect the hold.
  const sys = currentSystem();
  // Inspections are certain under Classic rules and likely, not certain, under Modern.
  const smuggling = carriesContraband(c);
  const inspected = smuggling && Math.random() < inspectionChance(c, sys);
  // Strict stations weigh ships: one heavier than its papers gets its hidden compartment opened.
  const weighed = !smuggling && checksClearance(sys) && weighsShips(sys) && hidingSomething(c, sys) && Math.random() < WEIGHBRIDGE_CHANCE;
  if (weighed) delete c.compartment;
  const due = checksClearance(sys) && (legalStatus(c) === 'offender' || inspected || weighed);
  const settlement = due ? settle(c) : null;
  const specialsDue = (c.contracts ?? []).filter((a) => a.special && a.to.system === sys.index && a.to.galaxy === sys.galaxy && a.jumpsLeft >= 0).map((a) => a.company);
  const held = [...exploreOf(c).data];
  const seen = messageIds();
  const delivered = deliver(c, sys);
  // Work accepted over the comms array, waiting here: loaded if it fits.
  const collected = collect(c, sys, cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
  bringHome(held);
  void loadFirsts(sys.galaxy);
  const news = checkMessages(c, sys, Date.now());
  const gone = [...collectHeld(c, sys), ...checkAdrift()];
  saveCommander(c);
  enterDocked();
  radioMessages(seen); // heard on the radio too, for the log when you launch
  markInbox(c);
  if (settlement) flash(settlementMessage(settlement, weighed ? 'Weighbridge: heavier than your papers · hidden compartment opened' : inspected ? 'Hold inspected' : 'Fined on arrival'), 6);
  else if (delivered.length || collected.length) flash([...delivered, ...specialsDue.map(thanksFrom), ...collected].join(' · '), 6);
  else if (gone.length) flash(gone.join(' · '), 5);
  else if (news.length) flash(`New message from ${COMPANIES[news[0].company].name}: ${news[0].subject}`, 5);
  else if (smuggling && inspectionChance(c, sys) > 0) flash('Docked · your hold was not inspected this time', 3);
}

function settlementMessage(s: Settlement, lead: string) {
  const parts = [`${lead} · ${s.fine.toLocaleString()} Cr`];
  if (s.confiscated.length) parts.push(`${s.confiscated.map((id) => commodityById(id)?.name ?? EQUIPMENT.find((e) => e.id === id)?.name ?? id).join(', ')} confiscated`);
  if (s.owed > 0) parts.push(`couldn't pay ${s.owed.toLocaleString()} Cr · equipment impounded`);
  return parts.join(' · ');
}

// --- Docking clearance and surrender ------------------------------------------------

const CLEARANCE_RANGE = 5000; // metres
let clearanceAnnounced = false;

/** Fugitives are turned away by any station that checks; anarchies and feudal worlds don't. */
const clearanceRefused = () => checksClearance(currentSystem()) && isFugitive();
/** A station in lockdown (something got loose aboard) lets nobody in. */
const lockedDown = () => eventsAt(currentSystem(), Date.now(), Date.now()).some((e) => e.type === 'lockdown');

function updateClearance() {
  const d = player.obj.position.distanceTo(station.root.position);
  if (d > CLEARANCE_RANGE * 1.6) clearanceAnnounced = false;
  if (clearanceAnnounced || d > CLEARANCE_RANGE) return;
  clearanceAnnounced = true;
  const name = stationName(currentSystem()).name;
  // Running dark into a lawful station: switch on to dock, if that's safe.
  if (darkRefused() && !lockedDown() && !clearanceRefused() && !transponderOnToDock()) return;
  if (lockedDown()) radio('station', name, 'Lockdown: containment breach · docking suspended', { flash: 4, urgent: true });
  else if (clearanceRefused()) radio('station', name, 'Docking refused: you are a Fugitive · U to surrender', { flash: 4, urgent: true });
  else if (darkRefused()) radio('station', name, 'Unidentified ship: switch on your transponder to dock', { flash: 4, urgent: true });
  else if (checksClearance(currentSystem())) radio('station', name, 'Transponder checked · Docking clearance granted', { flash: 2.5 });
  else radio('station', name, 'No questions asked', { flash: 2.5 });
  if (!lockedDown() && !clearanceRefused()) setTimeout(() => state === 'flying' && offerRouteWork(), 3000);
}

// --- What you're doing, and what's next (docs/design/flight-hud-and-touch.md) -------

/** Boards (system and half-hour) already mentioned, so traffic control says it once. */
const routeWorkSaid = new Set<string>();

/** Approaching a station: traffic control mentions one job on its board that goes your way. */
function offerRouteWork() {
  const c = cmdr();
  if (c.difficulty !== 'modern') return;
  const here = currentSystem();
  const now = Date.now();
  const key = `${here.galaxy}:${here.index}:${Math.floor(now / BOARD_SLOT)}`;
  if (routeWorkSaid.has(key)) return;
  const fit = routeWork(c, here, board(c, here, now), cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
  if (!fit) return;
  routeWorkSaid.add(key);
  const o = fit.offer;
  const what = `${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}`;
  radio('station', stationName(here).name, `${COMPANY_SHORT[o.company]} has ${what}, ${fit.why} · ${o.pay.toLocaleString()} Cr · dock to take it`, { flash: 5 });
  routeMessage(o, here, fit.why);
  saveCommander(c);
}

const jobBox = $('#job');
let jobStep: JobStep | null = null;
let jobKey = '';
let jobTimer = 0;
let jobListOpen = false;
/** A fight under way, and how long it's been quiet: when it's over, the computer says what's next. */
const fight = { on: false, calm: 0 };
const FIGHT_RANGE = 8000; // metres
const CALM_AFTER = 4; // seconds without a hostile in range

function updateJob(dt: number) {
  const pos = player.obj.position;
  const hostile =
    npcs.some((n) => n.hostile && n.obj.position.distanceTo(pos) < FIGHT_RANGE) ||
    [...sharedSpace.remotes.values()].some((r) => sharedSpace.isHostile(r) && r.position.distanceTo(pos) < FIGHT_RANGE);
  if (hostile) {
    // A fight: the strip folds away to keep the screen clear, and so does the radio log.
    if (!fight.on && jobOpen) {
      jobOpen = false;
      jobKey = '';
    }
    if (!fight.on) setRadioFight(true);
    Object.assign(fight, { on: true, calm: 0 });
  }
  else if (fight.on && (fight.calm += dt) >= CALM_AFTER) {
    fight.on = false;
    setRadioFight(false);
    const s = cmdr().difficulty === 'modern' ? jobStrip(cmdr(), currentSystem()) : null;
    if (s) radio('company', COMPANIES[s.step.contract.company].name, `Back on course · ${s.step.line.split(' · ')[0]} · ${s.step.next}`, { colour: COMPANIES[s.step.contract.company].colour });
  }
  jobTimer -= dt;
  if (jobTimer > 0) return;
  jobTimer = 0.5;
  renderJob();
  updateContextButton();
}

function renderJob() {
  const s = cmdr().difficulty === 'modern' ? jobStrip(cmdr(), currentSystem()) : null;
  jobStep = s?.step ?? null;
  jobBox.hidden = !s;
  if (!s) return;
  const key = JSON.stringify([s.all.map((x) => [x.line, x.next]), jobListOpen, jobOpen]);
  if (key === jobKey) return;
  jobKey = key;
  jobBox.className = `${s.step.urgency}${s.step.action === 'course' ? ' actionable' : ''}${jobOpen ? ' open' : ''}`;
  $('#job .job-short').textContent = `▸ ${s.step.short}${s.more ? ` · +${s.more}` : ''}`;
  $('#job .job-line').textContent = `▸ ${s.step.line}`;
  $('#job .job-next').textContent = `Next: ${s.step.next}`;
  const go = $('#job .job-go');
  go.hidden = !(s.step.action === 'course' && s.step.hop);
  go.textContent = `Set course · ${s.step.hop?.name ?? ''}`;
  const more = $('#job .job-more');
  more.hidden = !s.more;
  more.textContent = jobListOpen ? 'Hide' : `+${s.more} more`;
  const list = $('#job .job-list');
  list.hidden = !jobListOpen || !s.more;
  list.innerHTML = s.all
    .slice(1)
    .map((x) => `<li>${escapeHtml(x.line)}<small>${escapeHtml(x.next)}</small></li>`)
    .join('');
}

/** On a phone, the strip is a pill until tapped open. */
let jobOpen = false;
onTap($('#job .job-main'), () => {
  if (isTouch) jobOpen = !jobOpen;
  else if (jobStep?.action === 'course' && jobStep.end) setJobCourse();
  jobKey = '';
  renderJob();
});
onTap($('#job .job-go'), setJobCourse);
function setJobCourse() {
  if (!jobStep?.end) return;
  flash(plotCourse(cmdr(), jobStep.end.index), 2.5);
  saveCommander(cmdr());
  jobKey = '';
  renderJob();
}
onTap($('#job .job-more'), () => {
  jobListOpen = !jobListOpen;
  jobKey = '';
  renderJob();
});

// --- The radio (docs/design/radio-and-comms.md) -------------------------------------
// Under Modern rules, everything said to you in flight goes in the radio log:
// station traffic, police, pirates, traders and the companies, each in its
// own colour. The few lines that matter this second still flash as well.
// Classic keeps its flashes, as in 1984.

const modern = () => commander !== null && cmdr().difficulty === 'modern';
/** A working comms array: the companies reach you anywhere, and you hear further. */
const hasArray = () => modern() && isWorking(cmdr(), 'comms-array');

interface RadioOpts {
  /** Seconds to flash it: always under Classic, and under Modern if it's urgent. */
  flash?: number;
  urgent?: boolean;
  colour?: string;
  action?: RadioAction;
  /** The flashed text, when it isn't "from · text". */
  line?: string;
}

function radio(kind: RadioKind, from: string, text: string, o: RadioOpts = {}) {
  const line = o.line ?? `${from} · ${text}`;
  if (!modern()) {
    if (o.flash) flash(line, o.flash);
    return;
  }
  say({ kind, from, text, colour: o.colour, action: o.action });
  if (o.urgent && o.flash) flash(line, o.flash);
}

const companyVoice = (id: CompanyId) => ({ from: COMPANIES[id].name, colour: COMPANIES[id].colour });

/** The companies' notes (the ones kept in Messages) are heard on the radio too. */
const messageIds = () => new Set((cmdr().messages ?? []).map((m) => m.id));
function radioMessages(seen: Set<string>) {
  if (!modern()) return;
  for (const m of [...(cmdr().messages ?? [])].reverse()) {
    if (seen.has(m.id)) continue;
    say({ kind: 'company', ...companyVoice(m.company), ...(m.from ? { from: m.from } : {}), text: `${m.subject}: ${m.body}` });
  }
}

// Who's speaking, and what they know: a ship's serial and how often you've
// hailed it pick the line (the station's, the minute).
const serials = new WeakMap<NpcShip, number>();
let nextSerial = 0;
const serialOf = (n: NpcShip) => serials.get(n) ?? (serials.set(n, ++nextSerial), nextSerial);
const minute = () => Math.floor(Date.now() / 60_000);
const hailsOf = new WeakMap<NpcShip, number>();

function speakerOf(npc: NpcShip): { who: Speaker; kind: RadioKind; from: string; colour?: string } {
  if (!npcIdentified(npc)) return { who: npc.def.id === 'falcon' ? 'falcon' : npc.role === 'trader' ? 'trader' : 'pirate', kind: 'ship', from: `Unidentified ${npc.def.name}`, colour: UNIDENTIFIED_HEX };
  if (npc.def.id === 'falcon') return { who: 'falcon', kind: 'pirate', from: 'Falcon' };
  switch (npc.role) {
    case 'police':
      return { who: 'police', kind: 'police', from: `${currentSystem().name} police` };
    case 'marshal':
      return { who: 'marshal', kind: 'police', from: 'Co-operative Marshals', colour: '#ffd98a' };
    case 'trader':
      return { who: 'trader', kind: 'ship', from: npc.company ? `${COMPANIES[npc.company].name} ${npc.def.name}` : npc.def.name, colour: npc.company ? COMPANIES[npc.company].colour : '#9ef0c0' };
    default:
      return { who: 'pirate', kind: 'pirate', from: npc.def.name };
  }
}

function hailContext(k: number, npc?: NpcShip): HailContext {
  const sys = currentSystem();
  return {
    system: sys,
    k,
    status: legalStatus(cmdr()),
    dark: dark() && !identified(),
    scared: npc ? npc.attackedAgo < 12 : false,
    wronged: npc ? npc.attacker === player && npc.attackedAgo < 120 : false,
    company: npc?.company ? COMPANIES[npc.company].name : undefined,
    lawless: !checksClearance(sys),
  };
}

/** What's in your hold, as a pirate's scanner reads it. */
function playerHoldValue(): number {
  const prices = new Map(quotes(tradeContext()).map((q) => [q.commodity.id, q.price]));
  return Object.entries(cmdr().cargo).reduce((v, [id, q]) => v + q * (prices.get(id) ?? 0), 0);
}

/** L: hail the ship in your sights (or your missile's target); with nothing there, the station. */
function hailTarget() {
  if (!modern()) return flash('Classic rules: only the station talks to you', 1.5);
  const pos = player.obj.position;
  const npc = (locked && npcs.includes(locked) ? locked : null) ?? sightedNpc(RADIO_RANGE, isTouch ? 14 : 8);
  sfx.beep();
  if (npc) {
    const sp = speakerOf(npc);
    const d = npc.obj.position.distanceTo(pos);
    if (d > RADIO_RANGE) return radio('ship', 'Radio', `No answer from the ${npc.def.name}: ${(d / 1000).toFixed(1)} km, out of radio range`);
    // Ask again and you may get another line; the same ship, asked the same number of times, says the same.
    const asked = (hailsOf.get(npc) ?? 0) + 1;
    hailsOf.set(npc, asked);
    const ctx = hailContext(serialOf(npc) * 1000 + asked, npc);
    if (npc.paid) return radio('pirate', sp.from, "We had a deal. Don't push it.");
    if (sp.who === 'pirate' && npcIdentified(npc)) {
      const r = pirateAnswer(ctx, playerHoldValue(), cmdr().credits);
      return radio('pirate', sp.from, r.text, { colour: sp.colour, action: r.toll ? payOff(npc, r.toll) : undefined, flash: r.toll ? 4 : undefined, urgent: Boolean(r.toll) });
    }
    return radio(sp.kind, sp.from, hailReply(sp.who, ctx).text, { colour: sp.colour });
  }
  const d = pos.distanceTo(station.root.position);
  const name = stationName(currentSystem()).name;
  if (d > CLEARANCE_RANGE && !hasArray()) return radio('station', 'Radio', `Nothing in your sights, and ${name} is out of range: traffic control answers within ${CLEARANCE_RANGE / 1000} km`);
  radio('station', name, hailReply('station', hailContext(minute())).text);
}

/** A pirate's price, on the radio: pay it, and the band leaves you be. */
function payOff(npc: NpcShip, toll: number): RadioAction {
  return {
    label: `Pay ${toll} Cr`,
    done: 'Paid',
    until: Date.now() + 30_000,
    run: () => {
      const c = cmdr();
      if (!npcs.includes(npc)) return { kind: 'pirate', from: npc.def.name, text: '...' };
      if (c.credits < toll) return { kind: 'pirate', from: npc.def.name, text: "Can't pay? Then we'll take it." };
      c.credits = Math.round((c.credits - toll) * 10) / 10;
      saveCommander(c);
      const away = npc.obj.position.clone().sub(player.obj.position).normalize();
      for (const p of ofRole('pirate').filter((p) => p.obj.position.distanceTo(npc.obj.position) < 3000)) {
        Object.assign(p, { paid: true, fights: false, hostile: false, target: null, mode: 'travel' });
        p.destination = p.obj.position.clone().addScaledVector(away, 30000);
      }
      return { kind: 'pirate', from: npc.def.name, text: `Pleasure doing business. ${toll} Cr paid; we never saw you.` };
    },
  };
}

// Pirates say something before they open fire, if you're in range to hear.
const threatened = new WeakSet<NpcShip>();
let lastThreat = -Infinity;
function pirateThreats() {
  for (const p of ofRole('pirate')) {
    if (!p.hostile || threatened.has(p)) continue;
    threatened.add(p);
    if (elapsed - lastThreat < 20 || !npcIdentified(p) || p.obj.position.distanceTo(player.obj.position) > RADIO_RANGE) continue;
    lastThreat = elapsed;
    radio('pirate', p.def.name, pirateThreat(hailContext(serialOf(p) * 1000 + (minute() % 1000), p)));
  }
  // Paid-off pirates, gone over the horizon.
  for (const p of ofRole('pirate')) if (p.paid && p.obj.position.distanceTo(player.obj.position) > 25000) removeNpc(p);
}

// --- The comms array: the companies reach you anywhere ---------------------------------

/** Offers already put to you over the array. */
const offersHeard = new Set<string>();
const newsHeard = new Set<string>();
let arrayTimer = 0;

/** Keep the company's note in Messages, as traffic control's mention does. */
function routeMessage(o: Contract, at: StarSystem, why: string) {
  const c = cmdr();
  const id = `route:${o.id}`;
  if (c.messages?.some((m) => m.id === id)) return;
  const what = `${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}`;
  c.messages = [{ id, company: o.company, subject: 'Work on your route', body: `${what} at ${stationName(at).name}, ${at.name}: ${why}. ${o.pay.toLocaleString()} Cr on delivery. On the board until the half hour.`, at: Date.now() }, ...(c.messages ?? [])].slice(0, 20);
}

/** Work on your route from here and your next jump, with an Accept button. */
function arrayOffers() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  const next = c.target !== null && c.target !== here.index ? systemAt(here.galaxy, c.target) : null;
  const free = cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c) - reservedTonnes(c);
  for (const { offer: o, why, at } of workInReach(c, here, next, now, free)) {
    if (offersHeard.has(o.id) || cannotReserve(c, o)) continue;
    offersHeard.add(o.id);
    if (at === here) routeWorkSaid.add(`${here.galaxy}:${here.index}:${Math.floor(now / BOARD_SLOT)}`); // traffic control needn't say it again
    routeMessage(o, at, why);
    const where = at === here ? stationName(here).name : `${stationName(at).name}, ${at.name}`;
    radio('company', COMPANIES[o.company].name, `Work on your route: ${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}, ${why} · waiting at ${where} · ${o.pay.toLocaleString()} Cr`, {
      colour: COMPANIES[o.company].colour,
      action: acceptOffer(o, at),
    });
  }
  saveCommander(c);
}

/** Accept over the array: reserved now, collected when you dock where it waits. */
function acceptOffer(o: Contract, at: StarSystem): RadioAction {
  const voice = { kind: 'company' as const, ...companyVoice(o.company) };
  return {
    label: 'Accept',
    done: 'Accepted',
    until: (Math.floor(Date.now() / BOARD_SLOT) + 1) * BOARD_SLOT,
    run: () => {
      const c = cmdr();
      if (!isWorking(c, 'comms-array')) return { ...voice, text: "We can't hear you: your comms array is down. Dock and take it at the station." };
      if (!board(c, at, Date.now()).some((x) => x.id === o.id)) return { ...voice, text: "Sorry, Commander: that one's gone to someone else." };
      const why = reserve(c, o);
      if (why) return { ...voice, text: why };
      saveCommander(c);
      sfx.beep();
      jobKey = '';
      renderJob();
      return { ...voice, text: `Accepted: ${o.qty} t ${cargoName(o)} for ${destinationOf(o).name}. We'll hold it at ${stationName(at).name}, ${at.name}: collect it within ${COLLECT_JUMPS} jumps, and the clock starts when it's loaded.` };
    },
  };
}

/** Market news from a jump or two out, before the station's news has it. */
function arrayNews() {
  for (const n of newsInReach(currentSystem(), Date.now())) {
    const key = `${n.where.galaxy}:${n.where.index}:${n.event.start}`;
    if (newsHeard.has(key)) continue;
    newsHeard.add(key);
    radio('news', 'Comms array', n.line);
  }
}

// --- Distress calls ---------------------------------------------------------------------
// A trader under attack by pirates calls for help. You hear it within radio
// range, or anywhere in the system with the array, which also picks up
// attacks far out in the lanes. Get there while the pirates are still at it
// and see them off (destroyed or running), and the trader's company pays a
// little and remembers; the Carriers' Mutual remembers more.

interface Distress {
  trader: NpcShip;
  pirates: Set<NpcShip>;
  heard: boolean;
  /** You got there while it was still going on. */
  arrived: boolean;
  until: number;
}
const distresses: Distress[] = [];
const DISTRESS_ARRIVE = 5000; // metres: close enough to count as answering
const DISTRESS_TIME = 240; // seconds a call stays open
const DISTRESS_PIRATE_RANGE = 6000; // metres: pirates further than this from the trader have given up
let distressTimer = 90;
/** Damage a trader under attack takes while it calls for help: about a minute and a half against one pirate. */
const DISTRESS_SHIELDING = 0.4;

const traderName = (t: NpcShip) => (t.company ? `${COMPANIES[t.company].name} ${t.def.name}` : t.def.name);
const traderColour = (t: NpcShip) => (t.company ? COMPANIES[t.company].colour : '#9ef0c0');

function distressCall(trader: NpcShip, pirate: NpcShip) {
  if (!modern()) return;
  const known = distresses.find((x) => x.trader === trader);
  if (known) {
    known.pirates.add(pirate);
    return;
  }
  const d = trader.obj.position.distanceTo(player.obj.position);
  const heard = state === 'flying' && (d < RADIO_RANGE || hasArray());
  distresses.push({ trader, pirates: new Set([pirate]), heard, arrived: false, until: elapsed + DISTRESS_TIME });
  if (!heard) return;
  sfx.beep();
  radio('mayday', traderName(trader), `Mayday! Pirates on us, ${(d / 1000).toFixed(1)} km from you. Anyone?`, { colour: traderColour(trader), flash: 3.5, urgent: true });
}

function updateDistress() {
  const pos = player.obj.position;
  for (let i = distresses.length - 1; i >= 0; i--) {
    const d = distresses[i];
    const t = d.trader;
    if (!npcs.includes(t) || elapsed > d.until) {
      distresses.splice(i, 1);
      continue;
    }
    const still = [...d.pirates].filter((p) => npcs.includes(p) && !p.paid && p.mode !== 'flee' && p.obj.position.distanceTo(t.obj.position) < DISTRESS_PIRATE_RANGE);
    if (still.length && pos.distanceTo(t.obj.position) < DISTRESS_ARRIVE) d.arrived = true;
    if (still.length) continue;
    distresses.splice(i, 1);
    if (d.arrived && state === 'flying') rescued(d);
  }
}

function rescued(d: Distress) {
  const c = cmdr();
  const t = d.trader;
  const r = distressReward(d.pirates.size, t.company);
  c.credits = Math.round((c.credits + r.credits) * 10) / 10;
  if (t.company) {
    addStanding(c, t.company, r.standing);
    const mutual = t.company === 'mutual';
    c.messages = [
      {
        id: `rescue:${t.company}:${Date.now()}`,
        company: t.company,
        subject: mutual ? 'The Mutual remembers' : 'With thanks',
        body: mutual
          ? `You answered one of our crews' calls in ${currentSystem().name} and saw the pirates off. ${r.credits} Cr, and the Mutual's thanks. We look after those who look after us.`
          : `You saw pirates off one of our ships in ${currentSystem().name}. ${r.credits} Cr, with our thanks.`,
        at: Date.now(),
      },
      ...(c.messages ?? []),
    ].slice(0, 20);
  }
  saveCommander(c);
  sfx.beep();
  radio('ship', traderName(t), `Thank you, Commander. ${r.credits} Cr, with our thanks${r.standing ? ` · ${COMPANIES[t.company!].name} standing +${r.standing}` : ''}`, { colour: traderColour(t), flash: 4, urgent: true });
}

/** With the array you hear attacks far out in the lanes: now and then, one starts somewhere you can't see. */
function spawnDistress(): boolean {
  const room = MAX_PIRATES - ofRole('pirate').filter((p) => !p.paid).length;
  if (room < 1) return false;
  for (let tries = 0; tries < 8; tries++) {
    const at = player.obj.position.clone().addScaledVector(new THREE.Vector3().randomDirection(), 13000 + Math.random() * 7000);
    if (at.distanceTo(station.root.position) < 7000 || at.distanceTo(planetPos) < planetRadius * 1.4) continue;
    const trader = addNpc('cobra-mk3', 'trader', at);
    flyForCompany(trader);
    trader.cargo = randomCargo();
    trader.obj.lookAt(station.root.position);
    trader.ship.speed = trader.ship.maxSpeed * 0.5;
    trader.destination = onSlotAxis(900);
    legs.set(trader, 'inbound');
    const band = Math.min(room, Math.random() < 0.4 ? 2 : 1);
    for (let i = 0; i < band; i++) {
      const def = Math.random() < 0.6 ? 'sidewinder' : 'mamba';
      const p = addNpc(def, 'pirate', at.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(1500)), at);
      p.obj.lookAt(at);
      p.ship.speed = p.ship.maxSpeed * 0.5;
      p.bounty = BOUNTIES[def] ?? 40;
      Object.assign(p, { target: trader.ship, mode: 'attack' });
    }
    return true;
  }
  return false;
}

// --- The emergency beacon: fixed calls, from every ship --------------------------------

const beaconState = newBeacon();
let beaconOpen = false;
let beaconTimer = 0;
/** A Viper detailed to fly with you, and until when. */
let escort: { npc: NpcShip; until: number } | null = null;

function toggleBeacon(show = !beaconOpen) {
  if (show && !modern()) return flash('Classic rules: no emergency beacon', 1.5);
  beaconOpen = show;
  $('#beacon').hidden = !show;
  clearTimeout(beaconTimer);
  if (show) beaconTimer = window.setTimeout(() => toggleBeacon(false), 8000);
}

$('#beacon .beacon-calls').innerHTML = BEACON_CALLS.map((b, i) => `<button type="button" data-call="${b.call}">${isTouch ? '' : `${i + 1} · `}${escapeHtml(b.label)}</button>`).join('');
$('#beacon .beacon-calls')
  .querySelectorAll<HTMLButtonElement>('button')
  .forEach((b) => onTap(b, () => sendBeacon(b.dataset.call as BeaconCall)));

function sendBeacon(call: BeaconCall) {
  toggleBeacon(false);
  if (state !== 'flying') return;
  const c = cmdr();
  const here = currentSystem();
  const pos = player.obj.position;
  const label = BEACON_CALLS.find((b) => b.call === call)!.label;
  const police = `${here.name} police`;
  const nearest = galaxy(here.galaxy)
    .filter((s) => s !== here)
    .reduce((a, b) => (distanceLy(here, a) <= distanceLy(here, b) ? a : b));
  const out = beacon(beaconState, call, elapsed, {
    lawful: hasLaw(here),
    hostilesNear: npcs.some((n) => n.hostile && n.obj.position.distanceTo(pos) < FIGHT_RANGE) || [...sharedSpace.remotes.values()].some((r) => sharedSpace.isHostile(r) && r.position.distanceTo(pos) < FIGHT_RANGE),
    hull: player.hull / player.def.stats.hull,
    fuel: c.fuel,
    nearestLy: distanceLy(here, nearest),
    canDock: !clearanceRefused() && !lockedDown(),
    system: `${here.galaxy}:${here.index}`,
  });
  if (out.kind === 'wait') return flash(`Beacon recharging · ${out.seconds} s`, 1.5);
  sfx.beep();
  radio('beacon', 'Beacon', `${label} sent`);
  switch (out.kind) {
    case 'police': {
      if (isFugitive() && identified()) return radio('police', police, 'We know who you are, Commander. Surrender (U).', { flash: 3, urgent: true });
      const delay = Math.round(Math.max(10, 10 + (pos.distanceTo(station.root.position) - STATION_SPACE) / 200));
      responses.push({ at: elapsed + delay, where: pos.clone() });
      // Any Viper already out comes too.
      const near = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(pos) < 15000);
      if (near) near.patrol.centre.copy(pos);
      return radio('police', police, `Mayday received. Vipers on their way, about ${delay} s.`, { flash: 3, urgent: true });
    }
    case 'unanswered':
      return radio('beacon', 'Beacon', "No answer: there's no law here to send help");
    case 'false':
      if (out.offence) {
        radio('police', police, 'Second false alarm. Wasting police time is an offence, Commander.');
        return becomeOffender('Wasting police time · you are an OFFENDER');
      }
      return radio('police', police, "Nothing on our scanner, Commander. Don't make a habit of it.", { flash: 3, urgent: true });
    case 'escort': {
      let npc = ofRole('police').filter((p) => !p.hostile).sort((a, b) => a.obj.position.distanceTo(pos) - b.obj.position.distanceTo(pos))[0];
      if (!npc && ofRole('police').length < MAX_POLICE) {
        spawnViper(true);
        npc = npcs[npcs.length - 1];
      }
      if (npc) escort = { npc, until: elapsed + 150 };
      return radio('police', police, call === 'hull' ? 'Emergency berth ready, Commander. A Viper will see you in.' : 'Escort on its way. Head for the station.', { flash: 3, urgent: true });
    }
    case 'fuel-ok':
      return radio('station', stationName(here).name, `Your tanks read ${c.fuel.toFixed(1)} LY, and ${nearest.name} is ${distanceLy(here, nearest).toFixed(1)}. You'll make it.`);
    case 'dock-for-fuel':
      return radio('station', stationName(here).name, `Come in and fill up, Commander: ${FUEL_PRICE} Cr a light year at the pump.`);
    case 'tender': {
      const paid = Math.min(c.credits, out.cost);
      c.credits = Math.round((c.credits - paid) * 10) / 10;
      c.fuel = Math.min(fuelCapacity(c), Math.round((c.fuel + out.ly) * 10) / 10);
      saveCommander(c);
      return radio('company', "Carriers' Mutual", `Fuel tender alongside: ${out.ly.toFixed(1)} LY transferred · ${paid.toLocaleString()} Cr${paid < out.cost ? ', all you had' : ''}. Nobody gets stranded on our watch.`, { colour: COMPANIES.mutual.colour, flash: 4, urgent: true });
    }
    case 'tendered':
      return radio('company', "Carriers' Mutual", "We've sent you one tender here already, Commander. Try a pair of fuel scoops.", { colour: COMPANIES.mutual.colour });
  }
}

/** Each frame in flight (Modern): the radio's business. */
function updateRadio(dt: number) {
  if (!modern()) return;
  pirateThreats();
  updateDistress();
  if (escort) {
    const { npc, until } = escort;
    if (!npcs.includes(npc) || npc.hostile || elapsed > until) {
      if (npcs.includes(npc)) Object.assign(npc.patrol, { radius: 900 }).centre.copy(station.root.position);
      escort = null;
    } else {
      npc.patrol.centre.copy(player.obj.position);
      npc.patrol.radius = 350;
    }
  }
  arrayTimer -= dt;
  if (arrayTimer <= 0) {
    arrayTimer = 20;
    if (hasArray()) {
      arrayOffers();
      arrayNews();
    }
  }
  distressTimer -= dt;
  if (distressTimer <= 0) {
    distressTimer = 100 + Math.random() * 120;
    if (hasArray() && !distresses.length && ofRole('pirate').length < MAX_PIRATES - 1 && Math.random() < PIRATE_CHANCE[currentSystem().government] + 0.15) spawnDistress();
  }
}

/** On a touch screen, the obvious next step comes out of the drawer by itself. */
const contextButton = $<HTMLButtonElement>('#touch .context-button');
function updateContextButton() {
  if (!isTouch) return;
  const c = cmdr();
  const here = currentSystem();
  const pos = player.obj.position;
  const hop = c.target !== null && c.target !== here.index ? systemAt(here.galaxy, c.target) : null;
  const surveyNear =
    exploring() && sceneBodies.some((b) => b.body.kind !== 'star' && pos.distanceTo(b.centre) - b.radius < b.range * 2 && !isSurveyed(c, here, b.body.id));
  let next: [string, string] = ['KeyJ', 'Jump'];
  if (pos.distanceTo(station.root.position) < CLEARANCE_RANGE && hasEquipment(c, 'docking-computer')) next = ['KeyC', autopilot ? 'Dock: on' : 'Dock'];
  else if (surveyNear && hasEquipment(c, 'survey-autopilot')) next = ['Digit9', surveyPilot ? 'Survey: on' : 'Survey'];
  else if (countdown !== null) next = ['KeyH', 'Cancel jump'];
  else if (hop && distanceLy(here, hop) <= c.fuel + 1e-9) next = ['KeyH', `Hyper · ${hop.name}`];
  if (contextButton.dataset.key !== next[0]) contextButton.dataset.key = next[0];
  if (contextButton.textContent !== next[1]) contextButton.textContent = next[1];
}

const SURRENDER_TIME = 5; // seconds holding still before the police take you in
const SURRENDER_SPEED = 0.15; // fraction of top speed
let surrenderTimer: number | null = null;

/** U: hand yourself in. Always works where there's law, and always hurts. */
function toggleSurrender() {
  const c = cmdr();
  if (surrenderTimer !== null) {
    surrenderTimer = null;
    flash('Surrender withdrawn', 1.5);
    return;
  }
  if (!hasLaw(currentSystem())) {
    flash('No law here to surrender to', 2);
    return;
  }
  if (legalStatus(c) === 'clean' && !carriesContraband(c)) {
    flash('Nothing on your record here', 2);
    return;
  }
  setAutopilot(false);
  countdown = null;
  surrenderTimer = SURRENDER_TIME;
  if (isTouch) setTouchSpeed(0); // the slider drops to all stop with you
  flash('Surrender signalled · all stop, weapons cold', 2.5);
}

/** Firing or throttling up calls it off. No crime in that: you're just not surrendering. */
function breakSurrender(why = 'Weapons fired') {
  surrenderTimer = null;
  flash(`${why} · surrender withdrawn`, 2);
}

/** While surrendering, the ship brakes to a stop by itself; throttling up withdraws. */
function holdForSurrender(input: FlightInput) {
  if (surrenderTimer === null) return;
  if (input.throttle > 0 || input.speedStep > 0 || (input.speedTarget ?? 0) > SURRENDER_SPEED) return breakSurrender('Throttle up');
  input.throttle = 0;
  input.speedTarget = 0;
}

function updateSurrender(dt: number) {
  if (surrenderTimer === null) return;
  // The escort's clock starts once you've slowed down.
  if (player.speed > player.maxSpeed * SURRENDER_SPEED) return;
  const before = Math.ceil(surrenderTimer);
  surrenderTimer -= dt;
  if (Math.ceil(surrenderTimer) < before && surrenderTimer > 0) flash(`Police escort on its way · ${Math.ceil(surrenderTimer)}`, 1.1);
  if (surrenderTimer <= 0) {
    surrenderTimer = null;
    void surrender();
  }
}

async function surrender() {
  setState('transition');
  sfx.tunnel();
  await playTunnel();
  const c = cmdr();
  const settlement = settle(c);
  saveCommander(c);
  // They know exactly who you are now: whatever you did dark here is settled too.
  defiedPolice = hullChecked = false;
  unpinned = hail = null;
  transponderOff = switchOnWhenClear = false;
  for (const n of ofRole('police')) if (n.target === player) n.target = null;
  enterDocked();
  flash(settlementMessage(settlement, 'You surrendered · record cleared'), 5);
}

function die() {
  const c = cmdr();
  setView('front');
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
  // A company's special cargo is built to survive: it holds station here, beaconing.
  if (c.difficulty === 'modern') {
    const p = player.obj.position;
    const nearStation = p.distanceTo(station.root.position) < STATION_CREW_RANGE;
    for (const k of setAdrift(c, currentSystem(), [p.x, p.y, p.z], Date.now(), nearStation)) if (!k.held) spillSpecial(k);
  }
  c.stolen = {};
  // Classic, as in 1984: a new ship is a clean slate and the police lose
  // interest. Under Modern rules your record stands (see claimInsurance).
  if (c.difficulty === 'classic') {
    c.records = {};
    c.warrant = false;
  }
  surrenderTimer = null;
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
  const pod = hasEquipment(c, 'escape-pod');
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
    let message: string;
    if (classic) {
      removeEquipment(c, 'escape-pod');
      message = 'Picked up. Your insurers have replaced the ship.';
    } else {
      const lost = loseContracts(c);
      const adrift = (c.adrift ?? [])
        .filter((k) => Date.now() - k.lost < 10_000)
        .map((k) => (k.held ? `The ${k.label} survived: the station crew picked it up` : `The ${k.label} survived: it's adrift, beaconing. Recover it within 24 hours`));
      // You wake at this system's station: if its crew picked your case up, it's handed back here.
      const returned = collectHeld(c, currentSystem());
      if (lost.length || adrift.length || returned.length) setTimeout(() => flash([...lost, ...(returned.length ? returned : adrift)].join(' · '), 6), 5500);
      const claim = claimInsurance(c);
      if (claim.kind === 'void') {
        message = 'Insurance void: you were a Fugitive · the Co-operative has issued you a bare Cobra';
        if (claim.stake) message += ` and ${claim.stake.toLocaleString()} Cr to start again`;
        message += ' · settle with the law before you launch';
      } else {
        message = `${claim.pod ? 'Picked up. ' : ''}Insurance paid out · excess ${claim.paid.toLocaleString()} Cr`;
        if (claim.paid < claim.excess) message += ` (the rest written off)`;
      }
    }
    saveCommander(c);
    marshalsStandDown();
    enterDocked();
    flash(message, 5);
  }, 5000);
}

// --- Shared space (stage 1) ------------------------------------------------
// Opt-in, Modern rules: other commanders in your system, from its server
// (see net/space.ts and server/). Stage 1 is look and fly together: their
// lasers are drawn but don't hit anyone yet, and nothing is saved.

const COMMANDER_COLOUR = '#dfe9ff'; // their tags and scanner marks; ships keep their own colours

/** Another commander's tag: rank insignia, callsign and range, e.g. "◆◆ CMDR Moxon · 0.8 km". */
const callsignTag = (r: Remote, range: string) => (remoteUnidentified(r) ? `Unidentified ship · ${range}` : `${rankInsignia(r.rank)} CMDR ${r.name}${r.verified ? '' : ' (guest)'} · ${range}`.trim());
/** A commander running dark, too far off for a hull read: we can see them, not say who they are. */
const remoteUnidentified = (r: Remote) => r.dark && r.position.distanceTo(player.obj.position) > HULL_READ;
const commanderColour = (r: Remote) => (sharedSpace.isHostile(r) ? '#ff4d6d' : remoteUnidentified(r) ? UNIDENTIFIED_HEX : COMMANDER_COLOUR);
const BUMP_SEPARATION = 40; // metres each ship moves apart after a collision
const remoteModels = new Map<string, { model: ShipModel; fireCooldown: number; unidentified: boolean }>();
const sharedSpace = new SharedSpace(onSpaceEvent);

function sharedSpaceWanted(): boolean {
  try {
    return localStorage.getItem('witchspace.shared') === '1';
  } catch {
    return false;
  }
}

function toggleSharedSpace() {
  const on = !sharedSpaceWanted();
  try {
    localStorage.setItem('witchspace.shared', on ? '1' : '0');
  } catch {
    // Not saved; it still applies until the page is closed.
  }
  updateSharedButton();
  if (on) sharedSpace.resume();
  flash(on ? 'Shared space (beta) on: fly with other commanders · Modern rules only' : 'Shared space off: single-player', 2.5);
}

function updateSharedButton() {
  $('#shared-button').innerHTML = `<span class="key">S · </span>Shared space (beta): ${sharedSpaceWanted() ? 'on' : 'off'}`;
}

function onSpaceEvent(e: SpaceEvent) {
  switch (e.kind) {
    case 'connected':
      flash(e.others ? `Shared space · ${e.others} other commander${e.others === 1 ? '' : 's'} in ${currentSystem().name}` : `Shared space · nobody else in ${currentSystem().name} yet`, 3);
      break;
    case 'joined':
      flash(`${`${rankInsignia(e.remote.rank)} CMDR ${e.remote.name}`.trim()} (${e.remote.rank}) has arrived`, 2.5);
      break;
    case 'left': {
      const m = remoteModels.get(e.remote.id);
      if (m) disposeShip(m.model);
      remoteModels.delete(e.remote.id);
      break;
    }
    case 'lost':
      if (state === 'flying') flash('Shared space: connection lost · reconnecting', 2.5);
      break;
    case 'replaced':
      flash('Shared space · you joined from another window or device, so this one has left · launch again to fly here', 4.5);
      break;
    case 'hit':
      // The server's word on our shields and hull.
      if (state !== 'flying') break;
      player.shields = e.shields;
      player.hull = e.hull;
      sfx.hit();
      hitFeedback(0.35);
      if (e.by) showHitDirection(camera, e.by.position);
      break;
    case 'hitconfirm':
      sfx.hit();
      // Firing on another commander is like firing on any clean ship.
      becomeOffender(`Firing on Commander ${e.remote.name} · you are an OFFENDER`);
      break;
    case 'missile':
      startNetMissile(e);
      break;
    case 'missileEnd': {
      const n = netMissiles.get(e.id);
      if (!n) break;
      netMissiles.delete(e.id);
      n.missile.position.copy(e.p);
      explodeNetMissile(n.missile);
      break;
    }
    case 'ecm':
      if (e.p.distanceTo(player.obj.position) < 6000) sfx.ecm();
      if (e.by) flash(`CMDR ${e.by.name} fired an ECM`, 1.2);
      break;
    case 'bump':
      // The server's word on the damage; move apart so we're not still touching.
      if (state !== 'flying') break;
      player.shields = e.shields;
      player.hull = e.hull;
      player.obj.position.addScaledVector(e.push, BUMP_SEPARATION);
      player.speed *= 0.5;
      sfx.thud();
      hitFeedback(0.9);
      flash(e.with ? `Collision with Commander ${e.with.name}` : 'Collision', 2);
      break;
    case 'destroyed':
      if (e.me) {
        if (state === 'flying') {
          flash(e.collision ? 'Destroyed in a collision' : e.by ? `Destroyed by Commander ${e.by.name}` : 'Ship destroyed', 3);
          die();
        }
        break;
      }
      if (e.remote) commanderDestroyed(e.remote, e.byMe, e.collision);
      break;
  }
}

/** Another commander's ship breaks up. If we did it, the law and the rating take note. */
function commanderDestroyed(r: Remote, byMe: boolean, collision = false) {
  const m = remoteModels.get(r.id);
  if (m) {
    const boom = new Explosion(m.model.def, m.model.root, new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion).multiplyScalar(100));
    space.scene.add(boom.group);
    explosions.push(boom);
    boomAt(r.position, 2.2, 1600, 1.6);
    m.model.root.visible = false; // gone; the server tells us when they leave
  }
  // A collision is an accident: no kill, and no crime.
  if (!byMe || collision) {
    flash(collision ? `Commander ${r.name} was destroyed in a collision` : `Commander ${r.name} has been destroyed`, 2.5);
    return;
  }
  const c = cmdr();
  const before = combatRating(c.kills);
  c.kills += combatComputer ? 0.5 : 1;
  flash(`Commander ${r.name} destroyed`, 2.5);
  becomeFugitive(true); // killing a clean commander is a serious crime
  if (combatRating(c.kills) !== before) setTimeout(() => flash(`Combat rating: ${combatRating(c.kills)}`, 3), 2600);
  saveCommander(c);
}

function updateSharedSpace(dt: number, input: { fire: boolean } | null) {
  const share = state === 'flying' && Boolean(commander) && cmdr().difficulty === 'modern' && sharedSpaceWanted();
  if (!share) {
    if (sharedSpace.connected) sharedSpace.leave();
    return;
  }
  const here = currentSystem();
  sharedSpace.join(here.galaxy, here.index, cmdr().name, 'cobra-mk3', Object.values(cmdr().lasers).filter((l): l is LaserId => Boolean(l)), combatRating(cmdr().kills), cmdr().missiles, isWorking(cmdr(), 'ecm'), sessionToken());
  const back = sharedSpace.takeCorrection();
  if (back) player.obj.position.copy(back);
  sharedSpace.update(dt, {
    position: player.obj.position,
    quaternion: player.obj.quaternion,
    speed: player.speed,
    firing: Boolean(input?.fire) && !overheated,
    shields: player.shields,
    hull: player.hull,
    dark: transponderOff,
  });
  for (const r of sharedSpace.remotes.values()) {
    let m = remoteModels.get(r.id);
    if (!m) {
      // Other commanders fly their ships in the ship's own colours; their callsign tag says who they are.
      const model = buildShip(shipById(r.ship) ?? shipById('cobra-mk3')!);
      space.scene.add(model.root);
      m = { model, fireCooldown: 0, unidentified: false };
      remoteModels.set(r.id, m);
    }
    // Running dark: a cold white unknown until we're close enough to read the hull.
    const unknown = remoteUnidentified(r);
    if (unknown !== m.unidentified) {
      showUnidentified(m.model, unknown);
      m.unidentified = unknown;
    }
    m.model.root.position.copy(r.position);
    m.model.root.quaternion.copy(r.quaternion);
    // Their lasers, drawn straight ahead; they don't hit anything yet.
    m.fireCooldown -= dt;
    if (r.firing && m.fireCooldown <= 0) {
      m.fireCooldown = 0.25;
      const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(r.quaternion);
      const origin = r.position.clone().addScaledVector(fwd, 20);
      beams.fire(origin, origin.clone().addScaledVector(fwd, 2000), COMMANDER_COLOUR);
    }
  }
}

// Missiles between commanders: the server flies them and decides what they hit
// (server/src/rules.ts); we fly a copy alongside so there's something to see.

interface NetMissile {
  missile: Missile;
  /** The ship it's chasing, kept where that commander is (or the player). */
  target: PlayerShip | null;
  remote: Remote | null;
}
const netMissiles = new Map<string, NetMissile>();

function startNetMissile(e: Extract<SpaceEvent, { kind: 'missile' }>) {
  // A stand-in launcher at the server's launch point, so the missile leaves the rail as normal.
  const launcher = new PlayerShip(shipById('cobra-mk3')!);
  launcher.obj.position.copy(e.p).addScaledVector(e.d, -10);
  launcher.obj.lookAt(launcher.obj.position.clone().add(e.d));
  launcher.speed = Math.max(0, e.s - MISSILE.launchSpeed);
  let target: PlayerShip | null = null;
  if (e.targetIsMe) target = player;
  else if (e.target) {
    target = new PlayerShip(shipById('cobra-mk3')!);
    target.obj.position.copy(e.target.position);
  }
  const missile = new Missile(shipById('missile')!, launcher, target);
  space.scene.add(missile.model.root);
  netMissiles.set(e.id, { missile, target, remote: e.target });
  if (e.ownerIsMe) return;
  rocketAt(missile.position, 0.5);
  if (e.targetIsMe && state === 'flying') {
    sfx.incoming();
    incomingTimer = 1;
    flash(`INCOMING MISSILE from CMDR ${e.owner?.name ?? 'unknown'} · break hard or use ECM (Z)`, 2.5);
  }
}

function updateNetMissiles(dt: number) {
  for (const n of netMissiles.values()) {
    if (n.remote && n.target && n.target !== player) n.target.obj.position.copy(n.remote.position);
    // Until the server says how it ended, it keeps flying (or waits at the target).
    if (n.missile.update(dt) !== 'flying') n.missile.target = null;
  }
}

function explodeNetMissile(m: Missile) {
  const flare = new Explosion(m.model.def, m.model.root, m.dir.clone().multiplyScalar(m.speed * 0.3));
  space.scene.add(flare.group);
  explosions.push(flare);
  boomAt(m.position, 1.6, 1200, 1.1);
  m.dispose();
}

// --- The combat computer ----------------------------------------------------
// Modern rules: it flies the ship in a fight (see game/combatPilot.ts) while
// you man a turret or the gimballed front laser. Touch any flight control
// and you have the ship back.

let combatComputer: CombatPilot | null = null;
const COMBAT_COMPUTER_MIN_HULL = 0.25; // fraction of full hull: below this, you fly

const hasTurret = () => (['rear', 'left', 'right'] as const).some((m) => Boolean(cmdr().lasers[m]));

// --- The explorer's autopilots (docs/design/exploration.md, stage 1b) ------------

let surveyPilot: SurveyPilot | null = null;
const SURVEY_PILOT_HOSTILES = 5000; // metres: a hostile this close hands control back

function toggleSurveyPilot() {
  const c = cmdr();
  if (surveyPilot) return stopSurveyPilot('Survey autopilot off · you have control');
  if (!hasEquipment(c, 'survey-autopilot')) return flash(c.difficulty === 'modern' ? 'Survey autopilot not fitted · sold to Pathfinders' : 'No survey autopilot under Classic rules', 2);
  if (!isWorking(c, 'survey-autopilot')) return flash('Survey autopilot damaged · repair at a station', 2);
  const next = surveyGoal();
  if (!next) return flash('Nothing left to survey or find here · the star is yours, if you want it', 3);
  if (autopilot) setAutopilot(false);
  stopCombatComputer();
  surveyPilot = new SurveyPilot();
  surveyGoalName = next.name;
  sfx.lock();
  flash(`Survey autopilot · ${next.name}`, 2.5);
}

/** Hand back control. Letting go on its own (not for your hands on the stick), it stops the ship first: never left coasting into a moon. */
function stopSurveyPilot(message?: string, allStop = false) {
  if (!surveyPilot) return;
  surveyPilot = null;
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
  for (const b of sceneBodies) {
    if (b.body.kind === 'star' || isSurveyed(c, here, b.body.id)) continue;
    // Hold halfway into survey range, on the near side.
    const point = b.centre.clone().add(pos.clone().sub(b.centre).setLength(b.radius + b.range * 0.5));
    options.push({ goal: { point, within: b.range * 0.3 }, name: b.body.name, d: pos.distanceTo(point) });
  }
  for (const p of scenePois) {
    if (!p.revealed || isFound(c, here, p.poi.id)) continue;
    options.push({ goal: { point: p.position, within: SIGNAL_REACH * 0.6 }, name: p.poi.name, d: pos.distanceTo(p.position) });
  }
  options.sort((a, b) => a.d - b.d);
  return options[0] ?? null;
}

let surveyGoalName = '';
function flySurvey(dt: number, pilot: SurveyPilot) {
  if (!isWorking(cmdr(), 'survey-autopilot')) return stopSurveyPilot('Survey autopilot damaged · all stop · you have control', true);
  if (npcs.some((n) => n.hostile && n.obj.position.distanceTo(player.obj.position) < SURVEY_PILOT_HOSTILES)) return stopSurveyPilot('Hostiles near · survey autopilot off · all stop · you have control', true);
  const next = surveyGoal();
  if (!next) return stopSurveyPilot('Survey autopilot · nothing left here to survey or find · all stop · the star is yours, if you want it', true);
  if (next.name !== surveyGoalName) {
    if (surveyGoalName) flash(`Survey autopilot · next: ${next.name}`, 2.5);
    surveyGoalName = next.name;
  }
  const { left, lined } = pilot.update(dt, player, next.goal, { centre: planetPos, radius: planetRadius });
  // A long straight run: jump most of it.
  if (lined && left > J_DISTANCE + 3000) inSystemJump(true);
}

let routeJumpAt: number | null = null;
const ROUTE_PAUSE = 12; // seconds after arriving (and after the arrival news) before the route autopilot jumps on
const ROUTE_HOSTILES = 6000; // metres: hostiles this close hold the jump

function updateRouteAutopilot() {
  if (routeJumpAt === null || elapsed < routeJumpAt || countdown !== null) return;
  const c = cmdr();
  const dest = destination();
  if (!dest || !isWorking(c, 'route-autopilot')) {
    routeJumpAt = null;
    return;
  }
  const d = distanceLy(currentSystem(), dest);
  if (d > c.fuel) {
    routeJumpAt = null;
    return flash(`Route autopilot · not enough fuel for ${dest.name} (${d.toFixed(1)} LY) · refuel at the station`, 3.5);
  }
  if (npcs.some((n) => n.hostile && n.obj.position.distanceTo(player.obj.position) < ROUTE_HOSTILES)) {
    routeJumpAt = elapsed + 5;
    return flash('Route autopilot holding · hostiles near', 2);
  }
  routeJumpAt = null;
  toggleHyperspace();
}

function toggleCombatComputer() {
  const c = cmdr();
  if (combatComputer) return stopCombatComputer('Combat computer off · you have control');
  if (!hasEquipment(c, 'combat-computer')) return flash(c.difficulty === 'modern' ? 'Combat computer not fitted' : 'No combat computers under Classic rules', 2);
  if (!isWorking(c, 'combat-computer')) return flash('Combat computer damaged · repair at a station', 2);
  if (!hasTurret()) return flash('Fit a rear or side laser to use the combat computer: it flies, you man the turret', 3);
  const target = chooseTarget(player.obj.position, npcs, locked);
  if (!target) return flash('No hostiles in range', 1.5);
  if (autopilot) setAutopilot(false);
  surveyPilot = null;
  combatComputer = new CombatPilot();
  sfx.lock();
  flash(`Strap in, Commander · combat computer engaged · ${target.def.name} · you have the guns`, 3);
}

function stopCombatComputer(message?: string) {
  if (!combatComputer) return;
  combatComputer = null;
  aim.reset(player);
  if (message) flash(message, 2.5);
}

/** Hand the ship back when the pilot takes the controls, or things get bad. */
function checkCombatComputer(input: FlightInput) {
  if (!combatComputer) return;
  if (input.pitch || input.roll || input.yaw || input.throttle || input.speedStep) stopCombatComputer('Combat computer off · you have control');
  else if (player.hull < player.def.stats.hull * COMBAT_COMPUTER_MIN_HULL) stopCombatComputer('Hull critical · combat computer off · you have control');
  else if (!isWorking(cmdr(), 'combat-computer')) stopCombatComputer('Combat computer damaged · you have control');
}

// --- Photos -----------------------------------------------------------------

let photoPending = false;

/** P: copy the frame just drawn, with a shutter flash, then save or share it. */
function snapPhoto() {
  const canvas = $<HTMLCanvasElement>(isRetro() ? '#retro' : '#neo');
  const saving = takePhoto(canvas, isRetro());
  sfx.shutter();
  const el = $('#photo-flash');
  el.classList.remove('on');
  void el.offsetWidth; // restart the CSS animation
  el.classList.add('on');
  void saving.then((message) => flash(message, 2.5));
}

// --- Input ------------------------------------------------------------------

function updateModeLabel() {
  $('#mode').textContent = isRetro() ? '1984 MODE' : 'NEO-VECTOR';
  $('#look').classList.toggle('retro', isRetro());
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
const J_LOCK_SUN = 6000; // above the surface: jumps stop short of the heat
const J_LOCK_MOON = 2000; // above the surface

let countdown: number | null = null;
let lastTick = 0;
let jumpCooldown = 0;

function destination(): StarSystem | null {
  const c = cmdr();
  return c.target === null ? null : systemAt(currentSystem().galaxy, c.target);
}

/** Set while a galactic hyperdrive countdown is running. */
let galacticJump = false;

/** Y, or the button on the galaxy chart: jump to the next galaxy. */
function toggleGalacticJump() {
  if (countdown !== null) {
    countdown = null;
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
  if (isMapOpen()) toggleGalaxyMap();
  galacticJump = true;
  countdown = HYPERSPACE_COUNTDOWN;
  lastTick = Math.ceil(countdown);
  flash(`Galactic hyperdrive · to Galaxy ${((currentSystem().galaxy + 1) % 8) + 1}`, 2.5);
}

function toggleHyperspace() {
  if (countdown !== null) {
    countdown = null;
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
  countdown = HYPERSPACE_COUNTDOWN;
  lastTick = Math.ceil(countdown);
  flash(`Hyperspace to ${dest.name} · ${d.toFixed(1)} LY`, 2);
}

function updateTravel(dt: number) {
  jumpCooldown = Math.max(0, jumpCooldown - dt);
  $('#g-fuel').style.setProperty('--v', String(cmdr().fuel / fuelCapacity(cmdr())));
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
  const from = currentSystem();
  const galactic = galacticJump;
  galacticJump = false;
  // The galactic hyperdrive lands you near the middle of the next galaxy's
  // chart, at the system nearest (96, 96), as in the original.
  const dest = galactic ? nearestTo((from.galaxy + 1) % 8, 96, 96) : destination();
  if (!dest) return;
  setAutopilot(false);
  setState('transition');
  sfx.hyperspace();
  await playTunnel(3.2, 'hyperspace');

  // Traders you attacked unseen, still alive as you leave: they report it, in the system you're leaving.
  for (const npc of npcs) if (npc.unreported) reportedBy(npc);
  if (galactic) removeEquipment(c, 'galactic-hyperdrive');
  else c.fuel = Math.max(0, Math.round((c.fuel - distanceLy(from, dest)) * 10) / 10);
  c.location = { galaxy: dest.galaxy, system: dest.index };
  c.target = null;
  // On a plotted route: the next hop, or arrived.
  let routeNote = '';
  if (c.courseTo !== null && c.courseTo !== undefined) {
    const end = systemAt(dest.galaxy, c.courseTo);
    const hop = nextHop(dest, end);
    if (hop) {
      c.target = hop.index;
      routeNote = `Next jump plotted: ${hop.name}${hop === end ? '' : ` (on the way to ${end.name})`}${distanceLy(dest, hop) > c.fuel ? ' · refuel first' : ''}`;
    } else c.courseTo = null;
  }
  c.visits += 1; // Classic markets are set on arrival in a system, as in 1984
  // Records stay in the system where the crime happened, and cool as you travel.
  coolRecords(c);
  // A new system, a cold trail: the computer switches the transponder back on.
  if (transponderOff) {
    transponderOff = false;
    switchOnWhenClear = false;
    setTimeout(() => state === 'flying' && flash('Transponder on · new system (0 to run dark again)', 3), 6500);
  }
  // The Route Autopilot takes the next jump by itself, after a moment to look around.
  if (routeNote && isWorking(c, 'route-autopilot') && c.target !== null && distanceLy(dest, systemAt(dest.galaxy, c.target)) <= c.fuel) {
    routeJumpAt = elapsed + ROUTE_PAUSE;
    routeNote += ' · route autopilot jumps shortly (H to stop)';
  }
  const seen = messageIds();
  const jumpNotes = afterJump(c);
  const adriftNotes = checkAdrift();
  // Under Modern rules the companies' notes come over the radio; the route is the ship's computer.
  const contractNotes = modern() ? adriftNotes : [...jumpNotes, ...adriftNotes];
  if (contractNotes.length || routeNote) setTimeout(() => state === 'flying' && flash([routeNote, ...contractNotes].filter(Boolean).join(' · '), 4), 9000);
  setTimeout(() => state === 'flying' && radioMessages(seen), 9000);
  distresses.length = 0;
  escort = null;
  arrayTimer = 12; // the array picks up the new system's boards once you're settled
  distressTimer = 60 + Math.random() * 90;
  surrenderTimer = null;
  saveCommander(c);
  const slipped = carrier !== null && (carrier.phase === 'arriving' || carrier.phase === 'emerging');
  // Pirates who had your case when you left have got away with it.
  for (const npc of npcs) if (npc.carrying) takenByPirates(c, npc.carrying, Date.now());
  responses.length = 0;
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
  setView('front');
  setState('flying');
  fadeFromWhite();
  const wanted = legalStatus(c);
  const note = arrivalNote(dest);
  saveCommander(c);
  if (note) setTimeout(() => state === 'flying' && flash(note, 3), 4200);
  flash(
    `${dest.name} · ${GOVERNMENTS[dest.government]} · ${ECONOMIES[dest.economy]}` +
      (wanted === 'fugitive' ? (c.warrant ? ' · Marshals warrant: police hostile' : ' · You are wanted here') : wanted === 'offender' ? ' · Offender here' : ''),
    4,
  );
  announceEvent(dest, note ? 7800 : 4500);
  if (slipped) setTimeout(() => state === 'flying' && flash('You slipped away before the Marshals came through', 3.5), 5000);
  scheduleMarshals();
}

/** Arriving somewhere in the middle of a crisis: say so. */
function announceEvent(sys: StarSystem, delay: number) {
  const e = activeEvent(sys, Date.now());
  if (e) setTimeout(() => state === 'flying' && (modern() ? radio('news', `${sys.name} news`, EVENT_KINDS[e.type].headline(sys.name), { flash: 4, urgent: true, line: EVENT_KINDS[e.type].headline(sys.name) }) : flash(EVENT_KINDS[e.type].headline(sys.name), 4)), delay);
}

/** The original's J key: leap ahead when nothing is near enough to mass-lock you. */
function inSystemJump(quiet = false): boolean {
  if (jumpCooldown > 0) return false;
  const pos = player.obj.position;
  const shipsNear = npcs.some((p) => p.obj.position.distanceTo(pos) < J_LOCK_SHIPS);
  const stationNear = pos.distanceTo(station.root.position) < J_LOCK_STATION;
  const planetNear = pos.distanceTo(planetPos) - planetRadius < J_LOCK_PLANET;
  const sunNear = pos.distanceTo(SUN_POS) - SUN_RADIUS < J_LOCK_SUN;
  const moons = sceneBodies.filter((b) => b.body.kind === 'moon');
  const moonNear = moons.some((m) => pos.distanceTo(m.centre) - m.radius < J_LOCK_MOON);
  if (shipsNear || stationNear || planetNear || sunNear || moonNear) {
    if (!quiet) flash(`Mass locked · ${shipsNear ? 'ships' : stationNear ? 'station' : planetNear ? 'planet' : sunNear ? 'sun' : 'moon'} too close`, 1.5);
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
  limit(planetPos, planetRadius + J_LOCK_PLANET - 200);
  limit(SUN_POS, SUN_RADIUS + J_LOCK_SUN - 200);
  for (const m of moons) limit(m.centre, m.radius + J_LOCK_MOON - 200);
  if (dist < 500) {
    if (!quiet) flash('Mass locked · too close ahead', 1.5);
    return false;
  }
  pos.addScaledVector(fwd, dist);
  jumpCooldown = 1.2;
  sfx.jump();
  hitFeedback(0.15);
  flash('Jump', 0.6);
  return true;
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
  if (c.difficulty === 'modern') void loadFirsts(currentSystem().galaxy); // fresh names for next time; cached for five minutes
  const here = currentSystem();
  openMap({
    current: here,
    range: c.fuel,
    target: c.courseTo != null ? systemAt(here.galaxy, c.courseTo) : c.target === null ? null : systemAt(here.galaxy, c.target),
    news: newsLine,
    // Contracts in hand, so you can see where they're going once you've launched.
    contracts: (c.contracts ?? []).map((a) => {
      const to = destinationOf(a);
      const left = a.jumpsLeft >= 0 ? `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'} left` : 'late: half pay';
      const adrift = a.adrift ? ' · adrift: see Contracts when docked' : '';
      return { to, colour: COMPANIES[a.company].colour, line: `${a.qty} t ${cargoName(a)} → ${to.name} · ${left} · ${a.pay.toLocaleString()} Cr · ${COMPANIES[a.company].name}${adrift}` };
    }),
    firsts: (s) => (c.difficulty === 'modern' ? firstsLine(s) : null),
    explored: (s) => {
      const e = exploreOf(c);
      if (!e.visited.includes(`${s.galaxy}:${s.index}`)) return { visited: false, line: 'Not yet' };
      if (c.difficulty !== 'modern') return { visited: true, line: 'Visited' };
      const surveyed = bodiesOf(s).filter((b) => isSurveyed(c, s, b.id)).length;
      const found = poisOf(s).filter((p) => isFound(c, s, p.id)).length;
      return { visited: true, line: `Visited · surveyed ${surveyed} of ${bodiesOf(s).length}${found ? ` · ${found} signal${found === 1 ? '' : 's'} found` : ''}` };
    },
    onTarget: (s) => {
      // Within a jump: straight there. Further: plot the route, a hop at a time.
      const route = distanceLy(here, s) > fuelCapacity(c) ? plotCourse(c, s.index) : '';
      if (!route) {
        c.target = s.index;
        c.courseTo = null;
      } else flash(route, 3);
      saveCommander(c);
      sfx.beep();
      if (state === 'docked') renderDocked();
      else flash(`Destination: ${s.name}`, 1.5);
    },
  });
  // The galactic hyperdrive is launched from here, in flight.
  const galactic = $('#galaxy-map .map-galactic');
  galactic.hidden = !(state === 'flying' && hasEquipment(c, 'galactic-hyperdrive'));
  galactic.textContent = `Y · Galactic hyperdrive to Galaxy ${((here.galaxy + 1) % 8) + 1}`;
  setFlightInputSuppressed(true);
}

/** Keys while a chart is open. Returns true if the key was used. */
function handleMapKey(code: string): boolean {
  if (!isMapOpen()) return false;
  if (code === 'KeyG' || code === 'Escape') toggleGalaxyMap();
  else if (code === 'Tab') toggleMapMode();
  else if (code === 'KeyF') setTimeout(focusFind); // after this key, so the F isn't typed into the box
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
    if (state === 'docked' && dockTab === 'market') renderMarket(); // exchange or 1984 price list
    return;
  }
  if (code === 'KeyP' && state !== 'newgame') {
    photoPending = true; // taken right after the next frame is drawn
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
        setCausedEvents(commander?.caused);
        if (commander) enterDocked();
        else showNewGame();
      } else if (code === 'KeyN') {
        const saved = loadCommander();
        if (saved && !newCommanderArmed) armNewCommander(saved);
        else showNewGame();
      } else if (code === 'KeyS') {
        toggleSharedSpace();
      } else if (code === 'KeyA' || (code === 'Escape' && isAccountPanelOpen())) {
        toggleAccountPanel();
      }
      if (code !== 'KeyN' && newCommanderArmed) disarmNewCommander();
      break;
    case 'newgame':
      if (code === 'Digit1') startCommander('modern');
      else if (code === 'Digit2') startCommander('classic');
      else if (code === 'Enter') startCommander(defaultDifficulty());
      else if (code === 'Escape') showTitle();
      break;
    case 'docked':
      if (code === 'KeyL' || code === 'Enter') void launch();
      else if (code === 'KeyT') setDockTab(dockTab === 'market' ? 'station' : 'market');
      break;
    case 'flying':
      // The beacon's calls, while its panel is open: 1-4 send, Esc or ` cancel.
      if (beaconOpen && /^Digit[1-4]$/.test(code)) return sendBeacon(BEACON_CALLS[Number(code.slice(5)) - 1].call);
      if (beaconOpen && code === 'Escape') return toggleBeacon(false);
      if (code === 'F1') {
        toggleControlsCard();
      } else if (code === 'KeyH') {
        toggleHyperspace();
      } else if (code === 'KeyR') {
        flash(`Scanner range ${toggleScannerRange() / 1000} km`, 1.2);
      } else if (code === 'KeyJ') {
        inSystemJump();
      } else if (code === 'KeyU') {
        toggleSurrender();
      } else if (code === 'KeyT') {
        toggleLock();
      } else if (code === 'KeyX') {
        fireMissile();
      } else if (code === 'KeyZ') {
        playerEcm();
      } else if (code === 'KeyB') {
        energyBomb();
      } else if (code === 'KeyV') {
        setView(VIEWS[(VIEWS.indexOf(view) + 1) % VIEWS.length]);
      } else if (code === 'Digit0') {
        toggleTransponder();
      } else if (/^Digit[1-4]$/.test(code)) {
        setView(VIEWS[Number(code.slice(5)) - 1]);
      } else if (code === 'KeyL') {
        hailTarget();
      } else if (code === 'Quote') {
        if (modern()) toggleRadio();
      } else if (code === 'Backquote') {
        toggleBeacon();
      } else if (code === 'Enter') {
        if (modern() && !acceptLatest()) flash('Nothing on the radio to accept', 1.2);
      } else if (code === 'KeyY') {
        toggleGalacticJump();
      } else if (code === 'KeyK') {
        const s = toggleControlScheme();
        renderControlsCard();
        flash(s === 'mouse' ? 'Mouse + keyboard · click to aim' : 'Keyboard only (classic)', 2);
      } else if (code === 'KeyI') {
        flash(toggleInvertPitch() ? 'Pitch inverted' : 'Pitch normal', 2);
      } else if (code === 'KeyO') {
        toggleCombatComputer();
      } else if (code === 'Digit9') {
        toggleSurveyPilot();
      } else if (code === 'KeyC') {
        stopCombatComputer();
        if (autopilot) setAutopilot(false, 'Docking computer off');
        else if (!hasEquipment(cmdr(), 'docking-computer')) flash('Docking computer not fitted', 2);
        else if (!isWorking(cmdr(), 'docking-computer')) flash('Docking computer damaged · repair at a station', 2);
        else if (player.obj.position.distanceTo(station.root.position) > 10000) flash('Too far from the station', 2);
        else if (!darkRefused() || transponderOnToDock()) setAutopilot(true, 'Docking computer on');
      }
      break;
  }
}

addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest?.('input, textarea')) return; // typing, not flying
  if (e.code === 'Tab' && isMapOpen()) e.preventDefault(); // Tab switches charts, not focus
  if (!e.repeat) handleKey(e.code);
});
// Enter in the callsign box confirms it and starts with the default rules, as Enter does on that screen.
$<HTMLInputElement>('#callsign').addEventListener('keydown', (e) => {
  if (e.key !== 'Enter') return;
  (e.target as HTMLInputElement).blur();
  handleKey('Enter');
});
document.querySelectorAll<HTMLButtonElement>('[data-key]').forEach((b) => {
  const press = () => {
    b.blur(); // otherwise Space (throttle) would click it again
    handleKey(b.dataset.key!);
  };
  // The flight buttons are pressed mid-fight, with a finger on the aim pad.
  if (b.closest('#touch')) onTap(b, press);
  else b.addEventListener('click', press);
});

// --- Main loop --------------------------------------------------------------

// Timer pauses while the tab is hidden, so there's no huge step on return.
const timer = new THREE.Timer();
timer.connect(document);

function frame(now?: number) {
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  for (const button of gamepadPresses()) {
    const code = padToKey(button);
    if (code) handleKey(code);
  }
  if (inSpace) {
    if (camera.view?.enabled) camera.clearViewOffset();
    if (state !== 'transition') updateSpace(dt);
    const rift = carrier?.rift;
    lens.aim(camera, rift ? rift.group.position : null, rift ? rift.radius * rift.open : 0, rift ? rift.open : 0);
    render(space.scene);
  } else {
    lens.aim(camera, null, 0, 0);
    updateShowroom(dt);
    render(showroom.scene);
  }
  if (photoPending) {
    photoPending = false;
    snapPhoto();
  }
  requestAnimationFrame(frame);
}

// Handy for poking at the game from the browser console during development.
if (import.meta.env.DEV) {
  Object.assign(window, {
    witchspace: {
      player, station, dockingComputer, drifters, explosions, spillCargo, sun, npcs, missiles, launchMissile, spawnPirates, spawnFalcon: () => spawnFalcon(player.obj.position.clone().addScaledVector(player.forward(), 6000), player.obj.position), spawnTrader, spawnDistress, sendBeacon, hailTarget, playerHitNpc, becomeFugitive, damagePlayer, die, legalStatus, renderDocked, aim, summonCarrier,
      get carrier() { return carrier; },
      get commander() { return commander; },
      get state() { return state; },
      get autopilot() { return autopilot; },
      get explore() { return { bodies: sceneBodies, pois: scenePois, planetPos, survey }; },
      /** Hyperspace straight to a system in this galaxy, fuel or not. */
      jumpTo(index: number) {
        cmdr().target = index;
        cmdr().fuel = fuelCapacity(cmdr());
        void hyperspace();
      },
    },
  });
}

setRetro(false);
updateModeLabel();
initTouch();
initRadio();
setDockTab('station');
showTitle();
answerAdvert();
frame();

// Accounts: every save also goes to the cloud when signed in; sign-in links land here.
onSave(commanderSaved);
onSave((c) => setCausedEvents(c.caused));
void initAccount({
  flash,
  commanderReplaced: () => {
    if (state === 'title') showTitle();
  },
});
