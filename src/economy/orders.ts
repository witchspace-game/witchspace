import { cleanQty, type Commander } from '../game/commander';
import type { StarSystem } from '../galaxy/generate';
import { cargoTonnage, commodityById, UNITS_PER_TONNE } from './commodities';
import { priceAt, RECOVERY_MINUTES, TRADE_MEMORY, type MarketState } from './market';

// Limit orders on a station's exchange (Modern rules). A buy order holds your
// credits and a sell order holds your goods until it fills or you cancel.
// Orders fill when the market price reaches your limit, which it can do while
// you're away: prices keep moving with other traders and world events. They
// settle at the station: what you bought waits in the station's storage until
// you dock and collect it, and what you sold is paid for when you're next there.
// In the shared galaxy, the same orders will sit on the server's book.

export interface LimitOrder {
  oid: number;
  id: string;
  side: 'buy' | 'sell';
  qty: number;
  limit: number; // credits per unit
  placed: number; // ms
}

export interface Fill {
  order: LimitOrder;
  t: number;
}

export type OrderState = MarketState & {
  orders?: LimitOrder[];
  /** Goods bought by your orders, waiting at the station to be collected. */
  storage?: Record<string, number>;
  /** How far orders have been checked against the price history (ms). */
  ordersChecked?: number;
  /** Fills you haven't been told about yet. */
  fills?: Fill[];
};

const STEP = 60_000; // ms: how finely the price history is checked for fills
const LOOKBACK = 3 * 24 * 3600_000; // ms: orders older than this only check the last three days

export interface OrderResult {
  ok: boolean;
  message: string;
}

const units = (id: string) => {
  const u = commodityById(id)?.unit ?? 't';
  return u === 't' ? ' t' : ` ${u}`;
};

/** Place a limit order. Credits (buy) or goods (sell) are held until it fills or is cancelled. */
export function placeOrder(c: Commander, system: StarSystem, state: OrderState, id: string, side: 'buy' | 'sell', qty: number, limit: number, now: number): OrderResult {
  const good = commodityById(id);
  if (!good || qty <= 0 || !(limit > 0)) return { ok: false, message: 'Set a quantity and a price' };
  const price = priceAt(system, state, id, now);
  if (side === 'buy' && limit >= price) return { ok: false, message: `That's at or above the market (${price.toFixed(1)} Cr): use a market order` };
  if (side === 'sell' && limit <= price) return { ok: false, message: `That's at or below the market (${price.toFixed(1)} Cr): use a market order` };
  limit = Math.round(limit * 100) / 100;
  if (side === 'buy') {
    const hold = Math.round(limit * qty * 10) / 10;
    if (hold > c.credits) return { ok: false, message: 'Not enough credits to cover the order' };
    c.credits = Math.round((c.credits - hold) * 10) / 10;
  } else {
    if ((c.cargo[id] ?? 0) < qty) return { ok: false, message: `You haven't got that much ${good.name}` };
    if (system.government > 0 && qty > cleanQty(c, id)) return { ok: false, message: `Some of your ${good.name} is stolen: the station won't take it` };
    c.cargo[id] -= qty;
    if (c.cargo[id] <= 0) delete c.cargo[id];
  }
  const oid = Math.max(0, ...(state.orders ?? []).map((o) => o.oid)) + 1;
  state.orders = [...(state.orders ?? []), { oid, id, side, qty, limit, placed: now }];
  state.ordersChecked ??= now;
  return { ok: true, message: `${side === 'buy' ? 'Buy' : 'Sell'} order placed: ${qty}${units(id)} of ${good.name} at ${limit.toFixed(2)} Cr` };
}

/** Cancel an order: credits come back, and goods go back to the hold (or storage, if it's full). */
export function cancelOrder(c: Commander, state: OrderState, oid: number, capacity: number): OrderResult {
  const order = (state.orders ?? []).find((o) => o.oid === oid);
  if (!order) return { ok: false, message: 'No such order' };
  state.orders = state.orders!.filter((o) => o.oid !== oid);
  if (order.side === 'buy') c.credits = Math.round((c.credits + order.limit * order.qty) * 10) / 10;
  else {
    state.storage = { ...(state.storage ?? {}), [order.id]: (state.storage?.[order.id] ?? 0) + order.qty };
    collect(c, state, capacity);
  }
  return { ok: true, message: `Order cancelled: ${order.qty}${units(order.id)} of ${commodityById(order.id)?.name}` };
}

/**
 * Check open orders against the price history since they were last checked,
 * filling any whose limit the market reached. Call with the station's market
 * brought up to date (`state.updated` = now).
 */
export function checkOrders(c: Commander, system: StarSystem, state: OrderState, now: number): Fill[] {
  const open = state.orders ?? [];
  if (!open.length) {
    state.ordersChecked = now;
    return [];
  }
  const from = Math.max(state.ordersChecked ?? now, now - LOOKBACK);
  const filled: Fill[] = [];
  for (const order of open) {
    for (let t = Math.max(from, order.placed) + STEP; t <= now; t += STEP) {
      const price = priceAt(system, state, order.id, t);
      if (order.side === 'buy' ? price > order.limit : price < order.limit) continue;
      filled.push({ order, t });
      // The fill is a trade like any other: it moves the market, and the
      // station's stock now still feels it.
      const sign = order.side === 'buy' ? -1 : 1;
      state.stock[order.id] = Math.round((state.stock[order.id] ?? 0) + sign * order.qty * Math.exp(-(now - t) / 60000 / RECOVERY_MINUTES));
      state.trades = [...(state.trades ?? []), { t, id: order.id, side: order.side, qty: order.qty, total: Math.round(order.limit * order.qty * 10) / 10 }]
        .sort((a, b) => a.t - b.t)
        .slice(-TRADE_MEMORY);
      if (order.side === 'buy') state.storage = { ...(state.storage ?? {}), [order.id]: (state.storage?.[order.id] ?? 0) + order.qty };
      else c.credits = Math.round((c.credits + order.limit * order.qty) * 10) / 10;
      break;
    }
  }
  if (filled.length) {
    const done = new Set(filled.map((f) => f.order.oid));
    state.orders = open.filter((o) => !done.has(o.oid));
    state.fills = [...(state.fills ?? []), ...filled];
  }
  state.ordersChecked = now;
  return filled;
}

/** Move what's in the station's storage into the hold, as far as it fits. Returns what moved. */
export function collect(c: Commander, state: OrderState, capacity: number): Record<string, number> {
  const moved: Record<string, number> = {};
  for (const [id, qty] of Object.entries(state.storage ?? {})) {
    const perTonne = UNITS_PER_TONNE[commodityById(id)?.unit ?? 't'];
    const room = Math.floor((capacity - cargoTonnage(c.cargo)) * perTonne + 1e-9);
    const n = Math.min(qty, room);
    if (n <= 0) continue;
    c.cargo[id] = (c.cargo[id] ?? 0) + n;
    state.storage![id] = qty - n;
    if (state.storage![id] <= 0) delete state.storage![id];
    moved[id] = n;
  }
  return moved;
}

/** Plain words for a fill. */
export function describeFill(f: Fill): string {
  const o = f.order;
  return `Order filled: ${o.side === 'buy' ? 'bought' : 'sold'} ${o.qty}${units(o.id)} of ${commodityById(o.id)?.name} at ${o.limit.toFixed(2)} Cr`;
}
