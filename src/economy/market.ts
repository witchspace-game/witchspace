import type { StarSystem } from '../galaxy/generate';
import { COMMODITIES, type Commodity } from './commodities';
import { eventShare } from './events';
import { hash } from './seed';

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
  /** NPC deliveries that never arrived: the trader carrying them was destroyed. */
  lost?: { id: string; t: number; qty: number }[];
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
export const RECOVERY_MINUTES = 30; // time constant for markets to settle back


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

// Risk pays. Fewer traders brave lawless space, so there imports run short
// and exports pile up: buy cheap, sell dear, if you survive the pirates. The
// premium is a share of the price for a good the world fully imports (or
// fully exports), by government: anarchy, feudal, multi-government, dictatorship.
export const DANGER_PREMIUM = [0.45, 0.32, 0.16, 0.07, 0, 0, 0, 0];

/** A living market's usual price: the world's own, with the danger premium. */
export function equilibriumPrice(system: StarSystem, c: Commodity, i: number): number {
  return classicPrice(system, c, i) * (1 - DANGER_PREMIUM[system.government] * tradeBalance(system, c.id));
}

// Crises pay too: a world in a famine pays well over the odds for food, on
// top of what the shortage itself does to the price, until traders arrive.
const CRISIS = 0.9;

/** The extra a crisis (a world event here, or its echo nearby) puts on a good's price at time `t`. */
function crisis(system: StarSystem, id: string, t: number): number {
  const short = -eventShare(system, id, t, tradeBalance(system, id) < -0.2);
  return short > 0 ? 1 + CRISIS * short : 1;
}

/** A world's usual price for a good, without risk: Classic's, and the base of every living price. */
function classicPrice(system: StarSystem, c: Commodity, i: number): number {
  const econ = 1 + c.economyBias * (system.economy - MID);
  // High-tech worlds make advanced goods a little cheaper.
  const tech = c.economyBias > 0 ? 1 - (system.techLevel - 7) * 0.012 : 1;
  const character = 1 + (hash(system, 1, i) * 2 - 1) * c.volatility * 0.6;
  return Math.max(0.4, c.basePrice * econ * tech * character);
}

/** How much a world makes of a good relative to an average world: above 1 it's a producer, below 1 it imports. */
const production = (system: StarSystem, c: Commodity) => Math.min(3, Math.max(0.1, 1 - 4 * c.economyBias * (system.economy - MID)));

/**
 * How much deeper a living market is than a 1984 one. A whole world trades
 * through its station, so one Cobra's hold shouldn't crash a price: selling
 * a full load moves it a little, and only a stream of traders moves it a lot.
 * Importers keep at least IMPORT_FLOOR of an average world's stock.
 */
export const MARKET_DEPTH = 6;
const IMPORT_FLOOR = 0.35;

/**
 * A world's trade balance in a good, from -1 (imports nearly all it uses)
 * to 1 (a big exporter). NPC traders mostly buy where it's positive and
 * mostly deliver where it's negative.
 */
export function tradeBalance(system: StarSystem, id: string): number {
  const c = COMMODITIES.find((x) => x.id === id)!;
  if (c.baseSupply === 0) return 0;
  return Math.max(-1, Math.min(1, Math.log2(production(system, c)) / 1.6));
}

/** A 1984-sized market's usual stock: Classic's. */
function classicStock(system: StarSystem, c: Commodity, i: number): number {
  if (c.baseSupply === 0) return 0;
  // Worlds stock more of what they produce (where it's cheap).
  const size = Math.sqrt(system.population / 2.5);
  const character = 0.75 + hash(system, 2, i) * 0.5;
  return Math.round(c.baseSupply * production(system, c) * size * character);
}

/** A living market's usual stock of a good. */
export function equilibriumStock(system: StarSystem, c: Commodity, i: number): number {
  if (c.baseSupply === 0) return 0;
  const size = Math.sqrt(system.population / 2.5);
  const character = 0.75 + hash(system, 2, i) * 0.5;
  return Math.round(c.baseSupply * MARKET_DEPTH * Math.max(IMPORT_FLOOR, production(system, c)) * size * character);
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
//
// Trade has a direction. Producer worlds see NPC traders mostly buying
// (exports), importers mostly see them delivering. Left to itself an
// importer's stock would sit below its usual level and a producer's above;
// it's the steady flow of traders that brings both to normal. Stop the
// traders (a blockade, later) and importers run short.

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
  by: 'npc' | 'you' | 'lost';
  /** Credits per unit, roughly, for NPC trades; exact for yours. */
  price: number;
}

