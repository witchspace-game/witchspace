// First discoveries: the claims the server accepts (accounts.ts keeps the records).

/** At most a hold's worth of data claimed at once. */
export const MAX_CLAIMS = 60;

/** The body names the game uses: the planet, the star, moons, signals, trail steps and the lost courier. */
const BODY = /^(planet|star|moon[0-4]|poi[0-3]|courier|trail:[0-7]\.\d{1,2}:[0-4])$/;

/** A claim that makes sense: a real system and a body the game has. */
export function isClaim(c: unknown): c is { galaxy: number; system: number; body: string } {
  if (!c || typeof c !== 'object') return false;
  const { galaxy, system, body } = c as Record<string, unknown>;
  return Number.isInteger(galaxy) && (galaxy as number) >= 0 && (galaxy as number) <= 7 && Number.isInteger(system) && (system as number) >= 0 && (system as number) <= 255 && typeof body === 'string' && BODY.test(body);
}
