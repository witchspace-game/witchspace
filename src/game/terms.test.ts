import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander, type Commander } from './commander';
import type { CompanyId } from './companies';
import { afterJump, board, deliver, loseContracts, logOf, standing, take, yours, type Contract } from './contracts';
import { bondFor, HAZARD, lateShare, lossTerms, termsFor } from './terms';

const lave = systemAt(0, 7);
const NOW = Date.UTC(2026, 10, 12, 12);

/** A Contractor-sized job from Lave to Lave's anarchy-or-not neighbour: 10 t worth 1,000 Cr. */
function job(company: CompanyId, over: Partial<Contract> = {}): Contract {
  return { id: `test:${company}:${Math.random()}`, company, good: 'computers', qty: 10, from: { galaxy: 0, system: 7 }, to: { galaxy: 0, system: 7 }, jumps: 3, pay: 400, danger: 0, rush: false, needs: 'Contractor', value: 1000, ...over };
}

function cmdr(company: CompanyId, points: number, credits = 5000): Commander {
  const c = newCommander('modern');
  c.credits = credits;
  c.standing = { [company]: points };
  return c;
}

describe("a company's terms (Mark, 12 November 2026)", () => {
  it('rank pays: nothing extra for Casual, more at each rank, and hazard pay from Contractor up', () => {
    const anarchy = 0;
    expect(termsFor(300, 'vorg', 'Casual', anarchy)).toEqual({ pay: 300, rankBonus: 0, hazard: 0 });
    const contractor = termsFor(300, 'vorg', 'Contractor', anarchy);
    expect(contractor.rankBonus).toBe(45);
    expect(contractor.hazard).toBe(Math.round(HAZARD[0] * 1.25)); // Vorg pays for nerve
    expect(termsFor(300, 'mutual', 'Contractor', anarchy).hazard).toBe(HAZARD[0]);
    expect(termsFor(300, 'vorg', 'Trusted', anarchy).pay).toBeGreaterThan(contractor.pay);
    expect(termsFor(300, 'hexon', 'Partner', 7).hazard).toBe(0); // no hazard in a corporate state
    expect(termsFor(300, 'vorg', 'Unreliable', anarchy)).toEqual({ pay: 300, rankBonus: 0, hazard: 0 });
  });

  it('the board shows each commander their own pay', () => {
    const casual = board(newCommander('modern'), lave, NOW).filter((o) => !o.survey);
    const o = casual[0];
    const c = cmdr(o.company, 15);
    const mine = board(c, lave, NOW).find((x) => x.id === o.id)!;
    expect(mine.pay).toBeGreaterThan(o.pay);
    expect(mine.rankBonus).toBeGreaterThan(0);
  });

  it('valuable cargo asks a bond, never more than half your credits; Casual work never does', () => {
    expect(bondFor(1000, 'hexon', 'Casual', 9999)).toBe(0);
    expect(bondFor(1000, 'hexon', 'Contractor', 9999)).toBe(200);
    expect(bondFor(1000, 'vorg', 'Contractor', 9999)).toBe(100);
    expect(bondFor(1000, 'hexon', 'Contractor', 150)).toBe(75);
    const c = cmdr('hexon', 5);
    expect(take(c, yours(c, job('hexon')), 20)).toBeNull();
    expect(c.credits).toBe(4800);
    expect(c.contracts![0].bondPaid).toBe(200);
  });

  it('delivered: the pay and the bond back, and a step towards a good record', () => {
    const c = cmdr('hexon', 5);
    take(c, job('hexon'), 20);
    deliver(c, lave, NOW);
    expect(c.credits).toBe(5000 + 400);
    expect(logOf(c, 'hexon').clean).toBe(1);
  });

  it('late: Hexon takes a quarter a jump, Vorg forgives a jump, the Mutual pays three quarters', () => {
    expect([1, 2, 3].map((n) => lateShare('hexon', n))).toEqual([0.75, 0.5, 0.25]);
    expect([1, 2].map((n) => lateShare('vorg', n))).toEqual([1, 0.5]);
    expect(lateShare('mutual', 3)).toBe(0.75);
    const c = cmdr('hexon', 5);
    take(c, job('hexon', { jumps: 1 }), 20);
    afterJump(c, NOW);
    afterJump(c, NOW); // a jump late
    deliver(c, lave, NOW);
    expect(c.credits).toBe(5000 + 300);
    expect(standing(c, 'hexon')).toBe(4); // Hexon minds
  });

  it('lost with your ship: Vorg gives half the bond back, unless you started it', () => {
    expect(lossTerms('vorg', 'Contractor', 100, 1000, false)).toMatchObject({ refund: 50, standing: -1 });
    expect(lossTerms('vorg', 'Contractor', 100, 1000, true)).toMatchObject({ refund: 0, standing: -3 });
    const c = cmdr('vorg', 5);
    take(c, job('vorg'), 20);
    loseContracts(c, false, NOW);
    expect(c.credits).toBe(5000 - 50);
    expect(standing(c, 'vorg')).toBe(4);
  });

  it("the Mutual's pool covers its members, less an excess; not a non-member, nor a fight you started", () => {
    expect(lossTerms('mutual', 'Contractor', 150, 1000, false)).toMatchObject({ refund: 100, standing: -1 });
    expect(lossTerms('mutual', 'Partner', 150, 1000, false).refund).toBe(130);
    expect(lossTerms('mutual', 'Casual', 150, 1000, false)).toMatchObject({ refund: 0, standing: -2 });
    expect(lossTerms('mutual', 'Trusted', 150, 1000, true)).toMatchObject({ refund: 0, standing: -3 });
  });

  it('Hexon keeps the bond, and a second loss inside a week costs a rank', () => {
    const c = cmdr('hexon', 20); // Trusted
    take(c, job('hexon'), 20);
    loseContracts(c, false, NOW);
    expect(standing(c, 'hexon')).toBe(17);
    take(c, job('hexon'), 20);
    loseContracts(c, false, NOW + 3 * 24 * 3600_000);
    expect(standing(c, 'hexon')).toBe(5); // Contractor
    expect(c.messages![0].body).toMatch(/Two losses in a week/);
  });

  it('a good record buys one mistake: ten deliveries since the last failure halve its cost', () => {
    const c = cmdr('vorg', 30);
    for (let i = 0; i < 10; i++) {
      take(c, job('vorg'), 20);
      deliver(c, lave, NOW);
    }
    const before = standing(c, 'vorg');
    take(c, job('vorg'), 20);
    loseContracts(c, true, NOW); // your fault: -3, halved
    expect(standing(c, 'vorg')).toBe(before - 1);
    expect(logOf(c, 'vorg').clean).toBe(0);
  });
});
