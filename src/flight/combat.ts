// Your lasers and the fight (moved from main.ts): the gimballed mount, aiming and firing, the
// safety near the station, heat, and each frame of combat: who hits whom, rams and the police
// response.

import { sfx } from '../audio/sound';
import { ShipVoice, tailWarning } from '../audio/spatial';
import { shipById } from '../content/ships';
import type { ShipDef } from '../content/types';
import { isWorking } from '../game/commander';
import { carriesContraband, hasLaw, illegalEquipment, recordCrime, scansCargo } from '../game/law';
import { controlScheme, isMouseCaptured } from '../game/input';
import { allies, NpcShip } from '../game/npc';
import { think } from '../game/ai';
import { PLAYER_LASERS, rayHit, type Target } from '../game/weapons';
import { PlayerShip } from '../game/playerShip';
import { Explosion } from '../render/explosion';
import { camera } from '../render/renderer';
import { disposeShip } from '../render/shipModel';
import { flash } from '../ui/hud';
import { showHitDirection } from '../ui/indicators';
import { quotes } from '../economy/trade';
import { cmdr, currentSystem, game, modern } from '../core';
import { aim, beams, gimbalHold, explosions, flight, sharedSpace, npcs, ofRole, voices, player, space, station } from '../scene';
import { initManual } from '../ui/manual';
import { tradeContext } from '../ui/market';
import { escortOf, fleeing, legs, ride, updateTraffic } from './traffic';
import { laserSound, remoteVoices, shotSound, VOICE_RANGE, voiceOf } from './sounds';
import { EVADE_LASERS, evading, wispShot } from './wisp';
import { maybeFireNpcMissile, updateMissiles } from './missiles';
import { Drifter, drifters } from './adrift';
import { DISTRESS_SHIELDING, distressCall, radio } from './comms';
import { HIDDEN_BEYOND, HIDDEN_BEYOND_DARK, coverTargets, exploring, inClutter, playerVisibleAt } from './explore';
import { MAX_POLICE, SCAN_RANGE, SCAN_TIME, becomeFugitive, becomeOffender, damagePlayer, dark, destroyNpc, identified, inSafeZone, isFugitive, pirateFired, playerHitNpc, playerRammedNpc, spawnViper, PATROLS_BY_GOVERNMENT } from './law';
import * as THREE from 'three';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  viewDirection: () => THREE.Vector3;
  hitFeedback: (strength: number) => void;
  breakSurrender: (why?: string) => void;
  trackBeam: (from: object, a: THREE.Vector3, b: THREE.Vector3, color: string, hit: object | null) => void;
  die: () => void;
};
export const initCombat = (hooks: typeof main) => Object.assign(main, hooks);

/** How far off a turret's line it will still pick a target. */
const TURRET_CONE = THREE.MathUtils.degToRad(20);

type Shot = { kind: 'npc'; npc: NpcShip } | { kind: 'drifter'; drifter: Drifter } | { kind: 'station' } | { kind: 'commander' } | { kind: 'cover' };

// Lasers fire straight ahead unless a gimballed mount is fitted, in which
// case (with mouse aim) they swivel to hit what's under the ring. The ring
// never strays more than 30° from the nose. Gimbals trade a little damage
// for that convenience.
const GIMBAL_DAMAGE = 0.8;

initManual({ gimballed: () => gimballed() });
export function gimballed() {
  return controlScheme() === 'mouse' && isMouseCaptured() && Boolean(game.commander) && isWorking(cmdr(), 'gimbal-mount');
}

/**
 * While the combat computer flies (Mark: "my targeting system was all over the place"), the ring
 * rides with the nose instead of staying put in space as the ship throws itself about, and the
 * gimbal swings onto the computer's target, or the nearest hostile, whenever one is within its
 * reach, and back to the nose when none is: the computer flies, the gimbal tracks, you fire.
 */
