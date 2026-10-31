// The ships about you in flight (moved from main.ts): traders and pirates, how often trouble comes
// and how word of you gets round, the Modern timetable's ships riding their lanes (game/traffic.ts,
// docs/design/the-world.md), the Titan's guards and escorts, and the rule for a stray shot.

import { music, sfx } from '../audio/sound';
import { boomAt } from '../audio/spatial';
import { shipById } from '../content/ships';
import { saveCommander, type Commander } from '../game/commander';
import { systemKey } from '../game/law';
import { NpcShip, type NpcRole } from '../game/npc';
import { FALCON_LASER, MARSHAL_LASER, PIRATE_LASER, POLICE_LASER, TRADER_LASER } from '../game/weapons';
import { PlayerShip } from '../game/playerShip';
import { SLOT } from '../game/station';
import { addStanding } from '../game/contracts';
import { COMPANIES, pickCompany, type CompanyId } from '../game/companies';
import { applyCompanyBand } from '../render/livery';
import { HOLD, laneDirection, packHolds, voyages, type Voyage } from '../game/traffic';
import { JumpStreak } from '../render/jumpStreak';
import { isRetro } from '../render/renderer';
import { showUnidentified } from '../render/shipModel';
import { flash } from '../ui/hud';
import { commodityById, UNITS_PER_TONNE } from '../economy/commodities';
import { marketState } from '../economy/trade';
import { upcomingDeliveries } from '../economy/market';
import { cmdr, currentSystem, game, modern } from '../core';
import { explosions, flight, missiles, npcs, ofRole, voices, planetPos, player, space, station } from '../scene';
import { tradeContext } from '../ui/market';
import * as THREE from 'three';
import type { Missile } from '../game/missile';
import type { RadioKind, RadioOpts } from '../ui/radio';
import type { LoggedMoment } from '../game/flightLog';
import type { MomentEvent } from '../game/moments';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  rateKill: (npc: NpcShip | "crime") => string;
  reportedBy: (npc: NpcShip) => void;
  explodeMissile: (m: Missile) => void;
  spillCargo: (at: THREE.Vector3, velocity: THREE.Vector3, cargo: number | Record<string, number>, stolen?: boolean) => void;
  rollAssistApplies: () => boolean;
  npcIdentified: (npc: NpcShip) => boolean;
  radio: (kind: RadioKind, from: string, text: string, o?: RadioOpts) => void;
  keepMoment: (event: MomentEvent, before: number, after: number, events?: MomentEvent[]) => Promise<LoggedMoment | null>;
  keepCombat: (event: MomentEvent, before: number, after: number) => Promise<LoggedMoment | null>;
};
export const initTraffic = (hooks: typeof main) => Object.assign(main, hooks);

// --- Traffic: traders and pirates ----------------------------------------------------

/** Chance of pirates per encounter roll, by government: anarchies are rough, corporate states safe. */
export const PIRATE_CHANCE = [0.75, 0.55, 0.4, 0.3, 0.25, 0.15, 0.1, 0.06];
export const TRADERS_BY_GOVERNMENT = [1, 1, 2, 2, 2, 3, 3, 3];
const ENCOUNTER_INTERVAL = 40; // seconds between rolls for pirates
export const MAX_PIRATES = 4;
const CALM_BETWEEN_FIGHTS = 20; // seconds after a fight before the next roll (+10 s per step of government safety)
const FIGHT_NEAR = 12000; // metres: pirates this close count as a fight on
let lastFightAt = -Infinity;

