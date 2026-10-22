import { distanceLy, systemAt, systemsWithin, type StarSystem } from '../galaxy/generate';
import { COMMODITIES, commodityById } from '../economy/commodities';
import { stationTrades } from '../economy/legality';
import { DANGER_PREMIUM, equilibriumPrice, tradeBalance } from '../economy/market';
import { hash } from '../economy/seed';
import { FUEL_CAPACITY, type Commander } from './commander';
import { COMPANIES, pickCompany, standingAt, standingName, type CompanyId, type StandingName } from './companies';

// Company contracts (Modern rules), as set out in
// docs/design/companies-and-contracts.md: carry the company's cargo from here
// to there within so many hyperspace jumps, and get paid on delivery. The
// company supplies the cargo, so you need a hold, not money. Each station's
// board comes from its seed and the clock, the same for every commander.

export interface Contract {
  id: string;
  company: CompanyId;
  good: string;
  /** Tonnes, supplied by the company. */
  qty: number;
  from: { galaxy: number; system: number };
  to: { galaxy: number; system: number };
  /** Hyperspace jumps allowed. */
  jumps: number;
  /** Credits on delivery, on time. */
  pay: number;
  /** Of the pay, how much is the danger bonus (for showing). */
  danger: number;
  rush: boolean;
  /** Standing with the company needed to take it. */
  needs: StandingName;
  /** What the cargo is called, when it isn't a trade good (special assignments). */
  label?: string;
  /** A special assignment (game/assignments.ts). */
  special?: boolean;
}

/** A contract you've taken, counting down. */
export interface ActiveContract extends Contract {
  jumpsLeft: number;
}

/** A new board every half hour. */
export const BOARD_SLOT = 30 * 60_000;
export const MAX_ACTIVE = 3;
/** Jumps past the deadline before the company takes its cargo back. */
export const LATE_GRACE = 3;

const ROUTE_HOP = FUEL_CAPACITY;

