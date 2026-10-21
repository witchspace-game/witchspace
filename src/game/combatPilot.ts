import * as THREE from 'three';
import { steerTowards, type NpcShip } from './npc';
import type { PlayerShip } from './playerShip';

// The combat computer (Modern rules, needs a turret): flies your ship in a
// fight so you can work the guns. It flies the way the NPCs do, with the
// same physics and a textbook chase: close in, pass, break away, come round
// again. That makes it predictable, so a good pilot beats it, and kills
// made with it on count for half towards the combat rating.

export const PILOT_RANGE = 6000; // metres: it fights ships this close
const BREAKOFF_RANGE = 450; // metres: peel away early (two ships close fast)
const BREAKOFF_TIME = 2.4; // seconds, at least, before coming round again
const BREAKOFF_CLEAR = 900; // metres: open the range this far first, so the next run is a real one
const BREAKOFF_MAX = 6; // seconds: come round by then regardless
const LEAD = 0.15; // seconds: aim where the target will be
const CLOSE = 900; // metres: slow down to fight inside this
const ACCEL = 80; // m/s per second
const PLANET_MARGIN = 1.25; // planet radii: turn away inside this

export interface Planet {
  centre: THREE.Vector3;
  radius: number;
}

/**
 * Who to fight: the ship your missile is locked on, if it's close enough;
 * otherwise the nearest ship that's after you; otherwise the nearest pirate.
 */
export function chooseTarget(at: THREE.Vector3, npcs: NpcShip[], locked: NpcShip | null): NpcShip | null {
  const near = (n: NpcShip) => n.obj.position.distanceTo(at) < PILOT_RANGE;
  if (locked && npcs.includes(locked) && near(locked)) return locked;
  const by = (pick: (n: NpcShip) => boolean) =>
    npcs.filter((n) => pick(n) && near(n)).sort((a, b) => a.obj.position.distanceTo(at) - b.obj.position.distanceTo(at))[0] ?? null;
  return by((n) => n.hostile) ?? by((n) => n.role === 'pirate');
}

export class CombatPilot {
  target: NpcShip | null = null;
  mode: 'attack' | 'breakoff' = 'attack';
  private breakTimer = 0;
  private readonly breakDir = new THREE.Vector3();

  /**
   * Fly the ship for one frame against the best target. Returns false when
   * there's nothing left to fight.
   */
  fly(dt: number, ship: PlayerShip, npcs: NpcShip[], locked: NpcShip | null, planet?: Planet): boolean {
    const at = ship.obj.position;
    if (!this.target || !npcs.includes(this.target) || this.target.obj.position.distanceTo(at) > PILOT_RANGE * 1.2) {
      this.target = chooseTarget(at, npcs, locked);
      this.mode = 'attack';
    }
    const target = this.target;
    if (!target) return false;

    const to = target.obj.position.clone().sub(at);
    const dist = to.length();
    let aimAt: THREE.Vector3;
    let speed = ship.maxSpeed;
    if (this.mode === 'attack') {
      if (dist < BREAKOFF_RANGE) {
        this.mode = 'breakoff';
        this.breakTimer = BREAKOFF_TIME;
        // Peel away to the side and back from the target, never past it:
        // a random direction square to the line between the ships, plus some away.
        const away = to.clone().normalize().negate();
        const side = new THREE.Vector3().randomDirection().projectOnPlane(away).normalize();
        this.breakDir.copy(side).addScaledVector(away, 0.6).normalize();
      }
      aimAt = target.obj.position.clone().addScaledVector(target.ship.forward(), target.ship.speed * LEAD);
      if (dist < CLOSE) speed = ship.maxSpeed * 0.65;
    } else {
      this.breakTimer -= dt;
      if ((this.breakTimer <= 0 && dist > BREAKOFF_CLEAR) || this.breakTimer <= BREAKOFF_TIME - BREAKOFF_MAX) this.mode = 'attack';
      aimAt = at.clone().addScaledVector(this.breakDir, 1000);
    }
    // Never fly into the planet chasing someone.
    if (planet) {
      const fromPlanet = at.clone().sub(planet.centre);
      if (fromPlanet.length() < planet.radius * PLANET_MARGIN && ship.forward().dot(fromPlanet) < 0) aimAt = at.clone().add(fromPlanet.setLength(1000));
    }

    ship.steer(dt, { ...steerTowards(ship.obj, aimAt), throttle: 0, speedStep: 0, aimDx: 0, aimDy: 0, fire: false, active: false });
    ship.speed += THREE.MathUtils.clamp(speed - ship.speed, -ACCEL * dt, ACCEL * dt);
    return true;
  }
}
