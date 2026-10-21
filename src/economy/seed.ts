import type { StarSystem } from '../galaxy/generate';

/** A stable pseudo-random number in [0, 1) from a system, a salt and an index. */
export function hash(system: StarSystem, salt: number, index: number): number {
  const [a, b, c, d] = system.extraSeed;
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761) ^ (salt * 97) ^ (index * 1013);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
