import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { newCommander } from '../game/commander';
import { companyKey, fairRate, walletKey } from './currencies';
import { addLiquidity, buyLocal, changeAway, mintCompany, settleHidden, walletOf } from './money';

const g0 = galaxy(0);
const T = Date.UTC(2026, 10, 1);
const byGov = (gov: number) => g0.find((s) => s.government === gov)!;

describe('the wallet, simplified (three monies)', () => {
  it('changes another system’s money anywhere, for less than at home', () => {
    const c = newCommander('modern');
    c.credits = 1000;
    const dem = byGov(6);
    buyLocal(c, dem, 500, T, T);
    const units = walletOf(c)[walletKey(dem)];
    const before = c.credits;
    const r = changeAway(c, byGov(3), walletKey(dem), units, T);
    expect(r.ok).toBe(true);
    expect(c.credits - before).toBeCloseTo((units / fairRate(dem, T)) * 0.98, 0);
    expect(walletOf(c)[walletKey(dem)]).toBeUndefined();
  });

  it('pays back company coins and pool shares in credits, once', () => {
    const c = newCommander('modern');
    c.credits = 2000;
    const dem = byGov(6);
    mintCompany(c, 'hexon', 300, T, dem);
    buyLocal(c, dem, 600, T, T);
    addLiquidity(c, dem, 200, T);
    expect(walletOf(c)[companyKey('hexon')]).toBeGreaterThan(0);
    expect(c.fx?.lp?.[walletKey(dem)]).toBeTruthy();
    const before = c.credits;
    const paid = settleHidden(c, dem, T + 1000);
    expect(paid).toBeGreaterThan(690); // ~299 Cr of coins and ~400 Cr of pool share
    expect(c.credits).toBeCloseTo(before + paid, 1);
    expect(walletOf(c)[companyKey('hexon')]).toBeUndefined();
    expect(Object.keys(c.fx?.lp ?? {})).toHaveLength(0);
    expect(settleHidden(c, dem, T + 2000)).toBe(0);
  });
});
