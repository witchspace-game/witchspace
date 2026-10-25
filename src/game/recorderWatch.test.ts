import { describe, expect, it } from 'vitest';
import { RecorderWatch, SHIP_RANGE, somethingNear, STATION_RANGE, TAIL, type Point, type Surroundings } from './recorderWatch';

const at = (x: number): Point => ({ x, y: 0, z: 0 });
const empty: Surroundings = { me: at(0), ships: [], legends: 0, station: at(1e6), planet: { position: at(-1e6), radius: 5000 }, rift: false };

describe('when the flight recorder rests', () => {
  it('rests in open space with nothing about', () => {
    expect(somethingNear(empty)).toBe(false);
  });

  it('wakes for a ship in scanner range, the station or a planet', () => {
    expect(somethingNear({ ...empty, ships: [at(SHIP_RANGE - 1)] })).toBe(true);
    expect(somethingNear({ ...empty, ships: [at(SHIP_RANGE + 1)] })).toBe(false);
    expect(somethingNear({ ...empty, station: at(STATION_RANGE - 1) })).toBe(true);
    expect(somethingNear({ ...empty, planet: { position: at(20_000), radius: 6000 } })).toBe(true);
  });

  it('never rests near a Legend, even one the scanner can’t see, or a rift', () => {
    expect(somethingNear({ ...empty, legends: 1 })).toBe(true);
    expect(somethingNear({ ...empty, rift: true })).toBe(true);
  });

  it('carries on for a few seconds after the last thing goes', () => {
    const w = new RecorderWatch();
    w.update({ ...empty, ships: [at(100)] }, 0.1);
    for (let t = 0; t < TAIL - 0.5; t += 0.5) w.update(empty, 0.5);
    expect(w.resting).toBe(false);
    w.update(empty, 1);
    expect(w.resting).toBe(true);
    w.update({ ...empty, ships: [at(100)] }, 0.016);
    expect(w.resting).toBe(false);
  });
});
