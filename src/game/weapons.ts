import * as THREE from 'three';
import { disposeObject, neoLines, registerParts, retroLines, unregisterParts } from '../render/wire';

// Lasers are instant-hit, as in the original: what's under the crosshair when
// you fire is what you hit. Beams are drawn for a moment for feedback.

export interface Laser {
  name: string;
  /** Seconds between pulses. */
  interval: number;
  damage: number;
  range: number;
  /** Temperature added per pulse (overheats at 100). */
  heat: number;
  /** Temperature lost per second. */
  cooling: number;
  color: string;
}

export const PULSE_LASER: Laser = {
  name: 'Pulse laser',
  interval: 0.2,
  damage: 14,
  range: 3000,
  heat: 6,
  cooling: 16,
  color: '#3dffb0',
};

export type LaserId = 'pulse' | 'beam' | 'military';

export interface LaserForSale extends Laser {
  id: LaserId;
  price: number;
  /** Only sold at stations with at least this tech level. */
  minTech: number;
  blurb: string;
}

/**
 * The lasers a commander can buy. Damage per second: pulse 70, beam 90,
 * military 130. Beams heat up fastest; military lasers run coolest.
 */
export const PLAYER_LASERS: Record<LaserId, LaserForSale> = {
  pulse: { ...PULSE_LASER, id: 'pulse', price: 400, minTech: 3, blurb: 'Short, sharp pulses. Cheap and dependable.' },
  beam: {
    id: 'beam', name: 'Beam laser', interval: 0.1, damage: 9, range: 3200, heat: 4.2, cooling: 16, color: '#5ad8ff',
    price: 1000, minTech: 6, blurb: 'A near-continuous beam. More punch, but watch the temperature.',
  },
  military: {
    id: 'military', name: 'Military laser', interval: 0.1, damage: 13, range: 3600, heat: 3.4, cooling: 18, color: '#c78bff',
    price: 6000, minTech: 10, blurb: 'Navy issue: hits hardest, runs coolest, and costs accordingly.',
  },
};

export const POLICE_LASER: Laser = {
  name: 'Pulse laser',
  interval: 0.45,
  damage: 8,
  range: 2000,
  heat: 0,
  cooling: 0,
  color: '#ff4d6d',
};

export const MARSHAL_LASER: Laser = {
  name: 'Beam laser',
  interval: 0.35,
  damage: 9,
  range: 2400,
  heat: 0,
  cooling: 0,
  color: '#ffd98a',
};

export const PIRATE_LASER: Laser = {
  name: 'Pulse laser',
  interval: 0.5,
  damage: 7,
  range: 1800,
  heat: 0,
  cooling: 0,
  color: '#ff9a3d',
};

/** The Falcon's twin beams, one on each vane, firing together (docs/design/legends-the-falcon.md): 40 a second between them, well above a pirate's and below a commander's beam. Her flying is what makes her dangerous. */
export const FALCON_LASER: Laser = {
  name: 'Solo & Sons beam laser',
  interval: 0.25,
  damage: 5, // each
  range: 3000,
  heat: 0,
  cooling: 0,
  color: '#ff4d6d',
};

export const TRADER_LASER: Laser = { ...PIRATE_LASER, interval: 0.8, damage: 5, color: '#ffe08a' };

export interface Target<T> {
  value: T;
  position: THREE.Vector3;
  radius: number;
}

/** Nearest target whose (approximate) sphere the ray passes through. */
export function rayHit<T>(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  range: number,
  targets: Target<T>[],
): { target: Target<T>; distance: number; point: THREE.Vector3 } | null {
  let best: { target: Target<T>; distance: number; point: THREE.Vector3 } | null = null;
  const toTarget = new THREE.Vector3();
  for (const t of targets) {
    toTarget.copy(t.position).sub(origin);
    const along = toTarget.dot(dir);
    if (along < 0 || along > range) continue;
    const missBy = toTarget.addScaledVector(dir, -along).length();
    if (missBy > t.radius) continue;
    const distance = along - Math.sqrt(t.radius * t.radius - missBy * missBy);
    if (!best || distance < best.distance) {
      best = { target: t, distance, point: origin.clone().addScaledVector(dir, distance) };
    }
  }
  return best;
}

/** Short-lived beam graphics. */
export class Beams {
  private readonly live: { group: THREE.Group; parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] }; age: number }[] = [];

  constructor(private readonly scene: THREE.Scene) {}

  fire(from: THREE.Vector3, to: THREE.Vector3, color: string) {
    const pos = [from.x, from.y, from.z, to.x, to.y, to.z];
    const neo = neoLines(pos, new THREE.Color(color).multiplyScalar(2.2), 3);
    neo.material.transparent = true;
    const retro = retroLines(pos);
    const group = new THREE.Group();
    group.add(neo, retro);
    const parts = { neo: [neo], retro: [retro] };
    registerParts(parts);
    this.scene.add(group);
    this.live.push({ group, parts, age: 0 });
  }

  update(dt: number) {
    for (let i = this.live.length - 1; i >= 0; i--) {
      const b = this.live[i];
      b.age += dt;
      const neo = b.group.children[0] as ReturnType<typeof neoLines>;
      neo.material.opacity = Math.max(0, 1 - b.age / 0.12);
      if (b.age > 0.12) {
        unregisterParts(b.parts);
        disposeObject(b.group);
        this.live.splice(i, 1);
      }
    }
  }
}
