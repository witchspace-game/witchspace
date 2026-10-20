import * as THREE from 'three';
import type { PlayerShip } from './playerShip';
import { SLOT, type Station } from './station';

const TURN_RATE = 1.4; // rad/s
const FINAL_SPEED = 70; // m/s
const APPROACH_Z = 520; // start of the final approach, on the slot axis

/**
 * Flies the ship in. It first heads for a point on the slot's axis (going
 * around the station if needed), then turns to face the slot, matches its
 * spin and drifts in along the axis. Real docking computers cheat a little;
 * so does this one, by nudging the ship onto the centre line.
 */
export class DockingComputer {
  private phase: 'approach' | 'final' = 'approach';
  private readonly aim = new THREE.Object3D();

  reset() {
    this.phase = 'approach';
  }

  update(dt: number, ship: PlayerShip, station: Station) {
    ship.centreControls();
    const pos = ship.obj.position;
    const local = station.toLocal(pos);
    const radial = Math.hypot(local.x, local.y);
    this.aim.position.copy(pos);
    this.aim.up.copy(station.axis('y'));

    if (this.phase === 'approach' && local.z > 300 && local.z < APPROACH_Z + 250 && radial < 90) {
      this.phase = 'final';
    }

    let targetSpeed: number;
    if (this.phase === 'approach') {
      let waypoint: THREE.Vector3;
      if (local.z < 250) {
        // Beside or behind the station: swing wide around it first.
        const side = new THREE.Vector2(local.x, local.y);
        if (side.lengthSq() < 1) side.set(1, 0);
        side.setLength(520);
        waypoint = station.toWorld(new THREE.Vector3(side.x, side.y, 450));
      } else {
        waypoint = station.toWorld(new THREE.Vector3(0, 0, APPROACH_Z));
      }
      this.aim.lookAt(waypoint);
      const dist = waypoint.distanceTo(pos);
      targetSpeed = THREE.MathUtils.clamp(dist * 0.4, FINAL_SPEED, ship.maxSpeed * 0.8);
    } else {
      this.aim.lookAt(pos.clone().sub(station.axis('z')));
      const onAxis = station.toWorld(new THREE.Vector3(0, 0, local.z));
      pos.lerp(onAxis, Math.min(1, dt * 1.5));
      targetSpeed = local.z < SLOT.z + 200 ? FINAL_SPEED * 0.8 : FINAL_SPEED;
    }

    ship.obj.quaternion.rotateTowards(this.aim.quaternion, TURN_RATE * dt);
    ship.speed += THREE.MathUtils.clamp(targetSpeed - ship.speed, -120 * dt, 120 * dt);
  }
}
