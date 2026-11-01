// Exploring in flight (moved from main.ts; the rules are in game/explore.ts): moons, rings, wreck
// fields and signals, surveys, cover in the clutter, and the explorer's firsts and tips.

import { sfx } from '../audio/sound';
import { withLineUp } from '../content/moduleFiles';
import { shipById } from '../content/ships';
import { hasEquipment, isWorking, saveCommander, type Commander } from '../game/commander';
import { currentAccount } from '../net/account';
import { type Target } from '../game/weapons';
import { blinkBeacon, buildBeacon, buildMoon, buildRings, disposeWorldPart, powerDownBeacon } from '../render/worlds';
import { COMPANIES } from '../game/companies';
import { advanceTrail, bodiesOf, SIGNAL_REACH, COURIER_POINTS, courierPoiOf, courierRumour, RANK_NEWS, rankReached, trailTip, dataValue, describeWorld, exploreOf, isFound, isSurveyed, poisOf, recordDiscovery, recordSurvey, recordVisit, salvageCargo, SURVEY, trailPoisOf, worldOf, type Poi, type SurveyData } from '../game/explore';
import { buildYard } from '../render/yard';
import { stageLabel, yardAt } from '../game/yards';
import { lineUpFor } from '../game/commissions';
import { buildShip, disposeShip } from '../render/shipModel';
import { flash, flashLater } from '../ui/hud';
import { type Marker } from '../ui/indicators';
import { claimFirsts, firstsIn } from '../net/firsts';
import { type StarSystem } from '../galaxy/generate';
import { escapeHtml } from '../ui/escape';
import { $, cmdr, currentSystem, game } from '../core';
import { flight, planetPos, player, space, station, SUN_POS, SUN_RADIUS, type SceneBody, type ScenePoi } from '../scene';
import { plotCourse } from '../ui/contracts';
import { renderDocked } from '../ui/station';
import { spillCargo } from './adrift';
import * as THREE from 'three';

import type { LoggedMoment } from '../game/flightLog';
import type { MomentEvent } from '../game/moments';
/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  planetColour: (sys: StarSystem) => string;
  dark: () => boolean;
  noteCardMoment: (career: "fight" | "explore") => void;
  keepMoment: (event: MomentEvent, before: number, after: number, events?: MomentEvent[]) => Promise<LoggedMoment | null>;
};
export const initExplore = (hooks: typeof main) => Object.assign(main, hooks);

// --- Exploring (game/explore.ts) -----------------------------------------------------
// Rings and moons are drawn for everyone; surveys and signals pay, so they're
// Modern only, like the rest of what we've added to 1984.

let worldParts: THREE.Group[] = [];
export let survey: { target: SceneBody; progress: number } | null = null;
export const YARD_COLOUR = COMPANIES.wy.colour;
const SIGNAL_DETECT = 6000; // metres: close enough to notice a signal without a survey
const SIGNAL_COLOUR = '#c9b3ff';
const DEAD_HULL = new THREE.Color(0.16, 0.16, 0.17); // no power, no glow
export const exploring = () => cmdr().difficulty === 'modern';

function disposeExploreScene() {
  for (const g of worldParts) disposeWorldPart(g);
  for (const p of flight.scenePois) {
    for (const m of p.models) disposeShip(m);
    if (p.beacon) disposeWorldPart(p.beacon);
  }
  worldParts = [];
  flight.scenePois = [];
  flight.sceneBodies = [];
  survey = null;
  flight.yardScene?.dispose();
  flight.yardScene = null;
  $('#survey').hidden = true;
}

