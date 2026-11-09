import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { NpcShip, type NpcMode } from './npc';
import { PlayerShip } from './playerShip';
import { PULSE_LASER } from './weapons';

// Attack runs, not rams (Mark: "I hate the way the pirates come in nose first and literally
// smash into you"). Fly a pirate at a Cobra, many times over, and watch the gap.

/** The mode as it is now (update() changes it; a function keeps TypeScript from narrowing it). */
const modeOf = (n: NpcShip): NpcMode => n.mode;

function fight(pirateId: string, cobraSpeed: number, seconds: number) {
  const cobra = new PlayerShip(shipById('cobra-mk3')!);
  cobra.speed = cobraSpeed;
  const pirate = new NpcShip(shipById(pirateId)!, 'pirate', PULSE_LASER, { centre: new THREE.Vector3(), radius: 1000, height: 0, rate: 0.1, angle: 0 });
  // Head to head, 3 km apart, a little off line, as an ambush starts.
  pirate.obj.position.set(Math.random() * 200 - 100, Math.random() * 200 - 100, 3000);
  pirate.obj.lookAt(cobra.obj.position);
  pirate.ship.speed = pirate.ship.maxSpeed * 0.8;
  pirate.target = cobra;
  pirate.mode = 'attack';
  let closest = Infinity;
  let runs = 0;
  let was = modeOf(pirate);
  const dt = 1 / 60;
  for (let t = 0; t < seconds; t += dt) {
    pirate.update(dt);
    cobra.move(dt);
    closest = Math.min(closest, pirate.obj.position.distanceTo(cobra.obj.position));
    const now = modeOf(pirate);
    if (was === 'attack' && now === 'breakoff') runs++;
    was = now;
  }
  return { closest, runs, touching: pirate.radius + 30 };
}

describe('pirates make attack runs', () => {
  for (const id of ['sidewinder', 'mamba', 'falcon']) {
    it(`a ${id} breaks off before it reaches you, and comes round again`, () => {
      for (let i = 0; i < 25; i++) {
        // You flying at it flat out, cruising, or sitting still.
        const speed = [280, 150, 0][i % 3];
        const { closest, runs, touching } = fight(id, speed, 45);
        expect(closest, `run ${i}`).toBeGreaterThan(touching);
        // A Cobra running flat out is only a little slower than a pirate, so it gets fewer passes.
        expect(runs, `run ${i}`).toBeGreaterThanOrEqual(speed === 280 ? 2 : 3);
      }
    });
  }
});

// A renowned pirate holds back (Mark, 9 November 2026): long runs from range, never a joust.
describe('a renowned pirate holds back', () => {
  function holdBack(cobraSpeed: number) {
    const cobra = new PlayerShip(shipById('cobra-mk3')!);
    cobra.speed = cobraSpeed;
    const pirate = new NpcShip(shipById('cobra-mk3')!, 'pirate', PULSE_LASER, { centre: new THREE.Vector3(), radius: 1000, height: 0, rate: 0.1, angle: 0 });
    pirate.style = 'holdBack';
    pirate.obj.position.set(Math.random() * 200 - 100, Math.random() * 200 - 100, 4000);
    pirate.obj.lookAt(cobra.obj.position);
    pirate.ship.speed = pirate.ship.maxSpeed * 0.6;
    pirate.target = cobra;
    pirate.mode = 'attack';
    return { cobra, pirate };
  }

  it('turns away well before a joust, and comes round again', () => {
    for (let i = 0; i < 15; i++) {
      const speed = [200, 100, 0][i % 3];
      const { cobra, pirate } = holdBack(speed);
      let closest = Infinity;
      let runs = 0;
      let was = modeOf(pirate);
      for (let t = 0; t < 60; t += 1 / 60) {
        pirate.update(1 / 60);
        cobra.move(1 / 60);
        closest = Math.min(closest, pirate.obj.position.distanceTo(cobra.obj.position));
        if (was === 'attack' && modeOf(pirate) === 'breakoff') runs++;
        was = modeOf(pirate);
      }
      expect(closest, `run ${i}`).toBeGreaterThan(400); // a jouster comes to 150–280 m
      expect(runs, `run ${i}`).toBeGreaterThanOrEqual(2);
    }
  });

  it('pulls out when his shields are low, and comes back when they are up', () => {
    const { cobra, pirate } = holdBack(100);
    for (let t = 0; t < 5; t += 1 / 60) pirate.update(1 / 60);
    pirate.ship.shields = pirate.def.stats.shields * 0.2;
    pirate.update(1 / 60);
    expect(pirate.regrouping).toBe(true);
    expect(modeOf(pirate)).toBe('flee');
    for (let t = 0; t < 20 && pirate.regrouping; t += 1 / 60) {
      pirate.update(1 / 60);
      cobra.move(1 / 60);
    }
    expect(pirate.regrouping).toBe(false);
    expect(modeOf(pirate)).toBe('attack');
  });

  it('is a little slower than your Cobra, so running from him works', () => {
    const { pirate } = holdBack(0);
    pirate.target!.obj.position.set(0, 0, -20000); // far off: he goes flat out
    for (let t = 0; t < 10; t += 1 / 60) pirate.update(1 / 60);
    expect(pirate.ship.speed).toBeLessThan(pirate.ship.maxSpeed * 0.95);
  });
});
