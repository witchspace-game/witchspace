// What the server checks before it passes your position on (stage 1):
// you can't fly faster than your ship can, or teleport, except for the
// in-system jump, which has a cooldown. Anything else is refused and you're
// put back where you were.

import { JUMP, JUMP_COOLDOWN, LASERS, MISSILE, SHIELD_RECHARGE, SHIPS, SLACK, SPREAD, SYSTEM_RADIUS, type Vec3 } from './protocol';

export interface Track {
  p: Vec3;
  /** When this position was accepted (ms). */
  t: number;
  /** When the last jump was (ms). */
  jumpedAt: number;
}

export type Verdict = 'ok' | 'jump' | 'speeding' | 'teleport' | 'out of bounds';

const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

export function checkMove(ship: string, track: Track | null, p: Vec3, s: number, now: number): Verdict {
  const max = SHIPS[ship]?.maxSpeed ?? 0;
  if (Math.hypot(...p) > SYSTEM_RADIUS) return 'out of bounds';
  if (s < 0 || s > max * SLACK) return 'speeding';
  if (!track) return 'ok';
  const moved = dist(track.p, p);
  const dt = Math.max(0.05, (now - track.t) / 1000);
  if (moved <= max * SLACK * dt + 50) return 'ok';
  if (moved <= JUMP + max * SLACK * dt && now - track.jumpedAt >= JUMP_COOLDOWN) return 'jump';
  return 'teleport';
}

// --- Lasers -------------------------------------------------------------------
// The shooter only says "I fired, this way, with this laser". The server checks
// they could have, then works out what it hit, judging each target where the
// shooter saw it (a moment in the past) and adding the laser's own scatter.

export interface Sample {
  t: number; // ms
  p: Vec3;
}

/** Where a commander was at time `t`, from their recent accepted positions. */
export function positionAt(history: Sample[], t: number): Vec3 | null {
  if (!history.length) return null;
  if (t <= history[0].t) return history[0].p;
  for (let i = 1; i < history.length; i++) {
    const a = history[i - 1];
    const b = history[i];
    if (t <= b.t) {
      const k = (t - a.t) / Math.max(1, b.t - a.t);
      return [a.p[0] + (b.p[0] - a.p[0]) * k, a.p[1] + (b.p[1] - a.p[1]) * k, a.p[2] + (b.p[2] - a.p[2]) * k];
    }
  }
  return history[history.length - 1].p;
}

/** Whether a shot is allowed: a laser that's fitted, and no faster than it fires. */
export function canFire(laser: string, fitted: string[], lastShotAt: number, now: number): boolean {
  const l = LASERS[laser];
  return Boolean(l) && fitted.includes(laser) && now - lastShotAt >= l.interval * 1000 * 0.85;
}

const unit = (v: Vec3): Vec3 | null => {
  const n = Math.hypot(...v);
  return n > 0.5 && n < 1.5 ? [v[0] / n, v[1] / n, v[2] / n] : null;
};

/** Nudge a direction by up to `spread` radians, at random. */
function scatter(d: Vec3, spread: number, random: () => number): Vec3 {
  const j: Vec3 = [d[0] + (random() * 2 - 1) * spread, d[1] + (random() * 2 - 1) * spread, d[2] + (random() * 2 - 1) * spread];
  return unit(j) ?? d;
}

export interface ShotTarget {
  id: string;
  p: Vec3;
  radius: number;
}

/** The nearest target a laser shot hits, if any. */
export function resolveShot(origin: Vec3, direction: Vec3, range: number, targets: ShotTarget[], random = Math.random): string | null {
  const u = unit(direction);
  if (!u) return null;
  const d = scatter(u, SPREAD, random);
  let best: string | null = null;
  let bestT = range;
  for (const t of targets) {
    const o: Vec3 = [t.p[0] - origin[0], t.p[1] - origin[1], t.p[2] - origin[2]];
    const along = o[0] * d[0] + o[1] * d[1] + o[2] * d[2];
    if (along < 0 || along > bestT) continue;
    const off = Math.hypot(o[0] - d[0] * along, o[1] - d[1] * along, o[2] - d[2] * along);
    if (off <= t.radius) {
      best = t.id;
      bestT = along;
    }
  }
  return best;
}

export interface Health {
  shields: number;
  hull: number;
  /** When shields were last worked out (ms). */
  at: number;
}

