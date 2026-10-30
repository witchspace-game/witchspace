import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { chooseTarget, CombatPilot, PILOT_RANGE } from './combatPilot';
import { steerTowards, type NpcRole, type NpcShip } from './npc';
import { PlayerShip } from './playerShip';

const cobra = () => new PlayerShip(shipById('cobra-mk3')!);

// Just enough of an NPC for the computer: a real ship to chase, a role and a stance.
function npc(role: NpcRole, x: number, z: number, hostile = false): NpcShip {
  const ship = cobra();
  ship.obj.position.set(x, 0, z);
  return { role, ship, obj: ship.obj, hostile, def: ship.def } as unknown as NpcShip;
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
    // The break direction is random, so try it many times.
    for (let run = 0; run < 25; run++) {
      const me = cobra();
      me.speed = 200;
      const pirate = npc('pirate', 0, 440, true); // dead ahead, just inside break-off range
      const pilot = new CombatPilot();
      pilot.fly(1 / 60, me, [pirate], null);
      expect(pilot.mode).toBe('breakoff');
      let closest = Infinity;
      let cameRound = false;
      for (let i = 0; i < 60 * 7 && !cameRound; i++) {
        pilot.fly(1 / 60, me, [pirate], null);
        me.move(1 / 60);
        closest = Math.min(closest, me.obj.position.distanceTo(pirate.obj.position));
        cameRound = pilot.mode === 'attack';
      }
      expect(closest).toBeGreaterThan(150); // never flew through it
      expect(cameRound).toBe(true); // and came round for another run
    }
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

// A seeded random, so the rotation tests are the same every run.
const seeded = (seed = 7) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

// A pursuer that chases you nose-first, as a pirate does.
function chase(p: NpcShip, me: PlayerShip, dt: number) {
  p.ship.steer(dt, { ...steerTowards(p.obj, me.obj.position), throttle: 0, speedStep: 0, aimDx: 0, aimDy: 0, fire: false, active: false });
  p.ship.speed = 230;
  p.ship.move(dt);
}

describe('the combat computer knows who is after you', () => {
  it('turns on the ship that is hurting you, not the one in front', () => {
    const me = cobra();
    me.speed = 200;
    const ahead = npc('pirate', 0, 1200, true);
    const behind = npc('pirate', 0, -500, true);
    behind.obj.lookAt(0, 0, 0); // nose on you
    const pilot = new CombatPilot(seeded());
    pilot.fly(1 / 60, me, [ahead, behind], null, undefined, { heat: 0, hitBy: behind, hitAgo: 0.5 });
    expect(pilot.target).toBe(behind);
    expect(['break', 'scissors', 'jink']).toContain(pilot.mode);
    expect(pilot.announce).toMatch(/Cobra Mk III firing on you/);
  });

  it('never answers a tail with the same move twice running', () => {
    const pilot = new CombatPilot(seeded(3));
    const me = cobra();
    me.speed = 200;
    const behind = npc('pirate', 0, -400, true);
    behind.obj.lookAt(0, 0, 0);
    const moves: string[] = [];
    for (let i = 0; i < 60 * 30; i++) {
      pilot.fly(1 / 60, me, [behind], null, undefined, { heat: 0, hitBy: behind, hitAgo: 0.2 });
      // Keep it on your tail whatever you do, to see every answer.
      behind.obj.position.copy(me.obj.position).addScaledVector(me.forward(), -400);
      behind.obj.lookAt(me.obj.position);
      me.move(1 / 60);
      if (moves[moves.length - 1] !== pilot.mode) moves.push(pilot.mode);
    }
    const defences = moves.filter((m) => m !== 'attack');
    expect(new Set(defences).size).toBeGreaterThanOrEqual(2);
    for (let i = 1; i < defences.length; i++) expect(defences[i]).not.toBe(defences[i - 1]);
  });

  it('extends to let the shields come back, then comes round', () => {
    const me = cobra();
    me.speed = 200;
    me.shields = me.def.stats.shields * 0.2;
    const pirate = npc('pirate', 0, 2500, true);
    pirate.obj.lookAt(0, 0, 10000); // facing away: no threat
    const pilot = new CombatPilot(seeded());
    pilot.fly(1 / 60, me, [pirate], null, undefined, { heat: 0, hitBy: null, hitAgo: Infinity });
    expect(pilot.mode).toBe('extend');
    me.shields = me.def.stats.shields;
    pilot.fly(1 / 60, me, [pirate], null, undefined, { heat: 0, hitBy: null, hitAgo: Infinity });
    expect(pilot.mode).toBe('attack');
  });

  it('spoils a pursuer\'s aim far more than flying straight would', () => {
    // How long a chasing pirate has you in its sights over 12 s: the computer against running straight.
    const sighted = (fly: (me: PlayerShip, behind: NpcShip, i: number) => void, seed: number) => {
      const me = cobra();
      me.speed = 200;
      const behind = npc('pirate', 0, -600, true);
      behind.obj.lookAt(0, 0, 0);
      let frames = 0;
      for (let i = 0; i < 60 * 12; i++) {
        fly(me, behind, i);
        me.move(1 / 60);
        chase(behind, me, 1 / 60);
        const to = me.obj.position.clone().sub(behind.obj.position);
        if (behind.ship.forward().angleTo(to) < THREE.MathUtils.degToRad(8) && to.length() < 1000) frames++;
      }
      return frames + seed * 0;
    };
    const straight = sighted((me) => (me.speed = me.maxSpeed), 0);
    for (let seed = 1; seed <= 8; seed++) {
      const pilot = new CombatPilot(seeded(seed));
      const flown = sighted((me, behind) => pilot.fly(1 / 60, me, [behind], null, undefined, { heat: 0, hitBy: behind, hitAgo: 0 }), seed);
      expect(flown).toBeLessThan(straight * 0.7);
    }
  });
});
