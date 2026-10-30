// Things adrift and the sun (moved from main.ts): cargo canisters spilled from wrecks and scooped
// up, a lost company case and the pirates who come for it, and skimming the sun for fuel.

import { sfx } from '../audio/sound';
import { shipById } from '../content/ships';
import { fuelCapacity, hasEquipment, isWorking, markStolen, saveCommander } from '../game/commander';
import { record as ledgerRecord } from '../game/ledger';
import { SCOOP_SPEED } from '../game/controls';
import { ADRIFT_HOLD, caseLost, takenByPirates, expireCases, recoverCase, type AdriftCase } from '../game/assignments';
import { COMPANIES } from '../game/companies';
import { applyCompanyBand } from '../render/livery';
import { Explosion } from '../render/explosion';
import { buildShip, disposeShip, heatShip, type ShipModel } from '../render/shipModel';
import { flash } from '../ui/hud';
import { commodityById, UNITS_PER_TONNE } from '../economy/commodities';
import { freeTonnes } from '../economy/trade';
import { $, cmdr, currentSystem, game } from '../core';
import { explosions, flight, npcs, planetPos, player, space, station, SUN_POS, SUN_RADIUS } from '../scene';
import { tradeContext } from '../ui/market';
import { BOUNTIES, TRADE_GOODS, addNpc, removeNpc } from './traffic';
import * as THREE from 'three';
import type { NpcShip } from '../game/npc';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  damagePlayer: (amount: number, from?: NpcShip | undefined) => boolean;
};
export const initAdrift = (hooks: typeof main) => Object.assign(main, hooks);

/**
 * Things adrift: cargo canisters spilled from wrecks. They tumble near where
 * they were lost for a while, then the planet slowly pulls them in and they
 * burn up in the atmosphere. That keeps space tidy without anything vanishing
 * out of thin air.
 */
