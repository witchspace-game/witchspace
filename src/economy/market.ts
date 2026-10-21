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
  /** This commodity's stock straight after the trade. */
  stockAfter: number;
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

/** Prices for a living (Modern) market, as of `state.updated`. */
export function quoteModern(system: StarSystem, state: MarketState): Quote[] {
  return COMMODITIES.map((c, i) => {
    const eqStock = equilibriumStock(system, c, i);
    const stock = state.stock[c.id] ?? eqStock;
    const price = equilibriumPrice(system, c, i) * drift(system, c, i, state.updated) * pressure(eqStock, stock);
    return { commodity: c, price: round1(price), stock };
  });
}

/**
 * A commodity's stock at a past moment: back at equilibrium, unless one of
 * your trades disturbed it, after which it recovers exponentially.
 */
function stockAt(system: StarSystem, state: MarketState, c: Commodity, i: number, t: number): number {
  const eq = equilibriumStock(system, c, i);
  let last: MarketTrade | undefined;
  for (const trade of state.trades ?? []) if (trade.id === c.id && trade.t <= t) last = trade;
  if (!last) return eq;
  return eq + (last.stockAfter - eq) * Math.exp(-(t - last.t) / 60000 / RECOVERY_MINUTES);
}

/** A living market's price for one commodity at any moment up to now (unrounded). */
export function priceAt(system: StarSystem, state: MarketState, id: string, t: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const c = COMMODITIES[i];
  return equilibriumPrice(system, c, i) * drift(system, c, i, t) * pressure(equilibriumStock(system, c, i), stockAt(system, state, c, i, t));
}

export interface Candle {
  t: number; // start of the candle
  open: number;
  high: number;
  low: number;
  close: number;
}

/** `count` candles of `interval` ms each, the last one ending at `now`, sampled from the price history. */
export function candles(system: StarSystem, state: MarketState, id: string, now: number, interval: number, count: number): Candle[] {
  const SAMPLES = 12;
  const out: Candle[] = [];
  const start = now - interval * count;
  for (let k = 0; k < count; k++) {
    const t0 = start + k * interval;
    const ps: number[] = [];
    for (let j = 0; j <= SAMPLES; j++) ps.push(priceAt(system, state, id, t0 + (interval * j) / SAMPLES));
    out.push({ t: t0, open: ps[0], high: Math.max(...ps), low: Math.min(...ps), close: ps[ps.length - 1] });
  }
  return out;
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
  const step = Math.max(1, Math.round(equilibriumStock(system, COMMODITIES[i], i) / 20));
  const stock = state.stock[id] ?? 0;
  const asks: BookLevel[] = [];
  const bids: BookLevel[] = [];
  for (let k = 0; k < levels; k++) {
    const askQty = Math.min(step, stock - k * step);
    if (askQty > 0) {
      const s: MarketState = { stock: { ...state.stock, [id]: stock - k * step }, updated: state.updated };
      asks.push({ price: costToBuy(system, s, id, askQty) / askQty, qty: askQty });
    }
    const s: MarketState = { stock: { ...state.stock, [id]: stock + k * step }, updated: state.updated };
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

/** Total paid for selling `qty` one at a time into a living market (price falls as stock rises). */
export function proceedsToSell(system: StarSystem, state: MarketState, id: string, qty: number): number {
  let total = 0;
  const s: MarketState = { stock: { ...state.stock }, updated: state.updated };
  for (let n = 0; n < qty; n++) {
    // Each unit sold adds to the stock first, so buying and selling back
    // the same goods comes out even, never at a profit.
    s.stock[id] += 1;
    total += quoteModern(system, s).find((q) => q.commodity.id === id)!.price;
  }
  return Math.round(total * 10) / 10;
}

/** Total cost of buying `qty` one at a time from a living market (price rises as stock falls). */
export function costToBuy(system: StarSystem, state: MarketState, id: string, qty: number): number {
  let total = 0;
  const s: MarketState = { stock: { ...state.stock }, updated: state.updated };
  for (let n = 0; n < qty; n++) {
    total += quoteModern(system, s).find((q) => q.commodity.id === id)!.price;
    s.stock[id] -= 1;
  }
  return Math.round(total * 10) / 10;
}
