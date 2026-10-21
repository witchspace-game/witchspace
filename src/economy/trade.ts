import { cleanQty, stolenQty, tidyStolen, type Commander } from '../game/commander';
import type { StarSystem } from '../galaxy/generate';
import { commodityById, cargoTonnage, UNITS_PER_TONNE } from './commodities';
import { stationTrades } from './legality';
import { checkOrders } from './orders';
import { costToBuy, freshMarket, proceedsToSell, quoteClassic, quoteModern, recover, TRADE_MEMORY, type MarketState, type Quote } from './market';

// Buying and selling at the station you're docked at. Pure functions over the
// commander's state, so they can be tested without the game running.

export interface TradeContext {
  commander: Commander;
  system: StarSystem;
  /** Hold capacity in tonnes. */
  capacity: number;
  now: number;
}

export interface TradeResult {
  ok: boolean;
  message: string;
}

const key = (s: StarSystem) => `${s.galaxy}:${s.index}`;

/** Living markets remember recent trades, for the price history. */
function logTrade(ctx: TradeContext, state: MarketState, id: string, side: 'buy' | 'sell', qty: number, total: number) {
  if (ctx.commander.difficulty === 'classic') return;
  state.trades = [...(state.trades ?? []), { t: ctx.now, id, side, qty, total }].slice(-TRADE_MEMORY);
}

/** This station's market, created or brought up to date as needed. */
export function marketState(ctx: TradeContext): MarketState {
  const c = ctx.commander;
  const k = key(ctx.system);
  if (c.difficulty === 'classic') {
    // Fresh 1984-style prices and stock for each visit.
    const existing = c.markets[k];
    if (!existing || existing.visit !== c.visits) {
      const stock: Record<string, number> = {};
      for (const q of quoteClassic(ctx.system, c.visits)) stock[q.commodity.id] = q.stock;
      c.markets[k] = { stock, updated: ctx.now, visit: c.visits };
    }
    return c.markets[k];
  }
  // Update in place, so callers holding this object see every change.
  const existing = c.markets[k];
  if (!existing) return (c.markets[k] = freshMarket(ctx.system, ctx.now));
  const recovered = recover(ctx.system, existing, ctx.now);
  existing.stock = recovered.stock;
  existing.updated = recovered.updated;
  // Limit orders here may have filled while you were away.
  checkOrders(c, ctx.system, existing, ctx.now);
  return existing;
}

export function quotes(ctx: TradeContext): Quote[] {
  const state = marketState(ctx);
  if (ctx.commander.difficulty === 'classic') {
    return quoteClassic(ctx.system, ctx.commander.visits).map((q) => ({ ...q, stock: state.stock[q.commodity.id] ?? 0 }));
  }
  return quoteModern(ctx.system, state);
}

/** Confederacies, democracies and corporate states don't trade illegal goods. */
/** Whether the station's own exchange trades a good with you (see legality.ts). */
export function tradesHere(ctx: TradeContext, id: string): boolean {
  return stationTrades(ctx.commander, ctx.system, id);
}

export function freeTonnes(ctx: TradeContext): number {
  return ctx.capacity - cargoTonnage(ctx.commander.cargo);
}

function price(ctx: TradeContext, id: string, qty: number, buying: boolean): number {
  const state = marketState(ctx);
  if (ctx.commander.difficulty === 'classic') {
    const unit = quotes(ctx).find((q) => q.commodity.id === id)!.price;
    return Math.round(unit * qty * 10) / 10;
  }
  return buying ? costToBuy(ctx.system, state, id, qty) : proceedsToSell(ctx.system, state, id, qty);
}

/** The most of a commodity you could buy right now (credits, stock and hold space allowing). */
export function maxBuyable(ctx: TradeContext, id: string): number {
  if (!tradesHere(ctx, id)) return 0;
  const c = commodityById(id)!;
  const stock = quotes(ctx).find((q) => q.commodity.id === id)!.stock;
  const bySpace = Math.floor(freeTonnes(ctx) * UNITS_PER_TONNE[c.unit] + 1e-9);
  // Cost only rises with quantity, so find the most you can afford by halving.
  let lo = 0;
  let hi = Math.min(stock, bySpace);
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (price(ctx, id, mid, true) <= ctx.commander.credits) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export function buy(ctx: TradeContext, id: string, qty: number): TradeResult {
  const c = commodityById(id);
  if (!c || qty <= 0) return { ok: false, message: 'Nothing to buy' };
  if (!tradesHere(ctx, id)) return { ok: false, message: `${c.name} isn't traded openly here` };
  const state = marketState(ctx);
  if (quotes(ctx).find((q) => q.commodity.id === id)!.stock < qty) return { ok: false, message: `Not enough ${c.name} in stock` };
  if (qty / UNITS_PER_TONNE[c.unit] > freeTonnes(ctx) + 1e-9) return { ok: false, message: 'Not enough room in the hold' };
  const cost = price(ctx, id, qty, true);
  if (cost > ctx.commander.credits) return { ok: false, message: 'Not enough credits' };
  ctx.commander.credits = Math.round((ctx.commander.credits - cost) * 10) / 10;
  state.stock[id] -= qty;
  ctx.commander.cargo[id] = (ctx.commander.cargo[id] ?? 0) + qty;
  logTrade(ctx, state, id, 'buy', qty, cost);
  return { ok: true, message: `Bought ${qty} ${c.unit} of ${c.name} for ${cost.toFixed(1)} Cr` };
}

export function sell(ctx: TradeContext, id: string, qty: number): TradeResult {
  const c = commodityById(id);
  const held = ctx.commander.cargo[id] ?? 0;
  if (!c || qty <= 0 || held < qty) return { ok: false, message: 'Nothing to sell' };
  if (!tradesHere(ctx, id)) return { ok: false, message: `${c.name} isn't traded openly here` };
  // Where there's a law, stations won't take stolen goods.
  if (ctx.system.government > 0 && qty > cleanQty(ctx.commander, id)) {
    const hot = stolenQty(ctx.commander, id);
    return { ok: false, message: `${hot} of your ${c.name} ${hot === 1 ? 'is' : 'are'} stolen: the station won't take ${hot === 1 ? 'it' : 'them'}. Try a fence in the back room` };
  }
  const proceeds = price(ctx, id, qty, false);
  ctx.commander.credits = Math.round((ctx.commander.credits + proceeds) * 10) / 10;
  const state = marketState(ctx);
  state.stock[id] = (state.stock[id] ?? 0) + qty;
  ctx.commander.cargo[id] = held - qty;
  logTrade(ctx, state, id, 'sell', qty, proceeds);
  if (ctx.commander.cargo[id] <= 0) delete ctx.commander.cargo[id];
  tidyStolen(ctx.commander);
  return { ok: true, message: `Sold ${qty} ${c.unit} of ${c.name} for ${proceeds.toFixed(1)} Cr` };
}
