import { FUEL_CAPACITY, type Commander } from '../game/commander';
import { distanceLy, systemsWithin, type StarSystem } from '../galaxy/generate';
import { COMMODITIES } from './commodities';
import { stationTrades } from './legality';
import { costToBuy, freshMarket, proceedsToSell, recover, type MarketState } from './market';
import { maxBuyable, quotes, type TradeContext } from './trade';

// The ship's trade computer (Modern rules): every market within a tank of
// fuel, live, and the best things to carry between them. A Modern ship has
// the galaxy's prices on tap; the edge is in acting on them first, and in
// what changes while you're in witchspace.

export interface Route {
  id: string;
  dest: StarSystem;
  ly: number;
  /** Within the fuel you have now (otherwise, refuel first). */
  reachable: boolean;
  /** Units you'd carry: as many as credits, hold and stock allow (at least 1, to show the margin). */
  qty: number;
  cost: number;
  proceeds: number;
  profit: number;
}

export interface Outlet {
  id: string;
  held: number;
  /** The best place to sell what you hold, here included (dest null). */
  dest: StarSystem | null;
  ly: number;
  proceeds: number;
  /** Proceeds selling it all here, for comparison. */
  here: number;
}

const key = (s: StarSystem) => `${s.galaxy}:${s.index}`;

/** A market as it stands now, without touching the commander's records (unvisited ones are fresh). */
export function peekMarket(c: Commander, system: StarSystem, now: number): MarketState {
  const known = c.markets[key(system)];
  return known ? { ...known, ...recover(system, known, now) } : freshMarket(system, now);
}

/** Markets within a full tank, nearest first. */
export function marketsInRange(here: StarSystem): StarSystem[] {
  return systemsWithin(here, FUEL_CAPACITY);
}

/** The most profitable things to buy here and where to take them, best first. */
export function bestRoutes(ctx: TradeContext, limit = 12): Route[] {
  const c = ctx.commander;
  const here = peekMarket(c, ctx.system, ctx.now);
  const prices = quotes(ctx);
  const dests = marketsInRange(ctx.system).map((s) => ({ s, state: peekMarket(c, s, ctx.now), ly: distanceLy(ctx.system, s) }));
  const routes: Route[] = [];
  for (const good of COMMODITIES) {
    if (good.modernOnly && c.difficulty === 'classic') continue;
    const stock = prices.find((q) => q.commodity.id === good.id)?.stock ?? 0;
    if (!stock || !stationTrades(c, ctx.system, good.id)) continue;
    const qty = Math.max(1, maxBuyable(ctx, good.id));
    const cost = costToBuy(ctx.system, here, good.id, qty);
    for (const d of dests) {
      if (!stationTrades(c, d.s, good.id)) continue;
      const proceeds = proceedsToSell(d.s, d.state, good.id, qty);
      const profit = Math.round((proceeds - cost) * 10) / 10;
      if (profit > 0) routes.push({ id: good.id, dest: d.s, ly: d.ly, reachable: d.ly <= c.fuel, qty, cost, proceeds, profit });
    }
  }
  return routes.sort((a, b) => b.profit - a.profit).slice(0, limit);
}

/** For each good in the hold: where it would fetch the most, here included. */
export function bestOutlets(ctx: TradeContext): Outlet[] {
  const c = ctx.commander;
  const here = peekMarket(c, ctx.system, ctx.now);
  const dests = marketsInRange(ctx.system).map((s) => ({ s, state: peekMarket(c, s, ctx.now), ly: distanceLy(ctx.system, s) }));
  const out: Outlet[] = [];
  for (const [id, held] of Object.entries(c.cargo)) {
    if (!held) continue;
    const sellsHere = stationTrades(c, ctx.system, id) ? proceedsToSell(ctx.system, here, id, held) : 0;
    let best: Outlet = { id, held, dest: null, ly: 0, proceeds: sellsHere, here: sellsHere };
    for (const d of dests) {
      if (!stationTrades(c, d.s, id)) continue;
      const p = proceedsToSell(d.s, d.state, id, held);
      if (p > best.proceeds) best = { id, held, dest: d.s, ly: d.ly, proceeds: p, here: sellsHere };
    }
    out.push(best);
  }
  return out.sort((a, b) => b.proceeds - b.here - (a.proceeds - a.here));
}
