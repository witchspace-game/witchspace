import type { StarSystem } from '../galaxy/generate';
import { hash } from '../economy/seed';
import { worldOf } from './explore';

// The trading companies (docs/companies.md, docs/design/companies-and-contracts.md):
// who works where, what they carry, and what they think of you. Presence comes
// from each system's government and seed, so every commander sees the same
// companies in the same places.

export type CompanyId = 'hexon' | 'vorg' | 'mutual' | 'wy';

export interface Company {
  id: CompanyId;
  name: string;
  motto: string;
  /** One line for the contracts board. */
  blurb: string;
  /** Livery and UI colour (CSS). */
  colour: string;
  /** Goods the company prefers to carry, most wanted first. */
  goods: string[];
}

export const COMPANIES: Record<CompanyId, Company> = {
  hexon: {
    id: 'hexon',
    name: 'Hexon Holdings',
    motto: 'Continuity of care.',
    blurb: 'Punctual, polite, and unforgiving of lateness.',
    colour: '#bfefff',
    goods: ['medicine', 'luxuries', 'computers', 'electronics', 'liquor'],
  },
  vorg: {
    id: 'vorg',
    name: 'Vorg Industries',
    motto: 'We build. You survive.',
    blurb: 'Runs where the law is thin. Asks no questions.',
    colour: '#ff8a3d',
    goods: ['alloys', 'machinery', 'radioactives', 'minerals', 'hydrogen'],
  },
  mutual: {
    id: 'mutual',
    name: "Carriers' Mutual",
    motto: 'No hauler flies alone.',
    blurb: 'Fair rates, slow votes, and someone always comes when you call.',
    colour: '#7fb2ff',
    goods: ['food', 'textiles', 'water', 'furs', 'liquor', 'minerals'],
  },
  wy: {
    id: 'wy',
    name: 'Wexley-Yorozu',
    motto: 'Better worlds, built to order.',
    blurb: 'Terraformers and shipwrights. Read page 214.',
    colour: '#ffd23d',
    goods: ['machinery', 'electronics', 'alloys', 'computers', 'hydrogen', 'medicine'],
  },
};

export const COMPANY_IDS = Object.keys(COMPANIES) as CompanyId[];

/**
 * How strongly each company works a system (0 = not at all). Hexon holds the
 * safe core, Vorg the frontier, the Mutual a little of everywhere with a
 * government, and Wexley-Yorozu the thinly settled worlds with moons to build from.
 */
export function presence(s: StarSystem): Record<CompanyId, number> {
  const g = s.government;
  const jitter = (k: number) => 0.75 + hash(s, 700, k) * 0.5;
  return {
    hexon: (g >= 5 ? 3 : g >= 3 ? 1 : 0) * jitter(0),
    vorg: (g <= 1 ? 3 : g <= 2 ? 2 : g <= 3 ? 0.6 : 0) * jitter(1),
    mutual: (g >= 1 ? 1.6 : 0.3) * jitter(2),
    wy: (worldOf(s).moons.length && s.population < 4 ? 2.2 : 0.2) * jitter(3),
  };
}

/** Pick a company for something in this system, weighted by presence; `r` in [0, 1). */
export function pickCompany(s: StarSystem, r: number): CompanyId {
  const p = presence(s);
  const total = COMPANY_IDS.reduce((sum, id) => sum + p[id], 0);
  let x = r * total;
  for (const id of COMPANY_IDS) {
    x -= p[id];
    if (x < 0) return id;
  }
  return 'mutual';
}

// --- Standing ------------------------------------------------------------------

// Below zero: you've let the company down. Starter (Casual) work stays open
// so you can earn your way back, until you're Blacklisted.
export const STANDINGS = [
  { name: 'Blacklisted', at: -Infinity },
  { name: 'Distrusted', at: -9 },
  { name: 'Unreliable', at: -5 },
  { name: 'Casual', at: 0 },
  { name: 'Contractor', at: 5 },
  { name: 'Trusted', at: 15 },
  { name: 'Preferred', at: 40 },
  { name: 'Partner', at: 100 },
] as const;

export type StandingName = (typeof STANDINGS)[number]['name'];

export function standingName(points: number): StandingName {
  let name: StandingName = 'Blacklisted';
  for (const s of STANDINGS) if (points >= s.at) name = s.name;
  return name;
}

/** Points needed for a standing name. */
export const standingAt = (name: StandingName) => STANDINGS.find((s) => s.name === name)!.at;

/** Points needed to take work that asks for this standing: starter work is open to all but the blacklisted. */
export const workNeeds = (name: StandingName) => (name === 'Casual' ? standingAt('Distrusted') : standingAt(name));