export interface Drifter {
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
export const drifters: Drifter[] = [];
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

export function spillCargo(at: THREE.Vector3, velocity: THREE.Vector3, cargo: Record<string, number> | number, stolen = false) {
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
export function spillSpecial(k: AdriftCase) {
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
const raided = new Set<string>();

export function updateCaseRaid(dt: number) {
  if (!game.commander || game.state !== 'flying') return;
  const c = cmdr();
  // The pirates arrive.
  flight.raidClock += dt;
  for (const d of drifters) {
    if (!d.special || raided.has(d.special.contract) || flight.raidClock < RAID_DELAY) continue;
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
export function restoreAdrift() {
  flight.raidClock = 0;
  raided.clear();
  if (!game.commander) return;
  const here = currentSystem();
  for (const k of cmdr().adrift ?? []) if (!k.held && !k.fate && k.galaxy === here.galaxy && k.system === here.index) spillSpecial(k);
}

/** Cases whose time ran out elsewhere: tell the commander. */
export function checkAdrift() {
  if (!game.commander) return [];
  const notes = expireCases(cmdr(), Date.now(), (id) => drifters.some((d) => d.special?.contract === id));
  if (notes.length) saveCommander(cmdr());
  return notes;
}

// --- Fuel scoops: canisters and sun-skimming ----------------------------------------

const SCOOP_RANGE = 45; // metres from the ship's centre
const HEAT_RANGE = SUN_RADIUS * 2.5; // above the surface: the cabin starts to warm
const SKIM_RANGE = SUN_RADIUS * 0.8; // above the surface: close enough to scoop fuel
const SKIM_RATE = 0.12; // light years per second at full speed
let lastHeatWarning = 0;
let skimming = false;

/** A lost case answers its own contract's transponder: no scoops needed, just come in slow. */
function recoverCaseNear(d: Drifter): boolean {
  if (!d.special || d.model.root.position.distanceTo(player.obj.position) > RECOVER_RANGE) return false;
  const c = cmdr();
  const a = c.contracts?.find((x) => x.id === d.special!.contract);
  if (!a) return false;
  if (player.speed > player.maxSpeed * SCOOP_SPEED) {
    if (flight.elapsed - lastScoopWarning > 3) {
      lastScoopWarning = flight.elapsed;
      flash(`${a.label ?? 'Case'} · slow to under ${Math.round(SCOOP_SPEED * 100)}% speed to take it aboard`, 2);
    }
    return false;
  }
  if (freeTonnes(tradeContext()) < a.qty - 1e-9) {
    if (flight.elapsed - lastHoldFullWarning > 3) {
      lastHoldFullWarning = flight.elapsed;
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
    if (flight.elapsed - lastScoopWarning > 3) {
      lastScoopWarning = flight.elapsed;
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
    if (flight.elapsed - lastHoldFullWarning > 3) {
      lastHoldFullWarning = flight.elapsed;
      flash('Cargo hold full', 1.5);
    }
    return false;
  }
  c.cargo[contents.id] = (c.cargo[contents.id] ?? 0) + contents.qty;
  { const here = currentSystem(); ledgerRecord(c, { k: 'scoop', d: 0, g: contents.id, q: contents.qty, s: [here.galaxy, here.index] }); }
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
export function updateSun(dt: number): boolean {
  const altitude = player.obj.position.distanceTo(SUN_POS) - SUN_RADIUS;
  if (altitude < 0) return true; // flew into the sun
  const exposure = THREE.MathUtils.clamp(1 - altitude / HEAT_RANGE, 0, 1);
  // Temperature heads towards a level set by how close you are, and cools off away from the star.
  const targetTemp = exposure ** 1.6 * 140;
  flight.cabinTemp += (targetTemp - flight.cabinTemp) * Math.min(1, dt * (targetTemp > flight.cabinTemp ? 0.35 : 0.5));
  const gauge = $('#g-temp');
  gauge.style.setProperty('--v', String(Math.min(1, flight.cabinTemp / 100)));
  gauge.classList.toggle('hot', flight.cabinTemp > 75);
  if (flight.cabinTemp > 80 && flight.elapsed - lastHeatWarning > 4) {
    lastHeatWarning = flight.elapsed;
    sfx.beep();
    flash(flight.cabinTemp > 100 ? 'Cabin temperature critical · hull burning' : 'Cabin temperature high', 1.5);
  }
  if (flight.cabinTemp > 100 && main.damagePlayer((flight.cabinTemp - 100) * 0.6 * dt)) return true;

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

export function updateDrifters(dt: number) {
  const toPlanet = new THREE.Vector3();
  for (let i = drifters.length - 1; i >= 0; i--) {
    const d = drifters[i];
    const root = d.model.root;
    toPlanet.copy(planetPos).sub(root.position);
    const r = toPlanet.length();
    toPlanet.normalize();
    if (d.special && game.state === 'flying' && recoverCaseNear(d)) {
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
    d.velocity.addScaledVector(toPlanet, (flight.planetGM / (r * r)) * dt);
    // Sideways and outward drift slowly dies away; the fall itself doesn't.
    // Without this, wrecks at speed would fling canisters off into deep space.
    const falling = Math.max(0, d.velocity.dot(toPlanet));
    d.velocity.addScaledVector(toPlanet, -falling).multiplyScalar(Math.exp(-DRIFT_DRAG * dt)).addScaledVector(toPlanet, falling);

    if (r < flight.atmosphere) {
      // Re-entry: air drag, faster tumbling, and the hull glows towards white-hot.
      d.burn += dt;
      d.velocity.multiplyScalar(Math.exp(-dt * 0.3));
      d.spinRate += dt * 3;
      heatShip(d.model, Math.min(1, d.burn / BURN_TIME));
    }
    root.position.addScaledVector(d.velocity, dt);
    root.rotateOnAxis(d.axis, d.spinRate * dt);

    if (game.state === 'flying' && !d.special && tryScoop(d)) {
      disposeShip(d.model);
      drifters.splice(i, 1);
      continue;
    }

    if (d.burn >= BURN_TIME || r < flight.planetRadius) {
      const flare = new Explosion(d.model.def, root, d.velocity);
      space.scene.add(flare.group);
      explosions.push(flare);
    }
    if (d.burn >= BURN_TIME || r < flight.planetRadius || (r > LOST_IN_SPACE && !d.special)) {
      if (d.special && game.commander) {
        flash(caseLost(cmdr(), d.special.contract), 4);
        saveCommander(cmdr());
      }
      disposeShip(d.model);
      drifters.splice(i, 1);
    }
  }
}
