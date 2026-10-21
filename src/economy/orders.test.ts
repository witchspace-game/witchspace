import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander } from '../game/commander';
import { freshMarket, priceAt } from './market';
import { cancelOrder, checkOrders, collect, placeOrder, type OrderState } from './orders';

const NOW = 1_800_000_000_000;
const lave = systemAt(0, 7);
const HOUR = 3600_000;

/** The lowest and highest food price at Lave over the next `hours`, from now. */
function range(state: OrderState, hours: number) {
  let lo = Infinity;
  let hi = -Infinity;
  for (let t = NOW; t <= NOW + hours * HOUR; t += 60_000) {
    const p = priceAt(lave, state, 'food', t);
    lo = Math.min(lo, p);
    hi = Math.max(hi, p);
  }
  return { lo, hi };
}

describe('limit orders', () => {
  it('hold the credits for a buy order, and refuse one that would fill at once', () => {
    const c = newCommander('modern');
    c.credits = 1000;
    const state: OrderState = freshMarket(lave, NOW);
    const now = priceAt(lave, state, 'food', NOW);
    expect(placeOrder(c, lave, state, 'food', 'buy', 10, now + 1, NOW).ok).toBe(false);
    expect(placeOrder(c, lave, state, 'food', 'buy', 10, now * 0.98, NOW).ok).toBe(true);
    expect(c.credits).toBeCloseTo(1000 - Math.round(now * 0.98 * 100) / 100 * 10, 0);
  });

  it('fill while you are away, when the price reaches the limit, and wait in storage', () => {
    const c = newCommander('modern');
    c.credits = 1000;
    const state: OrderState = freshMarket(lave, NOW);
    const { lo } = range(state, 12);
    const limit = lo + 0.02;
    expect(placeOrder(c, lave, state, 'food', 'buy', 5, limit, NOW).ok).toBe(true);
    state.updated = NOW + 12 * HOUR;
    const fills = checkOrders(c, lave, state, NOW + 12 * HOUR);
    expect(fills).toHaveLength(1);
    expect(state.orders).toHaveLength(0);
    expect(state.storage?.food).toBe(5);
    expect(state.trades?.some((t) => t.id === 'food' && t.side === 'buy' && t.qty === 5)).toBe(true);
    collect(c, state, 20);
    expect(c.cargo.food).toBe(5);
    expect(state.storage?.food).toBeUndefined();
  });

  it('pay for a sell order when it fills', () => {
    const c = newCommander('modern');
    c.cargo = { food: 4 };
    const state: OrderState = freshMarket(lave, NOW);
    const { hi } = range(state, 12);
    const limit = hi - 0.02;
    expect(placeOrder(c, lave, state, 'food', 'sell', 4, limit, NOW).ok).toBe(true);
    expect(c.cargo.food).toBeUndefined(); // held by the order
    const before = c.credits;
    state.updated = NOW + 12 * HOUR;
    checkOrders(c, lave, state, NOW + 12 * HOUR);
    expect(c.credits).toBeCloseTo(before + Math.round(limit * 100) / 100 * 4, 0);
  });

  it('give everything back when cancelled', () => {
    const c = newCommander('modern');
    c.credits = 500;
    c.cargo = { food: 3 };
    const state: OrderState = freshMarket(lave, NOW);
    const p = priceAt(lave, state, 'food', NOW);
    placeOrder(c, lave, state, 'food', 'buy', 10, p * 0.5, NOW);
    placeOrder(c, lave, state, 'food', 'sell', 3, p * 2, NOW);
    for (const o of [...(state.orders ?? [])]) cancelOrder(c, state, o.oid, 20);
    expect(c.credits).toBeCloseTo(500, 1);
    expect(c.cargo.food).toBe(3);
    expect(state.orders).toHaveLength(0);
  });

  it("doesn't fill an order whose limit the market never reaches", () => {
    const c = newCommander('modern');
    c.credits = 1000;
    const state: OrderState = freshMarket(lave, NOW);
    const { lo } = range(state, 6);
    placeOrder(c, lave, state, 'food', 'buy', 5, lo * 0.5, NOW);
    state.updated = NOW + 6 * HOUR;
    expect(checkOrders(c, lave, state, NOW + 6 * HOUR)).toHaveLength(0);
    expect(state.orders).toHaveLength(1);
  });
});
