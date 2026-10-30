// Missiles in flight (moved from main.ts): locking on, the Modern seeker, firing, the NPCs' missiles,
// ECM and the energy bomb, and the missiles shared space flies between commanders.

import { sfx } from '../audio/sound';
import { boomAt, rocketAt } from '../audio/spatial';
import { shipById } from '../content/ships';
import { hasEquipment, isWorking, removeEquipment, saveCommander } from '../game/commander';
import { isTouch } from '../game/input';
import { NpcShip } from '../game/npc';
import { type Remote, type SpaceEvent } from '../net/space';
import { Missile, MISSILE } from '../game/missile';
import { PlayerShip } from '../game/playerShip';
import { Explosion } from '../render/explosion';
import { camera, isRetro } from '../render/renderer';
import { flash } from '../ui/hud';
import { showHitDirection } from '../ui/indicators';
import { fadeFromWhite } from '../ui/tunnel';
import { $, cmdr, game, modern } from '../core';
import { explosions, flight, missiles, sharedSpace, type SeekTarget, npcs, player, space } from '../scene';
import { EVADE_MISSILE_RANGE, EVADE_MISSILES, evadeChecked, evading } from './wisp';
import { riftInterference } from './marshals';
import * as THREE from 'three';
import type { ShipDef } from '../content/types';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  launchSound: (def: ShipDef, at: THREE.Vector3 | null) => void;
  damagePlayer: (amount: number, from?: NpcShip | undefined) => boolean;
  destroyNpc: (npc: NpcShip, killer: THREE.Object3D | null) => void;
  playerHitNpc: (npc: NpcShip, damage: number) => void;
  laserDirection: () => THREE.Vector3;
  hitFeedback: (strength: number) => void;
  npcIdentified: (npc: NpcShip) => boolean;
  breakSurrender: (why?: string) => void;
  die: () => void;
};
export const initMissiles = (hooks: typeof main) => Object.assign(main, hooks);

