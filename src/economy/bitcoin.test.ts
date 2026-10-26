import { afterEach, describe, expect, it } from 'vitest';
import { STAKE, newCommander } from '../game/commander';
import { claimInsurance } from '../game/insurance';
import { charge, spareCredits } from '../game/law';
import { askPrice, bidPrice, btcValue, buyBitcoin, cover, formatBtc, onSold, SATS, sellBitcoin, setQuote, SPREAD, STALE_MS, type Sold } from './bitcoin';

const NOW = 1_800_000_000_000;
const quote = { price: 80_000, time: NOW - 10_000 };

afterEach(() => setQuote(null));

describe('Bitcoin on the exchange', () => {
  it('buys sats at the live price plus the spread', () => {
    const c = newCommander('modern');
    const r = buyBitcoin(c, quote, 100, NOW);
    expect(r.ok).toBe(true);
    // 100 Cr at 80,400 a coin: about 124,378 sats
    expect(c.sats).toBe(Math.floor((100 * SATS) / askPrice(quote)));
    expect(c.credits).toBeGreaterThanOrEqual(0);
    expect(c.credits).toBeLessThan(0.2);
    expect(c.btcTrades).toHaveLength(1);
  });

  it('sells for the live price less the spread, so a round trip costs about one percent', () => {
    const c = newCommander('modern');
    c.credits = 10_000;
    buyBitcoin(c, quote, 10_000, NOW);
    sellBitcoin(c, quote, c.sats!, NOW);
    expect(c.sats).toBe(0);
    expect(c.credits).toBeCloseTo(10_000 * (1 - SPREAD) / (1 + SPREAD), -1);
  });

  it('takes no hold space and leaves cargo alone', () => {
    const c = newCommander('modern');
    c.cargo = { food: 5 };
    buyBitcoin(c, quote, 50, NOW);
    expect(c.cargo).toEqual({ food: 5 });
  });

  it("won't trade on a stale price", () => {
    const c = newCommander('modern');
    const old = { price: 80_000, time: NOW - STALE_MS - 1 };
    expect(buyBitcoin(c, old, 100, NOW)).toMatchObject({ ok: false });
    expect(buyBitcoin(c, null, 100, NOW).message).toMatch(/No price/);
    expect(c.credits).toBe(STAKE);
  });

  it('shows coins to eight places', () => {
    expect(formatBtc(125_000)).toBe('₿ 0.00125000');
  });
});

describe('Bitcoin and what you owe', () => {
  it('counts towards your means', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.sats = SATS / 100; // 0.01 coin, about 796 Cr at the bid
    expect(btcValue(c)).toBeCloseTo(bidPrice(quote) / 100, 0);
    expect(spareCredits(c)).toBeCloseTo(btcValue(c), 0);
  });

  it('pays a fine by selling just enough sats at the market price, and says so', () => {
    setQuote(quote);
    const told: Sold[] = [];
    onSold((x) => told.push(x));
    const c = newCommander('modern');
    c.credits = 0;
    c.sats = SATS / 100; // about 796 Cr
    c.equipment = ['ecm'];
    const { paid, owed } = charge(c, 500);
    expect(paid).toBe(500);
    expect(owed).toBe(0);
    expect(c.impound).toBeNull();
    expect(c.sats).toBeGreaterThan(0);
    expect(SATS / 100 - c.sats!).toBe(Math.ceil(((500 + STAKE) * SATS) / bidPrice(quote)));
    expect(c.credits).toBeGreaterThanOrEqual(STAKE); // the stake is left
    expect(told.at(-1)).toMatchObject({ reason: 'your fine' });
  });

  it('pays the insurance excess the same way, leaving the stake in credits', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.credits = STAKE;
    c.sats = SATS / 10; // about 7,960 Cr
    const claim = claimInsurance(c);
    expect(claim).toMatchObject({ kind: 'paid', excess: 250, paid: 250, owed: 0 });
    expect(c.credits).toBeGreaterThanOrEqual(STAKE);
    expect(c.sats).toBeLessThan(SATS / 10);
  });

  it('sells nothing if you have the credits: sell some yourself first to choose the moment', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.credits = 1_000;
    c.sats = 1_000_000;
    charge(c, 500);
    expect(c.sats).toBe(1_000_000);
    expect(c.credits).toBe(500);
  });

  it('sells sats rather than take your last 100 credits', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.credits = STAKE;
    c.sats = 1_000_000;
    charge(c, 100);
    expect(c.credits).toBeGreaterThanOrEqual(STAKE);
    expect(c.sats).toBeLessThan(1_000_000);
  });

  it('without a price heard, sells nothing: the rest is owed, the kit held', () => {
    const c = newCommander('modern');
    c.credits = 0;
    c.sats = 1_000_000;
    c.equipment = ['ecm'];
    expect(cover(c, 500, 'your fine', null)).toBe(0);
    expect(charge(c, 500)).toMatchObject({ paid: 0, owed: 500 });
    expect(c.sats).toBe(1_000_000);
  });

  it('changes nothing for a commander without Bitcoin', () => {
    const c = newCommander('modern');
    c.credits = 1_000;
    expect(claimInsurance(c)).toMatchObject({ paid: 250, owed: 0 });
    expect(c.impound).toBeNull();
  });

  it('survives the ship: nothing else touches the wallet', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.credits = 5_000;
    c.sats = 1_234_567;
    claimInsurance(c);
    expect(c.sats).toBe(1_234_567);
  });

  it('counts for nothing until a price has been heard', () => {
    const c = newCommander('modern');
    c.sats = 1_000_000;
    expect(btcValue(c)).toBe(0);
  });
});
