// First discoveries: the claims the server accepts (accounts.ts keeps the records).
// Honest claims (docs/design/exploration.md, "Fairness and pacing"): every claim
// is checked against the galaxy's seed, and an account can only win firsts at
// a human pace, so a script can't name the galaxy the day it ships.

import { isRealFind } from '../../src/game/explore';

/** At most a hold's worth of data claimed at once. */
export const MAX_CLAIMS = 60;

/** The body names the game uses: the planet, the star, moons, signals, trail steps and the lost courier. */
const BODY = /^(planet|star|moon[0-4]|poi[0-3]|courier|trail:[0-7]\.\d{1,2}:[0-4])$/;

/** Firsts one account can win: a keen explorer brings home 25–35 an hour, in bursts when they dock. */
export const PACE = { hour: 60, day: 300 };

/** A claim that makes sense: a real system and a body the game has. */
export function isClaim(c: unknown): c is { galaxy: number; system: number; body: string } {
  if (!c || typeof c !== 'object') return false;
  const { galaxy, system, body } = c as Record<string, unknown>;
  return Number.isInteger(galaxy) && (galaxy as number) >= 0 && (galaxy as number) <= 7 && Number.isInteger(system) && (system as number) >= 0 && (system as number) <= 255 && typeof body === 'string' && BODY.test(body);
}

/** A claim the galaxy bears out: the right shape, and that moon, signal or trail step really is in that system. */
export const isRealClaim = (c: unknown): c is { galaxy: number; system: number; body: string } => isClaim(c) && isRealFind(c.galaxy, c.system, c.body);

/** How many more firsts an account may win now, given how many it won in the last hour and day. */
export const allowance = (lastHour: number, lastDay: number) => Math.max(0, Math.min(PACE.hour - lastHour, PACE.day - lastDay));
