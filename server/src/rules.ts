// What the server checks before it passes your position on (stage 1):
// you can't fly faster than your ship can, or teleport, except for the
// in-system jump, which has a cooldown. Anything else is refused and you're
// put back where you were.

import { JUMP, JUMP_COOLDOWN, SHIPS, SLACK, SYSTEM_RADIUS, type Vec3 } from './protocol';

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
