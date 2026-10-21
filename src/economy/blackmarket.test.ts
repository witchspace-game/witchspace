import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from '../galaxy/generate';
import { newCommander } from '../game/commander';
import { abolitionistPrice, backRoomQuotes, backRoomTrade, freeSlaves, hasBackRoom, stingChance } from './blackmarket';
import { freshMarket, quoteModern } from './market';

const NOW = 1_800_000_000_000;
const systems = galaxy(0);
const byGov = (g: number) => systems.find((s) => s.government === g)!;

describe('the back room', () => {
  it('only exists where there is a law to break, and only under Modern rules', () => {
    expect(hasBackRoom(newCommander('modern'), byGov(0))).toBe(false);
    expect(hasBackRoom(newCommander('modern'), byGov(6))).toBe(true);
    expect(hasBackRoom(newCommander('classic'), byGov(6))).toBe(false);
  });

  it('pays more where the law is stricter', () => {
    const c = newCommander('modern');
    const anarchy = byGov(0);
    const open = quoteModern(anarchy, freshMarket(anarchy, NOW)).find((q) => q.commodity.id === 'narcotics')!.price;
    const feudal = backRoomQuotes(c, byGov(1), freshMarket(byGov(1), NOW), NOW).find((q) => q.id === 'narcotics')!;
    const corporate = backRoomQuotes(c, byGov(7), freshMarket(byGov(7), NOW), NOW).find((q) => q.id === 'narcotics')!;
    expect(feudal.bid).toBeGreaterThan(open);
    expect(corporate.bid / corporate.ask).toBeLessThan(0.9); // a wide spread
    expect(stingChance(byGov(7), 5)).toBeGreaterThan(stingChance(byGov(1), 5));
  });

  it('lists firearms only for commanders without a licence, where they are licensed', () => {
    const c = newCommander('modern');
    const lave = systemAt(0, 7); // dictatorship: firearms licensed
    expect(backRoomQuotes(c, lave, freshMarket(lave, NOW), NOW).some((q) => q.id === 'firearms')).toBe(true);
    c.equipment.push('weapons-licence');
    expect(backRoomQuotes(c, lave, freshMarket(lave, NOW), NOW).some((q) => q.id === 'firearms')).toBe(false);
  });

  it('sells, or seizes the goods when the buyer is police', () => {
    const lave = systemAt(0, 7);
    const c = newCommander('modern');
    c.cargo = { narcotics: 4 };
    const state = freshMarket(lave, NOW);
    const ok = backRoomTrade(c, lave, state, 'narcotics', 'sell', 2, 20, NOW, () => 0.99);
    expect(ok).toMatchObject({ ok: true, caught: false });
    expect(c.cargo.narcotics).toBe(2);
    const credits = c.credits;
    const sting = backRoomTrade(c, lave, state, 'narcotics', 'sell', 2, 20, NOW, () => 0);
    expect(sting).toMatchObject({ ok: true, caught: true });
    expect(c.cargo.narcotics).toBeUndefined();
    expect(c.credits).toBe(credits);
  });

  it('is thin: each unit sold fetches less than the last', () => {
    const lave = systemAt(0, 7);
    const c = newCommander('modern');
    const state = freshMarket(lave, NOW);
    const q = backRoomQuotes(c, lave, state, NOW).find((x) => x.id === 'narcotics')!;
    c.cargo = { narcotics: 6 };
    backRoomTrade(c, lave, state, 'narcotics', 'sell', 6, 20, NOW, () => 0.99);
    const after = backRoomQuotes(c, lave, state, NOW).find((x) => x.id === 'narcotics')!;
    expect(after.bid).toBeLessThan(q.bid * 0.9);
  });
});

describe('abolitionists', () => {
  it('buy slaves to free them, legally, for less than the back room', () => {
    const lawful = byGov(6);
    const c = newCommander('modern');
    c.cargo = { slaves: 3 };
    const back = backRoomQuotes(c, lawful, freshMarket(lawful, NOW), NOW).find((q) => q.id === 'slaves')!;
    expect(abolitionistPrice(lawful, NOW)).toBeLessThan(back.bid);
    expect(freeSlaves(c, lawful, 3, NOW).ok).toBe(true);
    expect(c.freed).toBe(3);
    expect(c.cargo.slaves).toBeUndefined();
  });
});
