import * as THREE from 'three';
import { turnAt, turnRateTowards } from './dockingComputer';
import type { PlayerShip } from './playerShip';

/** Somewhere the survey autopilot can go: a point to reach, and how close counts as there. */
export interface SurveyGoal {
  point: THREE.Vector3;
  /** Metres from `point` that count as arrived (in survey range, or close enough to a signal). */
  within: number;
}

/** Something to steer around: the planet. */
export interface Obstacle {
  centre: THREE.Vector3;
  radius: number;
}

const CLEARANCE = 1.25; // planet radii a route must keep clear of the centre
const WAYPOINT = 1.45; // planet radii out, where a route around the planet bends

/**
 * The Survey Autopilot (explorers, Pathfinder and up): flies to a goal, round
 * the planet if it's in the way, and holds still once there. Like the docking
 * computer it only ever moves the ship along its nose. Says when it's lined up
 * for a long straight run, so the caller can use an in-system jump.
 */
export class SurveyPilot {
  private readonly angVel = new THREE.Vector3();
  private readonly aim = new THREE.Object3D();

  /** Fly towards the goal. Returns how far to go, and whether the nose is on it (for a jump). */
  update(dt: number, ship: PlayerShip, goal: SurveyGoal, planet: Obstacle): { left: number; lined: boolean; there: boolean } {
    const pos = ship.obj.position;
    const left = pos.distanceTo(goal.point) - goal.within;
    const there = left <= 0;
    const target = there ? goal.point : routeAround(pos, goal.point, planet);
    this.aim.position.copy(pos);
    this.aim.up.copy(ship.obj.up);
    this.aim.lookAt(target);
    turnAt(dt, ship, turnRateTowards(ship, this.aim.quaternion), this.angVel);
    const facing = ship.forward().dot(target.clone().sub(pos).normalize());
    // Ease in: slow while turning, slower as the goal nears, stopped once there.
    const want = there ? 0 : THREE.MathUtils.clamp(left * 0.25, 40, ship.maxSpeed) * THREE.MathUtils.clamp((facing + 0.2) / 1.2, 0.15, 1);
    ship.speed += THREE.MathUtils.clamp(want - ship.speed, -80 * dt, 60 * dt);
    return { left, lined: facing > 0.998 && target === goal.point, there };
  }
}

/** The goal, or a waypoint beside the planet if the straight line would cross it. */
export function routeAround(from: THREE.Vector3, to: THREE.Vector3, planet: Obstacle): THREE.Vector3 {
  const line = to.clone().sub(from);
  const len = line.length();
  if (len < 1) return to;
  const dir = line.divideScalar(len);
  const along = THREE.MathUtils.clamp(planet.centre.clone().sub(from).dot(dir), 0, len);
  const closest = from.clone().addScaledVector(dir, along);
  const off = closest.clone().sub(planet.centre);
  if (off.length() >= planet.radius * CLEARANCE) return to;
  // Bend out past the planet's edge, on the side the line already passes.
  if (off.lengthSq() < 1) off.copy(new THREE.Vector3(0, 1, 0).cross(dir).lengthSq() > 1e-6 ? new THREE.Vector3(0, 1, 0).cross(dir) : new THREE.Vector3(1, 0, 0));
  return planet.centre.clone().add(off.setLength(planet.radius * WAYPOINT));
}
