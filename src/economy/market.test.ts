import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from '../galaxy/generate';
import { cargoTonnage } from './commodities';
import { costToBuy, freshMarket, quoteClassic, quoteModern, recover } from './market';

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
