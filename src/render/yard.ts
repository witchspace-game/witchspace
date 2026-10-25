import * as THREE from 'three';
import { moduleById } from '../content/moduleFiles';
import { centresOf } from '../content/modules';
import type { ShipDef } from '../content/types';
import { stationAtStage, stationSpin, type Yard } from '../game/yards';
import { buildShip, disposeShip, type ShipModel } from './shipModel';

// A Wexley-Yorozu yard in flight (game/yards.ts says where and how far along):
// the Titanoboa, assembled from its modules, parked off the moon on the side
// facing the station; the new station beside its fabricator, where the
// sections come out; Bullsnakes running ore from the moon's surface into the
// maw, and tug teams parked on the hold's pads. The haulers run on the clock,
// so everyone in the system sees them in the same places.

const STANDOFF = 2200; // metres from the moon's surface to the constructor's centre
const STATION_OFF = 1100; // metres from the constructor's centreline to the new station, off the fabricator's open side
const MOUTH_DEPTH = 70; // how far into the maw a hauler flies to empty its hopper
const PAD_TUGS = [-60, 0, 60]; // three Bullsnakes to a pad, side by side along the hold
const PAD_OUT = 250; // metres out from the spine, the middle of the pad
const PAD_HEIGHT = 25; // a Bullsnake's hopper sits on the pad
const HAULERS = 4;
const HAUL_PERIOD = 150; // seconds for a round trip
const BUILD_RADIUS = 95; // the station under construction, as solid as the finished one

export type YardContact = { kind: 'crash'; what: string } | { kind: 'bump'; what: string; damage: number };

export interface YardScene {
  yard: Yard;
  titan: ShipModel;
  station: ShipModel | null;
  /** The ore haulers, then the tugs parked on the hold's pads. */
  haulers: ShipModel[];
  /** Where to put a marker and measure from, and how much room it takes. */
  centre: THREE.Vector3;
  radius: number;
  update(dt: number, now: number): void;
  /** Has the ship at `p` hit anything? Bumps push it clear. */
  contact(p: THREE.Vector3, speed: number): YardContact | null;
  dispose(): void;
}

/** One box per face, in the hull's own frame: tight enough to fly through the habitat's wheel or the fabricator's cradle. */
function faceBoxes(def: ShipDef): THREE.Box3[] {
  const { vertices, faces } = def.geometry;
  return faces.map((f) => new THREE.Box3().setFromPoints(f.map((i) => new THREE.Vector3(...vertices[i]))));
}

/** Where each module sits along the hull: from the ship's line-up, or nothing for a one-piece hull. */
function modulesAlong(def: ShipDef) {
  const mods = (def.modules ?? []).map((id) => moduleById(id));
  return mods.every((m) => m) ? centresOf(mods.map((m) => m!)) : [];
}