// --- Missiles and ECM ---------------------------------------------------------------

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
export function sightedNpc(range = 5000, cone = 6): NpcShip | null {
  const fwd = main.laserDirection();
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

/** Let go of the missile: no lock, no seeking. */
function disarmMissile() {
  flight.seeker = null;
  flight.locked = null;
  flight.lockedCommander = null;
  flash('Missile disarmed', 1.2);
}

/** T: lock a missile onto the ship in your sights, or disarm. */
export function toggleLock() {
  const c = cmdr();
  if (c.missiles <= 0) {
    flash('No missiles · buy more at a station', 1.5);
    return;
  }
  if (c.difficulty === 'modern') {
    // Arm, and the seeker does the rest: hold a ship in your sights and it locks.
    if (flight.seeker || flight.locked || flight.lockedCommander) disarmMissile();
    else {
      flight.seeker = { on: null, progress: 0, beep: 0 };
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
    flight.locked = null;
    flight.lockedCommander = commanderTarget;
    sfx.lock();
    flash(`Missile locked · CMDR ${commanderTarget.name}`, 1.5);
    return;
  }
  if (!target) {
    if (flight.locked || flight.lockedCommander) {
      flight.locked = null;
      flight.lockedCommander = null;
      flash('Missile disarmed', 1.2);
    } else {
      flash('No target in your sights', 1.2);
    }
    return;
  }
  flight.locked = target;
  flight.lockedCommander = null;
  sfx.lock();
  flash(`Missile locked · ${target.def.name}`, 1.5);
}

/** The commander nearest the middle of your sights, within range. */
function sightedCommander(range: number, cone = 6): Remote | null {
  const fwd = main.laserDirection();
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
const seekPosition = (t: SeekTarget) => (t instanceof NpcShip ? t.obj.position : t.position);

function updateSeeker(dt: number) {
  if (!flight.seeker) return;
  if (cmdr().missiles <= 0) {
    flight.seeker = null;
    return;
  }
  const jammed = riftInterference() > 0.4;
  const npc = jammed ? null : sightedNpc(LOCK_RANGE, LOCK_CONE);
  const target: SeekTarget | null = npc ?? (jammed ? null : sightedCommander(LOCK_RANGE, LOCK_CONE));
  if (target !== flight.seeker.on) flight.seeker = { on: target, progress: 0, beep: 0 };
  if (!target) return;
  flight.seeker.progress += dt / SEEK_TIME;
  flight.seeker.beep -= dt;
  if (flight.seeker.beep <= 0) {
    sfx.seek(flight.seeker.progress);
    flight.seeker.beep = 0.28 - 0.2 * Math.min(1, flight.seeker.progress);
  }
  if (flight.seeker.progress < 1) return;
  flight.seeker = null;
  sfx.lockTone();
  if (npc) {
    flight.locked = npc;
    // Locked onto the law by mistake: say so, and how to let go, before the trigger.
    const law = main.npcIdentified(npc) && (npc.role === 'police' || npc.role === 'marshal');
    const off = isTouch ? 'hold to fire, tap to disarm' : 'X to fire, T to disarm';
    flash(law ? `Missile locked · ${npc.def.name} · police · firing is a crime · ${off}` : `Missile locked · ${main.npcIdentified(npc) ? npc.def.name : 'unidentified ship'} · ${off}`, law ? 3 : 1.8);
  } else {
    flight.lockedCommander = target as Remote;
    flash(`Missile locked · CMDR ${flight.lockedCommander.name} · ${isTouch ? 'hold to fire, tap to disarm' : 'X to fire, T to disarm'}`, 1.8);
  }
}

/** The seeker's box: wide and dashed while it searches, closing on a ship, red when locked. */
const seekerBox = $('#seeker');
export function updateSeekerBox() {
  const lockedAt = flight.locked?.obj.position ?? flight.lockedCommander?.position ?? null;
  const tracking = flight.seeker?.on ? seekPosition(flight.seeker.on) : null;
  if ((!flight.seeker && !lockedAt) || game.state !== 'flying') {
    seekerBox.hidden = true;
    return;
  }
  const at = lockedAt ?? tracking ?? camera.position.clone().addScaledVector(main.laserDirection(), 1000);
  const p = at.clone().project(camera);
  if (p.z > 1) {
    seekerBox.hidden = true; // behind you
    return;
  }
  const rect = $(isRetro() ? '#retro' : '#neo').getBoundingClientRect();
  seekerBox.hidden = false;
  seekerBox.style.transform = `translate(${rect.left + ((p.x + 1) / 2) * rect.width}px, ${rect.top + ((1 - p.y) / 2) * rect.height}px)`;
  const size = lockedAt ? 34 : tracking ? 90 - 56 * Math.min(1, flight.seeker!.progress) : 90;
  seekerBox.style.setProperty('--s', `${Math.round(size)}px`);
  seekerBox.classList.toggle('locked', Boolean(lockedAt));
  seekerBox.classList.toggle('tracking', !lockedAt && Boolean(tracking));
}

// On a touch screen, one missile button by FIRE, worked like a master arm and a guarded trigger
// (Mark: a thumb by FIRE mustn't launch at the wrong ship). A tap arms (locks, in Classic) or, armed
// or locked, disarms; only a press held for HOLD_TO_FIRE launches, the button charging as you hold.
const missileButton = $<HTMLButtonElement>('#touch .missile');
const HOLD_TO_FIRE = 500; // ms
let holdTimer = 0;
let fired = false;
missileButton.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  try {
    missileButton.setPointerCapture(e.pointerId); // keep the press if the thumb slides off
  } catch {
    /* no such pointer (a synthetic event): carry on without */
  }
  fired = false;
  if (!flight.locked && !flight.lockedCommander) return;
  missileButton.classList.add('holding');
  holdTimer = window.setTimeout(() => {
    fired = true;
    missileButton.classList.remove('holding');
    fireMissile();
    updateMissileButton();
  }, HOLD_TO_FIRE);
});
const releaseMissile = (tap: boolean) => {
  clearTimeout(holdTimer);
  missileButton.classList.remove('holding');
  if (tap && !fired) {
    if (flight.locked || flight.lockedCommander) disarmMissile();
    else toggleLock();
  }
  fired = false;
  missileButton.blur();
  updateMissileButton();
};
missileButton.addEventListener('pointerup', () => releaseMissile(true));
missileButton.addEventListener('pointercancel', () => releaseMissile(false));

/** Its label: how many missiles, and whether one is locked. */
export function updateMissileButton() {
  if (!game.commander) return;
  const n = cmdr().missiles;
  const armed = Boolean(flight.locked || flight.lockedCommander);
  const modern = cmdr().difficulty === 'modern';
  missileButton.classList.toggle('armed', armed);
  missileButton.classList.toggle('seeking', Boolean(flight.seeker) && !armed);
  missileButton.classList.toggle('empty', n <= 0);
  const label =
    n <= 0 ? 'No missiles' : armed ? (isTouch ? `Hold to fire ×${n}` : `Fire ×${n}`) : flight.seeker ? `Seeking ×${n}` : modern ? `Arm ×${n}` : `Lock ×${n}`;
  if (missileButton.textContent !== label) missileButton.textContent = label;
}

/** X: launch at the locked target. */
export function fireMissile() {
  const c = cmdr();
  if (flight.lockedCommander) {
    // The server flies missiles between commanders; we draw it when it says it's away.
    if (flight.surrenderTimer !== null) main.breakSurrender();
    c.missiles -= 1;
    saveCommander(c);
    sharedSpace.launchMissile(flight.lockedCommander.id);
    main.launchSound(player.def, null);
    flash(`Missile away · CMDR ${flight.lockedCommander.name}`, 1.2);
    flight.lockedCommander = null;
    return;
  }
  if (!flight.locked) {
    const hint = c.difficulty !== 'modern' ? 'Lock a target first (T)' : flight.seeker ? 'No lock yet · hold the ship in your sights' : 'Arm a missile first (T)';
    flash(c.missiles > 0 ? hint : 'No missiles', 1.5);
    return;
  }
  if (flight.surrenderTimer !== null) main.breakSurrender();
  c.missiles -= 1;
  saveCommander(c);
  launchMissile(player, flight.locked.ship);
  flight.lastShotAt = flight.elapsed; // a launch gives you away too
  flash(`Missile away · ${flight.locked.def.name}`, 1.2);
  flight.locked = null;
}

export function launchMissile(from: PlayerShip, target: PlayerShip) {
  const m = new Missile(shipById('missile')!, from, target);
  space.scene.add(m.model.root);
  missiles.push(m);
  main.launchSound(from.def, from === player ? null : m.position);
  if (target === player) {
    sfx.incoming();
    incomingTimer = 1;
    flash('INCOMING MISSILE · break hard or use ECM (Z)', 2.5);
  }
}

/** When each ship last fired a missile (elapsed seconds). */
const npcMissileAt = new WeakMap<NpcShip, number>();
const NPC_MISSILE_GAP = 20; // seconds between one ship's missiles (Modern)

export function maybeFireNpcMissile(npc: NpcShip) {
  if (npc.missiles <= 0 || npc.mode !== 'attack' || !npc.target || npc.role === 'trader') return;
  if (npc.target === player && game.state !== 'flying') return;
  // Modern: no salvos. One missile homing on you at a time, and a pause between
  // a ship's missiles, so each one is a fight you can win (break, or ECM).
  if (modern() && npc.target === player && (missiles.some((m) => m.target === player) || flight.elapsed - (npcMissileAt.get(npc) ?? -Infinity) < NPC_MISSILE_GAP)) return;
  const d = npc.obj.position.distanceTo(npc.target.obj.position);
  if (d < NPC_MISSILE_RANGE[0] || d > NPC_MISSILE_RANGE[1] || Math.random() > NPC_MISSILE_CHANCE) return;
  npc.missiles -= 1;
  npcMissileAt.set(npc, flight.elapsed);
  launchMissile(npc.ship, npc.target);
}

export function explodeMissile(m: Missile) {
  const flare = new Explosion(m.model.def, m.model.root, m.dir.clone().multiplyScalar(m.speed * 0.3));
  space.scene.add(flare.group);
  explosions.push(flare);
  boomAt(m.position, 1.6, 1200, 1.1);
  missiles.splice(missiles.indexOf(m), 1);
  m.dispose();
}

const BOMB_RANGE = 6000;

/** B: the energy bomb destroys every ship and missile nearby. Whoever they are. */
export function energyBomb() {
  const c = cmdr();
  if (!hasEquipment(c, 'energy-bomb')) {
    flash('No energy bomb fitted', 1.5);
    return;
  }
  if (flight.surrenderTimer !== null) main.breakSurrender();
  removeEquipment(c, 'energy-bomb');
  saveCommander(c);
  sfx.explosion();
  sfx.ecm();
  main.hitFeedback(1.4);
  const el = $('#whiteout');
  el.classList.remove('fade');
  el.hidden = false;
  fadeFromWhite();
  const near = (p: THREE.Vector3) => p.distanceTo(player.obj.position) < BOMB_RANGE;
  for (const m of missiles.filter((m) => near(m.position))) explodeMissile(m);
  const victims = npcs.filter((n) => near(n.obj.position));
  for (const npc of victims) main.destroyNpc(npc, player.obj);
  flash(victims.length ? `Energy bomb · ${victims.length} ship${victims.length > 1 ? 's' : ''} destroyed` : 'Energy bomb', 2.5);
}

/** Z: the ECM destroys every missile in range, friend or foe. */
export function playerEcm() {
  if (!isWorking(cmdr(), 'ecm')) {
    flash(hasEquipment(cmdr(), 'ecm') ? 'ECM damaged · repair at a station' : 'No ECM fitted', 1.5);
    return;
  }
  if (ecmCooldown > 0) return;
  ecmCooldown = ECM_COOLDOWN;
  sfx.ecm();
  main.hitFeedback(0.2);
  // Classic, as in 1984: ECM destroys every missile in flight, wherever it is.
  const range = cmdr().difficulty === 'classic' ? Infinity : ECM_RANGE;
  const hits = missiles.filter((m) => m.position.distanceTo(player.obj.position) < range);
  for (const m of hits) explodeMissile(m);
  if (sharedSpace.connected) sharedSpace.ecm(); // the server clears commanders' missiles
  flash(hits.length ? `ECM · ${hits.length} missile${hits.length > 1 ? 's' : ''} destroyed` : 'ECM', 1.5);
}

export function updateMissiles(dt: number) {
  ecmCooldown = Math.max(0, ecmCooldown - dt);
  flight.equipmentHitCooldown = Math.max(0, flight.equipmentHitCooldown - dt);
  const alive = game.state === 'flying';
  // A lost lock goes back to seeking (Modern), so the next ship in your sights can be locked.
  const lockLost = () => {
    if (alive && game.commander && cmdr().difficulty === 'modern' && cmdr().missiles > 0) flight.seeker = { on: null, progress: 0, beep: 0 };
    if (alive) flash(flight.seeker ? 'Missile lock lost · seeking' : 'Missile lock lost', 1.2);
  };
  if (flight.locked && (!npcs.includes(flight.locked) || flight.locked.obj.position.distanceTo(player.obj.position) > LOCK_HOLD)) {
    flight.locked = null;
    lockLost();
  }
  if (flight.lockedCommander && (![...sharedSpace.remotes.values()].includes(flight.lockedCommander) || flight.lockedCommander.position.distanceTo(player.obj.position) > LOCK_HOLD)) {
    flight.lockedCommander = null;
    lockLost();
  }
  if (alive) updateSeeker(dt);
  else flight.seeker = null;
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
      main.hitFeedback(1.2);
      showHitDirection(camera, m.position);
      if (main.damagePlayer(MISSILE.damage, npcs.find((n) => n.ship === m.owner))) {
        main.die();
        return;
      }
    } else if (victim) {
      // Classic, as in 1984: a missile that reaches a ship destroys it outright.
      const damage = cmdr().difficulty === 'classic' ? Infinity : MISSILE.damage;
      if (m.owner === player) main.playerHitNpc(victim, damage);
      else if (victim.hit(damage, m.owner)) main.destroyNpc(victim, m.owner.obj);
    }
  }

  // Keep warning while something is homing in.
  incomingTimer -= dt;
  if (alive && incomingTimer <= 0 && (missiles.some((m) => m.target === player) || [...netMissiles.values()].some((n) => n.missile.target === player))) {
    sfx.incoming();
    incomingTimer = 1;
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
export const netMissiles = new Map<string, NetMissile>();

export function startNetMissile(e: Extract<SpaceEvent, { kind: 'missile' }>) {
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
  if (e.targetIsMe && game.state === 'flying') {
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

export function explodeNetMissile(m: Missile) {
  const flare = new Explosion(m.model.def, m.model.root, m.dir.clone().multiplyScalar(m.speed * 0.3));
  space.scene.add(flare.group);
  explosions.push(flare);
  boomAt(m.position, 1.6, 1200, 1.1);
  m.dispose();
}