/** Fewest jumps between two systems in the same galaxy, at most `limit` (a tank's range per jump). */
export function jumpsBetween(a: StarSystem, b: StarSystem, limit = 6): number {
  if (a === b) return 0;
  let frontier = [a];
  const seen = new Set([a.index]);
  for (let n = 1; n <= limit; n++) {
    const next: StarSystem[] = [];
    for (const s of frontier) {
      for (const t of systemsWithin(s, ROUTE_HOP)) {
        if (t === b) return n;
        if (!seen.has(t.index)) {
          seen.add(t.index);
          next.push(t);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/** Systems from 1 to `max` jumps away, with their jump counts. */
function withinJumps(from: StarSystem, max: number): { s: StarSystem; n: number }[] {
  const out: { s: StarSystem; n: number }[] = [];
  let frontier = [from];
  const seen = new Set([from.index]);
  for (let n = 1; n <= max; n++) {
    const next: StarSystem[] = [];
    for (const s of frontier) {
      for (const t of systemsWithin(s, ROUTE_HOP)) {
        if (seen.has(t.index)) continue;
        seen.add(t.index);
        next.push(t);
        out.push({ s: t, n });
      }
    }
    frontier = next;
  }
  return out;
}

const key = (s: { galaxy: number; system: number }) => `${s.galaxy}:${s.system}`;
const at = (s: StarSystem) => ({ galaxy: s.galaxy, system: s.index });
const placeOf = (p: { galaxy: number; system: number }) => systemAt(p.galaxy, p.system);

/** The standing a cargo of this value calls for. */
function needsFor(value: number): StandingName {
  return value < 400 ? 'Casual' : value < 1500 ? 'Contractor' : value < 5000 ? 'Trusted' : 'Preferred';
}

/**
 * The contracts on offer at a station at time `now`, best first. The same for
 * everyone; `c` only decides legality (a licence) and hides the ones you've taken.
 */
export function board(c: Commander, here: StarSystem, now: number): Contract[] {
  const slot = Math.floor(now / BOARD_SLOT);
  const r = (salt: number, k: number) => hash(here, 9000 + (slot % 100_000) * 7 + salt, k);
  const near = withinJumps(here, 3);
  const offers: Contract[] = [];
  const count = 4 + Math.floor(r(0, 0) * 3);
  for (let k = 0; k < count; k++) {
    const company = pickCompany(here, r(1, k));
    const firm = COMPANIES[company];
    // A good the company carries, that this world makes and the station trades openly.
    const carries = (g: string) => commodityById(g)?.unit === 't' && stationTrades(c, here, g);
    let goods = firm.goods.filter((g) => carries(g) && tradeBalance(here, g) > -0.2);
    // Where its usual goods aren't made, a company carries whatever the world exports.
    if (!goods.length) goods = COMMODITIES.filter((x) => !x.modernOnly || c.difficulty === 'modern').map((x) => x.id).filter((g) => carries(g) && tradeBalance(here, g) > 0.2);
    if (!goods.length) continue;
    const good = goods[Math.floor(r(2, k) * goods.length)];
    // Somewhere that needs it, preferring importers.
    const dests = near.filter(({ s }) => stationTrades(c, s, good));
    if (!dests.length) continue;
    const importers = dests.filter(({ s }) => tradeBalance(s, good) < -0.1);
    const pool = importers.length ? importers : dests;
    const { s: dest, n: minJumps } = pool[Math.floor(r(3, k) * pool.length)];
    const rush = r(4, k) < 0.25;
    const qty = 3 + Math.floor(r(5, k) * 14);
    const gi = COMMODITIES.findIndex((x) => x.id === good);
    const priceHere = equilibriumPrice(here, COMMODITIES[gi], gi);
    const priceThere = equilibriumPrice(dest, COMMODITIES[gi], gi);
    const ly = distanceLy(here, dest);
    // About two thirds of what an independent would make on the run, plus a
    // carriage fee by distance: you risk none of your own money.
    const base = Math.max(30, qty * (Math.max(0, priceThere - priceHere) * 0.65 + 3 + ly * 0.6));
    const danger = Math.round(base * DANGER_PREMIUM[dest.government] * 1.5);
    const pay = Math.round(base * (rush ? 1.4 : 1)) + danger;
    offers.push({
      id: `${here.galaxy}:${here.index}:${slot}:${k}`,
      company,
      good,
      qty,
      from: at(here),
      to: at(dest),
      jumps: minJumps + (rush ? 0 : 2),
      pay,
      danger,
      rush,
      needs: needsFor(qty * priceHere),
    });
  }
  return offers.filter((o) => !c.contracts?.some((a) => a.id === o.id) && !c.contractsDone?.includes(o.id)).sort((a, b) => b.pay - a.pay);
}

export const standing = (c: Commander, id: CompanyId) => c.standing?.[id] ?? 0;

export interface CompanyLog {
  delivered: number;
  late: number;
  failed: number;
  special: number;
}

export const logOf = (c: Commander, id: CompanyId): CompanyLog => c.companyLog?.[id] ?? { delivered: 0, late: 0, failed: 0, special: 0 };

export function logContract(c: Commander, id: CompanyId, what: keyof CompanyLog) {
  const log = { ...logOf(c, id) };
  log[what] += 1;
  c.companyLog = { ...c.companyLog, [id]: log };
}

/** What the cargo is called on screen. */
export const cargoName = (a: Contract) => a.label ?? commodityById(a.good)?.name ?? a.good;

function addStanding(c: Commander, id: CompanyId, points: number) {
  c.standing = { ...c.standing, [id]: Math.max(-20, standing(c, id) + points) };
}

/** Why you can't take a contract, or null if you can. */
export function cannotTake(c: Commander, o: Contract, freeTonnes: number): string | null {
  if (c.difficulty !== 'modern') return 'Contracts are for Modern rules';
  if ((c.contracts?.length ?? 0) >= MAX_ACTIVE) return `You can carry ${MAX_ACTIVE} contracts at once`;
  if (standing(c, o.company) < standingAt(o.needs)) return `Needs ${o.needs} standing with ${COMPANIES[o.company].name}`;
  if (o.qty > freeTonnes + 1e-9) return `Needs ${o.qty} t free in the hold`;
  return null;
}

export function take(c: Commander, o: Contract, freeTonnes: number): string | null {
  const why = cannotTake(c, o, freeTonnes);
  if (why) return why;
  c.contracts = [...(c.contracts ?? []), { ...o, jumpsLeft: o.jumps }];
  return null;
}

function finish(c: Commander, id: string) {
  c.contracts = (c.contracts ?? []).filter((a) => a.id !== id);
  c.contractsDone = [...(c.contractsDone ?? []), id].slice(-60);
}

/** Give up a contract: the company takes its cargo back, and remembers. */
export function abandon(c: Commander, id: string): string {
  const a = c.contracts?.find((x) => x.id === id);
  if (!a) return '';
  finish(c, id);
  addStanding(c, a.company, -3);
  logContract(c, a.company, 'failed');
  return `Contract abandoned · ${COMPANIES[a.company].name} will remember`;
}

/** After a hyperspace jump: deadlines count down; long-overdue cargo is reclaimed. */
export function afterJump(c: Commander): string[] {
  const notes: string[] = [];
  for (const a of [...(c.contracts ?? [])]) {
    a.jumpsLeft -= 1;
    if (a.jumpsLeft === 0) notes.push(`${cargoName(a)} for ${placeOf(a.to).name}: last jump`);
    if (a.jumpsLeft < -LATE_GRACE) {
      finish(c, a.id);
      addStanding(c, a.company, -3);
      logContract(c, a.company, 'failed');
      notes.push(`${COMPANIES[a.company].name} has reclaimed its ${cargoName(a)}: contract failed`);
    }
  }
  return notes;
}

/** Docked: deliver whatever is due here. Returns what happened, for the player. */
export function deliver(c: Commander, here: StarSystem): string[] {
  const notes: string[] = [];
  for (const a of [...(c.contracts ?? [])]) {
    if (key(a.to) !== key(at(here))) continue;
    const late = a.jumpsLeft < 0;
    const pay = late ? Math.round(a.pay / 2) : a.pay;
    c.credits = Math.round((c.credits + pay) * 10) / 10;
    const before = standingName(standing(c, a.company));
    addStanding(c, a.company, late ? 0 : a.special ? 3 : 1 + (a.rush || a.danger > 0 ? 1 : 0));
    logContract(c, a.company, late ? 'late' : a.special ? 'special' : 'delivered');
    finish(c, a.id);
    const after = standingName(standing(c, a.company));
    notes.push(`${COMPANIES[a.company].name} · ${a.qty} t ${cargoName(a)} delivered${late ? ' late' : ''} · ${pay.toLocaleString()} Cr` + (after !== before ? ` · now ${after}` : ''));
  }
  return notes;
}

/** Ship lost: the company's cargo with it. */
export function loseContracts(c: Commander): string[] {
  const lost = c.contracts ?? [];
  for (const a of lost) {
    finish(c, a.id);
    addStanding(c, a.company, -2);
    logContract(c, a.company, 'failed');
  }
  return lost.map((a) => `${COMPANIES[a.company].name}'s ${cargoName(a)} lost with your ship`);
}

export const destinationOf = (a: Contract) => placeOf(a.to);
