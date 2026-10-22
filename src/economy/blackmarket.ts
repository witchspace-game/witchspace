import { cargoTonnes, removeStolen, stolenQty, type Commander } from '../game/commander';
import type { StarSystem } from '../galaxy/generate';
import { COMMODITIES, UNITS_PER_TONNE } from './commodities';
import { eventShare } from './events';
import { hasLicence, legalityAt } from './legality';
import { drift, equilibriumPrice, npcTrades, priceAt, type MarketState } from './market';

// The back room: where goods that are against the law here change hands.
// As set out in docs/design/markets-and-trade.md (section 3), it's thin
// (small stock, prices that jump with every trade), wide (a big gap between
// buying and selling), and the stricter the law, the better it pays and the
// likelier the buyer is an undercover officer. Smugglers trade here too, and
// a police crackdown dries it up. Lawful worlds also have abolitionists, who
// buy slaves to free them: for less, but legally.

// By government (Anarchy … Corporate State): how much more contraband fetches
// than its open price, and the chance per trade that the other side is police.
const PREMIUM = [1, 1.5, 1.8, 2.1, 2.6, 2.4, 2.8, 3.2];
const RISK = [0, 0.02, 0.05, 0.08, 0.15, 0.12, 0.16, 0.22];
const SPREAD = 0.08; // each side of the mid price
const THIN = 0.6; // price elasticity: far jumpier than the open market
const RECOVERY_MINUTES = 60;
const MEMORY_MS = 4 * 3600_000;

export interface BackRoomQuote {
  id: string;
  ask: number; // what you pay per unit
  bid: number; // what you get per unit
  stock: number;
  /** Chance a single trade here is with undercover police. */
  risk: number;
}

export interface BackRoomTrade {
  t: number;
  id: string;
  side: 'buy' | 'sell';
  qty: number;
}

/** Back-room state lives with the station's market. */
export type BackRoomState = MarketState & { backRoom?: BackRoomTrade[] };

/** Whether a good would go through the back room here rather than the open exchange. */
export function isContraband(c: Commander, s: StarSystem, id: string): boolean {
  const l = legalityAt(s, id, c.difficulty);
  return l === 'illegal' || (l === 'licensed' && !hasLicence(c));
}

/** Is there a back room at all? Not in anarchies (everything's legal) or under Classic rules. */
export const hasBackRoom = (c: Commander, s: StarSystem) => c.difficulty === 'modern' && s.government > 0;

const usual = (s: StarSystem, i: number) => Math.max(2, Math.round(COMMODITIES[i].baseSupply * 0.5 * Math.sqrt(s.population / 2.5)));

function stockAt(s: StarSystem, state: BackRoomState, i: number, t: number): number {
  const c = COMMODITIES[i];
  const eq = usual(s, i);
  let d = eq * eventShare(s, c.id, t, false); // crackdowns dry it up
  // Smugglers come and go with the same rhythm as the open market's traders.
  for (const e of npcTrades(s, c.id, t - MEMORY_MS, t)) d += (e.side === 'sell' ? 1 : -1) * Math.ceil(e.qty / 2) * Math.exp(-(t - e.t) / 60000 / RECOVERY_MINUTES);
  for (const tr of state.backRoom ?? []) {
    if (tr.id === c.id && tr.t <= t) d += (tr.side === 'sell' ? tr.qty : -tr.qty) * Math.exp(-(t - tr.t) / 60000 / RECOVERY_MINUTES);
  }
  return eq + d;
}

function midPrice(s: StarSystem, i: number, stock: number, eq: number, t: number): number {
  const c = COMMODITIES[i];
  const pressure = Math.min(4, Math.max(0.4, Math.pow(eq / Math.max(stock, 0.5), THIN)));
  return equilibriumPrice(s, c, i) * PREMIUM[s.government] * drift(s, c, i, t) * pressure;
}

