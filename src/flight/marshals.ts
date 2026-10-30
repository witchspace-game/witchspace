// The Co-operative Marshals in flight (moved from main.ts): the Bastion carrier, its rift and its
// Lancers. The rules (when they come, how long each phase lasts) are in game/marshals.ts.

import { music } from '../audio/sound';
import { boomAt } from '../audio/spatial';
import { shipById } from '../content/ships';
import { NpcShip } from '../game/npc';
import { ARRIVAL, ARRIVAL_WARNINGS, closingOpenness, EMERGE_SPEED, FIRST_LAUNCH, LAUNCH_GAP, MAX_OUT, marshalsDelay, RIFT_DISTANCE, RIFT_RADIUS, riftOpenness, WARNING, WING } from '../game/marshals';
import { MARSHAL_LASER } from '../game/weapons';
import { Rift } from '../render/rift';
import { riftClose, riftDrone, riftGroan, type Drone } from '../audio/rift';
import { isRetro } from '../render/renderer';
import { flash } from '../ui/hud';
import { cmdr, currentSystem, game } from '../core';
import { flight, npcs, planetPos, player, space, station } from '../scene';
import { addNpc, removeNpc } from './traffic';
import * as THREE from 'three';
import type { LoggedMoment } from '../game/flightLog';
import type { MomentEvent } from '../game/moments';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  damagePlayer: (amount: number, from?: NpcShip | undefined) => boolean;
  spillCargo: (at: THREE.Vector3, velocity: THREE.Vector3, cargo: number | Record<string, number>, stolen?: boolean) => void;
  die: () => void;
  keepMoment: (event: MomentEvent, before: number, after: number, events?: MomentEvent[]) => Promise<LoggedMoment | null>;
};
export const initMarshals = (hooks: typeof main) => Object.assign(main, hooks);

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

export let carrier: Carrier | null = null;
let marshalTimer: number | null = null; // seconds of flight until a carrier comes
const BAY = new THREE.Vector3(0, -7, 450); // the Bastion's bow bay, in its own frame
const CARRIER_STANDOFF = 3000; // metres it keeps from its quarry
const CARRIER_WITHDRAW_HEALTH = 0.25;

/** Start the clock on a carrier, if a warrant here calls for one. */
export function scheduleMarshals() {
  if (carrier || marshalTimer !== null || !game.commander) return;
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
export function summonCarrier() {
  const from = player.obj.position;
  let at = new THREE.Vector3();
  for (let i = 0; i < 12; i++) {
    const dir = player.forward().add(new THREE.Vector3().randomDirection().multiplyScalar(0.6)).normalize();
    at = from.clone().addScaledVector(dir, RIFT_DISTANCE);
    if (at.distanceTo(planetPos) > flight.planetRadius + RIFT_RADIUS * 3 && at.distanceTo(station.root.position) > RIFT_RADIUS * 3) break;
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
  if (game.state === 'flying') flash(message, 3);
}

/** Their quarry is dead: the carrier and its wing quietly leave the system. */
export function marshalsStandDown() {
  if (carrier) for (const l of carrier.wing) if (npcs.includes(l)) removeNpc(l);
  if (carrier && npcs.includes(carrier.npc)) removeNpc(carrier.npc, false);
  disposeCarrier();
  marshalTimer = null;
}

export function disposeCarrier() {
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
export function riftInterference(): number {
  const r = carrier?.rift;
  if (!r || r.open <= 0) return 0;
  const d = r.group.position.distanceTo(player.obj.position);
  return THREE.MathUtils.clamp(r.open * 1.4 * (1 - d / (r.radius * 12)), 0, 1);
}

function riftPull(c: Carrier, dt: number) {
  const r = c.rift;
  if (!r || r.open <= 0 || game.state !== 'flying') return;
  const to = r.group.position.clone().sub(player.obj.position);
  const d = to.length();
  const reach = r.radius * RIFT_PULL_RANGE;
  if (d > reach) return;
  const k = r.open * (1 - d / reach) ** 2;
  player.obj.position.addScaledVector(to.normalize(), RIFT_PULL * k * dt);
  flight.shake = Math.max(flight.shake, 0.3 * k); // a tremor, not enough to fight the controls
  if (!c.pullWarned) {
    c.pullWarned = true;
    flash('Gravitational shear · the rift is pulling you in', 3);
  }
  if (d < r.radius * r.open) {
    if (flight.elapsed - c.tornAt > 4) {
      c.tornAt = flight.elapsed;
      flash('Hull stress · the rift is tearing at the ship', 2.5);
    }
    if (main.damagePlayer(RIFT_TEAR * dt)) main.die();
  }
}

export function updateMarshals(dt: number) {
  const flying = game.state === 'flying';
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
  if (flight.locked && riftInterference() > 0.7) {
    flight.locked = null;
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
      void main.keepMoment({ kind: 'marshals', text: 'A witchspace rift: the Co-operative Marshals came through', subject: 'Bastion' }, 8, 21);
      music.play('marshals', !isRetro()); // Semper Fidelis, by the Marshals' own kind of band
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
    const wanted = Boolean(game.commander) && cmdr().warrant;
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
  if (game.state === 'flying') flash(first ? 'The Bastion is launching Lancers' : `Lancers launching · ${c.bay} still aboard`, 2);
}
/**
 * A Bastion destroyed: the Lancers still aboard go with it, those already out
 * fight on, and the wreck spills its alloys (stolen, if you did it). The
 * Marshals don't forget: each one destroyed brings the next sooner.
 */
export function bastionDestroyed(c: Carrier, velocity: THREE.Vector3, byPlayer: boolean) {
  const aboard = c.bay;
  c.bay = 0;
  carrier = null;
  c.rift?.dispose();
  c.drone?.stop();
  for (let i = 0; i < 3; i++) {
    const at = c.npc.obj.localToWorld(new THREE.Vector3(0, 0, (i - 1) * 300));
    main.spillCargo(at, velocity, { alloys: 3 + Math.floor(Math.random() * 4) }, byPlayer);
    setTimeout(() => boomAt(at, 3, 2400, 2), 300 + i * 450);
  }
  if (!byPlayer || !game.commander) return;
  const cm = cmdr();
  cm.bastionsDestroyed = (cm.bastionsDestroyed ?? 0) + 1;
  setTimeout(() => flash(`Bastion carrier destroyed${aboard ? ` with ${aboard} Lancers aboard` : ''} · the Marshals will not forget`, 4), 1800);
}

/** A new system: no carrier on its way. */
export function clearMarshalTimer() {
  marshalTimer = null;
}
