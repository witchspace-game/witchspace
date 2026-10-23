import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { stationAtStage, stationSpin, type Yard } from '../game/yards';
import { buildShip, disposeShip, type ShipModel } from './shipModel';

// A Wexley-Yorozu yard in flight (game/yards.ts says where and how far along):
// the Titanoboa parked off the moon on the side facing the station, the new
// station beside it in its current stage, and Bullsnakes running ore from the
// moon's surface to the intake under the constructor's prow. The haulers run
// on the clock, so everyone in the system sees them in the same places.

const STANDOFF = 2200; // metres from the moon's surface to the constructor's centre
const STATION_OFF = 1100; // metres from the constructor's centreline to the new station, clear of the bays
const INTAKE = new THREE.Vector3(0, -110, 1200); // under the prow, in the constructor's frame
const HAULERS = 4;
const HAUL_PERIOD = 150; // seconds for a round trip
const BUILD_RADIUS = 95; // the station under construction, as solid as the finished one

export type YardContact = { kind: 'crash'; what: string } | { kind: 'bump'; what: string; damage: number };

export interface YardScene {
  yard: Yard;
  titan: ShipModel;
  station: ShipModel | null;
  haulers: ShipModel[];
  /** Where to put a marker and measure from, and how much room it takes. */
  centre: THREE.Vector3;
  radius: number;
  update(dt: number, now: number): void;
  /** Has the ship at `p` hit anything? Bumps push it clear. */
  contact(p: THREE.Vector3, speed: number): YardContact | null;
  dispose(): void;
}

/** One box per separate part of a hull, in its own frame: tight enough to fly between the bays' outlines without falling through. */
function partBoxes(def: ShipDef): THREE.Box3[] {
  const { vertices, faces } = def.geometry;
  const parent = vertices.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (const f of faces) for (const v of f) parent[find(v)] = find(f[0]);
  const boxes = new Map<number, THREE.Box3>();
  for (const f of faces) {
    for (const v of f) {
      const root = find(v);
      if (!boxes.has(root)) boxes.set(root, new THREE.Box3());
      boxes.get(root)!.expandByPoint(new THREE.Vector3(...vertices[v]));
    }
  }
  return [...boxes.values()];
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
  const boxes = partBoxes(defs.titan);

  const stageDef = stationAtStage(defs.station, yard.stage);
  const station = stageDef ? buildShip(stageDef) : null;
  const spin = stationSpin(yard, defs.station.stats.rollRate ?? 0.25);
  if (station) {
    // On the station's side of the constructor, its slot facing the way traffic will come.
    station.root.position.copy(centre).addScaledVector(out, STATION_OFF).addScaledVector(along, -300);
    station.root.lookAt(station.root.position.clone().add(out));
    // Where a spin-up has got to, so it's the same for everyone.
    station.root.rotateZ((spin * (Date.now() / 1000)) % (Math.PI * 2));
    scene.add(station.root);
  }

  const intake = titan.root.localToWorld(INTAKE.clone());
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

  const place = (now: number) => {
    haulers.forEach((m, i) => {
      const { from, to } = routes[i];
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