/** Prices for every good that's contraband here. */
export function backRoomQuotes(c: Commander, s: StarSystem, state: BackRoomState, now: number): BackRoomQuote[] {
  if (!hasBackRoom(c, s)) return [];
  const out: BackRoomQuote[] = [];
  COMMODITIES.forEach((good, i) => {
    if (good.modernOnly && c.difficulty === 'classic') return;
    if (!isContraband(c, s, good.id)) return;
    const stock = stockAt(s, state, i, now);
    const mid = midPrice(s, i, stock, usual(s, i), now);
    out.push({ id: good.id, ask: round1(mid * (1 + SPREAD)), bid: round1(mid * (1 - SPREAD)), stock: Math.max(0, Math.floor(stock)), risk: RISK[s.government] });
  });
  return out;
}

/** Total for `qty` units, one at a time, as the thin market moves with each. */
export function backRoomTotal(s: StarSystem, state: BackRoomState, id: string, qty: number, side: 'buy' | 'sell', now: number): number {
  const i = COMMODITIES.findIndex((x) => x.id === id);
  const eq = usual(s, i);
  let stock = stockAt(s, state, i, now);
  let total = 0;
  for (let n = 0; n < qty; n++) {
    if (side === 'sell') stock += 1;
    const mid = midPrice(s, i, stock, eq, now);
    total += side === 'buy' ? mid * (1 + SPREAD) : mid * (1 - SPREAD);
    if (side === 'buy') stock -= 1;
  }
  return Math.round(total * 10) / 10;
}

/** The chance a trade of `qty` units is a sting: bigger deals draw more attention. */
export const stingChance = (s: StarSystem, qty: number) => Math.min(0.6, RISK[s.government] * (1 + qty / 5));

export interface BackRoomResult {
  ok: boolean;
  /** The other side was police: goods (or credits) seized, and a record. */
  caught: boolean;
  message: string;
}

/**
 * Trade in the back room. `random` decides whether it's a sting. A sting on
 * a sale seizes the goods; on a purchase it seizes the credits. Either way
 * you leave with an Offender record (the caller records it).
 */
export function backRoomTrade(
  c: Commander,
  s: StarSystem,
  state: BackRoomState,
  id: string,
  side: 'buy' | 'sell',
  qty: number,
  capacity: number,
  now: number,
  random = Math.random,
): BackRoomResult {
  const good = COMMODITIES.find((x) => x.id === id);
  if (!good || qty <= 0 || !hasBackRoom(c, s) || !isContraband(c, s, id)) return { ok: false, caught: false, message: 'Nothing doing' };
  const quote = backRoomQuotes(c, s, state, now).find((q) => q.id === id)!;
  const total = backRoomTotal(s, state, id, qty, side, now);
  if (side === 'buy') {
    if (quote.stock < qty) return { ok: false, caught: false, message: `They haven't got that much ${good.name}` };
    if (cargoTonnes(c) + qty / UNITS_PER_TONNE[good.unit] > capacity + 1e-9) return { ok: false, caught: false, message: 'Not enough room in the hold' };
    if (total > c.credits) return { ok: false, caught: false, message: 'Not enough credits' };
  } else if ((c.cargo[id] ?? 0) < qty) return { ok: false, caught: false, message: `You haven't got that much ${good.name}` };

  const sting = random() < stingChance(s, qty) * (side === 'buy' ? 0.5 : 1);
  const units = good.unit === 't' ? ' t' : ` ${good.unit}`;
  if (side === 'buy') {
    c.credits = Math.round((c.credits - total) * 10) / 10;
    if (sting) return { ok: true, caught: true, message: `Sting! Undercover police took your ${total.toFixed(1)} Cr` };
    c.cargo[id] = (c.cargo[id] ?? 0) + qty;
  } else {
    c.cargo[id] -= qty;
    if (c.cargo[id] <= 0) delete c.cargo[id];
    if (sting) return { ok: true, caught: true, message: `Sting! The buyer was police: ${qty}${units} of ${good.name} seized` };
    c.credits = Math.round((c.credits + total) * 10) / 10;
  }
  state.backRoom = [...(state.backRoom ?? []).filter((x) => x.t > now - MEMORY_MS), { t: now, id, side, qty }];
  return { ok: true, caught: false, message: `${side === 'buy' ? 'Bought' : 'Sold'} ${qty}${units} of ${good.name} for ${total.toFixed(1)} Cr, no questions asked` };
}