export function buildExploreScene(sys: StarSystem) {
  disposeExploreScene();
  const w = worldOf(sys);
  const c = game.commander;
  if (w.rings) {
    const rings = buildRings(flight.planetRadius, w.rings, main.planetColour(sys));
    rings.position.copy(planetPos);
    space.scene.add(rings);
    worldParts.push(rings);
  }
  const bodies = bodiesOf(sys);
  flight.sceneBodies.push({ body: bodies[0], centre: planetPos, radius: flight.planetRadius, range: flight.planetRadius * SURVEY.planet.altitude });
  flight.sceneBodies.push({ body: bodies[1], centre: SUN_POS, radius: SUN_RADIUS, range: SUN_RADIUS * SURVEY.star.altitude });
  w.moons.forEach((m, i) => {
    const radius = m.size * flight.planetRadius;
    let angle = m.angle;
    const at = () => new THREE.Vector3(Math.cos(angle) * Math.cos(m.tilt), Math.sin(m.tilt), Math.sin(angle) * Math.cos(m.tilt)).multiplyScalar(m.orbit * flight.planetRadius).add(planetPos);
    // Keep the station's approach clear.
    if (at().distanceTo(station.root.position) < flight.planetRadius + radius) angle += Math.PI;
    const moon = buildMoon(radius);
    moon.position.copy(at());
    space.scene.add(moon);
    worldParts.push(moon);
    flight.sceneBodies.push({ body: bodies[2 + i], centre: moon.position, radius, range: radius * SURVEY.moon.altitude });
  });
  if (!c || c.difficulty !== 'modern') return;
  // The yard first, so signals can keep clear of it.
  const yard = yardAt(sys, Date.now());
  const quarry = yard && flight.sceneBodies.find((b) => b.body.id === `moon${yard.moon}`);
  if (yard && quarry) {
    const defs = { titan: withLineUp(shipById('titanoboa')!, lineUpFor(yard)), hauler: shipById('bullsnake')!, station: shipById('coriolis')! };
    flight.yardScene = buildYard(space.scene, yard, defs, { centre: quarry.centre, radius: quarry.radius }, station.root.position);
  }
  const planetDone = isSurveyed(c, sys, 'planet');
  const courier = courierPoiOf(c, sys);
  for (const poi of [...poisOf(sys), ...trailPoisOf(c, sys), ...(courier ? [courier] : [])]) {
    const dir = new THREE.Vector3(...poi.direction);
    // Near enough that salvage isn't lost to space, and clear of the moons.
    const position = dir.clone().multiplyScalar(Math.min(poi.distance * flight.planetRadius, 30000)).add(planetPos);
    for (const b of flight.sceneBodies) if (b.body.kind === 'moon' && position.distanceTo(b.centre) < b.radius * 3) position.addScaledVector(dir, b.radius * 4);
    if (flight.yardScene && position.distanceTo(flight.yardScene.centre) < flight.yardScene.radius * 2) position.addScaledVector(dir, flight.yardScene.radius * 3);
    const found = isFound(c, sys, poi.id);
    // A beacon you've found has powered down and drifted off: gone from your sky. (Each commander finds their own.)
    if (found && poi.kind === 'beacon') continue;
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
    flight.scenePois.push(sp);
  }
}