// Small markets see far fewer trades, as real illiquid markets do, so a
// handful of tonnes isn't bought out every hour.
const npcChance = (eq: number) => NPC_CHANCE * Math.min(1, (eq / 20) ** 2);
const NPC_BIAS = 0.35; // how strongly trade direction follows the world's balance

/**
 * The average push the NPC trade flow gives a world's stock, in units: up at
 * importers (deliveries), down at producers (exports). Subtracted from the
 * flow's effect, so with normal traffic stock averages its usual level.
 */
function npcFlowMean(system: StarSystem, c: Commodity, i: number): number {
  const eq = equilibriumStock(system, c, i);
  if (eq <= 0) return 0;
  const perMinute = npcChance(eq) / (NPC_SLOT / 60000);
  const meanQty = levelStep(system, c, i) * 1.5;
  return perMinute * NPC_RECOVERY_MINUTES * meanQty * (-2 * NPC_BIAS * tradeBalance(system, c.id));
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
  const chance = npcChance(eq);
  const pBuy = 0.5 + NPC_BIAS * tradeBalance(system, id);
  const out: MarketEvent[] = [];
  const M = 1_000_003;
  for (let k = Math.floor(from / NPC_SLOT); k <= Math.floor(to / NPC_SLOT); k++) {
    const slot = k % M;
    if (hash(system, 20_000 + slot, i) >= chance) continue;
    const t = k * NPC_SLOT + hash(system, 30_000 + slot, i) * NPC_SLOT;
    if (t < from || t > to) continue;
    const side = hash(system, 40_000 + slot, i) < pBuy ? 'buy' : 'sell';
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
    const i = COMMODITIES.findIndex((c) => c.id === id);
    d = -npcFlowMean(system, COMMODITIES[i], i);
    for (const e of npcTrades(system, id, t - IMPACT_MEMORY, t)) d += signed(e) * npcDecay(t - e.t);
    if (npcCache.size > 5000) npcCache.clear();
    npcCache.set(key, d);
  }
  return d;
}

// --- Supply chains ------------------------------------------------------------------
//
// Some goods are made from others. Where a world makes an output, a shortage
// of its input slows production and the output's stock falls with it; a glut
// of the input does the reverse, a little. Disrupt one link and the shortage
// spreads down the chain.

export const CHAIN_INPUTS: Record<string, string[]> = {
  alloys: ['minerals'],
  electronics: ['minerals'],
  computers: ['electronics'],
  machinery: ['alloys'],
  firearms: ['alloys'],
  hydrogen: ['water'],
  medicine: ['hydrogen'],
};
const CHAIN = 0.5; // how much of an input's shortage, as a share, passes to the output

/** Effects on the stock from outside your own trading: other traders, lost deliveries, world events and the supply chain. */
function external(system: StarSystem, state: MarketState, id: string, t: number, live: boolean): number {
  return npcDeviation(system, id, t) + lostDeviation(state, id, t) + eventDeviation(system, id, t) + chainDeviation(system, state, id, t, live);
}

/** World events here (and the echo of news from nearby) shift the stock by a share of its usual level. */
function eventDeviation(system: StarSystem, id: string, t: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const eq = equilibriumStock(system, COMMODITIES[i], i);
  if (eq <= 0) return 0;
  return eq * eventShare(system, id, t, tradeBalance(system, id) < -0.2);
}

/**
 * A commodity's stock at time `t`. Live (`t` is now) it starts from the
 * station's own stock after your trades; for history it rebuilds that from
 * the trade log.
 */
function stockOf(system: StarSystem, state: MarketState, id: string, t: number, live: boolean): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const eq = equilibriumStock(system, COMMODITIES[i], i);
  const own = live ? (state.stock[id] ?? eq) : eq + yourDeviation(state, id, t);
  return own + external(system, state, id, t, live);
}

/** Deliveries that were destroyed on the way: the stock they would have added never arrived. */
function lostDeviation(state: MarketState, id: string, t: number): number {
  let d = 0;
  for (const l of state.lost ?? []) if (l.id === id && l.t <= t) d -= l.qty * npcDecay(t - l.t);
  return d;
}

function chainDeviation(system: StarSystem, state: MarketState, id: string, t: number, live: boolean): number {
  const inputs = CHAIN_INPUTS[id];
  const making = tradeBalance(system, id);
  if (!inputs || making <= 0.1) return 0;
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const eq = equilibriumStock(system, COMMODITIES[i], i);
  let d = 0;
  for (const input of inputs) {
    const k = COMMODITIES.findIndex((c) => c.id === input);
    const eqIn = equilibriumStock(system, COMMODITIES[k], k);
    if (eqIn <= 0) continue;
    const share = Math.max(-1, Math.min(0.5, (stockOf(system, state, input, t, live) - eqIn) / eqIn));
    d += CHAIN * making * eq * share;
  }
  return d;
}

