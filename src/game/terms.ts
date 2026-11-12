// A company's terms (Mark, 12 November 2026): "There should be some advantages to becoming a
// contractor, and therefore you have to earn your way. Once you become a contractor, it should be
// advantageous"; "Would Vorg punish you the same way [the] Mutual would?"; and "This would protect
// and make players think twice because they want to maintain their contractor status, so they
// wouldn't engage frivolously in combat." See docs/design/companies-and-contracts.md, "Terms".
//
// Rank pays: more on every job, and hazard pay from Contractor up. Valuable cargo carries a bond,
// back on delivery. Each company treats a lost cargo, a late one and a deserted one in its own way,
// and a loss in a fight you started is yours: no insurer covers it.

import type { CompanyId, StandingName } from './companies';

/** Ranks with a company, from Casual up (below Casual pays as Casual). */
const RANKED = ['Casual', 'Contractor', 'Trusted', 'Preferred', 'Partner'] as const;
type Ranked = (typeof RANKED)[number];
const ranked = (rank: StandingName): Ranked => ((RANKED as readonly string[]).includes(rank) ? (rank as Ranked) : 'Casual');

/** On every job from the company: the pay, times this. */
export const RANK_PAY: Record<Ranked, number> = { Casual: 1, Contractor: 1.15, Trusted: 1.3, Preferred: 1.5, Partner: 1.75 };

/** Hazard pay at Contractor, a flat sum for the trip by the destination's government (anarchy first): the danger is in going, whatever you carry. */
export const HAZARD = [200, 140, 60, 25, 0, 0, 0, 0];
/** Hazard pay, times this, by rank. None for Casual work. */
export const HAZARD_RANK: Record<Ranked, number> = { Casual: 0, Contractor: 1, Trusted: 1.5, Preferred: 2, Partner: 2.5 };
/** Vorg pays for nerve. */
export const HAZARD_COMPANY: Record<CompanyId, number> = { hexon: 1, vorg: 1.25, mutual: 1, wy: 1 };

/** Carriage per light year, by company: the Mutual pays the miles, Vorg the danger. */
export const CARRIAGE: Record<CompanyId, number> = { hexon: 1, vorg: 0.9, mutual: 1.15, wy: 1 };
/** Hexon pays on value: this much more for valuable cargo. */
export const HEXON_VALUABLE = 1.1;

/** The bond on cargo that needs Contractor or better: a share of its value, back on delivery. */
export const BOND: Record<CompanyId, number> = { hexon: 0.2, vorg: 0.1, mutual: 0.15, wy: 0.15 };
/** Never more than this share of your credits: a loss always hurts, and never ruins anyone. */
export const BOND_CAP = 0.5;
/** The Mutual's members (Contractor and up) pay only this excess on a loss, a share of the cargo's value. */
export const MUTUAL_EXCESS: Record<Ranked, number> = { Casual: 1, Contractor: 0.05, Trusted: 0.04, Preferred: 0.03, Partner: 0.02 };

export interface Terms {
  /** The pay on time, all in. */
  pay: number;
  /** Of it, what your rank adds. */
  rankBonus: number;
  /** Of it, hazard pay. */
  hazard: number;
}

/** What a job pays you, given your rank with its company. `base` is its pay to anyone (Casual). */
export function termsFor(base: number, company: CompanyId, rank: StandingName, government: number): Terms {
  const r = ranked(rank);
  const rankBonus = Math.round(base * (RANK_PAY[r] - 1));
  const hazard = Math.round(HAZARD[government] * HAZARD_RANK[r] * HAZARD_COMPANY[company]);
  return { pay: base + rankBonus + hazard, rankBonus, hazard };
}

/** The bond a job asks: none for Casual work; capped by what you have. */
export function bondFor(value: number, company: CompanyId, needs: StandingName, credits: number): number {
  if (needs === 'Casual' || !value) return 0;
  return Math.max(0, Math.min(Math.round(value * BOND[company]), Math.floor(credits * BOND_CAP)));
}

/** A late delivery: the share of the pay you get, `late` jumps past the deadline (1 and on). */
export function lateShare(company: CompanyId, late: number): number {
  if (company === 'hexon') return Math.max(0.25, 1 - 0.25 * late); // punctual, polite, and unforgiving: a quarter off each jump
  if (company === 'vorg') return late <= 1 ? 1 : 0.5; // a jump late is a jump late; after that, half
  if (company === 'mutual') return 0.75; // the members know how it goes
  return 0.5;
}

/** Standing for a late delivery. */
export const lateStanding = (company: CompanyId) => (company === 'hexon' ? -1 : 0);

/** How a company words a late delivery's pay, for its notices. */
export function lateWords(company: CompanyId): string {
  if (company === 'hexon') return 'a quarter off the pay for each jump late';
  if (company === 'vorg') return 'full pay a jump late, half after that';
  if (company === 'mutual') return 'three quarters of the pay';
  return 'half pay';
}

/** Standing for walking away from a job (abandoned, or never collected). The Mutual takes it hardest. */
export const abandonStanding = (company: CompanyId) => (company === 'mutual' ? -4 : -3);

export interface Loss {
  /** Of the bond, what comes back. */
  refund: number;
  /** Standing change (negative). */
  standing: number;
  /** One line in the company's voice. */
  says: string;
}

/**
 * Cargo lost with your ship. `fault`: you started the fight that lost it (fired first on a ship
 * that wasn't attacking you), and no insurer covers that. `bond` is what you paid; `value` the cargo's worth.
 */
export function lossTerms(company: CompanyId, rank: StandingName, bond: number, value: number, fault: boolean): Loss {
  const r = ranked(rank);
  const member = RANKED.indexOf(r) >= 1;
  if (company === 'vorg') {
    if (fault) return { refund: 0, standing: -3, says: 'You picked that fight with our cargo aboard. The bond is ours.' };
    return { refund: Math.round(bond / 2), standing: -1, says: 'You flew it. That’s what we pay for. Half your bond back.' };
  }
  if (company === 'mutual') {
    if (fault) return { refund: 0, standing: -3, says: 'The pool doesn’t cover a fight you started. The members keep your bond.' };
    if (member) {
      const excess = Math.min(bond, Math.round(value * MUTUAL_EXCESS[r]));
      return { refund: bond - excess, standing: -1, says: `The pool covers it, as it covers every member. ${excess ? `Your excess is ${excess.toLocaleString()} Cr.` : ''}`.trim() };
    }
    return { refund: 0, standing: -2, says: 'Members are covered by the pool. You’re not a member yet: the bond is forfeit.' };
  }
  if (company === 'hexon') return { refund: 0, standing: fault ? -4 : -3, says: fault ? 'A breach of contract: you engaged with our consignment aboard. The bond is forfeit.' : 'The consignment was not delivered. Under the contract, the bond is forfeit.' };
  return { refund: 0, standing: fault ? -4 : -3, says: 'The materials are lost. The bond is forfeit.' };
}

/** Hexon drops a rank for a second loss within this long. */
export const HEXON_SECOND_LOSS = 7 * 24 * 3600_000;
/** A good record: this many deliveries since your last failure halves what the next one costs you in standing. */
export const GOOD_RECORD = 10;
