// The law in flight (moved from main.ts): the police and their patrols, damage, crime and what
// the law makes of a kill, stray shots, the station's guns and the police who answer a call,
// running dark, and the police hail. The rules are in game/law.ts.

import { sfx } from '../audio/sound';
import { boomAt } from '../audio/spatial';
import { shipById } from '../content/ships';
import { hasEquipment, isWorking, rollEquipmentDamage, rollFragileDamage, saveCommander, type Commander } from '../game/commander';
import { checksClearance, hasLaw, legalStatus, recordCrime } from '../game/law';
import { NpcShip } from '../game/npc';
import { combatRating, killPoints, pointsNote, rightOn, type Foe } from '../game/rating';
import { POLICE_LASER } from '../game/weapons';
import { COMPANIES } from '../game/companies';
import { Explosion } from '../render/explosion';
import { flash } from '../ui/hud';
import { commodityById } from '../economy/commodities';
import { marketState } from '../economy/trade';
import { loseDelivery } from '../economy/market';
import { $, cmdr, currentSystem, game, modern } from '../core';
import { beams, explosions, HULL_READ, flight, npcs, ofRole, player, space, station } from '../scene';
import { tradeContext } from '../ui/market';
import { FALCON_DISABLES, alertSecurity, deliveries, fightOn, pirateLost, removeNpc } from './traffic';
import { bastionDestroyed, carrier, scheduleMarshals } from './marshals';
import { spillCargo, spillSpecial } from './adrift';
import { CLEARANCE_RANGE, answerPolice, distresses, radio, speakerOf, traderColour, traderName } from './comms';
import * as THREE from 'three';

import type { LoggedMoment } from '../game/flightLog';
import type { MomentEvent } from '../game/moments';
/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  setAutopilot: (on: boolean, message?: string | undefined) => void;
  noteCardMoment: (career: "fight" | "explore") => void;
  trackBoom: (npc: NpcShip) => void;
  keepCombat: (event: MomentEvent, before: number, after: number) => Promise<LoggedMoment | null>;
};
export const initLaw = (hooks: typeof main) => Object.assign(main, hooks);

// --- Police and combat ------------------------------------------------------

/** Police patrols by government: none in anarchies, most in democracies and corporate states. */
export const PATROLS_BY_GOVERNMENT = [0, 1, 1, 2, 2, 2, 3, 3];
export const MAX_POLICE = 4;
export const SCAN_RANGE = 1200; // metres
export const SCAN_TIME = 3; // seconds within range for a police scan

export const isFugitive = () => Boolean(game.commander) && legalStatus(cmdr()) === 'fugitive';

/** Wanted here, you can pay your way clean at the station rather than launch into the police. */
export const canSettle = (c: Commander) => hasLaw(currentSystem()) && legalStatus(c) !== 'clean';

export function legalLabel() {
  const c = cmdr();
  const status = legalStatus(c);
  const label = status === 'fugitive' ? 'Fugitive' : status === 'offender' ? 'Offender' : 'Clean';
  if (c.warrant) return `${label} · Marshals warrant`;
  if (!hasLaw(currentSystem())) return `${label} · no law here`;
  return label;
}