export function buildYard(
  scene: THREE.Scene,
  yard: Yard,
  defs: { titan: ShipDef; hauler: ShipDef; station: ShipDef },
  moon: { centre: THREE.Vector3; radius: number },
  towards: THREE.Vector3,
): YardScene {
  // Off the moon on the side facing the station, lying across the line between them.
  const out = towards.clone().sub(moon.centre).normalize();
  const centre = moon.centre.clone().addScaledVector(out, moon.radius + STANDOFF);
  let along = new THREE.Vector3().crossVectors(out, new THREE.Vector3(0, 1, 0));
  if (along.lengthSq() < 1e-6) along = new THREE.Vector3(1, 0, 0);
  along.normalize();

  const titan = buildShip(defs.titan);
  titan.root.position.copy(centre);
  titan.root.lookAt(centre.clone().add(along));
  scene.add(titan.root);
  titan.root.updateMatrixWorld();
  const boxes = faceBoxes(defs.titan);
  const sections = modulesAlong(defs.titan);
  const find = (id: string) => sections.find((m) => m.id === id);

  const stageDef = stationAtStage(defs.station, yard.stage, yard.progress);
  const station = stageDef ? buildShip(stageDef) : null;
  const spin = stationSpin(yard, defs.station.stats.rollRate ?? 0.25);
  if (station) {
    // Off the fabricator's open side, the side facing the station, so the sections go straight across.
    // Its slot faces the way traffic will come.
    const local = out.clone().applyQuaternion(titan.root.quaternion.clone().invert());
    const side = local.x >= 0 ? 1 : -1;
    station.root.position.copy(titan.root.localToWorld(new THREE.Vector3(side * STATION_OFF, 0, find('fabricator')?.z ?? -300)));
    station.root.lookAt(station.root.position.clone().add(out));
    // Where a spin-up has got to, so it's the same for everyone.
    station.root.rotateZ((spin * (Date.now() / 1000)) % (Math.PI * 2));
    scene.add(station.root);
  }

  // Into the maw's mouth; a one-piece hull takes it at the prow.
  const maw = find('maw');
  const prow = maw ? maw.z + maw.length / 2 : titan.radius;
  const intake = titan.root.localToWorld(new THREE.Vector3(0, 0, prow - MOUTH_DEPTH));
  const haulers: ShipModel[] = [];
  const routes: { from: THREE.Vector3; to: THREE.Vector3 }[] = [];
  for (let i = 0; i < HAULERS; i++) {
    const m = buildShip(defs.hauler);
    scene.add(m.root);
    haulers.push(m);
    // Each on its own lane, a little apart.
    const side = new THREE.Vector3().crossVectors(along, out).multiplyScalar((i - (HAULERS - 1) / 2) * 70);
    const to = intake.clone().add(side.clone().multiplyScalar(0.4));
    const from = moon.centre.clone().add(to.clone().sub(moon.centre).setLength(moon.radius + 60)).add(side);
    routes.push({ from, to });
  }
  // Tug teams resting on the hold's pads between jobs, noses out, ready to launch.
  const hold = find('hold');
  if (hold) {
    for (const sx of [1, -1]) {
      for (const dz of PAD_TUGS) {
        const m = buildShip(defs.hauler);
        m.root.quaternion.copy(titan.root.quaternion).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), (sx * Math.PI) / 2));
        m.root.position.copy(titan.root.localToWorld(new THREE.Vector3(sx * PAD_OUT, PAD_HEIGHT, hold.z + dz)));
        scene.add(m.root);
        haulers.push(m);
      }
    }
  }

  const place = (now: number) => {
    routes.forEach(({ from, to }, i) => {
      const m = haulers[i];
      const phase = ((now / 1000 / HAUL_PERIOD + i / HAULERS) % 1 + 1) % 1;
      // Up loaded, back empty; easing off at each end to load and unload.
      const up = phase < 0.5;
      const s = THREE.MathUtils.smootherstep(up ? phase * 2 : 2 - phase * 2, 0, 1);
      m.root.position.lerpVectors(from, to, s);
      m.root.lookAt(up ? to : from);
    });
  };
  place(Date.now());

  return {
    yard,
    titan,
    station,
    haulers,
    centre,
    radius: titan.radius,
    update(dt, now) {
      if (station && spin) station.root.rotateZ(spin * dt);
      place(now);
    },
    contact(p, speed) {
      // The constructor: nothing you fly is going to move it.
      const local = titan.root.worldToLocal(p.clone());
      if (boxes.some((b) => b.distanceToPoint(local) < 15)) return { kind: 'crash', what: defs.titan.name };
      if (station && p.distanceTo(station.root.position) < BUILD_RADIUS) {
        p.copy(station.root.position).add(p.clone().sub(station.root.position).setLength(BUILD_RADIUS + 12));
        return { kind: 'bump', what: 'station frame', damage: 20 + speed * 0.45 };
      }
      for (const m of haulers) {
        const away = p.clone().sub(m.root.position);
        if (away.length() < m.radius) {
          p.copy(m.root.position).add(away.setLength(m.radius + 15));
          return { kind: 'bump', what: defs.hauler.name, damage: 25 };
        }
      }
      return null;
    },
    dispose() {
      disposeShip(titan);
      if (station) disposeShip(station);
      for (const m of haulers) disposeShip(m);
    },
  };
}