const GIMBAL_SLEW = THREE.MathUtils.degToRad(150); // degrees a second it can swing
export function gimbalRide(dt: number) {
  aim.dir.copy(gimbalHold).applyQuaternion(player.obj.quaternion);
  if (!gimballed() || flight.view !== 'front') return;
  const fwd = player.forward();
  const at = player.obj.position;
  const candidates = [flight.combatComputer?.target, ...npcs.filter((n) => n.hostile)].filter((n): n is NpcShip => Boolean(n) && npcs.includes(n!));
  const lead = (n: NpcShip) => n.obj.position.clone().addScaledVector(n.ship.forward(), n.ship.speed * 0.12).sub(at);
  const target = candidates.find((n) => n.obj.position.distanceTo(at) < playerLaser().range && fwd.angleTo(lead(n)) < GIMBAL_REACH);
  // Nothing within reach: the ring drifts home to the nose, ready for the next pass.
  const want = target ? lead(target).normalize() : fwd;
  const angle = aim.dir.angleTo(want);
  if (angle > 1e-4) aim.dir.lerp(want, Math.min(1, (GIMBAL_SLEW * dt) / angle)).normalize();
  aim.clamp(player);
  gimbalHold.copy(aim.dir).applyQuaternion(player.obj.quaternion.clone().invert());
}
const GIMBAL_REACH = THREE.MathUtils.degToRad(30); // as far as the ring may lead the nose

/** The laser on the mount you're looking along, if any. */
const mountLaser = () => {
  const id = cmdr().lasers[flight.view];
  return id ? PLAYER_LASERS[id] : null;
};
/** For heat and range: the current mount's laser, or the front one. */
export const playerLaser = () => mountLaser() ?? PLAYER_LASERS[cmdr().lasers.front ?? 'pulse'];

