import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander } from '../game/commander';
import { freshMarket, priceAt } from './market';
import { amendOrder, cancelOrder, checkOrders, collect, describeFill, placeOrder, requestCancel, sendOrder, type OrderState } from './orders';

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
  it('say what waiting for your price earned when they fill', () => {
    const c = newCommander('modern');
    c.credits = 1000;
    const state: OrderState = freshMarket(lave, NOW);
    const market = priceAt(lave, state, 'food', NOW);
    placeOrder(c, lave, state, 'food', 'buy', 10, market - 0.5, NOW);
    const order = state.orders![0];
    expect(order.market).toBe(market);
    expect(describeFill({ order, t: NOW + HOUR })).toContain(`${Math.round(0.5 * 10)} Cr better than buying at market`);
  });

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
    expect(placeOrder(c, lave, state, 'food', 'buy', 1, limit, NOW).ok).toBe(true);
    state.updated = NOW + 12 * HOUR;
    const fills = checkOrders(c, lave, state, NOW + 12 * HOUR);
    expect(fills).toHaveLength(1);
    expect(state.orders).toHaveLength(0);
    expect(state.storage?.food).toBe(1);
    expect(state.trades?.some((t) => t.id === 'food' && t.side === 'buy' && t.qty === 1)).toBe(true);
    collect(c, state, 20);
    expect(c.cargo.food).toBe(1);
    expect(state.storage?.food).toBeUndefined();
  });

  it('pay for a sell order when it fills', () => {
    const c = newCommander('modern');
    c.cargo = { food: 1 };
    const state: OrderState = freshMarket(lave, NOW);
    const { hi } = range(state, 12);
    const limit = hi - 0.02;
    expect(placeOrder(c, lave, state, 'food', 'sell', 1, limit, NOW).ok).toBe(true);
    expect(c.cargo.food).toBeUndefined(); // held by the order
    const before = c.credits;
    state.updated = NOW + 12 * HOUR;
    checkOrders(c, lave, state, NOW + 12 * HOUR);
    expect(c.credits).toBeCloseTo(before + Math.round(limit * 100) / 100, 0);
  });

  it('fill a big order in parts, only as much as the market takes at your price (Mark: no cashing a hoard in one go)', () => {
    const c = newCommander('modern');
    c.cargo = { gems: 1_000_000 };
    const state: OrderState = freshMarket(lave, NOW);
    const limit = priceAt(lave, state, 'gems', NOW) * 1.02;
    expect(placeOrder(c, lave, state, 'gems', 'sell', 1_000_000, limit, NOW).ok).toBe(true);
    const before = c.credits;
    state.updated = NOW + 12 * HOUR;
    const fills = checkOrders(c, lave, state, NOW + 12 * HOUR);
    const sold = fills.reduce((n, f) => n + f.order.qty, 0);
    // Some sells, every gram at your price or better for the market; most of it waits on the order.
    expect(sold).toBeGreaterThan(0);
    expect(sold).toBeLessThan(50_000);
    expect(c.credits - before).toBeCloseTo(Math.round(limit * 100) / 100 * sold, -1);
    expect(state.orders?.[0].qty).toBe(1_000_000 - sold);
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

  describe('cancelled or changed from another station, at the speed of news', () => {
    const DELAY = 30 * 60_000;

    it('a cancel from here is instant, as before', () => {
      const c = newCommander('modern');
      c.credits = 500;
      const state: OrderState = freshMarket(lave, NOW);
      placeOrder(c, lave, state, 'food', 'buy', 10, priceAt(lave, state, 'food', NOW) * 0.5, NOW);
      expect(requestCancel(c, state, state.orders![0].oid, 20, NOW, 0, 'Lave').ok).toBe(true);
      expect(state.orders).toHaveLength(0);
      expect(c.credits).toBeCloseTo(500, 1);
    });

    it('a cancel sent from elsewhere works only when it arrives, and the credits come back then', () => {
      const c = newCommander('modern');
      c.credits = 500;
      const state: OrderState = freshMarket(lave, NOW);
      placeOrder(c, lave, state, 'food', 'buy', 10, priceAt(lave, state, 'food', NOW) * 0.5, NOW);
      const held = 500 - c.credits;
      expect(requestCancel(c, state, state.orders![0].oid, 20, NOW, DELAY, 'Lave').ok).toBe(true);
      // Not yet: the order is still there and the credits still held.
      state.updated = NOW + DELAY / 2;
      checkOrders(c, lave, state, NOW + DELAY / 2);
      expect(state.orders).toHaveLength(1);
      expect(c.credits).toBeCloseTo(500 - held, 1);
      // Arrived: gone, credits back, and told once.
      state.updated = NOW + DELAY + 60_000;
      checkOrders(c, lave, state, NOW + DELAY + 60_000);
      expect(state.orders).toHaveLength(0);
      expect(c.credits).toBeCloseTo(500, 1);
      expect(state.cancelled).toHaveLength(1);
    });

    it('an order can still fill before its cancel arrives, and the fill stands', () => {
      const c = newCommander('modern');
      c.credits = 1000;
      const state: OrderState = freshMarket(lave, NOW);
      const { lo } = range(state, 12);
      placeOrder(c, lave, state, 'food', 'buy', 1, lo + 0.02, NOW);
      requestCancel(c, state, state.orders![0].oid, 20, NOW, 12 * HOUR, 'Lave');
      state.updated = NOW + 13 * HOUR;
      const fills = checkOrders(c, lave, state, NOW + 13 * HOUR);
      expect(fills).toHaveLength(1);
      expect(state.storage?.food).toBe(1);
      expect(state.cancelled ?? []).toHaveLength(0);
    });

    it('a sell cancelled from elsewhere puts the goods back in storage there', () => {
      const c = newCommander('modern');
      c.cargo = { food: 3 };
      const state: OrderState = freshMarket(lave, NOW);
      placeOrder(c, lave, state, 'food', 'sell', 3, priceAt(lave, state, 'food', NOW) * 3, NOW);
      requestCancel(c, state, state.orders![0].oid, 20, NOW, DELAY, 'Lave');
      state.updated = NOW + DELAY + 60_000;
      checkOrders(c, lave, state, NOW + DELAY + 60_000);
      expect(state.storage?.food).toBe(3);
      expect(c.cargo.food).toBeUndefined();
    });

    it('a lower price sent from elsewhere takes over when it arrives, and gives back what it no longer holds', () => {
      const c = newCommander('modern');
      c.credits = 1000;
      const state: OrderState = freshMarket(lave, NOW);
      const p = priceAt(lave, state, 'food', NOW);
      placeOrder(c, lave, state, 'food', 'buy', 10, p * 0.5, NOW);
      const before = c.credits;
      const next = Math.round(p * 0.4 * 100) / 100;
      expect(amendOrder(c, lave, state, state.orders![0].oid, next, NOW, DELAY).ok).toBe(true);
      expect(state.orders![0].limit).toBeCloseTo(Math.round(p * 0.5 * 100) / 100, 2); // the old price, until it arrives
      state.updated = NOW + DELAY + 60_000;
      checkOrders(c, lave, state, NOW + DELAY + 60_000);
      expect(state.orders![0].limit).toBe(next);
      expect(c.credits).toBeCloseTo(before + (Math.round(p * 0.5 * 100) / 100 - next) * 10, 0);
    });

    it('a higher buy price holds the extra credits at once, and a fill at the old price gives them back', () => {
      const c = newCommander('modern');
      c.credits = 1000;
      const state: OrderState = freshMarket(lave, NOW);
      const { lo } = range(state, 12);
      const limit = Math.round((lo + 0.02) * 100) / 100;
      placeOrder(c, lave, state, 'food', 'buy', 1, limit, NOW);
      const before = c.credits;
      amendOrder(c, lave, state, state.orders![0].oid, limit + 1, NOW, 12 * HOUR);
      expect(c.credits).toBeCloseTo(before - 1, 1);
      state.updated = NOW + 12 * HOUR - 60_000;
      checkOrders(c, lave, state, NOW + 12 * HOUR - 60_000);
      expect(state.storage?.food).toBe(1);
      expect(c.credits).toBeCloseTo(before, 1); // the spare came back with the fill
    });

    it('a change at the station you are at is instant, and refused if it would fill at once', () => {
      const c = newCommander('modern');
      c.credits = 1000;
      const state: OrderState = freshMarket(lave, NOW);
      const p = priceAt(lave, state, 'food', NOW);
      placeOrder(c, lave, state, 'food', 'buy', 10, p * 0.5, NOW);
      expect(amendOrder(c, lave, state, state.orders![0].oid, p * 2, NOW, 0).ok).toBe(false);
      expect(amendOrder(c, lave, state, state.orders![0].oid, p * 0.6, NOW, 0).ok).toBe(true);
      expect(state.orders![0].limit).toBeCloseTo(p * 0.6, 1);
      expect(c.credits).toBeCloseTo(1000 - Math.round(p * 0.6 * 100) / 100 * 10, 0);
    });

    it('works on an order sent from elsewhere that has not arrived yet', () => {
      const c = newCommander('modern');
      c.credits = 1000;
      const state: OrderState = freshMarket(lave, NOW);
      const p = priceAt(lave, state, 'food', NOW);
      sendOrder(c, lave, state, 'food', 'buy', 5, p * 0.5, NOW, DELAY);
      const left = c.credits;
      requestCancel(c, state, state.orders![0].oid, 20, NOW + 60_000, DELAY, 'Lave');
      state.updated = NOW + 2 * DELAY + 120_000;
      checkOrders(c, lave, state, NOW + 2 * DELAY + 120_000);
      expect(state.orders).toHaveLength(0);
      expect(c.credits).toBeCloseTo(left + Math.round(p * 0.5 * 100) / 100 * 5, 0);
    });
  });
});
