import { galaxy, GOVERNMENTS, type StarSystem } from '../galaxy/generate';
import { stationName } from '../galaxy/stationNames';
import { newCommander } from '../game/commander';
import { COMPANY_IDS, presence, type CompanyId } from '../game/companies';
import { board, BOARD_SLOT, withinJumps, type Contract } from '../game/contracts';

// The contracts board as the website shows it (docs/design/jobs-board.md):
// what a brand-new Modern commander docked at Lave would see, worked out from
// the game's own seed and clock, with nothing from the server. No DOM here, so
// it can be tested.

export const LAVE = galaxy(0)[7];
/** Every commander starts as this one: Lave, a Cobra, 100 Cr, no standing. */
const newcomer = newCommander('modern');
/** A Cobra Mk III's hold, in tonnes. */
export const COBRA_HOLD = 20;

/**
 * A board offer, with when it went up and comes down. Once the game's board
 * rolls, each offer carries its own times; until then, the whole board shares
 * its half hour.
 */
export type Offer = Contract & { posted: number; until: number };

/** The board at a station now, and whether it rolls (each offer with its own times) or changes every half hour. */
export function boardAt(here: StarSystem, now: number): { offers: Offer[]; rolling: boolean } {
  const slot = Math.floor(now / BOARD_SLOT) * BOARD_SLOT;
  const raw = board(newcomer, here, now) as (Contract & { posted?: number; until?: number })[];
  return {
    offers: raw.map((o) => ({ ...o, posted: o.posted ?? slot, until: o.until ?? slot + BOARD_SLOT })),
    rolling: raw.some((o) => o.posted !== undefined),
  };
}

/** The kinds the filters and adverts speak of. */
export type Kind = 'haulage' | 'starter' | 'contractor' | 'rush' | 'survey' | 'danger' | 'assignment' | 'coming-soon' | 'build';
export const FILTER_KINDS: { id: Kind; label: string }[] = [
  { id: 'haulage', label: 'Haulage' },
  { id: 'survey', label: 'Surveys' },
  { id: 'rush', label: 'Rush' },
  { id: 'danger', label: 'Danger pay' },
  { id: 'starter', label: 'Open to new pilots' },
];

export function kindsOf(o: Contract): Kind[] {
  const k: Kind[] = [o.survey ? 'survey' : 'haulage', o.needs === 'Casual' ? 'starter' : 'contractor'];
  if (o.rush) k.push('rush');
  if (o.danger > 0) k.push('danger');
  return k;
}

export interface Advert {
  company: CompanyId;
  title: string;
  kinds: Kind[];
  text: string;
  meta: string;
  /** Where Apply goes, when it isn't the game (a design commission). */
  href?: string;
}

/** Kinds that never appear on a station's board: by invitation, not built yet, or design commissions. */
export const OFF_BOARD: Kind[] = ['assignment', 'coming-soon', 'build'];

/** The live offers an advert describes: same company, and every kind the advert names. */
export const offersFor = (a: Advert, offers: Contract[]) => (a.kinds.some((k) => OFF_BOARD.includes(k)) ? [] : offers.filter((o) => o.company === a.company && a.kinds.every((k) => kindsOf(o).includes(k))));

/**
 * Where a company is strongest near Lave: the nearest world where it works
 * more than any of the others. Its fallback when it has nothing at Lave.
 */
export function homeGround(company: CompanyId, from = LAVE): { s: StarSystem; n: number } {
  const leads = (s: StarSystem) => {
    const p = presence(s);
    return p[company] > 0.5 && COMPANY_IDS.every((id) => p[id] <= p[company]);
  };
  if (leads(from)) return { s: from, n: 0 };
  return withinJumps(from, 8).find(({ s }) => leads(s)) ?? { s: from, n: 0 };
}

export const station = (s: StarSystem) => stationName(s).name;

/** "an anarchy", "a corporate state". */
export const govPhrase = (s: StarSystem) => {
  const g = GOVERNMENTS[s.government].toLowerCase();
  return `${/^[aeiou]/.test(g) ? 'an' : 'a'} ${g}`;
};

export const jumpsPhrase = (n: number) => (n === 1 ? 'one jump' : `${n} jumps`);

/** "3 min", "1 h 5 min". */
export function span(ms: number): string {
  const m = Math.max(1, Math.round(ms / 60_000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
}
