import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from '../galaxy/generate';
import { cargoTonnage, COMMODITIES } from './commodities';
import { candles, costToBuy, drift, equilibriumStock, freshMarket, loseDelivery, npcTrades, orderBook, priceAt, quoteClassic, quoteModern, recentTrades, recover, stationOrder, stockFor, tradeBalance, upcomingDeliveries } from './market';

const price = (q: ReturnType<typeof quoteModern>, id: string) => q.find((x) => x.commodity.id === id)!.price;
const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

describe('prices follow the economy', () => {
  const systems = galaxy(0);
  const industrial = systems.filter((s) => s.economy <= 1);
  const agricultural = systems.filter((s) => s.economy >= 6);
  const avgPrice = (group: typeof systems, id: string) => avg(group.map((s) => price(quoteModern(s, freshMarket(s, 0)), id)));

  it('food is cheaper on agricultural worlds', () => {
    expect(avgPrice(agricultural, 'food')).toBeLessThan(avgPrice(industrial, 'food'));
  });

  it('computers are cheaper on industrial worlds', () => {
    expect(avgPrice(industrial, 'computers')).toBeLessThan(avgPrice(agricultural, 'computers'));
  });

  it('a classic trade route makes money: computers out to the farms', () => {
    const margin = avgPrice(agricultural, 'computers') - avgPrice(industrial, 'computers');
    expect(margin).toBeGreaterThan(10);
  });

  it('is the same every time for the same world', () => {
    const lave = systemAt(0, 7);
    expect(quoteModern(lave, freshMarket(lave, 0))).toEqual(quoteModern(lave, freshMarket(lave, 0)));
  });
});

describe('living markets (Modern)', () => {
  const lave = systemAt(0, 7);

  it('buying drains stock and raises the price', () => {
    const before = freshMarket(lave, 0);
    const after = { ...before, stock: { ...before.stock, food: before.stock.food - 10 } };
    expect(price(quoteModern(lave, after), 'food')).toBeGreaterThan(price(quoteModern(lave, before), 'food'));
  });

  it('selling a glut lowers the price', () => {
    const before = freshMarket(lave, 0);
    const after = { ...before, stock: { ...before.stock, computers: before.stock.computers + 40 } };
    expect(price(quoteModern(lave, after), 'computers')).toBeLessThan(price(quoteModern(lave, before), 'computers'));
  });

  it('buying in bulk costs more than buying one at today\'s price', () => {
    const m = freshMarket(lave, 0);
    expect(costToBuy(lave, m, 'food', 10)).toBeGreaterThan(price(quoteModern(lave, m), 'food') * 10);
  });

  it('markets recover over time', () => {
    const m = freshMarket(lave, 0);
    const drained = { stock: { ...m.stock, food: 0 }, updated: 0 };
    const later = recover(lave, drained, 2 * 60 * 60 * 1000); // two hours
    expect(later.stock.food).toBeGreaterThan(m.stock.food * 0.9);
  });
});

describe('classic markets', () => {
  it('give different prices on different visits', () => {
    const lave = systemAt(0, 7);
    const a = quoteClassic(lave, 1).map((q) => q.price);
    const b = quoteClassic(lave, 2).map((q) => q.price);
    expect(a).not.toEqual(b);
  });
});

describe('the cargo hold', () => {
  it('counts gold in kilograms and gems in grams', () => {
    expect(cargoTonnage({ food: 3, gold: 500, gems: 250_000 })).toBeCloseTo(3.75);
  });
});