export function spawnViper(fromSlot: boolean) {
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

// Fitted equipment is only at risk once the hull is badly hurt, and never
// more than one item in quick succession, so a scrape doesn't strip the ship.
const EQUIPMENT_RISK_HULL = 0.5; // fraction of full hull
const EQUIPMENT_HIT_GAP = 10; // seconds between items lost


/**
 * Damage the player's ship. Shields soak hits first; once a hit reaches the
 * hull it may take out fitted equipment. Returns true if the ship is destroyed.
 */
export function damagePlayer(amount: number, from?: NpcShip): boolean {
  if (from) flight.lastHitBy = { npc: from, at: flight.elapsed };
  // Under fire on the docking computer, you get the stick back: never a sitting duck on autopilot (Mark). Modern only.
  if (from && flight.autopilot && modern()) main.setAutopilot(false, 'Under fire · docking computer off · you have control');
  const hullBefore = player.hull;
  let destroyed = player.damage(amount);
  // A Falcon fights to disable: at a third of your hull she stops, and takes her price.
  if (from?.breaksOffAt !== undefined && player.hull < player.def.stats.hull * FALCON_DISABLES) {
    player.hull = Math.min(hullBefore, player.def.stats.hull * FALCON_DISABLES);
    destroyed = false;
    from.won = true;
  }
  const badlyHurt = player.hull < player.def.stats.hull * EQUIPMENT_RISK_HULL;
  // Pirates aim for the comms array: it's how you'd call for help.
  const aimed = from?.role === 'pirate';
  if (!destroyed && player.hull < hullBefore && !badlyHurt && flight.equipmentHitCooldown <= 0 && game.commander) {
    const hit = rollFragileDamage(cmdr(), Math.random, aimed);
    if (hit) {
      flight.equipmentHitCooldown = EQUIPMENT_HIT_GAP;
      sfx.scrape();
      flash(`${hit.name} damaged · plain radio until it's repaired at a station`, 2.5);
    }
  }
  if (!destroyed && player.hull < hullBefore && badlyHurt && flight.equipmentHitCooldown <= 0 && game.commander) {
    const hit = rollEquipmentDamage(cmdr(), Math.random, aimed ? 'comms-array' : undefined);
    if (hit) {
      flight.equipmentHitCooldown = EQUIPMENT_HIT_GAP;
      sfx.scrape();
      flash(cmdr().difficulty === 'classic' ? `${hit.name} destroyed!` : hit.id === 'comms-array' ? `${hit.name} damaged · plain radio until it's repaired at a station` : `${hit.name} damaged · repair at a station`, 2.5);
      if (hit.id === 'docking-computer' && flight.autopilot) main.setAutopilot(false);
    }
  }
  return destroyed;
}

/**
 * Attacking police makes you a Fugitive here. Serious crimes (destroying
 * police, attacking the station) also bring a Marshals warrant under Modern
 * rules, which follows you to every system with a government.
 */
export function becomeFugitive(serious = false) {
  const c = cmdr();
  if (!hasLaw(currentSystem())) return;
  if (!identified()) {
    // Running dark: seen, not known. Police who saw it come after the ship anyway.
    unpinnedCrime('fugitive', serious);
    if (ofRole('police').some((p) => p.obj.position.distanceTo(player.obj.position) < POLICE_SEE)) flight.defiedPolice = true;
    return;
  }
  const hadWarrant = c.warrant;
  const was = isFugitive();
  recordCrime(c, 'fugitive', serious);
  flight.surrenderTimer = null;
  if (c.warrant && !hadWarrant) {
    flash('Co-operative Marshals warrant issued', 2.5);
    scheduleMarshals();
  }
  if (was) return;
  flight.reinforceTimer = 6;
  if (!c.warrant || hadWarrant) flash('You are now a FUGITIVE', 2.5);
}

export function becomeOffender(message: string, unknown = !identified()) {
  if (unknown) return unpinnedCrime('offender', false);
  if (legalStatus(cmdr()) !== 'clean') return;
  recordCrime(cmdr(), 'offender');
  flash(message, 3);
}

/** A ship blows up. If the player did it, the law and the combat rating take note. */
export function destroyNpc(npc: NpcShip, killer: THREE.Object3D | null) {
  main.trackBoom(npc);
  const velocity = npc.ship.forward().multiplyScalar(npc.ship.speed);
  const boom = new Explosion(npc.def, npc.obj, velocity);
  space.scene.add(boom.group);
  explosions.push(boom);
  boomAt(npc.obj.position, 2.2, 1600, 1.6);
  // A pirate carrying your lost case drops it again.
  if (npc.carrying && game.commander) {
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
  if (lost && game.commander) {
    const market = marketState(tradeContext());
    for (const d of lost) loseDelivery(market, d, Date.now());
    saveCommander(cmdr());
    if (npc.obj.position.distanceTo(player.obj.position) < 8000) {
      const goods = lost.map((d) => `${d.qty}${commodityById(d.id)?.unit === 't' ? ' t' : ' ' + commodityById(d.id)?.unit} ${commodityById(d.id)?.name}`).join(', ');
      setTimeout(() => flash(`Delivery lost · ${goods} won't reach ${currentSystem().name}`, 3), 1600);
    }
  }
  // A trader that called for help, and didn't get it.
  if (distresses.some((d) => d.trader === npc && d.heard) && game.state === 'flying') radio('mayday', traderName(npc), 'Signal lost', { colour: traderColour(npc) });
  removeNpc(npc);
  if (carrier?.npc === npc) bastionDestroyed(carrier, velocity, killer === player.obj);
  if (killer !== player.obj) return;
  if (npc.role === 'pirate') pirateLost();

  const c = cmdr();
  const rated = rateKill(npc);
  const note = rated ? ` · ${rated}` : '';
  if (npc.role === 'pirate') {
    c.credits = Math.round((c.credits + npc.bounty) * 10) / 10;
    flash(`${npc.def.name} destroyed · Bounty ${npc.bounty} Cr${note}`, 2.5);
    void main.keepCombat({ kind: 'kill', text: `${npc.def.name} destroyed · bounty ${npc.bounty} Cr`, subject: npc.def.name }, 20, 4);
  } else {
    flash(`${npc.def.name} destroyed${note}`, 1.5);
    // Killing police or an innocent trader is a serious crime. Under Classic
    // rules, as in 1984, a trader only counts if the station sees it happen;
    // under Modern, only if anyone saw (the victim can't tell anyone now).
    if (npc.role !== 'trader') becomeFugitive(true);
    else if (c.difficulty === 'classic') {
      if (inSafeZone(npc.obj.position)) becomeFugitive(true);
    } else if (witnessed(npc.obj.position, npc)) becomeFugitive(true);
    else flash('No witnesses · but its cargo is stolen goods', 3);
  }
  saveCommander(c);
}

/** What the rating needs to know about a ship you destroyed. */
const foeOf = (npc: NpcShip): Foe => ({
  value: npc.def.stats.ratingValue,
  role: npc.role,
  bounty: npc.bounty,
  firedFirst: Boolean(npc.firedOnPlayer),
  laser: npc.laser.name,
  missiles: npc.missiles,
  ecm: npc.ecm,
  wingmen: npcs.filter((n) => n !== npc && n.hostile && n.target === player).length,
});

/**
 * Rate a kill (docs/design/combat-rating.md). Modern: points weighted by the
 * ship, its role, how well armed it was, the odds and how far it was beneath
 * you, nothing for a crime; Classic: one a kill, as in 1984. Kills the combat
 * computer flew count half. Says when you reach a new rank, and every 256
 * points the old salute. Returns the note for the kill's flash (Modern).
 */
export function rateKill(npc: NpcShip | 'crime'): string {
  const c = cmdr();
  const before = c.kills;
  const classic = c.difficulty === 'classic';
  const r = classic ? { points: flight.combatComputer ? 0.5 : 1 } : npc === 'crime' ? { points: 0, none: 'crime' as const } : killPoints(foeOf(npc), c.kills, Boolean(flight.combatComputer));
  c.kills = Math.round((c.kills + r.points) * 100) / 100;
  if (r.points > 0) main.noteCardMoment('fight');
  if (rightOn(before, c.kills)) setTimeout(() => flash('Right On Commander!', 3), 1200);
  if (combatRating(c.kills) !== combatRating(before)) setTimeout(() => flash(`Combat rating: ${combatRating(c.kills)}`, 3), 2600);
  return classic ? '' : pointsNote(r);
}

/** The station's safe zone: close enough for its guns and its police to see. */
const SAFE_ZONE = 5000; // metres
export const inSafeZone = (at: THREE.Vector3) => game.commander !== null && at.distanceTo(station.root.position) < SAFE_ZONE;

/** The player shot or rammed a ship. Pirates are fair game; anyone else is a crime. */
// Friendly fire (Mark: a police Viper flies across you in a fight, catches one shot, and you're a
// fugitive). Under Modern rules, in a fight, the first stray hit on a police or security ship is
// forgiven with a warning; a burst that clips it counts once. Again within half a minute, or with
// no fight on, or a ship you've locked a missile on, and it's no accident. Destroying one still counts.
const STRAY_BURST = 1.5; // seconds: hits this close together are one accident
const STRAY_MEMORY = 30; // seconds before another accident would be forgiven
const strays = new WeakMap<NpcShip, { from: number; at: number }>();
function strayShot(npc: NpcShip): boolean {
  if (!modern() || npc.role === 'marshal' || !(npc.guard || npc.role === 'police') || !fightOn() || flight.locked === npc) return false;
  const s = strays.get(npc);
  if (s && flight.elapsed - s.from <= STRAY_BURST) return (s.at = flight.elapsed), true;
  if (s && flight.elapsed - s.at < STRAY_MEMORY) return false;
  strays.set(npc, { from: flight.elapsed, at: flight.elapsed });
  const sp = speakerOf(npc);
  radio(sp.kind, sp.from, 'Check your fire, Commander!', { colour: sp.colour, flash: 2 });
  return true;
}

export function playerHitNpc(npc: NpcShip, damage: number) {
  // Paid off, then shot at: the deal's off.
  if (npc.paid) Object.assign(npc, { paid: false, fights: true });
  // A stray shot in a fight: it hurts, but it's no crime and no grudge (a kill still counts).
  if (strayShot(npc)) {
    if (npc.hit(damage)) destroyNpc(npc, player.obj);
    return;
  }
  alertSecurity(npc, player);
  if (npc.guard) {
    if (witnessed(npc.obj.position, npc)) becomeOffender('Firing on company security · you are an OFFENDER');
  } else if (npc.role === 'police' || npc.role === 'marshal') becomeFugitive();
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

/** A collision is an accident (a ship launching into you, say): it hurts, but it's no crime, no kill, and no grudge. */
export function playerRammedNpc(npc: NpcShip, damage: number) {
  if (npc.hit(damage)) destroyNpc(npc, null);
}

// --- The law beyond the station (docs/design/companies-and-contracts.md, section 4) ----
// Within station space the station sees everything. Out in the lanes, a crime
// needs a witness: police in sight, another ship, or a victim who gets away.
// Under Classic rules (frozen) every crime counts, as before.

export const STATION_SPACE = 10000; // metres: the station sees everything inside this
const POLICE_SEE = 8000; // metres: a police ship witnesses anything this close
const SHIPS_SEE = 6000; // metres: another ship sees a crime this close (and lives to tell)

/** Would anyone see a crime here? (The victim doesn't count: it reports only if it gets away.) */
function witnessed(at: THREE.Vector3, victim: NpcShip | null): boolean {
  if (!game.commander || cmdr().difficulty !== 'modern') return true;
  if (at.distanceTo(station.root.position) < STATION_SPACE) return true;
  return npcs.some((n) => {
    if (n === victim || n.role === 'pirate') return false;
    const d = n.obj.position.distanceTo(at);
    return n.role === 'police' || n.role === 'marshal' ? d < POLICE_SEE : d < SHIPS_SEE;
  });
}

// A distress call: police launch from the station and fly to the scene. The
// further out, the longer they take: about 20 s at 12 km, a minute at 20 km.
export const responses: { at: number; where: THREE.Vector3 }[] = [];
export function forgetResponses() {
  responses.length = 0;
}

function mayday(npc: NpcShip) {
  if (npc.maydayCalled || !hasLaw(currentSystem())) return;
  npc.maydayCalled = true;
  if (isWorking(cmdr(), 'distress-jammer')) return flash(`Distress call jammed · the ${npc.def.name} can't reach the police`, 2.5);
  const where = npc.obj.position.clone();
  const delay = Math.max(10, 10 + (where.distanceTo(station.root.position) - STATION_SPACE) / 200);
  responses.push({ at: flight.elapsed + delay, where });
  const line = `Mayday from the ${npc.company ? COMPANIES[npc.company].name : ''} ${npc.def.name}`.replace('  ', ' ') + ` · police about ${Math.round(delay)} s away`;
  radio('mayday', traderName(npc), `Mayday! We're under attack · police about ${Math.round(delay)} s away`, { colour: traderColour(npc), flash: 3, urgent: true, line });
}

export function updateResponses() {
  for (let i = responses.length - 1; i >= 0; i--) {
    if (flight.elapsed < responses[i].at) continue;
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

// The station defends its approach (Mark): in a lawful system under Modern rules, a pirate that
// fires within the safe zone brings the station's police out at once, and inside its guns' reach
// the station fires on it. Anarchies have no law: nobody comes, as there.
const STATION_GUNS = 2000; // metres
const STATION_GUN_INTERVAL = 0.5; // seconds between shots
const STATION_GUN_DAMAGE = 18;
const FIRED_RECENTLY = 5; // seconds a pirate stays a target after its last shot
const pirateFiredAt = new WeakMap<NpcShip, number>();
let stationGunCooldown = 0;
let policeScrambledAt = -Infinity;

export function pirateFired(npc: NpcShip) {
  if (!modern() || !hasLaw(currentSystem()) || !inSafeZone(npc.obj.position)) return;
  pirateFiredAt.set(npc, flight.elapsed);
  if (flight.elapsed - policeScrambledAt < 30) return; // one scramble at a time
  policeScrambledAt = flight.elapsed;
  for (let k = 0; k < 2 && ofRole('police').length < MAX_POLICE; k++) spawnViper(true);
  radio('police', `${currentSystem().name} police`, 'Pirate fire on the approach · police launching', { flash: 2 });
}

export function updateStationDefence(dt: number) {
  stationGunCooldown -= dt;
  if (stationGunCooldown > 0 || !modern() || !hasLaw(currentSystem())) return;
  const target = npcs.find((n) => n.role === 'pirate' && flight.elapsed - (pirateFiredAt.get(n) ?? -Infinity) < FIRED_RECENTLY && n.obj.position.distanceTo(station.root.position) < STATION_GUNS);
  if (!target) return;
  stationGunCooldown = STATION_GUN_INTERVAL;
  const from = station.root.position.clone().add(target.obj.position.clone().sub(station.root.position).setLength(95));
  beams.fire(from, target.obj.position.clone(), POLICE_LASER.color);
  if (target.hit(STATION_GUN_DAMAGE)) destroyNpc(target, station.root);
}

/** A trader you attacked, getting away: it reports you (in the system where it happened). */
export function reportedBy(npc: NpcShip) {
  if (!npc.unreported || !game.commander) return;
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

const HAIL_TIME = 15; // seconds to answer a police hail
const HAIL_SLOW = 0.2; // fraction of top speed: slow enough for a Viper to read your hull
const SUSPECT_TIME = 180; // seconds after a crime that switching on near the law makes you the suspect


export const transponderBroken = () => game.commander !== null && cmdr().damaged.includes('transponder');
/** Nobody can read who you are from afar. */
export const dark = () => game.commander !== null && cmdr().difficulty === 'modern' && (flight.transponderOff || transponderBroken());

/** Whether the law knows it's you: transponder on, or the station or a police ship close enough to read your hull. */
export function identified(): boolean {
  if (!dark()) return true;
  if (player.obj.position.distanceTo(station.root.position) < STATION_SPACE) return true;
  return npcs.some((n) => (n.role === 'police' || n.role === 'marshal') && n.obj.position.distanceTo(player.obj.position) < HULL_READ);
}

function unpinnedCrime(status: 'offender' | 'fugitive', serious: boolean) {
  flight.unpinned = { status: flight.unpinned?.status === 'fugitive' ? 'fugitive' : status, serious: serious || Boolean(flight.unpinned?.serious), at: flight.elapsed };
  flash(`Seen, but not identified · an unidentified ${player.def.name}`, 2.5);
}

// The ship's computer switches it back on for you when that's safe and
// needed: arriving in a new system, and approaching a lawful station to dock.
// Not when it would make you the suspect: then it says why, counts down on
// the DARK light, and switches on when the coast is clear.

/** Seconds until switching on here is safe; 0 if it is now (Infinity: you defied the police here). */
function suspectFor(): number {
  if (flight.defiedPolice) return Infinity;
  return flight.unpinned ? Math.max(0, SUSPECT_TIME - (flight.elapsed - flight.unpinned.at)) : 0;
}


const clock = (secs: number) => {
  const t = Math.ceil(secs);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/** Switch on for docking if it's safe; otherwise say why not. Returns whether it's on. */
export function transponderOnToDock(): boolean {
  if (!flight.transponderOff) return true;
  const wait = suspectFor();
  if (wait > 0) {
    flight.switchOnWhenClear = wait !== Infinity;
    flash(`Transponder left dark: switching on here would make you the suspect · ${wait === Infinity ? 'you ignored a police hail' : clock(wait)} · or jump out`, 4);
    return false;
  }
  flight.switchOnWhenClear = false;
  flight.transponderOff = false;
  showTransponder();
  flash('Transponder on for docking', 2);
  return true;
}

/** 0: switch the transponder off (run dark), or on again. */
export function toggleTransponder() {
  if (cmdr().difficulty !== 'modern') return flash('Classic rules: the transponder stays on', 1.5);
  if (transponderBroken()) return flash('Transponder damaged · repair it at a station', 2);
  flight.transponderOff = !flight.transponderOff;
  flight.switchOnWhenClear = false;
  showTransponder();
  if (flight.transponderOff) return flash(hasLaw(currentSystem()) ? 'Transponder off · running dark' : 'Transponder off · nobody here cares', 2);
  // Back on where the law can see, soon after a crime nobody pinned on you: you're the suspect.
  const watched =
    player.obj.position.distanceTo(station.root.position) < STATION_SPACE ||
    ofRole('police').some((p) => p.obj.position.distanceTo(player.obj.position) < POLICE_SEE);
  const crime = flight.unpinned && flight.elapsed - flight.unpinned.at < SUSPECT_TIME ? flight.unpinned : null;
  flight.unpinned = null; // switched on quietly, or too late: the trail goes cold
  if (watched && (crime || flight.defiedPolice)) {
    flight.defiedPolice = false;
    if (crime?.status === 'fugitive') becomeFugitive(crime.serious);
    else becomeOffender(crime ? 'Transponder on, near the scene · you are the suspect · OFFENDER' : 'Transponder on · you ignored a police hail · OFFENDER');
    return;
  }
  if (flight.hail) radio('police', `${currentSystem().name} police`, 'Transponder read · thank you, Commander', { flash: 2, urgent: true, line: 'Transponder read · thank you, Commander' });
  else flash('Transponder on', 2);
}

function showTransponder() {
  const on = dark();
  // While a crime here is fresh, the light counts down to when switching on is safe.
  const wait = flight.transponderOff ? suspectFor() : 0;
  const timer = wait > 0 && wait !== Infinity ? ` ${clock(wait)}` : '';
  const light = $('#dark-light');
  light.classList.toggle('on', on);
  if (light.textContent !== `DARK${timer}`) light.textContent = `DARK${timer}`;
  const button = $('#touch .dark-button');
  button.classList.toggle('armed', flight.transponderOff);
  // The survey autopilot's button, once there's one fitted.
  const survey = $('#touch .survey-button');
  const fitted = hasEquipment(cmdr(), 'survey-autopilot');
  if (survey.hidden === fitted) survey.hidden = !fitted;
  survey.classList.toggle('armed', Boolean(flight.surveyPilot));
  if (button.textContent !== `Dark${timer}`) button.textContent = `Dark${timer}`;
  // Waiting to dock and the coast is now clear: on it goes.
  if (flight.switchOnWhenClear && flight.transponderOff && wait === 0 && player.obj.position.distanceTo(station.root.position) < CLEARANCE_RANGE) {
    flight.switchOnWhenClear = false;
    flight.transponderOff = false;
    flash('Coast clear · transponder on for docking', 2.5);
  }
}

/** Each frame in flight: police hail a dark ship they can see. */
export function updateHail() {
  showTransponder();
  const box = $('#hail');
  if (flight.hail && !npcs.includes(flight.hail.by)) flight.hail = null; // the Viper's gone; another may ask
  if (!dark() || !hasLaw(currentSystem()) || flight.defiedPolice || (flight.hullChecked && !flight.transponderOff)) {
    flight.hail = null;
    box.hidden = true;
    return;
  }
  if (!flight.hail) {
    const by = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(player.obj.position) < POLICE_SEE);
    if (!by) return;
    flight.hail = { by, until: flight.elapsed + HAIL_TIME };
    sfx.beep();
    // One hail (Mark got two): in Modern the radio card is it, with the seconds left on it; Classic keeps the banner.
    const deadline = Date.now() + HAIL_TIME * 1000;
    radio('police', `${currentSystem().name} police`, `Unidentified ${player.def.name}, switch on your transponder.`, { flash: 4, urgent: true, line: `Unidentified ${player.def.name}, this is ${currentSystem().name} police. Switch on your transponder.`, answers: transponderBroken() && !flight.transponderOff ? answerPolice() : answerPolice().map((a) => ({ ...a, until: deadline, clock: true })) });
  }
  // The Viper that hailed you comes to look.
  flight.hail.by.patrol.centre.copy(player.obj.position);
  flight.hail.by.patrol.radius = 400;
  const broken = transponderBroken() && !flight.transponderOff;
  if (broken && player.speed <= player.maxSpeed * HAIL_SLOW) {
    flight.hail.until = Math.max(flight.hail.until, flight.elapsed + 5); // holding still for them: the clock waits
    if (flight.hail.by.obj.position.distanceTo(player.obj.position) < HULL_READ) {
      flight.hail = null;
      flight.hullChecked = true;
      box.hidden = true;
      radio('police', `${currentSystem().name} police`, isFugitive() ? 'Hull read · you are wanted here' : 'Hull read · clean · get that transponder seen to at the next station', { flash: 3, urgent: true, line: isFugitive() ? 'Hull read · you are wanted here' : 'Hull read · clean · get that transponder seen to at the next station' });
      return;
    }
  }
  if (flight.elapsed > flight.hail.until) {
    flight.hail = null;
    flight.defiedPolice = true;
    box.hidden = true;
    sfx.beep();
    radio('police', `${currentSystem().name} police`, 'No answer · police are treating you as hostile', { flash: 3, urgent: true, line: 'No answer · police are treating you as hostile' });
    return;
  }
  // In Modern the card carries the hail; the banner stays for a broken transponder, whose clock waits while you hold still.
  box.hidden = modern() && !broken;
  const left = Math.ceil(flight.hail.until - flight.elapsed);
  const text = broken
    ? `Police hail · transponder damaged: cut your speed and let the Viper read your hull · ${left} s`
    : `Police hail · switch on your transponder${document.body.classList.contains('touch') ? '' : ' (0)'} · ${left} s`;
  const span = box.querySelector('span')!;
  if (span.textContent !== text) span.textContent = text;
  box.querySelector('button')!.hidden = broken;
}

/** Lawful stations won't dock a ship that has switched its transponder off. */
export const darkRefused = () => flight.transponderOff && checksClearance(currentSystem());

// The hail's own button: answer it in one tap.
$('#hail .hail-on').addEventListener('click', (e) => {
  (e.currentTarget as HTMLButtonElement).blur();
  if (flight.transponderOff) toggleTransponder();
});
