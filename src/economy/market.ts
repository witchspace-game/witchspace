import type { StarSystem } from '../galaxy/generate';
import { COMMODITIES, type Commodity } from './commodities';

// Station markets.
//
// Modern rules: living markets. Each system has an equilibrium price and
// stock set by its economy and tech level. Buying drains stock and pushes the
// price up; selling does the opposite; markets drift back towards
// equilibrium over time.
//
// Living markets also drift slowly over real time, as traffic and news come
// and go, so prices move while you watch. The drift is deterministic, so a
// market's price history can be worked out exactly for any past moment.
//
// Classic rules: 1984-style. Fresh prices on each visit around the
// equilibrium, and your trades leave no lasting mark.

export interface MarketState {
  /** Current stock per commodity id. */
  stock: Record<string, number>;
  /** When the stock was last updated (ms since epoch). */
  updated: number;
  /** Classic rules: which visit these prices belong to. */
  visit?: number;
  /** Modern rules: recent trades here, newest last, for the price history. */
  trades?: MarketTrade[];
}

export interface MarketTrade {
  t: number; // ms since epoch
  id: string;
  side: 'buy' | 'sell';
  qty: number;
  total: number; // credits
}

/** How many trades a market remembers. */
export const TRADE_MEMORY = 40;

export interface Quote {
  commodity: Commodity;
  price: number; // credits per unit, to one decimal place
  stock: number; // units available to buy
}

const ELASTICITY = 0.35; // how strongly stock levels move prices
const RECOVERY_MINUTES = 30; // time constant for markets to settle back

