import * as THREE from 'three';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { ShipDef } from '../content/types';
import { DockingComputer } from './dockingComputer';
import { PlayerShip } from './playerShip';
import { SLOT, Station } from './station';

const load = (id: string): ShipDef => JSON.parse(readFileSync(resolve(__dirname, `../../content/ships/${id}.json`), 'utf8'));
const DT = 1 / 60;

/** Out on the lane, nose on the slot, with the computer on: fly `seconds`, holding while `hold(t)`. */
function fly(seconds: number, hold: (t: number) => boolean, startZ = 3000) {
  const station = new Station(load('coriolis'));
  station.root.updateMatrixWorld();
  const ship = new PlayerShip(load('cobra-mk3'));
  ship.obj.position.copy(station.toWorld(new THREE.Vector3(0, 0, startZ)));
  ship.obj.lookAt(station.root.position);
  ship.obj.updateMatrixWorld();
  const dc = new DockingComputer();
  let closest = Infinity;
  let docked = -1;
  for (let t = 0; t < seconds; t += DT) {
    station.update(DT);
    station.root.updateMatrixWorld();
    dc.update(DT, ship, station, hold(t));
    ship.move(DT);
    ship.obj.updateMatrixWorld();
    const z = station.toLocal(ship.obj.position).z;
    if (hold(t)) closest = Math.min(closest, z);
    if (docked < 0 && z < SLOT.z) docked = t;
  }
  return { ship, closest, docked };
}

describe('the docking computer and the rings', () => {
  it('waits out on the approach, still, while the rings are red', () => {
    const { ship, closest, docked } = fly(60, () => true);
    expect(docked).toBe(-1);
    expect(closest).toBeGreaterThan(SLOT.z + 1500); // never near the mouth a launch comes out of
    expect(ship.speed).toBeLessThan(5); // waiting, not circling
  });

  it('goes in once they say come in', () => {
    const { docked } = fly(120, (t) => t < 30);
    expect(docked).toBeGreaterThan(30);
  });

  it('keeps going if it is already committed to the slot', () => {
    const { docked } = fly(40, (t) => t > 1, SLOT.z + 400);
    expect(docked).toBeGreaterThan(0);
  });
});
