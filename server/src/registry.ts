// Registering your ship (Mark, 9 November 2026; docs/design/shared-space.md, step 4a). The server stamps
// the ship as it is when the commander registers: her transponder number, the date, the home port, what
// she carries, and where the ledger starts, so everything after is checked from a point the server saw.
//
// Mark's answers (13 November 2026): the game invites a commander to register at their first purchase or
// at Mostly Harmless; registering is free; solo play stays open either way; shared space needs it. A ship
// that isn't basic when she's registered is stamped as she is, marked not basic: what she had before
// stays in solo, and at the door (step 3) only what's on the record since counts.
//
// accounts.ts does the SQL; this works out the stamp. Kept for good, with the account: archived with it
// when it's deleted, then erased (archive.ts).

import { combatRating } from '../../src/game/rating';
import { isShipNumber, newShipNumber } from '../../src/game/transponder';

/** The parts of a save the stamp reads. */
export interface RegSave {
  ship?: unknown;
  shipNumber?: unknown;
  credits?: unknown;
  kills?: unknown;
  equipment?: unknown;
  lasers?: unknown;
  missiles?: unknown;
  location?: unknown;
  difficulty?: unknown;
  ledger?: { entries?: { h?: unknown }[]; head?: unknown };
}

export interface Fit {
  hull: string;
  lasers: Record<string, string>;
  equipment: string[];
  missiles: number;
  credits: number;
  rating: string;
}

export interface Stamp {
  number: string;
  galaxy: number;
  system: number;
  fit: Fit;
  /** A Cobra Mk III in her standard fit, Harmless or Mostly Harmless. */
  basic: boolean;
  /** The ledger's last hash when she was registered: the chain the server counts from. */
  ledger: string;
}

/** Kit that isn't the ship's own: your papers (game/shipyard.ts keeps these with you). */
const PAPERS = new Set(['transponder', 'weapons-licence']);
const STANDARD = { hull: 'cobra-mk3', front: 'pulse', missiles: 3 };
/** The ranks a basic ship's commander can be: the invitation comes at Mostly Harmless. */
const BASIC_RANKS = new Set(['Harmless', 'Mostly Harmless']);

const strings = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
const num = (v: unknown, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);

export function fitOf(save: RegSave): Fit {
  const lasers: Record<string, string> = {};
  if (save.lasers && typeof save.lasers === 'object')
    for (const [m, id] of Object.entries(save.lasers as Record<string, unknown>)) if (typeof id === 'string') lasers[m] = id;
  return {
    hull: typeof save.ship === 'string' ? save.ship : STANDARD.hull,
    lasers,
    equipment: strings(save.equipment).filter((id) => !PAPERS.has(id)).sort(),
    missiles: num(save.missiles, STANDARD.missiles),
    credits: Math.round(num(save.credits) * 10) / 10,
    rating: combatRating(num(save.kills)),
  };
}

export function isBasic(f: Fit): boolean {
  const mounts = Object.keys(f.lasers);
  return (
    f.hull === STANDARD.hull &&
    mounts.length === 1 &&
    f.lasers.front === STANDARD.front &&
    f.equipment.length === 0 &&
    f.missiles <= STANDARD.missiles &&
    BASIC_RANKS.has(f.rating)
  );
}

export function ledgerHead(save: RegSave): string {
  const e = save.ledger?.entries;
  const last = Array.isArray(e) && e.length ? e[e.length - 1]?.h : undefined;
  if (typeof last === 'string') return last;
  return typeof save.ledger?.head === 'string' ? save.ledger.head : 'start';
}

/**
 * The stamp for a save. `taken` says whether a number is already in the registry: then (or if the save's
 * number isn't one) the server issues her a new one, and the game takes it.
 */
export function stampOf(save: RegSave, taken: (n: string) => boolean): Stamp {
  let number = isShipNumber(save.shipNumber) && !taken(save.shipNumber) ? save.shipNumber : newShipNumber();
  while (taken(number)) number = newShipNumber();
  const loc = (save.location ?? {}) as { galaxy?: unknown; system?: unknown };
  const galaxy = Math.min(7, Math.max(0, Math.floor(num(loc.galaxy))));
  const system = Math.min(255, Math.max(0, Math.floor(num(loc.system, 7))));
  const fit = fitOf(save);
  return { number, galaxy, system, fit, basic: isBasic(fit), ledger: ledgerHead(save) };
}

/** What the game and the site are told: the stamp, without the ledger's hash. */
export interface Registration {
  number: string;
  at: number;
  galaxy: number;
  system: number;
  fit: Fit;
  basic: boolean;
}