/** A stable pseudo-random number in [0, 1) from a system, a salt and a commodity. */
function hash(system: StarSystem, salt: number, index: number): number {
  const [a, b, c, d] = system.extraSeed;
  let h = (a * 73856093) ^ (b * 19349663) ^ (c * 83492791) ^ (d * 2654435761) ^ (salt * 97) ^ (index * 1013);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Drift: smooth noise at three time scales, weighted, up to ±DRIFT × the
// commodity's volatility. Volatile goods (narcotics) swing far more than
// staples (food).
const DRIFT = 0.2;
const DRIFT_WAVES: [periodMs: number, weight: number][] = [
  [3 * 3600_000, 0.55],
  [40 * 60_000, 0.3],
  [6 * 60_000, 0.15],
];

/** Smooth noise in [-1, 1] for a commodity at time `t`, one wave of period `period`. */
function wave(system: StarSystem, i: number, w: number, period: number, t: number): number {
  const x = t / period;
  const k = Math.floor(x);
  const f = x - k;
  const ease = f * f * (3 - 2 * f);
  const a = hash(system, 1000 + w * 7919 + (k % 1_000_003), i) * 2 - 1;
  const b = hash(system, 1000 + w * 7919 + ((k + 1) % 1_000_003), i) * 2 - 1;
  return a + (b - a) * ease;
}

/** The drift multiplier on a commodity's price at time `t` (ms). */
export function drift(system: StarSystem, c: Commodity, i: number, t: number): number {
  let n = 0;
  DRIFT_WAVES.forEach(([period, weight], w) => (n += weight * wave(system, i, w, period, t)));
  return 1 + n * c.volatility * DRIFT;
}

/** Midpoint of the economy scale, so average worlds sit at the base price. */
const MID = 3.5;

export function equilibriumPrice(system: StarSystem, c: Commodity, i: number): number {
  const econ = 1 + c.economyBias * (system.economy - MID);
  // High-tech worlds make advanced goods a little cheaper.
  const tech = c.economyBias > 0 ? 1 - (system.techLevel - 7) * 0.012 : 1;
  const character = 1 + (hash(system, 1, i) * 2 - 1) * c.volatility * 0.6;
  return Math.max(0.4, c.basePrice * econ * tech * character);
}

export function equilibriumStock(system: StarSystem, c: Commodity, i: number): number {
  if (c.baseSupply === 0) return 0;
  // Worlds stock more of what they produce (where it's cheap).
  const production = Math.min(3, Math.max(0.1, 1 - 4 * c.economyBias * (system.economy - MID)));
  const size = Math.sqrt(system.population / 2.5);
  const character = 0.75 + hash(system, 2, i) * 0.5;
  return Math.round(c.baseSupply * production * size * character);
}

export function freshMarket(system: StarSystem, now: number): MarketState {
  const stock: Record<string, number> = {};
  COMMODITIES.forEach((c, i) => (stock[c.id] = equilibriumStock(system, c, i)));
  return { stock, updated: now };
}

/** Let a market drift back towards equilibrium for the time that has passed. */
export function recover(system: StarSystem, state: MarketState, now: number): MarketState {
  const minutes = Math.max(0, (now - state.updated) / 60000);
  const k = 1 - Math.exp(-minutes / RECOVERY_MINUTES);
  const stock: Record<string, number> = {};
  COMMODITIES.forEach((c, i) => {
    const eq = equilibriumStock(system, c, i);
    const cur = state.stock[c.id] ?? eq;
    stock[c.id] = Math.round(cur + (eq - cur) * k);
  });
  return { stock, updated: now };
}

/** Scarce goods cost more; gluts cost less. Clamped to sensible bounds. */
function pressure(eqStock: number, stock: number): number {
  if (eqStock <= 0) return 1;
  return Math.min(2.5, Math.max(0.5, Math.pow(Math.max(eqStock, 1) / Math.max(stock, 0.5), ELASTICITY)));
}

// --- Other traders ---------------------------------------------------------------
//
// NPC traders buy and sell at every living market. Their trades are a
// deterministic stream of events per commodity, generated from the system's
// seed and the clock, so every market's history can be worked out exactly
// and the same for everyone. Each trade knocks the stock out of balance, and
// the market absorbs it over NPC_RECOVERY_MINUTES (faster than your big
// trades, since other traders' flows tend to offset); impacts older than
// IMPACT_MEMORY have faded to nothing that matters. In the shared galaxy,
// players' trades will be events on the same books.

const NPC_SLOT = 120_000; // ms: at most one NPC trade per commodity per slot
const NPC_CHANCE = 0.3; // chance of a trade in each slot, at a market of 20 units or more
const NPC_RECOVERY_MINUTES = 12;
const IMPACT_MEMORY = 2 * 3600_000; // ms
const decay = (ms: number) => Math.exp(-ms / 60000 / RECOVERY_MINUTES);
const npcDecay = (ms: number) => Math.exp(-ms / 60000 / NPC_RECOVERY_MINUTES);

export interface MarketEvent {
  t: number;
  side: 'buy' | 'sell';
  qty: number;
  by: 'npc' | 'you';
  /** Credits per unit, roughly, for NPC trades; exact for yours. */
  price: number;
}

/** The size of one level of the order book, and of a typical NPC trade. */
const levelStep = (system: StarSystem, c: Commodity, i: number) => Math.max(1, Math.round(equilibriumStock(system, c, i) / 20));

/** NPC trades in one commodity between `from` and `to` (ms), oldest first. Prices are left at 0. */
export function npcTrades(system: StarSystem, id: string, from: number, to: number): MarketEvent[] {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const c = COMMODITIES[i];
  const eq = equilibriumStock(system, c, i);
  if (eq <= 0) return [];
  const step = levelStep(system, c, i);
  // Small markets see far fewer trades, as real illiquid markets do, so a
  // handful of tonnes isn't bought out every hour.
  const chance = NPC_CHANCE * Math.min(1, (eq / 20) ** 2);
  const out: MarketEvent[] = [];
  const M = 1_000_003;
  for (let k = Math.floor(from / NPC_SLOT); k <= Math.floor(to / NPC_SLOT); k++) {
    const slot = k % M;
    if (hash(system, 20_000 + slot, i) >= chance) continue;
    const t = k * NPC_SLOT + hash(system, 30_000 + slot, i) * NPC_SLOT;
    if (t < from || t > to) continue;
    const side = hash(system, 40_000 + slot, i) < 0.5 ? 'buy' : 'sell';
    out.push({ t, side, qty: step * (1 + Math.floor(hash(system, 50_000 + slot, i) * 2)), by: 'npc', price: 0 });
  }
  return out;
}

const signed = (e: { side: 'buy' | 'sell'; qty: number }) => (e.side === 'buy' ? -e.qty : e.qty);

/** How far NPC trading has pushed a commodity's stock from its usual level at time `t`. Cached: it's asked for often. */
const npcCache = new Map<string, number>();
function npcDeviation(system: StarSystem, id: string, t: number): number {
  const key = `${system.galaxy}:${system.index}:${id}:${t}`;
  let d = npcCache.get(key);
  if (d === undefined) {
    d = 0;
    for (const e of npcTrades(system, id, t - IMPACT_MEMORY, t)) d += signed(e) * npcDecay(t - e.t);
    if (npcCache.size > 5000) npcCache.clear();
    npcCache.set(key, d);
  }
  return d;
}

/** Prices for a living (Modern) market, as of `state.updated`. `stock` includes other traders' activity. */
export function quoteModern(system: StarSystem, state: MarketState): Quote[] {
  return COMMODITIES.map((c, i) => {
    const eqStock = equilibriumStock(system, c, i);
    const stock = (state.stock[c.id] ?? eqStock) + npcDeviation(system, c.id, state.updated);
    const price = equilibriumPrice(system, c, i) * drift(system, c, i, state.updated) * pressure(eqStock, stock);
    return { commodity: c, price: round1(price), stock: Math.max(0, Math.round(stock)) };
  });
}

/** Units of one commodity a station has to sell right now, other traders included. */
export function stockFor(system: StarSystem, state: MarketState, id: string): number {
  return quoteModern(system, state).find((q) => q.commodity.id === id)!.stock;
}

/** Your trades' push on the stock at time `t`, from the market's trade log. */
function yourDeviation(state: MarketState, id: string, t: number): number {
  let d = 0;
  for (const trade of state.trades ?? []) if (trade.id === id && trade.t <= t) d += signed(trade) * decay(t - trade.t);
  return d;
}

/** Price at time `t` given the NPC trades in the window before it (oldest first). */
function priceWith(system: StarSystem, state: MarketState, c: Commodity, i: number, t: number, npc: MarketEvent[]): number {
  let d = yourDeviation(state, c.id, t);
  for (const e of npc) if (e.t <= t && e.t > t - IMPACT_MEMORY) d += signed(e) * npcDecay(t - e.t);
  const eq = equilibriumStock(system, c, i);
  return equilibriumPrice(system, c, i) * drift(system, c, i, t) * pressure(eq, eq + d);
}

/** A living market's price for one commodity at any moment up to now (unrounded). */
export function priceAt(system: StarSystem, state: MarketState, id: string, t: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  return priceWith(system, state, COMMODITIES[i], i, t, npcTrades(system, id, t - IMPACT_MEMORY, t));
}

export interface Candle {
  t: number; // start of the candle
  open: number;
  high: number;
  low: number;
  close: number;
  /** Units traded in the candle, by everyone. */
  volume: number;
}

/** `count` candles of `interval` ms each, the last one ending at `now`, sampled from the price history. */
export function candles(system: StarSystem, state: MarketState, id: string, now: number, interval: number, count: number): Candle[] {
  const SAMPLES = 12;
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const c = COMMODITIES[i];
  const start = now - interval * count;
  const npc = npcTrades(system, id, start - IMPACT_MEMORY, now);
  const yours = (state.trades ?? []).filter((t) => t.id === id);
  const out: Candle[] = [];
  for (let k = 0; k < count; k++) {
    const t0 = start + k * interval;
    const ps: number[] = [];
    for (let j = 0; j <= SAMPLES; j++) ps.push(priceWith(system, state, c, i, t0 + (interval * j) / SAMPLES, npc));
    const inCandle = (t: number) => t >= t0 && t < t0 + interval;
    const volume = npc.filter((e) => inCandle(e.t)).reduce((n, e) => n + e.qty, 0) + yours.filter((e) => inCandle(e.t)).reduce((n, e) => n + e.qty, 0);
    out.push({ t: t0, open: ps[0], high: Math.max(...ps), low: Math.min(...ps), close: ps[ps.length - 1], volume });
  }
  return out;
}

/** The latest trades in a commodity, everyone's, newest first. */
export function recentTrades(system: StarSystem, state: MarketState, id: string, now: number, limit: number): MarketEvent[] {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const c = COMMODITIES[i];
  const from = now - 3 * 3600_000;
  const npc = npcTrades(system, id, from - IMPACT_MEMORY, now);
  const events: MarketEvent[] = npc
    .filter((e) => e.t >= from)
    .slice(-limit)
    .map((e) => ({ ...e, price: priceWith(system, state, c, i, e.t, npc) }));
  for (const t of state.trades ?? []) if (t.id === id && t.t >= from) events.push({ t: t.t, side: t.side, qty: t.qty, by: 'you', price: t.total / t.qty });
  return events.sort((a, b) => b.t - a.t).slice(0, limit);
}

export interface BookLevel {
  price: number; // average credits per unit across the level
  qty: number; // units
}

/**
 * The order book a living market's pricing implies: the price of each next
 * slice of goods you could buy (asks, cheapest first) or sell (bids, best
 * first). Asks stop where the station's stock runs out.
 */
export function orderBook(system: StarSystem, state: MarketState, id: string, levels: number): { asks: BookLevel[]; bids: BookLevel[]; step: number } {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const step = levelStep(system, COMMODITIES[i], i);
  const own = state.stock[id] ?? 0;
  const available = stockFor(system, state, id);
  const asks: BookLevel[] = [];
  const bids: BookLevel[] = [];
  for (let k = 0; k < levels; k++) {
    const askQty = Math.min(step, available - k * step);
    if (askQty > 0) {
      const s: MarketState = { stock: { ...state.stock, [id]: own - k * step }, updated: state.updated };
      asks.push({ price: costToBuy(system, s, id, askQty) / askQty, qty: askQty });
    }
    const s: MarketState = { stock: { ...state.stock, [id]: own + k * step }, updated: state.updated };
    bids.push({ price: proceedsToSell(system, s, id, step) / step, qty: step });
  }
  return { asks, bids, step };
}

/** Prices for a Classic market: fresh each visit, `visit` picks the variation. */
export function quoteClassic(system: StarSystem, visit: number): Quote[] {
  return COMMODITIES.map((c, i) => {
    const swing = 1 + (hash(system, 100 + visit, i) * 2 - 1) * c.volatility;
    const stockSwing = 0.8 + hash(system, 200 + visit, i) * 0.4;
    return {
      commodity: c,
      price: round1(equilibriumPrice(system, c, i) * swing),
      stock: Math.round(equilibriumStock(system, c, i) * stockSwing),
    };
  });
}

function round1(n: number) {
  return Math.max(0.1, Math.round(n * 10) / 10);
}

/** One commodity's posted price when its own stock (before other traders) is `own`. Same as quoteModern's. */
function unitPrice(system: StarSystem, state: MarketState, c: Commodity, i: number, own: number): number {
  const eq = equilibriumStock(system, c, i);
  const price = equilibriumPrice(system, c, i) * drift(system, c, i, state.updated) * pressure(eq, own + npcDeviation(system, c.id, state.updated));
  return round1(price);
}

/** Total paid for selling `qty` one at a time into a living market (price falls as stock rises). */
export function proceedsToSell(system: StarSystem, state: MarketState, id: string, qty: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const own = state.stock[id] ?? equilibriumStock(system, COMMODITIES[i], i);
  let total = 0;
  // Each unit sold adds to the stock first, so buying and selling back the
  // same goods comes out even, never at a profit.
  for (let n = 1; n <= qty; n++) total += unitPrice(system, state, COMMODITIES[i], i, own + n);
  return Math.round(total * 10) / 10;
}

/** Total cost of buying `qty` one at a time from a living market (price rises as stock falls). */
export function costToBuy(system: StarSystem, state: MarketState, id: string, qty: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const own = state.stock[id] ?? equilibriumStock(system, COMMODITIES[i], i);
  let total = 0;
  for (let n = 0; n < qty; n++) total += unitPrice(system, state, COMMODITIES[i], i, own - n);
  return Math.round(total * 10) / 10;
}