/** Shields recharge as they do in the game. */
export function recharge(h: Health, maxShields: number, now: number): Health {
  return { ...h, shields: Math.min(maxShields, h.shields + ((now - h.at) / 1000) * SHIELD_RECHARGE), at: now };
}

/** Take a hit: shields first, then the hull. Returns the new health, and whether that destroyed the ship. */
export function takeHit(h: Health, damage: number): { health: Health; destroyed: boolean } {
  const absorbed = Math.min(h.shields, damage);
  const health = { ...h, shields: h.shields - absorbed, hull: h.hull - (damage - absorbed) };
  return { health, destroyed: health.hull <= 0 };
}

/** The browser reports its own health (NPC damage happens there): accept it only if it's no better than ours. */
export function reportHealth(h: Health, reported: unknown, maxShields: number, now: number): Health {
  const r = recharge(h, maxShields, now);
  if (!Array.isArray(reported) || reported.length !== 2 || !reported.every((n) => typeof n === 'number' && Number.isFinite(n))) return r;
  return { shields: Math.max(0, Math.min(r.shields, reported[0])), hull: Math.max(0, Math.min(r.hull, reported[1])), at: now };
}

// --- Collisions -----------------------------------------------------------------
// Ships report where they are ten times a second, and two fast ships can close
// 50 m or more between reports, so we check the whole path since the last one,
// not just where they ended up.

/** The closest two ships came while one moved from `a0` to `a1` past the other at `b`. */
export function closestApproach(a0: Vec3, a1: Vec3, b: Vec3): number {
  const d: Vec3 = [a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]];
  const w: Vec3 = [b[0] - a0[0], b[1] - a0[1], b[2] - a0[2]];
  const len2 = d[0] * d[0] + d[1] * d[1] + d[2] * d[2];
  const k = len2 > 0 ? Math.max(0, Math.min(1, (w[0] * d[0] + w[1] * d[1] + w[2] * d[2]) / len2)) : 0;
  return Math.hypot(a0[0] + d[0] * k - b[0], a0[1] + d[1] * k - b[1], a0[2] + d[2] * k - b[2]);
}

/** Damage to each ship in a collision: a knock at low speed, serious head on. */
export const collisionDamage = (closing: number) => Math.round(10 + Math.max(0, closing) * 0.1);

// --- Missiles -----------------------------------------------------------------
// Flown by the server, exactly as the game flies them: off the rail, speeding
// up, turning towards the target at a limited rate (a hard break can still
// shake one), and exploding within the fuse distance.

export interface Flight {
  p: Vec3;
  /** Unit direction of travel. */
  d: Vec3;
  s: number;
  age: number;
}

const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: Vec3, b: Vec3): Vec3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];

/** Rotate `v` about unit `axis` by `angle` (Rodrigues). */
function turn(v: Vec3, axis: Vec3, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const k = cross(axis, v);
  const kd = dot(axis, v) * (1 - c);
  return [v[0] * c + k[0] * s + axis[0] * kd, v[1] * c + k[1] * s + axis[1] * kd, v[2] * c + k[2] * s + axis[2] * kd];
}

/** Fly a missile for `dt` seconds towards `target` (or straight on without one). */
export function stepMissile(m: Flight, target: Vec3 | null, dt: number): 'flying' | 'hit' | 'expired' {
  m.age += dt;
  if (m.age > MISSILE.lifetime) return 'expired';
  m.s = Math.min(MISSILE.maxSpeed, m.s + MISSILE.acceleration * dt);
  if (target) {
    const want: Vec3 = [target[0] - m.p[0], target[1] - m.p[1], target[2] - m.p[2]];
    const dist = Math.hypot(...want);
    if (dist < MISSILE.fuse) return 'hit';
    const w: Vec3 = [want[0] / dist, want[1] / dist, want[2] / dist];
    const angle = Math.acos(Math.max(-1, Math.min(1, dot(m.d, w))));
    if (angle > 1e-4) {
      let axis = cross(m.d, w);
      const len = Math.hypot(...axis);
      axis = len < 1e-9 ? [0, 1, 0] : [axis[0] / len, axis[1] / len, axis[2] / len];
      const d = turn(m.d, axis, Math.min(angle, MISSILE.turnRate * dt));
      const n = Math.hypot(...d);
      m.d = [d[0] / n, d[1] / n, d[2] / n];
    }
  }
  m.p = [m.p[0] + m.d[0] * m.s * dt, m.p[1] + m.d[1] * m.s * dt, m.p[2] + m.d[2] * m.s * dt];
  return 'flying';
}