/** Prices for a living (Modern) market, as of `state.updated`. `stock` includes other traders, lost deliveries and supply chains. */
export function quoteModern(system: StarSystem, state: MarketState): Quote[] {
  return COMMODITIES.map((c, i) => {
    const eqStock = equilibriumStock(system, c, i);
    const stock = stockOf(system, state, c.id, state.updated, true);
    const price = equilibriumPrice(system, c, i) * drift(system, c, i, state.updated) * crisis(system, c.id, state.updated) * pressure(eqStock, stock);
    return { commodity: c, price: round1(price), stock: Math.max(0, Math.round(stock)) };
  });
}

/** Units of one commodity a station has to sell right now, everything included. */
export function stockFor(system: StarSystem, state: MarketState, id: string): number {
  return Math.max(0, Math.round(stockOf(system, state, id, state.updated, true)));
}

/** Your trades' push on the stock at time `t`, from the market's trade log. */
function yourDeviation(state: MarketState, id: string, t: number): number {
  let d = 0;
  for (const trade of state.trades ?? []) if (trade.id === id && trade.t <= t) d += signed(trade) * decay(t - trade.t);
  return d;
}

/** A living market's price for one commodity at any moment up to now (unrounded). */
export function priceAt(system: StarSystem, state: MarketState, id: string, t: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const c = COMMODITIES[i];
  const eq = equilibriumStock(system, c, i);
  return equilibriumPrice(system, c, i) * drift(system, c, i, t) * crisis(system, id, t) * pressure(eq, stockOf(system, state, id, t, false));
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
  const start = now - interval * count;
  const lost = new Set((state.lost ?? []).filter((l) => l.id === id).map((l) => l.t));
  const npc = npcTrades(system, id, start, now).filter((e) => !lost.has(e.t));
  const yours = (state.trades ?? []).filter((t) => t.id === id);
  const out: Candle[] = [];
  for (let k = 0; k < count; k++) {
    const t0 = start + k * interval;
    const ps: number[] = [];
    for (let j = 0; j <= SAMPLES; j++) ps.push(priceAt(system, state, id, t0 + (interval * j) / SAMPLES));
    const inCandle = (t: number) => t >= t0 && t < t0 + interval;
    const volume = npc.filter((e) => inCandle(e.t)).reduce((n, e) => n + e.qty, 0) + yours.filter((e) => inCandle(e.t)).reduce((n, e) => n + e.qty, 0);
    out.push({ t: t0, open: ps[0], high: Math.max(...ps), low: Math.min(...ps), close: ps[ps.length - 1], volume });
  }
  return out;
}

/** The latest trades in a commodity, everyone's, newest first. */
export function recentTrades(system: StarSystem, state: MarketState, id: string, now: number, limit: number): MarketEvent[] {
  const from = now - 3 * 3600_000;
  const lost = new Map((state.lost ?? []).filter((l) => l.id === id).map((l) => [l.t, l]));
  const events: MarketEvent[] = npcTrades(system, id, from, now)
    .slice(-limit)
    .map((e) => (lost.has(e.t) ? { ...e, by: 'lost' as const, price: 0 } : { ...e, price: priceAt(system, state, id, e.t) }));
  for (const t of state.trades ?? []) if (t.id === id && t.t >= from) events.push({ t: t.t, side: t.side, qty: t.qty, by: 'you', price: t.total / t.qty });
  return events.sort((a, b) => b.t - a.t).slice(0, limit);
}

