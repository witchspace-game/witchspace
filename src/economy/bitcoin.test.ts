import { afterEach, describe, expect, it } from 'vitest';
import { STAKE, newCommander } from '../game/commander';
import { claimInsurance } from '../game/insurance';
import { charge, spareCredits } from '../game/law';
import { btcValue, buyBitcoin, cancelBtcOrder, fillBtcOrders, formatBtc, placeBtcOrder, SATS, sellBitcoin, setQuote, FEE, STALE_MS } from './bitcoin';

const NOW = 1_800_000_000_000;
const quote = { price: 80_000, time: NOW - 10_000 };

afterEach(() => setQuote(null));

describe('Bitcoin on the exchange', () => {
  it('buys sats at the spot price, less the fee', () => {
    const c = newCommander('modern');
    const r = buyBitcoin(c, quote, 100, NOW);
    expect(r.ok).toBe(true);
    // 100 Cr at 80,000 a coin, 0.1 Cr to the broker: 124,875 sats
    expect(c.sats).toBe(Math.floor((100 * (1 - FEE.market) * SATS) / 80_000));
    expect(c.credits).toBe(0);
    expect(c.btcTrades![0]).toMatchObject({ price: 80_000, fee: 0.1 });
    expect(c.btcTrades).toHaveLength(1);
  });

  it('sells at the spot price less the fee, so a round trip costs about 0.2%', () => {
    const c = newCommander('modern');
    c.credits = 10_000;
    buyBitcoin(c, quote, 10_000, NOW);
    sellBitcoin(c, quote, c.sats!, NOW);
    expect(c.sats).toBe(0);
    expect(c.credits).toBeCloseTo(10_000 * (1 - FEE.market) ** 2, -1);
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

  it('is worth the spot price, once a price has been heard', () => {
    const c = newCommander('modern');
    c.sats = SATS / 100;
    expect(btcValue(c)).toBe(0);
    setQuote(quote);
    expect(btcValue(c)).toBe(800);
  });
});

describe('Bitcoin limit orders', () => {
  const MIN = 60_000;
  const spans = (from: number, prices: number[]) => prices.map((p, i) => ({ t: from + i * MIN, h: p + 50, l: p - 50 }));

  it('holds the credits, and buys at the limit the first time the real price falls to it', () => {
    const c = newCommander('modern');
    c.credits = 1_000;
    expect(placeBtcOrder(c, 'buy', 500, 78_000, NOW).ok).toBe(true);
    expect(c.credits).toBe(500); // held
    expect(fillBtcOrders(c, spans(NOW + MIN, [80_000, 79_000, 78_400]))).toHaveLength(0); // not yet
    const fills = fillBtcOrders(c, spans(NOW + MIN, [80_000, 79_000, 78_020, 77_000]));
    expect(fills).toHaveLength(1);
    expect(fills[0].at).toBe(NOW + 3 * MIN); // the first minute it got there
    expect(c.sats).toBe(Math.floor((500 * (1 - FEE.limit) * SATS) / 78_000));
    expect(fills[0].trade).toMatchObject({ price: 78_000, fee: 0.5 });
    expect(c.btcOrders).toHaveLength(0);
  });

  it('sells at the limit when the price rises to it', () => {
    const c = newCommander('modern');
    c.sats = SATS / 100;
    placeBtcOrder(c, 'sell', SATS / 100, 85_000, NOW);
    expect(c.sats).toBe(0); // held
    const credits = c.credits;
    expect(fillBtcOrders(c, spans(NOW + MIN, [84_000, 85_000]))).toHaveLength(1);
    expect(c.credits).toBeCloseTo(credits + (85_000 * (1 - FEE.limit)) / 100, 0);
  });

  it('never fills worse than the real price: a buy set above the market buys at the market', () => {
    const c = newCommander('modern');
    placeBtcOrder(c, 'buy', 100, 81_000, NOW);
    fillBtcOrders(c, [{ t: NOW + MIN, h: 80_300, l: 80_300 }]);
    expect(c.btcTrades![0].price).toBe(80_300);
  });

  it("never fills from the price before it was placed: no orders in the past", () => {
    const c = newCommander('modern');
    placeBtcOrder(c, 'buy', 50, 70_000, NOW);
    expect(fillBtcOrders(c, spans(NOW - 10 * MIN, [69_000, 69_000, 69_000]))).toHaveLength(0);
  });

  it('gives back what it held when cancelled', () => {
    const c = newCommander('modern');
    c.credits = 300;
    placeBtcOrder(c, 'buy', 200, 70_000, NOW);
    cancelBtcOrder(c, NOW);
    expect(c.credits).toBe(300);
    expect(c.btcOrders).toHaveLength(0);
  });
});

