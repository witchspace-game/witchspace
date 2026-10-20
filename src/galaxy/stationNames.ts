import data from '../../content/station-names.json';
import type { StarSystem } from './generate';

// Every system's station has a name, chosen from community content by the
// system's data, so it's the same for every commander.

export interface StationName {
  name: string;
  /** Who or what the name honours, if anyone. */
  honours: string;
}

export function stationName(system: StarSystem): StationName {
  const special = (data.special as Record<string, StationName>)[`${system.galaxy}:${system.index}`];
  if (special) return special;
  const [a, b, c, d] = system.extraSeed;
  const pick = (a * 31 + c * 7 + system.index * 13 + system.galaxy * 101) % data.names.length;
  const suffix = data.suffixes[(b + d + system.galaxy) % data.suffixes.length];
  const entry = data.names[pick];
  return { name: `${entry.name} ${suffix}`, honours: entry.honours };
}