// Word gets round (Modern): every pirate you destroy in a system makes the
// next lot there warier, so they come less often and later: a good pilot
// can earn quickly, but not forever. It fades with time (halving every 10
// minutes), so a system you come back to later has forgotten you.
const WARY_HALF_LIFE = 10 * 60 * 1000; // ms
const WARY_ODDS = 0.88; // each loss multiplies the odds of the next attack by this
const WARY_CALM = 5; // seconds more quiet per loss
const pirateLosses = new Map<string, { n: number; at: number }>();
const toldWary = new Set<string>(); // systems where you've been told, so it's said once
function wariness(): number {
  const w = pirateLosses.get(systemKey(currentSystem()));
  return w ? w.n * 0.5 ** ((Date.now() - w.at) / WARY_HALF_LIFE) : 0;
}
export function pirateLost() {
  if (!modern()) return;
  const before = wariness();
  pirateLosses.set(systemKey(currentSystem()), { n: before + 1, at: Date.now() });
  if (before + 1 >= 6 && !toldWary.has(systemKey(currentSystem())) && toldWary.add(systemKey(currentSystem()))) setTimeout(() => game.state === 'flying' && flash('Word gets round · pirates here are giving you a wide berth', 4), 3000);
}
/** Pirates about you, or anyone out to get you. */
export const fightOn = () => npcs.some((n) => n.hostile || (n.role === 'pirate' && n.obj.position.distanceTo(player.obj.position) < FIGHT_NEAR));
export const BOUNTIES: Record<string, number> = { sidewinder: 50, mamba: 80, falcon: 2000 };
/** The Falcon, the Legend of the lanes: a chance in each pirate encounter, by government (anarchies most). */
const FALCON_CHANCE = [0.04, 0.03, 0.02, 0.015, 0.01, 0.01, 0.005, 0.005];
export const TRADE_GOODS = ['food', 'textiles', 'computers', 'machinery', 'liquor', 'luxuries', 'furs', 'minerals', 'alloys'];
let encounterTimer = 0;
let traderTimer = 0;

type Leg = 'inbound' | 'docking' | 'outbound' | 'titan';
export const legs = new WeakMap<NpcShip, Leg>();

// Inbound traders carry the market's real upcoming deliveries (Modern rules):
// destroy one and those goods never reach the station.
type Delivery = { id: string; t: number; qty: number };
export const deliveries = new WeakMap<NpcShip, Delivery[]>();
let carried = new Set<string>(); // deliveries already given to a trader in this system
const DELIVERY_WINDOW = [2 * 60_000, 15 * 60_000]; // ms ahead: due after the trader could dock

function loadDeliveries(npc: NpcShip): boolean {
  if (!game.commander || cmdr().difficulty !== 'modern') return false;
  const now = Date.now();
  const due = upcomingDeliveries(currentSystem(), marketState(tradeContext()), now + DELIVERY_WINDOW[0], now + DELIVERY_WINDOW[1]).filter(
    (d) => !carried.has(`${d.id}:${d.t}`),
  );
  const load: Delivery[] = [];
  for (const d of due) if (load.length < 3 && !load.some((x) => x.id === d.id)) load.push(d);
  if (!load.length) return false;
  // What fits in her hold; the rest comes on a later ship.
  load.splice(0, load.length, ...packHolds(load, HOLD['cobra-mk3'])[0]);
  for (const d of load) carried.add(`${d.id}:${d.t}`);
  deliveries.set(npc, load);
  npc.cargo = Object.fromEntries(load.map((d) => [d.id, d.qty]));
  return true;
}

/** The station's approach lane: points on the slot axis, which don't move as it spins. */
export const onSlotAxis = (d: number) => station.toWorld(new THREE.Vector3(0, 0, SLOT.z + d));

/** Ships seen jumping from further than this aren't worth drawing. */
const STREAK_SEEN = 20_000;
/** Closer than this, you hear her go. */
const STREAK_HEARD = 3000;

/** A ship going into witchspace (or out of it, arriving): a streak along her heading, not a blink. */
export function jumpStreak(npc: NpcShip, leaving: boolean) {
  const d = npc.obj.position.distanceTo(player.obj.position);
  if (game.state !== 'flying' || d > STREAK_SEEN) return;
  const streak = new JumpStreak(npc.def, npc.obj, leaving);
  space.scene.add(streak.group);
  explosions.push(streak);
  if (d < STREAK_HEARD) sfx.shipJump();
}

/** A random direction that keeps well clear of the planet. */
function awayFromPlanet(): THREE.Vector3 {
  const toPlanet = planetPos.clone().sub(station.root.position).normalize();
  const d = new THREE.Vector3().randomDirection();
  if (d.dot(toPlanet) > -0.2) d.addScaledVector(toPlanet, -(d.dot(toPlanet) + 0.6)).normalize();
  return d;
}

export function randomCargo(): Record<string, number> {
  const cargo: Record<string, number> = {};
  for (let i = 0; i < 1 + Math.floor(Math.random() * 3); i++) {
    const id = TRADE_GOODS[Math.floor(Math.random() * TRADE_GOODS.length)];
    cargo[id] = (cargo[id] ?? 0) + 1 + Math.floor(Math.random() * 4);
  }
  return cargo;
}

