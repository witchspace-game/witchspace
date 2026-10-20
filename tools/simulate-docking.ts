// Flies the docking computer from many random starting positions and reports
// how reliably and how smoothly it docks. Runs headless in Node.
//
//   npm run sim:docking            summary
//   npm run sim:docking -- --ci    exit non-zero if docking regresses

import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ShipDef } from '../src/content/types';
import { DockingComputer } from '../src/game/dockingComputer';
import { PlayerShip } from '../src/game/playerShip';
import { Station } from '../src/game/station';

const root = resolve(import.meta.dirname, '..');
const load = (id: string): ShipDef => JSON.parse(readFileSync(resolve(root, `content/ships/${id}.json`), 'utf8'));

const RUNS = 300;
const DT = 1 / 60;
const TIMEOUT = 120; // seconds

// Deterministic randomness so results are comparable between runs.
let seed = 1984;
const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const between = (a: number, b: number) => a + rand() * (b - a);
const randomDir = () => {
  const z = between(-1, 1);
  const t = between(0, Math.PI * 2);
  const r = Math.sqrt(1 - z * z);
  return new THREE.Vector3(r * Math.cos(t), r * Math.sin(t), z);
};

interface Result {
  docked: boolean;
  time: number;
  impacts: number;
  /** Peak angular acceleration, rad/s². High = jerky rotation. */
  peakAngAccel: number;
  /** Mean absolute angular acceleration, rad/s². */
  meanAngAccel: number;
  /** Peak sideways (non-nose) velocity, m/s. Non-zero = the ship is being slid. */
  peakSlide: number;
}

function fly(): Result {
  const station = new Station(load('coriolis'));
  station.root.rotation.z = between(0, Math.PI * 2);
  station.root.updateMatrixWorld();
  const ship = new PlayerShip(load('cobra-mk3'));
  const dc = new DockingComputer();

  ship.obj.position.copy(randomDir().multiplyScalar(between(300, 3500)));
  ship.obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), randomDir());
  ship.speed = between(0, 220);
  ship.obj.updateMatrixWorld();

  let prevQ = ship.obj.quaternion.clone();
  let prevW: THREE.Vector3 | null = null;
  let peakAngAccel = 0;
  let sumAngAccel = 0;
  let samples = 0;
  let peakSlide = 0;
  let impacts = 0;

  for (let t = 0; t < TIMEOUT; t += DT) {
    const before = ship.obj.position.clone();
    const prevLocal = station.toLocal(ship.obj.position);
    station.update(DT);
    station.root.updateMatrixWorld();
    dc.update(DT, ship, station);
    ship.move(DT);
    ship.obj.updateMatrixWorld();

    // Angular velocity from successive orientations, then its rate of change.
    const dq = prevQ.clone().invert().multiply(ship.obj.quaternion);
    if (dq.w < 0) dq.set(-dq.x, -dq.y, -dq.z, -dq.w);
    const angle = 2 * Math.acos(Math.min(1, dq.w));
    const s = Math.sqrt(1 - dq.w * dq.w);
    const w = s > 1e-6 ? new THREE.Vector3(dq.x / s, dq.y / s, dq.z / s).multiplyScalar(angle / DT) : new THREE.Vector3();
    if (prevW && t > 0.5) {
      const a = w.clone().sub(prevW).length() / DT;
      peakAngAccel = Math.max(peakAngAccel, a);
      sumAngAccel += a;
      samples++;
    }
    prevW = w;
    prevQ = ship.obj.quaternion.clone();

    // Any motion not along the nose is the computer sliding the ship.
    const moved = ship.obj.position.clone().sub(before).divideScalar(DT);
    const sideways = moved.clone().sub(ship.forward().multiplyScalar(moved.dot(ship.forward())));
    peakSlide = Math.max(peakSlide, sideways.length());

    const contact = station.contact(ship, prevLocal);
    if (contact?.kind === 'docked') {
      return { docked: true, time: t, impacts, peakAngAccel, meanAngAccel: sumAngAccel / Math.max(1, samples), peakSlide };
    }
    if (contact) impacts++;
  }
  return { docked: false, time: TIMEOUT, impacts, peakAngAccel, meanAngAccel: sumAngAccel / Math.max(1, samples), peakSlide };
}

const results = Array.from({ length: RUNS }, fly);
const docked = results.filter((r) => r.docked);
const pct = (xs: number[], p: number) => [...xs].sort((a, b) => a - b)[Math.floor((xs.length - 1) * p)] ?? 0;
const fmt = (n: number) => n.toFixed(1);

const summary = {
  docked: `${docked.length}/${RUNS}`,
  withImpacts: results.filter((r) => r.impacts > 0).length,
  timeMedian: fmt(pct(docked.map((r) => r.time), 0.5)),
  time95: fmt(pct(docked.map((r) => r.time), 0.95)),
  angAccelMean: fmt(pct(results.map((r) => r.meanAngAccel), 0.5)),
  angAccelPeak95: fmt(pct(results.map((r) => r.peakAngAccel), 0.95)),
  slidePeak95: fmt(pct(results.map((r) => r.peakSlide), 0.95)),
};

console.log('Docking computer simulation');
console.log(`  docked                  ${summary.docked}`);
console.log(`  runs with impacts       ${summary.withImpacts}`);
console.log(`  time to dock (s)        median ${summary.timeMedian}, 95th pct ${summary.time95}`);
console.log(`  angular accel (rad/s²)  typical ${summary.angAccelMean}, 95th pct peak ${summary.angAccelPeak95}`);
console.log(`  sideways slide (m/s)    95th pct peak ${summary.slidePeak95}`);

if (process.argv.includes('--ci')) {
  const failures = [];
  if (docked.length < RUNS * 0.98) failures.push('fewer than 98% of runs docked');
  if (results.some((r) => r.impacts > 0)) failures.push('the docking computer hit the station');
  if (failures.length) {
    console.error(`\nFAILED: ${failures.join('; ')}`);
    process.exit(1);
  }
}