/** Surveys under way, signals found, and the moons' surfaces. Returns true if you hit a moon. */
export function updateExplore(dt: number): boolean {
  const pos = player.obj.position;
  for (const b of flight.sceneBodies) if (b.body.kind === 'moon' && pos.distanceTo(b.centre) < b.radius) return true;
  flight.yardScene?.update(dt, Date.now());
  for (const p of flight.scenePois) {
    for (const m of p.models) m.root.rotateOnAxis(TUMBLE_AXIS, dt * 0.03);
    if (p.beacon) blinkBeacon(p.beacon, flight.elapsed);
  }
  if (!exploring()) return false;
  const c = cmdr();
  const here = currentSystem();

  // Surveying: hold close to something you haven't surveyed yet.
  const deep = isWorking(c, 'survey-scanner'); // twice the range, half the time
  const near = flight.sceneBodies.find((b) => pos.distanceTo(b.centre) - b.radius < b.range * (deep ? 2 : 1) && !isSurveyed(c, here, b.body.id));
  if (near && survey?.target !== near) survey = { target: near, progress: 0 };
  if (survey) {
    survey.progress = THREE.MathUtils.clamp(survey.progress + (near === survey.target ? dt * (deep ? 2 : 1) : -dt * 0.5), 0, survey.target.body.time);
    if (survey.progress >= survey.target.body.time) {
      const done = survey.target.body;
      const before = exploreOf(c).points;
      recordSurvey(c, here, done);
      main.noteCardMoment('explore');
      void main.keepMoment({ kind: 'discovery', text: `Survey complete · ${done.name}`, subject: done.name }, 20, 3);
      noteExplorerRank(before);
      saveCommander(c);
      sfx.beep();
      const grade = done.grade ? ` · ${done.grade === 'Candidate' ? 'terraforming CANDIDATE: Wexley-Yorozu will want this' : done.grade.toLowerCase()}` : '';
      flashLater(`Survey complete · ${done.name}${grade} · data worth ${dataValue(exploreOf(c).data[exploreOf(c).data.length - 1], here)} Cr here, more further away`, 4);
      survey = null;
      if (done.id === 'planet') {
        const hidden = flight.scenePois.filter((p) => !p.revealed);
        for (const p of hidden) p.revealed = true;
        if (hidden.length) setTimeout(() => game.state === 'flying' && flash(hidden.length === 1 ? 'The survey picked up an unidentified signal' : `The survey picked up ${hidden.length} unidentified signals`, 3), 3800);
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
  for (const p of flight.scenePois) {
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

// Wrecks and beacons are solid: they stop lasers, yours and theirs, so you
// can put one between you and a pirate, and they bounce you off.
const BEACON_RADIUS = 22;
export function coverTargets<T>(value: T): Target<T>[] {
  const out: Target<T>[] = [];
  for (const p of flight.scenePois) {
    for (const m of p.models) out.push({ value, position: m.root.position, radius: m.radius * 0.8 });
    if (p.beacon) out.push({ value, position: p.beacon.position, radius: BEACON_RADIUS });
  }
  return out;
}

// Hiding in the clutter (docs/design/exploration.md): in a wreck field you're
// lost to ships beyond a short range, unless you've just fired. Your scanner
// is cluttered the same way.
const CLUTTER_RADIUS = 700; // metres round a wreck field's centre
export const HIDDEN_BEYOND = 1500; // metres
export const HIDDEN_BEYOND_DARK = 600; // metres, transponder off
const SHOT_GIVES_AWAY = 3; // seconds after firing that everyone can see you

export function inClutter(pos: THREE.Vector3) {
  return flight.scenePois.some((p) => p.poi.kind === 'wrecks' && p.position.distanceTo(pos) < CLUTTER_RADIUS);
}
/** Whether a ship at this distance can pick the player out. */
export function playerVisibleAt(distance: number) {
  if (!exploring() || !inClutter(player.obj.position) || flight.elapsed - flight.lastShotAt < SHOT_GIVES_AWAY) return true;
  return distance < (main.dark() ? HIDDEN_BEYOND_DARK : HIDDEN_BEYOND);
}

/** The wreck or beacon the ship has run into, pushing it back out; null if none. */
export function bumpCover(pos: THREE.Vector3, shipRadius: number): string | null {
  for (const p of flight.scenePois) {
    const solids = [...p.models.map((m) => ({ at: m.root.position, r: m.radius * 0.8 })), ...(p.beacon ? [{ at: p.beacon.position, r: BEACON_RADIUS }] : [])];
    for (const { at, r } of solids) {
      const away = pos.clone().sub(at);
      if (away.length() >= r + shipRadius) continue;
      if (away.lengthSq() < 1) away.set(0, 1, 0);
      pos.copy(at).add(away.setLength(r + shipRadius + 5));
      return p.revealed && isFound(cmdr(), currentSystem(), p.poi.id) ? p.poi.name : p.poi.kind === 'beacon' ? 'beacon' : 'wreck';
    }
  }
  return null;
}

function discover(p: ScenePoi) {
  const c = cmdr();
  const before = exploreOf(c).points;
  recordDiscovery(c, currentSystem(), p.poi);
  if (p.beacon) powerDownBeacon(p.beacon); // its message delivered, its lamp goes out
  // The lost courier's prototype: yours now.
  if (p.poi.prize && !hasEquipment(c, p.poi.prize)) {
    c.equipment.push(p.poi.prize);
    exploreOf(c).points += COURIER_POINTS;
    setTimeout(() => game.state === 'flying' && flash('Will-o’-the-Wisp fitted · enemy lasers miss half the time, half the missiles are spoofed · Wexley-Yorozu will want it back', 6), 5200);
  }
  if (p.poi.salvage.length) {
    spillCargo(p.position, new THREE.Vector3(), salvageCargo(p.poi.salvage));
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
export function bringHome(held: SurveyData[]) {
  const c = cmdr();
  const gone = held.filter((d) => !exploreOf(c).data.includes(d));
  if (c.difficulty !== 'modern' || !gone.length) return;
  void claimFirsts(gone.map((d) => ({ galaxy: d.galaxy, system: d.system, body: d.body }))).then((won) => {
    if (!won.length) return;
    const one = gone.find((d) => d.galaxy === won[0].galaxy && d.system === won[0].system && d.body === won[0].body);
    const what = won.length === 1 ? (one?.name ?? 'one find') : `${won.length} finds`;
    setTimeout(() => flash(`First to bring it home · your callsign goes on the chart for ${what}`, 5), 2500);
    if (game.state === 'docked') renderDocked();
  });
}

/** The chart's line on who got somewhere first: names on the galaxy. */
export function firstsLine(s: StarSystem): string | null {
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
export function myFirsts(galaxy: number): number {
  const mine = currentAccount()?.callsign;
  if (!mine) return 0;
  let n = 0;
  for (let i = 0; i < 256; i++) for (const callsign of firstsIn(galaxy, i).values()) if (callsign === mine) n++;
  return n;
}

/** What explorers hear at a station: the nearest trail not yet started (Trailblazers), and bar talk of the courier. */
export function explorerTips(c: Commander, here: StarSystem): [string, string][] {
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
export function showLog(title: string, text: string, ms: number) {
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
export function exploreMarkers(km: (p: THREE.Vector3) => string): Marker[] {
  const out: Marker[] = [];
  // Moons, and (Modern) the planet: bright in the explorer's colour until
  // surveyed, then the plain grey of somewhere done, with a tick for anyone
  // who can't tell the colours apart. Named within 30 km of the surface.
  for (const b of flight.sceneBodies) {
    if (b.body.kind === 'star' || (b.body.kind === 'planet' && !exploring())) continue;
    const near = player.obj.position.distanceTo(b.centre) - b.radius < 30000;
    const surveyed = !exploring() || isSurveyed(cmdr(), currentSystem(), b.body.id);
    const tick = exploring() && surveyed ? ' ✓' : '';
    out.push({ position: b.centre, color: surveyed ? '#9aa3ad' : SIGNAL_COLOUR, radius: b.radius, label: near ? `${b.body.name}${tick} ${km(b.centre)}` : undefined });
  }
  if (!exploring()) return out;
  for (const p of flight.scenePois) {
    if (!p.revealed) continue;
    const found = isFound(cmdr(), currentSystem(), p.poi.id);
    out.push({ position: p.position, color: SIGNAL_COLOUR, radius: 30, label: found ? `${p.poi.name} ${km(p.position)}` : `Signal ${km(p.position)}` });
  }
  // A yard is hard to miss, so it's always named.
  if (flight.yardScene) out.push({ position: flight.yardScene.centre, color: YARD_COLOUR, radius: flight.yardScene.radius, label: `Wexley-Yorozu yard · ${stageLabel(flight.yardScene.yard)} · ${km(flight.yardScene.centre)}` });
  return out;
}

/** On arriving anywhere: note the visit, and say what's special here. */
export function arrivalNote(sys: StarSystem): string {
  const before = exploreOf(cmdr()).points;
  const first = recordVisit(cmdr(), sys);
  noteExplorerRank(before);
  const world = describeWorld(worldOf(sys));
  const yard = exploring() && yardAt(sys, Date.now()) ? 'A Wexley-Yorozu yard is building here' : '';
  return [world, yard, first ? 'First visit' : ''].filter(Boolean).join(' · ');
}
