import { afterEach, describe, expect, it } from 'vitest';
import { STAKE, newCommander } from '../game/commander';
import { claimInsurance } from '../game/insurance';
import { charge, spareCredits } from '../game/law';
import { askPrice, bidPrice, btcValue, buyBitcoin, formatBtc, SATS, sellBitcoin, setQuote, SPREAD, STALE_MS } from './bitcoin';

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

describe('Bitcoin is out of reach', () => {
  it('is never taken for a fine: fines come out of credits, and the kit is held for the rest', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.credits = 0;
    c.sats = SATS / 100;
    c.equipment = ['ecm'];
    const { paid, owed } = charge(c, 500);
    expect(paid).toBe(0);
    expect(owed).toBe(500);
    expect(c.sats).toBe(SATS / 100);
  });

  it("doesn't make a fine bigger: the law only sees your credits", () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.sats = SATS; // a whole coin
    expect(spareCredits(c)).toBe(0);
  });

  it('is never taken for the insurers\' excess', () => {
    setQuote(quote);
    const c = newCommander('modern');
    c.credits = STAKE;
    c.sats = SATS / 10;
    claimInsurance(c);
    expect(c.sats).toBe(SATS / 10);
    expect(c.credits).toBe(STAKE);
  });

  it('survives the ship', () => {
    const c = newCommander('modern');
    c.credits = 5_000;
    c.sats = 1_234_567;
    claimInsurance(c);
    expect(c.sats).toBe(1_234_567);
  });

  it('is worth what it would sell for, once a price has been heard', () => {
    const c = newCommander('modern');
    c.sats = SATS / 100;
    expect(btcValue(c)).toBe(0);
    setQuote(quote);
    expect(btcValue(c)).toBeCloseTo(bidPrice(quote) / 100, 0);
  });
});
