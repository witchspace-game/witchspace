import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { chooseTarget, CombatPilot, PILOT_RANGE } from './combatPilot';
import type { NpcRole, NpcShip } from './npc';
import { PlayerShip } from './playerShip';

const cobra = () => new PlayerShip(shipById('cobra-mk3')!);

// Just enough of an NPC for the computer: a real ship to chase, a role and a stance.
function npc(role: NpcRole, x: number, z: number, hostile = false): NpcShip {
  const ship = cobra();
  ship.obj.position.set(x, 0, z);
  return { role, ship, obj: ship.obj, hostile } as unknown as NpcShip;
}

describe('the combat computer', () => {
  it('fights the locked target first, then whoever is after you, then pirates', () => {
    const at = new THREE.Vector3();
    const trader = npc('trader', 0, 500);
    const pirate = npc('pirate', 0, 1500);
    const hunter = npc('pirate', 0, 3000, true);
    const far = npc('pirate', 0, PILOT_RANGE + 500, true);
    expect(chooseTarget(at, [trader, pirate, hunter, far], null)).toBe(hunter);
    expect(chooseTarget(at, [trader, pirate, far], null)).toBe(pirate);
    expect(chooseTarget(at, [trader, pirate, hunter], pirate)).toBe(pirate);
    expect(chooseTarget(at, [trader, far], null)).toBeNull();
  });

  it('turns to face its target and closes in', () => {
    const me = cobra();
    me.speed = 100;
    const pirate = npc('pirate', 2000, 0, true); // off to one side
    const pilot = new CombatPilot();
    const start = me.obj.position.distanceTo(pirate.obj.position);
    for (let i = 0; i < 300; i++) {
      expect(pilot.fly(1 / 60, me, [pirate], null)).toBe(true);
      me.move(1 / 60);
    }
    const to = pirate.obj.position.clone().sub(me.obj.position).normalize();
    expect(me.forward().angleTo(to)).toBeLessThan(THREE.MathUtils.degToRad(25));
    expect(me.obj.position.distanceTo(pirate.obj.position)).toBeLessThan(start);
  });

  it('breaks away rather than ramming, then comes round again', () => {
    const me = cobra();
    me.speed = 200;
    const pirate = npc('pirate', 0, 250, true); // dead ahead and very close
    const pilot = new CombatPilot();
    pilot.fly(1 / 60, me, [pirate], null);
    expect(pilot.mode).toBe('breakoff');
    for (let i = 0; i < 60 * 3; i++) {
      pilot.fly(1 / 60, me, [pirate], null);
      me.move(1 / 60);
    }
    expect(pilot.mode).toBe('attack');
    expect(me.obj.position.distanceTo(pirate.obj.position)).toBeGreaterThan(450);
  });

  it('stands down when there is nothing to fight', () => {
    expect(new CombatPilot().fly(1 / 60, cobra(), [npc('trader', 0, 500)], null)).toBe(false);
  });

  it("won't chase a target into the planet", () => {
    const me = cobra();
    me.obj.position.set(0, 0, 0);
    me.obj.lookAt(0, 0, 1); // nose towards the planet and the pirate beyond it
    const pirate = npc('pirate', 0, 0, true);
    pirate.obj.position.set(0, 0, 3000);
    const planet = { centre: new THREE.Vector3(0, 0, 1500), radius: 1400 };
    const pilot = new CombatPilot();
    for (let i = 0; i < 120; i++) {
      pilot.fly(1 / 60, me, [pirate], null, planet);
      me.move(1 / 60);
    }
    // It has turned away: heading out from the planet, not into it.
    expect(me.forward().dot(planet.centre.clone().sub(me.obj.position).normalize())).toBeLessThan(0.5);
  });
});
