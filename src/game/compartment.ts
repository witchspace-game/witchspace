import type { StarSystem } from '../galaxy/generate';
import { commodityById } from '../economy/commodities';
import type { Commander } from './commander';
import { COMPANIES, type CompanyId } from './companies';
import type { Contract } from './contracts';

// Shielded compartments (Modern rules), as set out in
// docs/design/companies-and-contracts.md, section 2b (Mark's idea). A
// company's special cargo is contraband where its contents are illegal, so
// the company fits a shielded compartment for the job, and you keep it. Its
// papers re-register part of your hold as structure, so a scan sees a normal
// hold: whatever the law objects to, up to its size, isn't found. Strict
// stations weigh ships, though, and a weighbridge can give it away.

export const COMPARTMENT_TONNES = 4;
/** At a station that weighs ships, the chance it notices one carrying more than its papers say. */
export const WEIGHBRIDGE_CHANCE = 0.2;
/** Democracies and Corporate States weigh ships at the dock. */
export const weighsShips = (s: StarSystem) => s.government >= 6;

/** Where each company's special cargo is against the law. The Mutual's relief supplies never are. */
const BANNED: Record<CompanyId, (government: number) => boolean> = {
  vorg: (g) => g >= 2, // crates that tick, anywhere police scan
  wy: (g) => g >= 4, // live samples, where the law is strict
  hexon: (g) => g === 6, // class-4 biologicals: democracies object; corporate states don't ask
  mutual: () => false,
};

export const bannedSpecial = (a: Contract, s: StarSystem) => Boolean(a.special) && BANNED[a.company](s.government);

/** Taking a special assignment: the company fits a compartment, if the ship hasn't one. Returns a line for the player. */
export function fitCompartment(c: Commander, a: Contract): string | null {
  if (!a.special || a.company === 'mutual' || c.compartment) return null;
  c.compartment = { company: a.company, tonnes: COMPARTMENT_TONNES };
  return `${COMPANIES[a.company].name} fitted a shielded compartment (${COMPARTMENT_TONNES} t of your hold) for the job · it's yours to keep`;
}

/** Tonnes the compartment hides from a scan. */
export const shieldedTonnes = (c: Commander) => c.compartment?.tonnes ?? 0;

/**
 * How much of what's aboard the law here objects to, in tonnes: the given
 * goods (contraband and stolen) and any banned company cargo. Goods sold by
 * the kilogram or gram count at their weight, so they're easy to hide but
 * still found without a compartment.
 */
export function objectionableTonnes(c: Commander, s: StarSystem, goods: string[]): number {
  const tonnes = goods.reduce((t, id) => {
    const q = c.cargo[id] ?? 0;
    const unit = commodityById(id)?.unit;
    return t + (unit === 't' ? q : unit === 'kg' ? q / 1000 : q / 1_000_000);
  }, 0);
  return tonnes + (c.contracts ?? []).filter((a) => !a.adrift && bannedSpecial(a, s)).reduce((t, a) => t + a.qty, 0);
}

