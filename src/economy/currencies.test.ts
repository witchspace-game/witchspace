import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { backing, BTC_REF, companyValue, crisis, currencyOf, fairRate, poolNow, poolRate, positionNow, quoteBuy, quoteSell, reserveShare, mintedToday, stableValue, supplyOf } from './currencies';
import { activeEvent, EVENT_KINDS, outputAt } from './events';

const g0 = galaxy(0);
const T = Date.UTC(2026, 10, 1);
const DAY = 86_400_000;
const byGov = (gov: number) => g0.find((s) => s.government === gov)!;

describe('a currency for every system', () => {
  it('is generated for all but the anarchies, with codes that are unique and never real ones', () => {
    for (let g = 0; g < 8; g++) {
      const codes = galaxy(g).map(currencyOf).filter(Boolean).map((c) => c!.ticker);
      expect(new Set(codes).size).toBe(codes.length);
      for (const code of ['USD', 'EUR', 'GBP', 'BTC']) expect(codes).not.toContain(code);
    }
    expect(currencyOf(byGov(0))).toBeNull();
    expect(currencyOf(byGov(7))).toMatchObject({ policy: 'reserve', stable: true, base: 1 });
  });

  it('runs as its government would: pegs hold, printers inflate, scarce money gains', () => {
    const corp = byGov(7);
    for (let d = 0; d < 400; d += 7) expect(Math.abs(fairRate(corp, T + d * DAY) - 1)).toBeLessThan(0.005); // fully backed: it holds
    const dict = byGov(3);
    expect(fairRate(dict, T + 120 * DAY)).toBeGreaterThan(fairRate(dict, T));
    const dem = byGov(6);
    expect(fairRate(dem, T + 120 * DAY) / fairRate(dem, T)).toBeGreaterThan(1.05);
    const comm = byGov(4);
    expect(fairRate(comm, T + 300 * DAY)).toBe(fairRate(comm, T));
  });

  it('breaks an algorithmic peg now and then, and lets it recover', () => {
    const feudal = g0.filter((s) => s.government === 1);
    let broke = 0;
    for (const s of feudal)
      for (let d = 0; d < 365; d += 0.5) {
        const k = crisis(s, T + d * DAY, 0.15);
        if (k > 0.9) {
          broke++;
          const before = fairRate(s, T + (d - 3) * DAY);
          const worst = fairRate(s, T + d * DAY);
          const after = fairRate(s, T + (d + 8) * DAY);
          expect(worst / before).toBeGreaterThan(5); // the coin is worth a fraction of what it was
          expect(after).toBeLessThan(worst); // it re-pegs a week later…
          expect(after / before).toBeGreaterThan(4); // …lower: the loss stays, so buying the bottom is no sure thing
          expect(worst / after).toBeLessThan(1.5);
          break;
        }
      }
    expect(broke).toBeGreaterThan(feudal.length / 3);
  });
});

describe('a station’s pool', () => {
  const s = byGov(6);
  it('slips against a big swap, charges its fee, and drifts back to the fair rate', () => {
    const p = poolNow(s, undefined, T);
    const small = quoteBuy(p, 100) / 100;
    const big = quoteBuy(p, 100_000) / 100_000;
    expect(big).toBeLessThan(small); // slippage
    expect(small).toBeLessThan(poolRate(p)); // the fee
    const after = { ...p, local: p.local - quoteBuy(p, 100_000), credits: p.credits + 100_000 };
    expect(poolRate(after)).toBeLessThan(poolRate(p));
    const later = poolNow(s, after, T + 6 * 3600_000);
    expect(Math.abs(poolRate(later) / fairRate(s, T + 6 * 3600_000) - 1)).toBeLessThan(0.01);
    // Selling straight back loses only the fees.
    const units = quoteBuy(p, 1000);
    expect(quoteSell({ ...p, local: p.local - units, credits: p.credits + 1000 }, units)).toBeGreaterThan(990);
  });

  it('takes a stablecoin anywhere at its rate, less the network’s fee', () => {
    expect(stableValue(byGov(7), 1000, T)).toBeCloseTo(997, -1);
  });
});