describe('the exchange view of a living market', () => {
  const lave = systemAt(0, 7);
  const NOW = 1_800_000_000_000;

  it('drifts gently, within the commodity volatility', () => {
    const food = COMMODITIES.findIndex((c) => c.id === 'food');
    for (let t = NOW; t < NOW + 6 * 3600_000; t += 97_000) {
      const d = drift(lave, COMMODITIES[food], food, t);
      expect(Math.abs(d - 1)).toBeLessThanOrEqual(COMMODITIES[food].volatility * 0.2 + 1e-9);
    }
  });

  it('moves smoothly, without jumps between nearby moments', () => {
    const gems = COMMODITIES.findIndex((c) => c.id === 'gems');
    const a = drift(lave, COMMODITIES[gems], gems, NOW);
    const b = drift(lave, COMMODITIES[gems], gems, NOW + 1000);
    expect(Math.abs(a - b)).toBeLessThan(0.002);
  });

  it('has a price history that ends at the live price', () => {
    const state = freshMarket(lave, NOW);
    const live = price(quoteModern(lave, state), 'computers');
    expect(priceAt(lave, state, 'computers', NOW)).toBeCloseTo(live, 0);
    const cs = candles(lave, state, 'computers', NOW, 300_000, 24);
    expect(cs).toHaveLength(24);
    for (const c of cs) expect(c.high).toBeGreaterThanOrEqual(Math.max(c.open, c.close) - 1e-9);
  });

  it('remembers trades: the history shows a big purchase pushing the price up', () => {
    const state = freshMarket(lave, NOW);
    const before = priceAt(lave, state, 'food', NOW);
    state.stock.food -= 15;
    state.trades = [{ t: NOW, id: 'food', side: 'buy', qty: 15, total: 0 }];
    expect(priceAt(lave, state, 'food', NOW + 1)).toBeGreaterThan(before);
    expect(priceAt(lave, state, 'food', NOW - 1)).toBeCloseTo(before, 6);
  });

  it('implies an order book: asks rise, bids fall, and the spread is never negative', () => {
    const state = freshMarket(lave, NOW);
    const { asks, bids } = orderBook(lave, state, 'computers', 8);
    for (let k = 1; k < asks.length; k++) expect(asks[k].price).toBeGreaterThanOrEqual(asks[k - 1].price);
    for (let k = 1; k < bids.length; k++) expect(bids[k].price).toBeLessThanOrEqual(bids[k - 1].price);
    expect(asks[0].price).toBeGreaterThanOrEqual(bids[0].price);
  });

  it('stops the asks where the stock runs out', () => {
    const state = freshMarket(lave, NOW);
    state.stock.furs -= stockFor(lave, state, 'furs') - 3; // leave three for sale, other traders included
    const { asks, step } = orderBook(lave, state, 'furs', 8);
    expect(stockFor(lave, state, 'furs')).toBe(3);
    expect(asks.reduce((n, l) => n + l.qty, 0)).toBe(3);
    expect(step).toBeGreaterThan(0);
  });

  it('has other traders buying and selling, the same for everyone', () => {
    const a = npcTrades(lave, 'food', NOW, NOW + 3600_000);
    expect(a.length).toBeGreaterThan(5);
    expect(npcTrades(lave, 'food', NOW, NOW + 3600_000)).toEqual(a);
    expect(new Set(a.map((e) => e.side)).size).toBe(2);
  });

  it('lets other traders move the price', () => {
    const state = freshMarket(lave, NOW);
    const [first] = npcTrades(lave, 'food', NOW, NOW + 3600_000);
    const before = priceAt(lave, state, 'food', first.t - 1);
    const after = priceAt(lave, state, 'food', first.t + 1);
    if (first.side === 'buy') expect(after).toBeGreaterThan(before);
    else expect(after).toBeLessThan(before);
  });

  it('counts everyone in the candle volume, and lists the latest trades newest first', () => {
    const state = freshMarket(lave, NOW);
    const cs = candles(lave, state, 'food', NOW, 3600_000, 6);
    expect(cs.reduce((n, c) => n + c.volume, 0)).toBeGreaterThan(0);
    const recent = recentTrades(lave, state, 'food', NOW, 10);
    for (let k = 1; k < recent.length; k++) expect(recent[k].t).toBeLessThanOrEqual(recent[k - 1].t);
    for (const e of recent) expect(e.price).toBeGreaterThan(0);
  });
});