/** NPC deliveries due between `from` and `to` (ms), across all goods: what inbound traders are carrying. */
export function upcomingDeliveries(system: StarSystem, state: MarketState, from: number, to: number): { id: string; t: number; qty: number }[] {
  const out: { id: string; t: number; qty: number }[] = [];
  for (const c of COMMODITIES) {
    for (const e of npcTrades(system, c.id, from, to)) {
      if (e.side === 'sell' && !(state.lost ?? []).some((l) => l.id === c.id && l.t === e.t)) out.push({ id: c.id, t: e.t, qty: e.qty });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** A delivery's trader was destroyed before it arrived: the goods never reach the market. */
export function loseDelivery(state: MarketState, delivery: { id: string; t: number; qty: number }, now: number) {
  if (delivery.t <= now) return; // already delivered
  state.lost = [...(state.lost ?? []).filter((l) => l.t > now - IMPACT_MEMORY), { ...delivery }];
}

/** Below this share of its usual stock a station is short, and posts an order to restock. */
export const SHORTAGE = 0.8;
/** Above this share it has a surplus to clear. */
export const SURPLUS = 1.25;

export interface StationOrder {
  side: 'buy' | 'sell'; // what the station is doing
  qty: number; // units to get back to its usual stock
  price: number; // average credits per unit across the order
}

/**
 * The station's own order, if it's short or overstocked: a buy order for what
 * it needs to get back to its usual stock, or a sell order for its surplus.
 * Deliveries (yours or other traders') fill it, and it shrinks as they do.
 */
export function stationOrder(system: StarSystem, state: MarketState, id: string): StationOrder | null {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const eq = equilibriumStock(system, COMMODITIES[i], i);
  if (eq <= 0) return null;
  const stock = stockFor(system, state, id);
  if (stock < eq * SHORTAGE) {
    const qty = eq - stock;
    return { side: 'buy', qty, price: proceedsToSell(system, state, id, qty) / qty };
  }
  if (stock > eq * SURPLUS) {
    const qty = stock - eq;
    return { side: 'sell', qty, price: costToBuy(system, state, id, qty) / qty };
  }
  return null;
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

/** Prices for a Classic market: fresh each visit, `visit` picks the variation. The original goods only. */
export function quoteClassic(system: StarSystem, visit: number): Quote[] {
  return COMMODITIES.flatMap((c, i) => {
    if (c.modernOnly) return [];
    const swing = 1 + (hash(system, 100 + visit, i) * 2 - 1) * c.volatility;
    const stockSwing = 0.8 + hash(system, 200 + visit, i) * 0.4;
    return {
      commodity: c,
      price: round1(classicPrice(system, c, i) * swing),
      stock: Math.round(classicStock(system, c, i) * stockSwing),
    };
  });
}

function round1(n: number) {
  return Math.max(0.1, Math.round(n * 10) / 10);
}

/**
 * The sum of the unit prices with your own stock at each level from `lo` to `hi`.
 * Only the stock moves the price, and past a point it stops moving it (pressure is
 * clamped), so a long run there counts in one step: selling two tonnes of gems,
 * two million grams, used to price every gram at every market and froze the
 * trade computer (Mark).
 */
function priceSum(system: StarSystem, state: MarketState, c: Commodity, i: number, lo: number, hi: number, outside: number): number {
  if (hi < lo) return 0;
  const eq = equilibriumStock(system, c, i);
  const base = equilibriumPrice(system, c, i) * drift(system, c, i, state.updated) * crisis(system, c.id, state.updated);
  const at = (own: number) => round1(base * pressure(eq, own + outside));
  if (eq <= 0) return at(lo) * (hi - lo + 1);
  const e = Math.max(eq, 1);
  const glut = Math.ceil(e * Math.pow(2, 1 / ELASTICITY) - outside) + 2; // from here up, the lowest price
  const scarce = Math.floor(e / Math.pow(2.5, 1 / ELASTICITY) - outside) - 2; // from here down, the highest
  let total = 0;
  if (lo <= scarce) total += (Math.min(hi, scarce) - lo + 1) * at(Math.min(hi, scarce));
  for (let own = Math.max(lo, scarce + 1); own <= Math.min(hi, glut - 1); own++) total += at(own);
  if (hi >= glut) total += (hi - Math.max(lo, glut) + 1) * at(Math.max(lo, glut));
  return total;
}

/** Total paid for selling `qty` one at a time into a living market (price falls as stock rises). */
export function proceedsToSell(system: StarSystem, state: MarketState, id: string, qty: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const own = state.stock[id] ?? equilibriumStock(system, COMMODITIES[i], i);
  // Each unit sold adds to the stock first, so buying and selling back the
  // same goods comes out even, never at a profit.
  const outside = external(system, state, id, state.updated, true);
  return Math.round(priceSum(system, state, COMMODITIES[i], i, own + 1, own + qty, outside) * 10) / 10;
}

/** Total cost of buying `qty` one at a time from a living market (price rises as stock falls). */
export function costToBuy(system: StarSystem, state: MarketState, id: string, qty: number): number {
  const i = COMMODITIES.findIndex((c) => c.id === id);
  const own = state.stock[id] ?? equilibriumStock(system, COMMODITIES[i], i);
  const outside = external(system, state, id, state.updated, true);
  return Math.round(priceSum(system, state, COMMODITIES[i], i, own - qty + 1, own, outside) * 10) / 10;
}