describe('tied to the real Bitcoin price', () => {
  it('holds a Corporate peg while its reserves cover it, and lets it slip when a crash leaves them short', () => {
    const corp = byGov(7);
    expect(fairRate(corp, T, BTC_REF * 1.5)).toBeCloseTo(1, 2); // over-backed: still 1:1
    const crash = BTC_REF * 0.3;
    expect(backing(corp, crash)).toBeLessThan(1);
    expect(fairRate(corp, T, crash)).toBeGreaterThan(1 / backing(corp, crash)); // the run makes it worse than the shortfall
    expect(reserveShare(corp)).toBeGreaterThan(0.09);
  });

  it('moves a Confederacy’s money with Bitcoin', () => {
    const conf = byGov(5);
    expect(fairRate(conf, T, BTC_REF * 2)).toBeCloseTo(fairRate(conf, T) / 2, 1); // Bitcoin doubles: a credit buys half as much
  });

  it('redeems a company coin at a credit until a crash outruns its 150% backing', () => {
    expect(companyValue(BTC_REF)).toBe(1);
    expect(companyValue(BTC_REF * 0.7)).toBe(1); // still covered at 105%
    expect(companyValue(BTC_REF * 0.5)).toBeCloseTo(0.75, 2);
  });
});

describe('providing liquidity', () => {
  it('earns fees, and loses against simply holding when the rate moves', () => {
    const dem = byGov(6);
    const price = 1 / fairRate(dem, T);
    const credits = 10_000;
    const local = credits / price;
    const p = { k: local * credits, price, credits, added: T };
    const soon = positionNow(dem, p, T);
    expect(soon.value).toBeCloseTo(soon.held, 0); // nothing has moved yet
    const year = positionNow(dem, p, T + 365 * DAY);
    expect(year.fees).toBeGreaterThan(credits * 0.1); // a year's fees
    expect(year.value - year.fees).toBeLessThan(year.held); // the rate moved: impermanent loss
  });
});

describe('money follows what a world makes', () => {
  // A floating money at a world in the middle of an event that cuts its output.
  const find = (policy: string, cut: boolean) => {
    for (const s of galaxy(0))
      if (currencyOf(s)?.policy === policy)
        for (let t = Date.UTC(2026, 10, 1); t < Date.UTC(2026, 11, 1); t += 3600_000) {
          const e = activeEvent(s, t);
          if (e && t > e.start + 3600_000 && t < e.end - 3600_000 && EVENT_KINDS[e.type].output < 0 === cut) return { s, t, e };
        }
    throw new Error('none found');
  };

  it('cuts output in a war or a famine, and raises it in a boom', () => {
    const { s, t, e } = find('inflation', true);
    expect(outputAt(s, t)).toBeCloseTo(1 + EVENT_KINDS[e.type].output, 5);
    expect(outputAt(s, e.end + 3600_000)).toBe(1);
  });

  it('weakens a floating money while output is down, and the issuer mints and burns with it', () => {
    const { s, t, e } = find('inflation', true);
    const after = e.end + 3600_000;
    // More units to the credit during the cut than just after it (inflation over a few hours is tiny).
    expect(fairRate(s, t) / fairRate(s, after)).toBeGreaterThan(1.03);
    expect(supplyOf(s, t)).toBeGreaterThan(0);
    const reserve = galaxy(0).find((x) => currencyOf(x)?.policy === 'reserve')!;
    // A pegged money doesn't move; its supply follows output instead.
    expect(supplyOf(reserve, t)).toBeCloseTo(reserve.productivity * 1000 * outputAt(reserve, t) * fairRate(reserve, t), 0);
    expect(Number.isFinite(mintedToday(s, t))).toBe(true);
    expect(supplyOf(galaxy(0).find((x) => !currencyOf(x))!, t)).toBe(0);
  });

  it('strengthens a floating money in a boom', () => {
    const { s, t, e } = find('printing', false);
    expect(fairRate(s, t) / fairRate(s, e.end + 3600_000)).toBeLessThan(1);
  });
});
