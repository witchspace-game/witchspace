import type { StarSystem } from '../galaxy/generate';
import { COMMODITIES, type Commodity } from './commodities';

// Station markets.
//
// Modern rules: living markets. Each system has an equilibrium price and
// stock set by its economy and tech level. Buying drains stock and pushes the
// price up; selling does the opposite; markets drift back towards
// equilibrium over time.
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
}

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

/** Prices for a living (Modern) market. */
export function quoteModern(system: StarSystem, state: MarketState): Quote[] {
  return COMMODITIES.map((c, i) => {
    const eqPrice = equilibriumPrice(system, c, i);
    const eqStock = equilibriumStock(system, c, i);
    const stock = state.stock[c.id] ?? eqStock;
    // Scarce goods cost more; gluts cost less. Clamped to sensible bounds.
    const pressure = eqStock > 0 ? Math.pow(Math.max(eqStock, 1) / Math.max(stock, 0.5), ELASTICITY) : 1;
    const price = eqPrice * Math.min(2.5, Math.max(0.5, pressure));
    return { commodity: c, price: round1(price), stock };
  });
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
