import { describe, expect, it } from 'vitest';
import { freshMarket, priceAt } from '../economy/market';
import { placeOrder, requestCancel, sendOrder, type OrderState } from '../economy/orders';
import { systemAt } from '../galaxy/generate';
import { newCommander } from '../game/commander';
import { openOrders, orderStatus, ticker } from './ordersList';

const NOW = 1_800_000_000_000;
const lave = systemAt(0, 7);
const diso = systemAt(0, 129);

describe('your orders across every market', () => {
  it('lists orders everywhere, here first, with what your news says of each', () => {
    const c = newCommander('modern');
    c.credits = 5000;
    const here: OrderState = freshMarket(lave, NOW);
    const there: OrderState = freshMarket(diso, NOW - 20 * 60_000);
    c.markets = { [`0:${lave.index}`]: here, [`0:${diso.index}`]: there } as never;
    sendOrder(c, diso, there, 'food', 'buy', 3, priceAt(diso, there, 'food', NOW) * 0.5, NOW, 30 * 60_000);
    placeOrder(c, lave, here, 'food', 'buy', 2, priceAt(lave, here, 'food', NOW) * 0.5, NOW);
    const rows = openOrders(c, lave, NOW);
    expect(rows.map((r) => r.system.name)).toEqual([lave.name, diso.name]);
    expect(rows[0].status).toBe('Open');
    expect(rows[1].status).toMatch(/^Arrives /);
    expect(rows[1].travelling).toBe(true);
  });

  it('says when a cancel is on its way, and when a market was last heard from', () => {
    const c = newCommander('modern');
    c.credits = 5000;
    const there: OrderState = freshMarket(diso, NOW);
    placeOrder(c, diso, there, 'food', 'buy', 2, priceAt(diso, there, 'food', NOW) * 0.5, NOW);
    expect(orderStatus(there.orders![0], there, false, NOW).text).toMatch(/^Open, as of /);
    requestCancel(c, there, there.orders![0].oid, 20, NOW, 30 * 60_000, diso.name);
    expect(orderStatus(there.orders![0], there, false, NOW).text).toMatch(/^Cancelling, arrives /);
  });

  it('names pairs as an exchange does', () => {
    expect(ticker('medicine')).toBe('MEDS');
    expect(ticker('btc')).toBe('BTC');
  });
});