export function addNpc(def: string, role: NpcRole, at: THREE.Vector3, patrolCentre = station.root.position) {
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
export function flyForCompany(npc: NpcShip) {
  if (!game.commander || cmdr().difficulty !== 'modern' || Math.random() < 0.2) return;
  npc.company = pickCompany(currentSystem(), Math.random());
  applyCompanyBand(npc.model, COMPANIES[npc.company].colour);
}

/** A trader either arriving from witchspace and heading in, or launching and heading out. */
export function spawnTrader(arriving: boolean, distance = 14000 + Math.random() * 8000) {
  if (arriving) {
    const at = station.root.position.clone().addScaledVector(awayFromPlanet(), distance);
    const npc = addNpc('cobra-mk3', 'trader', at);
    flyForCompany(npc);
    npc.obj.lookAt(station.root.position);
    npc.ship.speed = npc.ship.maxSpeed * 0.5;
    npc.destination = onSlotAxis(900);
    legs.set(npc, 'inbound');
    if (!loadDeliveries(npc)) npc.cargo = randomCargo();
    jumpStreak(npc, false);
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

// --- Traffic from the market's timetable (Modern; game/traffic.ts, docs/design/the-world.md) ---
//
// Every voyage is worked out from the seed and the clock, so each ship is where
// it would be for anyone: far from you it rides its lane by the clock, and once
// you're close, or it's in trouble, it flies itself like any other trader.

type Rails = { path: THREE.QuadraticBezierCurve3; start: number; end: number; length: number };
export const railsOf = new WeakMap<NpcShip, Rails>();
export const voyageOf = new WeakMap<NpcShip, Voyage>();
const LANE_OUT = 30_000; // metres from the station where a lane begins or ends
const RAILS_NEAR = 2500; // closer to you than this, a ship flies itself
const MAX_VOYAGES = 8; // ships on their lanes at once, at most (5 until convoys, 31 October 2026: Mark wanted busier systems)
let trafficShips = new Map<string, NpcShip>(); // voyage id → its ship, this visit
let trafficDone = new Set<string>(); // voyages flown, docked or lost, this visit
let trafficList: Voyage[] = [];
let trafficListAt = -Infinity;
let trafficCheck = 0;
/** The visit's first ships are just there when you arrive; after that, a ship that appears near you arrives with a streak. */
let trafficSettled = false;
const lanePaths = new Map<string, THREE.QuadraticBezierCurve3>(); // worked out once a visit

// Company security (Mark): Vipers in company colours. Guards patrol a yard's Titan;
// escorts fly alongside a freighter. They fight pirates and whoever attacks the
// company's ships, and answer to the company, not the law.
const yardGuards = new Set<NpcShip>();
export const escortOf = new Map<NpcShip, NpcShip>(); // escort → the freighter it's with
const YARD_GUARDS = [3, 3, 2, 2, 2, 2, 2, 2]; // by government: more in lawless space
const GUARD_RELIEF = 180_000; // ms before a lost guard is replaced from the Titan's hold
let guardDueAt = 0;

function securityViper(company: CompanyId, centre: THREE.Vector3, radius: number, i: number): NpcShip {
  const npc = new NpcShip(shipById('viper')!, 'police', POLICE_LASER, {
    centre: centre.clone(),
    radius,
    height: [150, -200, 40][i % 3],
    rate: (i % 2 ? -1 : 1) * 0.16,
    angle: i * 2.1,
  });
  npc.guard = true;
  npc.company = company;
  applyCompanyBand(npc.model, COMPANIES[company].colour);
  const p = npc.patrol;
  npc.obj.position.set(Math.cos(p.angle) * p.radius, p.height, Math.sin(p.angle) * p.radius).add(p.centre);
  space.scene.add(npc.obj);
  npcs.push(npc);
  return npc;
}

/** Keep the yard guarded, and send away escorts whose freighter has docked or gone, once they're out of sight. */
function keepSecurity(now: number) {
  if (flight.yardScene && flight.yardScene.yard.stage !== 'finished') {
    const want = YARD_GUARDS[currentSystem().government];
    if (yardGuards.size < want && now >= guardDueAt) {
      yardGuards.add(securityViper('wy', flight.yardScene.centre, flight.yardScene.radius + 900 + yardGuards.size * 500, yardGuards.size));
      if (yardGuards.size >= want) guardDueAt = 0;
    }
  }
  for (const [escort, freighter] of escortOf) {
    if (npcs.includes(freighter)) continue;
    if (escort.obj.position.distanceTo(player.obj.position) > 5000 && !escort.hostile) removeNpc(escort);
  }
}

/** Someone fired on a company ship: its security nearby goes after them. */
export function alertSecurity(victim: NpcShip, by: PlayerShip) {
  if (!victim.company) return;
  for (const g of npcs) {
    if (!g.guard || g.company !== victim.company || g.obj.position.distanceTo(victim.obj.position) > 8000) continue;
    g.attacker = by;
    g.attackedAgo = 0;
  }
}

export function resetTraffic() {
  yardGuards.clear();
  escortOf.clear();
  guardDueAt = 0;
  lanePaths.clear();
  trafficShips = new Map();
  trafficDone = new Set();
  trafficListAt = -Infinity;
  trafficCheck = 0;
  trafficSettled = false;
}

/** A voyage's path through the system: from its lane's end, round the planet and moons, to the slot or the Titan (or back out). */
function lanePath(v: Voyage): THREE.QuadraticBezierCurve3 | null {
  const d = new THREE.Vector3(...laneDirection(currentSystem(), v.other));
  const toPlanet = planetPos.clone().sub(station.root.position).normalize();
  if (d.dot(toPlanet) > -0.2) d.addScaledVector(toPlanet, -(d.dot(toPlanet) + 0.6)).normalize();
  const far = station.root.position.clone().addScaledVector(d, LANE_OUT);
  let near: THREE.Vector3;
  if (v.to === 'titan') {
    if (!flight.yardScene) return null;
    near = flight.yardScene.centre.clone().add(far.clone().sub(flight.yardScene.centre).setLength(flight.yardScene.radius * 1.2));
  } else near = onSlotAxis(v.leg === 'in' ? 900 : 300);
  const [a, b] = v.leg === 'in' ? [far, near] : [near, far];
  const path = new THREE.QuadraticBezierCurve3(a, a.clone().add(b).multiplyScalar(0.5), b);
  // Bend round anything in the way: push the middle of the curve out from it until it's clear.
  const bodies = [{ centre: planetPos, radius: flight.planetRadius * 1.15 }, ...flight.sceneBodies.filter((b) => b.body.id.startsWith('moon')).map((b) => ({ centre: b.centre, radius: b.radius * 1.3 }))];
  for (let tries = 0; tries < 6; tries++) {
    let worst: { centre: THREE.Vector3; by: number; at: THREE.Vector3 } | null = null;
    for (let i = 1; i < 20; i++) {
      const p = path.getPoint(i / 20);
      for (const body of bodies) {
        const by = body.radius - p.distanceTo(body.centre);
        if (by > 0 && (!worst || by > worst.by)) worst = { centre: body.centre, by, at: p };
      }
    }
    if (!worst) break;
    path.v1.add(worst.at.clone().sub(worst.centre).setLength(worst.by * 2.2 + 500));
  }
  return path;
}

const cruiseOf = (hull: string) => shipById(hull)!.stats.maxSpeed * 0.5;

/** Ships on their lanes right now that aren't in the scene yet: put them there. */
function syncTraffic(dt: number) {
  if (!modern() || !game.commander) return;
  trafficCheck -= dt;
  if (trafficCheck > 0) return;
  trafficCheck = 1;
  const now = Date.now();
  keepSecurity(now);
  if (now - trafficListAt > 60_000) {
    trafficList = voyages(currentSystem(), now - 10 * 60_000, now + 10 * 60_000, marketState(tradeContext()).lost ?? []);
    trafficListAt = now;
  }
  for (const v of trafficList) {
    if (trafficShips.size >= MAX_VOYAGES) break;
    if (trafficShips.has(v.id) || trafficDone.has(v.id)) continue;
    const path = lanePaths.get(v.id) ?? lanePath(v); // none yet for the Titan until her yard is in the scene
    if (!path) continue;
    lanePaths.set(v.id, path);
    const length = path.getLength();
    const flight = (length / cruiseOf(v.hull)) * 1000;
    const start = v.leg === 'in' ? v.at - flight : v.at;
    if (now < start || now >= start + flight) continue;
    const npc = addNpc(v.hull, 'trader', path.getPointAt((now - start) / flight));
    if (v.company) {
      npc.company = v.company;
      applyCompanyBand(npc.model, COMPANIES[v.company].colour);
    }
    npc.cargo = {};
    for (const c of v.cargo) npc.cargo[c.id] = (npc.cargo[c.id] ?? 0) + c.qty;
    if (v.leg === 'in' && v.to === 'station') {
      deliveries.set(npc, v.cargo);
      for (const c of v.cargo) carried.add(`${c.id}:${c.t}`);
    }
    npc.destination = path.getPoint(1);
    legs.set(npc, v.to === 'titan' ? 'titan' : v.leg === 'in' ? 'inbound' : 'outbound');
    railsOf.set(npc, { path, start, end: start + flight, length });
    voyageOf.set(npc, v);
    trafficShips.set(v.id, npc);
    ride(npc, now);
    // Never a blink in front of you (Mark: a Cobra "may of come back in the same system but slightly different place").
    // A ship just launching comes out of the slot as she always has.
    if (trafficSettled && !(v.leg === 'out' && now - start < 5000)) jumpStreak(npc, false);
    for (let i = 0; i < v.escorts && v.company; i++) escortOf.set(securityViper(v.company, npc.obj.position, 550 + i * 250, i), npc);
  }
  if (game.state === 'flying') trafficSettled = true;
}

/** Move the ships riding their lanes to where the clock says; let go of any that are near you or in trouble. */
export function ride(npc: NpcShip, now: number) {
  const r = railsOf.get(npc);
  if (!r) return;
  const u = (now - r.start) / (r.end - r.start);
  const near = game.state === 'flying' && npc.obj.position.distanceTo(player.obj.position) < RAILS_NEAR;
  if (u >= 1 || near || npc.hostile || npc.attackedAgo < 60) {
    railsOf.delete(npc);
    return;
  }
  const at = r.path.getPointAt(Math.max(0, u));
  npc.obj.position.copy(at);
  npc.obj.lookAt(at.clone().add(r.path.getTangentAt(Math.max(0, u))));
  npc.ship.speed = r.length / ((r.end - r.start) / 1000);
}

/** A pirate band of one to three, somewhere ahead of the player and away from the station. */
export function spawnPirates(near: THREE.Vector3): false | 'pirates' | 'falcon' {
  const dir = player.forward().add(new THREE.Vector3().randomDirection().multiplyScalar(0.8)).normalize();
  const centre = near.clone().addScaledVector(dir, 5000 + Math.random() * 2500);
  if (centre.distanceTo(station.root.position) < 5000 || centre.distanceTo(planetPos) < flight.planetRadius * 1.3) return false;
  // Now and then, the Falcon: alone, running dark, and worth a fortune (Modern only).
  if (cmdr().difficulty === 'modern' && !falconAvoiding() && !npcs.some((n) => n.def.id === 'falcon') && Math.random() < FALCON_CHANCE[currentSystem().government]) {
    spawnFalcon(centre, near);
    return 'falcon';
  }
  const gov = currentSystem().government;
  // Pirates hunt in packs (Modern): two to four in an anarchy, two or three in
  // a feudal system, one or two where it's safer. Classic keeps 1984's sizes.
  const [least, extra] = !modern() ? [1, gov === 0 ? 3 : 2] : gov === 0 ? [2, 3] : gov === 1 ? [2, 2] : [1, 2];
  const count = Math.min(MAX_PIRATES - ofRole('pirate').length, least + Math.floor(Math.random() * extra));
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
export function spawnFalcon(at: THREE.Vector3, near: THREE.Vector3) {
  const npc = addNpc('falcon', 'pirate', at, at);
  npc.obj.lookAt(near);
  npc.ship.speed = npc.ship.maxSpeed * 0.5;
  npc.dark = true;
  npc.bounty = BOUNTIES.falcon;
  npc.ecm = true;
  npc.breaksOffAt = FALCON_BREAKS_OFF;
  npc.laser = FALCON_LASER;
  npc.guns = FALCON_GUNS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  npc.gimbal = FALCON_GIMBAL;
  npc.cargo = { gems: 1 + Math.floor(Math.random() * 3), gold: 1 + Math.floor(Math.random() * 2) };
  return npc;
}

// A Falcon can't be destroyed (docs/design/legends-the-falcon.md, Beating her):
// at about a fifth of her hull she breaks off, jettisons a can of gems (a fee
// for your trouble), hails you, and jumps out with her ECM covering her.
// Driving her off pays her bounty and counts as a kill.
const FALCON_BREAKS_OFF = 0.2;
/** A laser at the tip of each talon vane, firing in turn. */
const FALCON_GUNS = [[36, -2.4, 23], [-36, -2.4, 23]] as const;
/** Her beams swing onto you this far off her nose: a little gimbal, not a turret. */
const FALCON_GIMBAL = THREE.MathUtils.degToRad(8);
const FALCON_JUMP_DELAY = 2.5; // seconds from breaking off to her jump
/** She stops when your hull is down to this share: she disables, she doesn't kill. */
export const FALCON_DISABLES = 1 / 3;
/** Her price, in tonnes: the most valuable goods in your hold, never company cargo, your ship, kit or credits. */
const FALCON_TAKES = 10;
const FALCON_CALLING = [
  "That's my price. The rest is yours, and so is your life. Fly safe, Commander.",
  "Nothing personal. The Solos have bills too.",
  "You'll get home. Slowly. Think about who you carry for.",
  "Tell them the Falcon took it. They'll understand.",
];
const FALCON_FEE = 4; // grams of gem-stones in the can
const FALCON_PARTING = [
  "Enough. You've earned the stones. Spend them somewhere I'm not.",
  "You fly like a Mutual pilot. That's a compliment. The stones are for the paintwork.",
  "Not bad. Not good enough. Here, for your trouble.",
  "My father built this ship to leave fights like this one. Keep the change, Commander.",
];
/** After you drive her off, she keeps away from you for a day, and a meeting in that time (only a dev spawn now) pays no bounty: she isn't a living. */
const FALCON_AVOIDS = 24 * 3600_000;
const falconAvoiding = () => Date.now() - (cmdr().falconDrivenOff ?? 0) < FALCON_AVOIDS;
export const fleeing = new Map<NpcShip, number>();

/** Each frame: a Falcon down to her last fifth breaks off, then jumps out. */
export function updateLegends(dt: number) {
  for (const npc of npcs) {
    if (!npc.won || fleeing.has(npc)) continue;
    fleeing.set(npc, FALCON_JUMP_DELAY * 2);
    Object.assign(npc, { mode: 'flee', hostile: false, fights: false, target: player });
    const taken = game.commander ? takeFalconsPrice(cmdr()) : '';
    main.radio('pirate', 'Falcon', FALCON_CALLING[Math.floor(Math.random() * FALCON_CALLING.length)], { colour: '#ff4d6d' });
    flash(taken ? `The Falcon took ${taken}` : 'The Falcon found nothing worth taking', 3.5);
    void main.keepCombat({ kind: 'legend', text: taken ? `The Falcon took ${taken}` : 'Beaten by the Falcon', subject: 'The Falcon' }, 20, 6);
  }
  for (const npc of npcs) {
    if (!npc.brokeOff || npc.won || fleeing.has(npc)) continue;
    fleeing.set(npc, FALCON_JUMP_DELAY);
    Object.assign(npc, { mode: 'flee', hostile: false, fights: false, target: player });
    // Her ECM covers her: anything already fired at her goes.
    for (const m of [...missiles]) if (m.target === npc.ship) main.explodeMissile(m);
    if (npc.obj.position.distanceTo(player.obj.position) < 6000) sfx.ecm();
    main.spillCargo(npc.obj.position, npc.ship.forward().multiplyScalar(npc.ship.speed * 0.3), { gems: FALCON_FEE });
    main.radio('pirate', 'Falcon', FALCON_PARTING[Math.floor(Math.random() * FALCON_PARTING.length)], { colour: '#ff4d6d' });
    if (npc.attacker === player && game.commander && falconAvoiding()) {
      flash('Falcon driven off · no bounty: you beat her less than a day ago', 3);
    } else if (npc.attacker === player && game.commander) {
      const c = cmdr();
      const rated = main.rateKill(npc);
      c.credits = Math.round((c.credits + npc.bounty) * 10) / 10;
      c.falconDrivenOff = Date.now();
      addStanding(c, 'wy', 2);
      addStanding(c, 'hexon', 2);
      saveCommander(c);
      flash(`Falcon driven off · Bounty ${npc.bounty} Cr${rated ? ` · ${rated}` : ''}`, 3);
      void main.keepCombat({ kind: 'kill', text: `Drove off the Falcon · bounty ${npc.bounty} Cr`, subject: 'Falcon' }, 20, 6);
    }
  }
  for (const [npc, left] of fleeing) {
    if (!npcs.includes(npc)) {
      fleeing.delete(npc);
      continue;
    }
    const now = left - dt;
    fleeing.set(npc, now);
    if (now > 0) continue;
    fleeing.delete(npc);
    const seen = npc.obj.position.distanceTo(player.obj.position) < 12000;
    boomAt(npc.obj.position, 0.8, 4000, 0.6);
    removeNpc(npc);
    if (seen) flash('The Falcon jumped out', 2);
  }
}

/** Her price: the most valuable goods by the tonne, up to her hold, leaving company cargo alone. Returns what she took, for the banner. */
function takeFalconsPrice(c: Commander): string {
  const consigned: Record<string, number> = {};
  for (const a of c.contracts ?? []) if (!a.adrift && !a.reserved) consigned[a.good] = (consigned[a.good] ?? 0) + a.qty;
  const goods = Object.entries(c.cargo)
    .map(([id, qty]) => ({ c: commodityById(id), id, free: qty - (consigned[id] ?? 0) }))
    .filter((g) => g.c && g.free > 0)
    .sort((a, b) => b.c!.basePrice * UNITS_PER_TONNE[b.c!.unit] - a.c!.basePrice * UNITS_PER_TONNE[a.c!.unit]);
  let room = FALCON_TAKES;
  const took: string[] = [];
  for (const g of goods) {
    if (room <= 0) break;
    const per = UNITS_PER_TONNE[g.c!.unit];
    const units = Math.min(g.free, Math.floor(room * per));
    if (units <= 0) continue;
    c.cargo[g.id] -= units;
    if (c.cargo[g.id] <= 0) delete c.cargo[g.id];
    room -= units / per;
    took.push(`${units}${g.c!.unit === 't' ? ' t' : g.c!.unit} of ${g.c!.name.toLowerCase()}`);
  }
  saveCommander(c);
  return took.slice(0, 3).join(', ') + (took.length > 3 ? ' and more' : '');
}

/** Each frame: ships running dark stay a cold white unknown until you're close enough to read the hull. */
export function updateIdentities() {
  for (const npc of npcs) {
    if (!npc.dark) continue;
    const unknown = !main.npcIdentified(npc);
    if (unknown === npc.shownUnidentified) continue;
    const first = npc.shownUnidentified === true; // was unknown: this is the hull read
    showUnidentified(npc.model, unknown);
    npc.shownUnidentified = unknown;
    if (first && !unknown) {
      sfx.lock();
      if (npc.def.id === 'falcon') {
        void main.keepMoment({ kind: 'legend', text: 'Hull read: the Falcon', subject: 'The Falcon' }, 15, 10);
        music.play('falcon', !isRetro()); // the Witches' Sabbath
      }
      flash(npc.def.id === 'falcon' ? 'Hull read · FALCON · the one the haulers warn you about' : `Hull read · ${npc.def.name}`, 3.5);
    }
  }
}

// Traffic control: the slot is yours once you're committed to it (the docking
// computer on, or lined up on the approach) and for a little while after you
// launch. Traders don't launch then, and incoming ones wait off to one side,
// out of the lane, until you're in or clear. Police launch whenever they must.
const SLOT_CLEAR = 4000; // metres from the station
const LAUNCH_CLEAR = 15; // seconds after launching
let launchedAt = -Infinity;
const slotReserved = () =>
  game.state === 'flying' &&
  player.obj.position.distanceTo(station.root.position) < SLOT_CLEAR &&
  (flight.autopilot || main.rollAssistApplies() || flight.elapsed - launchedAt < LAUNCH_CLEAR);
const holding = new WeakSet<NpcShip>();
const holdPoint = () => station.toWorld(new THREE.Vector3(1500, 0, SLOT.z + 2500));

/** Spawn and retire traffic. Traders dock or leave; pirates turn up by chance. */
export function updateTraffic(dt: number) {
  const sys = currentSystem();
  const reserved = slotReserved();
  for (const npc of [...npcs]) {
    const leg = legs.get(npc);
    if (!leg || npc.mode !== 'travel') continue;
    if (leg === 'inbound' && reserved && !holding.has(npc)) {
      holding.add(npc);
      npc.destination = holdPoint();
    } else if (leg === 'inbound' && !reserved && holding.has(npc)) {
      holding.delete(npc); // cleared in: back to the lane
      npc.destination = onSlotAxis(900);
    } else if (leg === 'inbound' && holding.has(npc)) {
      continue; // waiting its turn
    } else if (leg === 'inbound' && npc.obj.position.distanceTo(npc.destination!) < 150) {
      legs.set(npc, 'docking');
      npc.destination = onSlotAxis(-SLOT.z); // the station's centre, down the slot
    } else if (leg === 'docking' && station.toLocal(npc.obj.position).z < SLOT.z) {
      main.reportedBy(npc);
      removeNpc(npc); // safely inside
    } else if (leg === 'titan' && npc.obj.position.distanceTo(npc.destination!) < 400) {
      removeNpc(npc); // unloading into the Titan's hold
    } else if (leg === 'outbound' && npc.obj.position.distanceTo(npc.destination!) < 600) {
      main.reportedBy(npc);
      jumpStreak(npc, true);
      removeNpc(npc); // gone to witchspace
    }
  }
  traderTimer -= dt;
  if (traderTimer <= 0) {
    traderTimer = 25 + Math.random() * 35;
    if (!modern() && ofRole('trader').length < TRADERS_BY_GOVERNMENT[sys.government]) spawnTrader(Math.random() < 0.6 || reserved);
  }
  syncTraffic(dt);
  // Pacing (Modern): one fight at a time, and a breather after each, longer
  // in safer systems, so trouble comes in beats you can follow. (Classic
  // keeps 1984's: a roll every so often, whatever else is going on.)
  if (fightOn()) lastFightAt = flight.elapsed;
  const wary = modern() ? wariness() : 0;
  const calm = !modern() || (!fightOn() && flight.elapsed - lastFightAt > CALM_BETWEEN_FIGHTS + sys.government * 10 + wary * WARY_CALM);
  encounterTimer -= dt;
  if (encounterTimer <= 0 && game.state === 'flying' && calm) {
    encounterTimer = ENCOUNTER_INTERVAL * (0.6 + Math.random() * 0.8);
    if (ofRole('pirate').length < MAX_PIRATES && Math.random() < PIRATE_CHANCE[sys.government] * WARY_ODDS ** wary) {
      const met = spawnPirates(player.obj.position);
      if (met) flash(met === 'falcon' ? 'Unidentified contact on scanner' : 'Contacts on scanner', 2);
    }
  }
}

export function removeNpc(npc: NpcShip, dispose = true) {
  if (yardGuards.delete(npc) && !guardDueAt) guardDueAt = Date.now() + GUARD_RELIEF;
  escortOf.delete(npc);
  const voyage = voyageOf.get(npc);
  if (voyage && trafficShips.get(voyage.id) === npc) {
    trafficShips.delete(voyage.id);
    trafficDone.add(voyage.id);
  }
  voices.get(npc)?.dispose();
  voices.delete(npc);
  npcs.splice(npcs.indexOf(npc), 1);
  for (const n of npcs) {
    if (n.target === npc.ship) n.target = null;
    if (n.attacker === npc.ship) n.attacker = null;
  }
  if (flight.locked === npc) flight.locked = null;
  if (dispose) npc.dispose();
}

/** A new system: no deliveries handed out yet. */
export function forgetDeliveries() {
  carried = new Set();
}
/** The first trader and the first trouble after arriving. */
export function startEncounters() {
  traderTimer = 15;
  encounterTimer = modern() ? 25 + Math.random() * 15 : 12 + Math.random() * 10; // Modern: after the arrival news has been read
  lastFightAt = -Infinity;
}
export function markLaunched() {
  launchedAt = flight.elapsed;
}
/** For the debug handle. */
export const pacing = () => ({ encounterTimer, sinceFight: flight.elapsed - lastFightAt, fightOn: fightOn(), wary: wariness() });