// --- The fence ---------------------------------------------------------------------
//
// Stolen goods can't be sold openly where there's a law, but a fence will
// take them: for about 60% of the open price, no questions asked, though the
// buyer could still be police.

const FENCE_CUT = 0.6;

export interface FenceQuote {
  id: string;
  bid: number; // per unit
  qty: number; // stolen units you hold
  risk: number;
}

/** What a fence here will pay for each stolen good you're carrying. */
export function fenceQuotes(c: Commander, s: StarSystem, state: MarketState, now: number): FenceQuote[] {
  if (!hasBackRoom(c, s)) return [];
  return Object.keys(c.stolen ?? {})
    .map((id) => ({ id, qty: stolenQty(c, id) }))
    .filter((x) => x.qty > 0)
    .map(({ id, qty }) => ({ id, qty, bid: round1(priceAt(s, state, id, now) * FENCE_CUT), risk: RISK[s.government] }));
}

/** Sell stolen goods to the fence. A sting seizes them, as in the back room. */
export function fenceSell(c: Commander, s: StarSystem, state: MarketState, id: string, qty: number, now: number, random = Math.random): BackRoomResult {
  const q = fenceQuotes(c, s, state, now).find((x) => x.id === id);
  const good = COMMODITIES.find((x) => x.id === id);
  if (!q || !good || qty <= 0 || qty > q.qty) return { ok: false, caught: false, message: 'Nothing to fence' };
  const units = good.unit === 't' ? ' t' : ` ${good.unit}`;
  removeStolen(c, id, qty);
  if (random() < stingChance(s, qty)) return { ok: true, caught: true, message: `Sting! The fence was police: ${qty}${units} of stolen ${good.name} seized` };
  const paid = Math.round(q.bid * qty * 10) / 10;
  c.credits = Math.round((c.credits + paid) * 10) / 10;
  return { ok: true, caught: false, message: `Fenced ${qty}${units} of stolen ${good.name} for ${paid.toFixed(1)} Cr` };
}

// --- Abolitionists ----------------------------------------------------------------

/** Lawful worlds (where slavery is banned and the law is strong) have an abolitionist society. */
export const hasAbolitionists = (c: Commander, s: StarSystem) => c.difficulty === 'modern' && s.government >= 4;

/** What abolitionists pay per unit to free slaves: about half the back room's price, but legal. */
export function abolitionistPrice(s: StarSystem, now: number): number {
  const i = COMMODITIES.findIndex((x) => x.id === 'slaves');
  return round1(equilibriumPrice(s, COMMODITIES[i], i) * drift(s, COMMODITIES[i], i, now) * 1.2);
}

/** Hand slaves over to be freed. Legal, and it's counted. */
export function freeSlaves(c: Commander, s: StarSystem, qty: number, now: number): BackRoomResult {
  const held = c.cargo.slaves ?? 0;
  if (!hasAbolitionists(c, s) || qty <= 0 || held < qty) return { ok: false, caught: false, message: 'Nothing to hand over' };
  const paid = Math.round(abolitionistPrice(s, now) * qty * 10) / 10;
  c.cargo.slaves = held - qty;
  if (c.cargo.slaves <= 0) delete c.cargo.slaves;
  c.credits = Math.round((c.credits + paid) * 10) / 10;
  c.freed = (c.freed ?? 0) + qty;
  return { ok: true, caught: false, message: `${qty} people freed. The abolitionists paid ${paid.toFixed(1)} Cr towards your costs` };
}

function round1(n: number) {
  return Math.max(0.1, Math.round(n * 10) / 10);
}