describe('supply and demand', () => {
  const NOW = 1_800_000_000_000;
  const systems = galaxy(0);

  it('sends traders to buy where goods are made and deliver where they are wanted', () => {
    const farm = systems.find((s) => tradeBalance(s, 'food') > 0.5)!;
    const works = systems.find((s) => tradeBalance(s, 'food') < -0.5)!;
    const sells = (s: typeof farm) => npcTrades(s, 'food', NOW, NOW + 48 * 3600_000).filter((e) => e.side === 'sell').length;
    const buys = (s: typeof farm) => npcTrades(s, 'food', NOW, NOW + 48 * 3600_000).filter((e) => e.side === 'buy').length;
    expect(buys(farm)).toBeGreaterThan(sells(farm));
    expect(sells(works)).toBeGreaterThan(buys(works));
  });

  it('keeps stock around its usual level with normal traffic', () => {
    for (const s of systems.slice(0, 40)) {
      const i = COMMODITIES.findIndex((c) => c.id === 'food');
      const eq = equilibriumStock(s, COMMODITIES[i], i);
      if (eq < 20) continue;
      let total = 0;
      const n = 200;
      for (let k = 0; k < n; k++) total += stockFor(s, freshMarket(s, NOW + k * 1_234_567), 'food');
      expect(total / n).toBeGreaterThan(eq * 0.85);
      expect(total / n).toBeLessThan(eq * 1.15);
    }
  });

  it('posts a buy order when short, filled down by deliveries', () => {
    const lave = systemAt(0, 7);
    const state = freshMarket(lave, NOW);
    const usual = equilibriumStock(lave, COMMODITIES[0], 0);
    state.stock.food -= stockFor(lave, state, 'food') - Math.floor(usual / 2); // half empty
    const order = stationOrder(lave, state, 'food')!;
    expect(order.side).toBe('buy');
    expect(order.qty).toBe(usual - Math.floor(usual / 2));
    state.stock.food += 5;
    expect(stationOrder(lave, state, 'food')!.qty).toBe(order.qty - 5);
  });

  it('keeps the new goods out of Classic markets', () => {
    const lave = systemAt(0, 7);
    expect(quoteClassic(lave, 1).some((q) => q.commodity.modernOnly)).toBe(false);
    expect(quoteModern(lave, freshMarket(lave, NOW)).some((q) => q.commodity.id === 'medicine')).toBe(true);
  });
});

describe('supply chains and deliveries', () => {
  const NOW = 1_800_000_000_000;
  const systems = galaxy(0);

  it('passes a shortage of an input down to what is made from it', () => {
    const works = systems.find((s) => tradeBalance(s, 'computers') > 0.4 && equilibriumStock(s, COMMODITIES[7], 7) > 0)!;
    const state = freshMarket(works, NOW);
    const before = stockFor(works, state, 'computers');
    state.stock.electronics = 0; // electronics bought out
    expect(stockFor(works, state, 'computers')).toBeLessThan(before);
    expect(priceAt(works, state, 'computers', NOW)).toBeGreaterThanOrEqual(priceAt(works, freshMarket(works, NOW), 'computers', NOW));
  });

  it('leaves goods a world only imports untouched by its inputs', () => {
    const farm = systems.find((s) => tradeBalance(s, 'computers') < -0.3)!;
    const state = freshMarket(farm, NOW);
    const before = stockFor(farm, state, 'computers');
    state.stock.electronics = 0;
    expect(stockFor(farm, state, 'computers')).toBe(before);
  });

  it('knows which deliveries inbound traders carry, and a lost one never arrives', () => {
    const works = systems.find((s) => tradeBalance(s, 'food') < -0.5)!;
    const state = freshMarket(works, NOW);
    const [next] = upcomingDeliveries(works, state, NOW, NOW + 3600_000);
    expect(next).toBeDefined();
    const after = (s: typeof state) => stockFor(works, { ...s, updated: next.t + 1 }, next.id);
    const withIt = after(state);
    loseDelivery(state, next, NOW);
    expect(after(state)).toBe(withIt - next.qty);
    expect(upcomingDeliveries(works, state, NOW, NOW + 3600_000)).not.toContainEqual(next);
    expect(recentTrades(works, state, next.id, next.t + 1, 30).find((e) => e.t === next.t)?.by).toBe('lost');
  });

  it("can't undo a delivery that has already arrived", () => {
    const lave = systemAt(0, 7);
    const state = freshMarket(lave, NOW);
    loseDelivery(state, { id: 'food', t: NOW - 1000, qty: 4 }, NOW);
    expect(state.lost ?? []).toHaveLength(0);
  });
});
