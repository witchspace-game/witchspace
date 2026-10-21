import type { Commander } from '../game/commander';
import type { StarSystem } from '../galaxy/generate';
import { commodityById } from './commodities';

// What's legal where, as set out in docs/design/markets-and-trade.md
// (section 3). Under Modern rules each government has its own laws on
// firearms, narcotics and slaves; firearms may need a weapons licence.
// Classic keeps the 1984 rule: illegal goods are illegal everywhere, and
// only the lawful stations refuse to trade them.

export type Legality = 'legal' | 'licensed' | 'illegal';

// By government: Anarchy, Feudal, Multi-Government, Dictatorship, Communist,
// Confederacy, Democracy, Corporate State.
const L = 'legal';
const LIC = 'licensed';
const X = 'illegal';
const LAWS: Record<string, Legality[]> = {
  firearms: [L, L, LIC, LIC, X, LIC, LIC, X],
  narcotics: [L, X, X, X, X, X, X, X],
  slaves: [L, L, X, X, X, X, X, X],
};

/** A good's legal status at a system, under the commander's rules. */
export function legalityAt(system: StarSystem, id: string, difficulty: 'classic' | 'modern'): Legality {
  if (difficulty === 'classic') return commodityById(id)?.legality === 'illegal' ? X : L;
  return LAWS[id]?.[system.government] ?? L;
}

export const hasLicence = (c: Commander) => c.equipment.includes('weapons-licence');

/** Stolen goods in the hold, where there's a law to care. */
export function stolenAt(c: Commander, system: StarSystem): string[] {
  if (c.difficulty === 'classic' || system.government === 0) return [];
  return Object.keys(c.stolen ?? {}).filter((id) => Math.min(c.stolen![id], c.cargo[id] ?? 0) > 0);
}

/** Goods in the hold that are against the law here: illegal ones, and licensed ones without a licence. */
export function contrabandAt(c: Commander, system: StarSystem): string[] {
  return Object.keys(c.cargo).filter((id) => {
    if (c.cargo[id] <= 0) return false;
    const l = legalityAt(system, id, c.difficulty);
    return l === X || (l === LIC && !hasLicence(c));
  });
}

/** Whether the station itself will trade a good with this commander. */
export function stationTrades(c: Commander, system: StarSystem, id: string): boolean {
  if (c.difficulty === 'classic') return !(commodityById(id)?.legality === 'illegal' && system.government >= 5);
  const l = legalityAt(system, id, c.difficulty);
  return l === L || (l === LIC && hasLicence(c));
}

/**
 * The chance a lawful station inspects your hold when you dock. Classic:
 * every time, as before. Modern: often but not always, so smuggling is a
 * gamble rather than a certainty.
 */
export function inspectionChance(c: Commander, system: StarSystem): number {
  if (system.government < 4) return 0;
  if (c.difficulty === 'classic') return system.government >= 5 ? 1 : 0;
  return [0, 0, 0, 0, 0.6, 0.5, 0.65, 0.8][system.government];
}