export function laserDirection() {
  if (flight.view === 'front') return gimballed() ? aim.dir.clone() : player.forward();
  const dir = main.viewDirection();
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
  switch (flight.view) {
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
  if (flight.elapsed - lastSafetyFlash < 2) return;
  lastSafetyFlash = flight.elapsed;
  flash(text, 1.6);
}

function firePlayerLaser() {
  wispShot(); // the Wisp goes quiet while you're shooting
  const laser = mountLaser();
  if (!laser) {
    flight.laserCooldown = 0.6;
    flash(`No ${flight.view} laser fitted`, 1.2);
    return;
  }
  if (flight.autopilot) {
    flight.laserCooldown = 0.3;
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
    ...coverTargets({ kind: 'cover' as const }),
  ];
  const hit = rayHit(origin, dir, laser.range, targets);
  if (hit?.target.value.kind === 'station' && cmdr().difficulty === 'modern' && fireHeld < FIRE_OVERRIDE && !isFugitive()) {
    flight.laserCooldown = 0.1;
    safetyFlash('Safety on · station in line of fire · hold fire to override');
    return;
  }
  if (flight.surrenderTimer !== null) main.breakSurrender();
  flight.laserCooldown = laser.interval;
  flight.lastShotAt = flight.elapsed;
  flight.laserHeat += laser.heat;
  if (flight.laserHeat >= 100) {
    flight.overheated = true;
    flash('Laser overheated', 1.2);
  }
  const end = hit ? hit.point : origin.clone().addScaledVector(dir, laser.range);
  for (const muzzle of muzzles()) beams.fire(muzzle, end, laser.color);
  main.trackBeam(player, origin, end, laser.color, hit?.target.value.kind === 'npc' ? hit.target.value.npc : null);
  shotSound(player.def, laserSound(laser), null);
  if (sharedSpace.connected) sharedSpace.fire(dir, laser.id);
  if (!hit) return;
  const shot = hit.target.value;
  if (shot.kind === 'npc') {
    sfx.hit();
    playerHitNpc(shot.npc, gimballed() ? laser.damage * GIMBAL_DAMAGE : laser.damage);
  } else if (shot.kind === 'station') {
    flight.stationFlash = 0.25;
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
  const sinceWarning = flight.elapsed - stationWarnedAt;
  if (!isFugitive() && sinceWarning > STATION_WARNING_MEMORY) {
    stationWarnedAt = flight.elapsed;
    recordCrime(cmdr(), 'offender');
    flash('Cease fire, Commander · this is your only warning · you are an OFFENDER', 3);
    return;
  }
  if (!isFugitive() && sinceWarning < STATION_GRACE) return; // time to let go of the trigger
  if (!isFugitive() || !cmdr().warrant) {
    becomeFugitive(true);
    flash('Station under attack · Police launching', 2.5);
  }
  if (ofRole('police').length < MAX_POLICE && flight.reinforceTimer > 1) flight.reinforceTimer = 0.5;
}

/** How much a ship weighs in a collision: its hull and shields together. */
const heft = (def: ShipDef) => def.stats.hull + def.stats.shields;
const CRUSHING = 5; // a ship this many times heavier crushes you

export function updateCombat(dt: number, input: { fire: boolean } | null) {
  const alive = game.state === 'flying';
  beams.update(dt);
  fireHeld = alive && input?.fire ? fireHeld + dt : 0;

  if (alive && input) {
    flight.laserCooldown -= dt;
    flight.laserHeat = Math.max(0, flight.laserHeat - playerLaser().cooling * dt);
    if (flight.overheated && flight.laserHeat < 40) flight.overheated = false;
    if (input.fire && !flight.overheated && flight.laserCooldown <= 0) firePlayerLaser();
  }

  // Decide who fights whom a few times a second.
  flight.thinkTimer -= dt;
  if (flight.thinkTimer <= 0) {
    flight.thinkTimer = 0.25;
    const prices = game.commander ? new Map(quotes(tradeContext()).map((q) => [q.commodity.id, q.price])) : new Map<string, number>();
    const holdValue = (cargo: Record<string, number>) => Object.entries(cargo).reduce((v, [id, q]) => v + q * (prices.get(id) ?? 0), 0);
    const world = {
      player,
      playerPresent: alive,
      // Wanted here and known, or a dark ship that defied them.
      playerWanted: (isFugitive() && identified()) || flight.defiedPolice,
      npcs,
      inSafeZone: (at: THREE.Vector3) => cmdr().difficulty === 'classic' && inSafeZone(at),
      canSee: (npc: NpcShip) => playerVisibleAt(npc.obj.position.distanceTo(player.obj.position)),
      cargoValue: (ship: PlayerShip) => (ship === player ? (game.commander ? holdValue(cmdr().cargo) : 0) : holdValue(npcs.find((n) => n.ship === ship)?.cargo ?? {})),
    };
    const hunting = (n: NpcShip) => n.target === player && (n.mode === 'attack' || n.mode === 'breakoff');
    const before = new Map(npcs.map((n) => [n, n.mode === 'search' ? 'search' : hunting(n) ? 'hunt' : '']));
    for (const npc of npcs) if (!fleeing.has(npc)) think(npc, world); // a Falcon breaking off is past arguing with
    // Tell the player: into the clutter, and when the hunt changes (lost, or given up).
    const nowIn = alive && exploring() && inClutter(player.obj.position);
    const lost = alive && npcs.some((n) => before.get(n) === 'hunt' && n.mode === 'search');
    const notes = [
      nowIn && !flight.wasInClutter ? `In the clutter · hidden beyond ${((dark() ? HIDDEN_BEYOND_DARK : HIDDEN_BEYOND) / 1000).toFixed(1)} km` : '',
      lost ? 'Lost them · they’re searching where they last saw you' : '',
      !lost && alive && npcs.some((n) => before.get(n) === 'search' && n.mode !== 'search' && !hunting(n)) ? 'They’ve given up the search' : '',
    ].filter(Boolean);
    if (notes.length) flash(notes.join(' · '), notes.length > 1 ? 4 : 2.5);
    flight.wasInClutter = nowIn;
    for (const npc of npcs) maybeFireNpcMissile(npc);
  }
  updateMissiles(dt);
  updateTraffic(dt);

  for (const npc of [...npcs]) {
    if (!npcs.includes(npc)) continue; // destroyed earlier this frame
    const shot = npc.update(dt);
    ride(npc, Date.now());
    const escorting = escortOf.get(npc);
    if (escorting && npcs.includes(escorting)) npc.patrol.centre.copy(escorting.obj.position);
    if (shot && npc.target === player) npc.firedOnPlayer = true;
    if (shot && npc.role === 'pirate') pirateFired(npc);
    // Keep ships from flying through the station, except traders docking down the slot.
    const fromStation = npc.obj.position.clone().sub(station.root.position);
    if (fromStation.length() < 120 && legs.get(npc) !== 'docking') npc.obj.position.copy(station.root.position).add(fromStation.setLength(120));

    if (shot) {
      for (const { origin, dir: aim } of npc.muzzles(shot)) {
        type Struck = 'player' | 'station' | 'cover' | NpcShip;
        const targets: Target<Struck>[] = [
          { value: 'station', position: station.root.position, radius: 90 },
          ...coverTargets<Struck>('cover'),
          // Ships don't shoot their own side.
          ...npcs.filter((n) => n !== npc && !allies(n.role, npc.role)).map((n) => ({ value: n as Struck, position: n.obj.position, radius: n.radius * 0.75 })),
        ];
        // The Will-o'-the-Wisp jinks the ship out of the way of half the shots.
        if (alive && !(evading() && Math.random() < EVADE_LASERS)) targets.push({ value: 'player', position: player.obj.position, radius: 22 });
        const hit = rayHit(origin, aim, npc.laser.range, targets);
        const beamEnd = hit ? hit.point : origin.clone().addScaledVector(aim, npc.laser.range);
        beams.fire(origin, beamEnd, npc.laser.color);
        main.trackBeam(npc, origin, beamEnd, npc.laser.color, hit?.target.value === 'player' ? player : hit?.target.value instanceof NpcShip ? hit.target.value : null);
        shotSound(npc.def, laserSound(npc.laser), origin);
        const struck = hit?.target.value;
        if (struck instanceof NpcShip) {
          // A trader calling for help puts everything into its shields, to last until help comes.
          const calling = struck.role === 'trader' && npc.role === 'pirate' && modern();
          if (calling) distressCall(struck, npc);
          if (struck.hit(npc.laser.damage * (calling ? DISTRESS_SHIELDING : 1), npc.ship)) destroyNpc(struck, npc.obj);
        } else if (struck === 'player') {
          sfx.hit();
          main.hitFeedback(0.35);
          showHitDirection(camera, npc.obj.position);
          if (damagePlayer(npc.laser.damage, npc)) {
            main.die();
            return;
          }
        }
      }
    }

    // Ramming hurts both ships. Fly into something far heavier, like a
    // Bastion, and it's you that comes off worse: completely.
    if (alive && npc.touches(player.obj.position, 20)) {
      if (heft(npc.def) > heft(player.def) * CRUSHING) {
        sfx.thud();
        main.hitFeedback(1);
        flash(`Collision with the ${npc.def.name}`, 3);
        playerRammedNpc(npc, 25);
        main.die();
        return;
      }
      // Back out along the line from its centre until clear of the hull.
      const away = player.obj.position.clone().sub(npc.obj.position).normalize();
      for (let i = 0; i < 100 && npc.touches(player.obj.position, 30); i++) player.obj.position.addScaledVector(away, 10);
      sfx.thud();
      main.hitFeedback(0.9);
      playerRammedNpc(npc, 25);
      if (damagePlayer(25, npc.breaksOffAt !== undefined ? npc : undefined)) { // a Legend disables, even by collision
        main.die();
        return;
      }
    }
  }

  // Engine sounds for nearby ships, positioned in 3D.
  for (const npc of npcs) {
    const near = alive && npc.obj.position.distanceTo(player.obj.position) < VOICE_RANGE;
    let voice = voices.get(npc);
    if (near && !voice) voices.set(npc, (voice = new ShipVoice(npc.obj.position, voiceOf(npc.def))));
    if (!near && voice) {
      voice.dispose();
      voices.delete(npc);
    }
    voice?.update(npc.obj.position, npc.ship.speed / npc.ship.maxSpeed);
  }
  // And other commanders', each sounding like her ship; her speed from her last two positions.
  for (const r of sharedSpace.remotes.values()) {
    const near = alive && r.position.distanceTo(player.obj.position) < VOICE_RANGE;
    let voice = remoteVoices.get(r.id);
    if (near && !voice) remoteVoices.set(r.id, (voice = new ShipVoice(r.position, voiceOf(shipById(r.ship)))));
    if (!near && voice) {
      voice.dispose();
      remoteVoices.delete(r.id);
    }
    if (!voice) continue;
    const [a, b] = r.history.slice(-2);
    const max = shipById(r.ship)?.stats.maxSpeed ?? 300;
    voice.update(r.position, a && b && b.t > a.t ? Math.min(1, a.p.distanceTo(b.p) / (b.t - a.t) / max) : 0.5);
  }
  for (const [id, v] of remoteVoices) {
    if (sharedSpace.remotes.has(id)) continue;
    v.dispose();
    remoteVoices.delete(id);
  }

  // Police in lawful-ish systems scan ships that loiter near them.
  if (alive && !flight.scanned && scansCargo(currentSystem())) {
    const scanner = ofRole('police').find((p) => !p.hostile && p.obj.position.distanceTo(player.obj.position) < SCAN_RANGE);
    flight.scanProgress = scanner ? flight.scanProgress + dt : Math.max(0, flight.scanProgress - dt);
    if (flight.scanProgress >= SCAN_TIME) {
      flight.scanned = true;
      if (illegalEquipment(cmdr()).length) becomeOffender('Scanned by police · distress jammer found · you are an OFFENDER');
      else if (carriesContraband(cmdr())) becomeOffender('Scanned by police · contraband found · you are an OFFENDER');
      else radio('police', `${currentSystem().name} police`, 'Scanned · clean', { flash: 1.5, line: 'Scanned by police · clean' });
    }
  }

  // A soft double beep when a hostile is close behind you.
  flight.tailWarningTimer -= dt;
  if (alive && flight.tailWarningTimer <= 0) {
    const fwd = player.forward();
    const onTail = npcs.find((npc) => {
      if (!npc.hostile) return false;
      const to = npc.obj.position.clone().sub(player.obj.position);
      return to.length() < 900 && fwd.angleTo(to) > THREE.MathUtils.degToRad(120);
    });
    if (onTail) {
      tailWarning(onTail.obj.position);
      flight.tailWarningTimer = 2.5;
    }
  }

  // The station sends more police after a fugitive, and replaces patrols otherwise.
  const nearStation = player.obj.position.distanceTo(station.root.position) < 9000;
  if (alive && isFugitive() && nearStation && currentSystem().government > 0) {
    flight.reinforceTimer -= dt;
    if (flight.reinforceTimer <= 0 && ofRole('police').length < MAX_POLICE) {
      spawnViper(true);
      flash('Police launching', 1.5);
      flight.reinforceTimer = 20;
    }
  } else if (!isFugitive() && ofRole('police').length < PATROLS_BY_GOVERNMENT[currentSystem().government]) {
    flight.repopulateTimer -= dt;
    if (flight.repopulateTimer <= 0) {
      spawnViper(true);
      flight.repopulateTimer = 30;
    }
  }
}
