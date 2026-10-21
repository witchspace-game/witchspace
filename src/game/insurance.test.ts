import { describe, expect, it } from 'vitest';
import { newCommander } from './commander';
import { claimInsurance, EXCESS, excessFor } from './insurance';
import { legalStatus, recordCrime } from './law';

const kitted = () => {
  const c = newCommander('modern');
  c.credits = 10000;
  c.equipment = ['fuel-scoops', 'ecm', 'extra-energy'];
  c.lasers = { front: 'military', rear: 'beam' };
  return c;
};

describe('insurance (Modern rules)', () => {
  it('charges an excess of a tenth of the kit, with a minimum', () => {
    // 600 + 600 + 1500 + 6000 + 1000 + 3 missiles at 30
    expect(excessFor(kitted())).toBe(979);
    expect(excessFor(newCommander('modern'))).toBe(EXCESS.minimum);
  });

  it('replaces the ship and kit for a law-abiding commander, less the excess', () => {
    const c = kitted();
    c.damaged = ['ecm'];
    const claim = claimInsurance(c);
    expect(claim).toMatchObject({ kind: 'paid', excess: 979, paid: 979, owed: 0 });
    expect(c.credits).toBe(10000 - 979);
    expect(c.equipment).toEqual(['fuel-scoops', 'ecm', 'extra-energy']);
    expect(c.damaged).toEqual(['ecm']); // wear and tear isn't covered
  });

  it('keeps your record: a new ship does not fool the police', () => {
    const c = kitted();
    recordCrime(c, 'offender');
    claimInsurance(c);
    expect(legalStatus(c)).toBe('offender');
  });

  it('impounds the kit when you cannot pay the excess', () => {
    const c = kitted();
    c.credits = 100;
    const claim = claimInsurance(c);
    expect(claim).toMatchObject({ kind: 'paid', paid: 100, owed: 879 });
    expect(c.equipment).toEqual([]);
    expect(c.impound?.items).toEqual(['fuel-scoops', 'ecm', 'extra-energy']);
  });

  it("won't pay for a Fugitive: a bare Cobra, and the record stands", () => {
    const c = kitted();
    recordCrime(c, 'fugitive', true);
    expect(claimInsurance(c)).toEqual({ kind: 'void' });
    expect(c.equipment).toEqual([]);
    expect(c.lasers).toEqual({ front: 'pulse' });
    expect(c.credits).toBe(10000);
    expect(legalStatus(c)).toBe('fugitive');
  });

  it('lets an escape pod save a Fugitive\'s kit', () => {
    const c = kitted();
    c.equipment.push('escape-pod');
    recordCrime(c, 'fugitive');
    const claim = claimInsurance(c);
    expect(claim.kind).toBe('paid');
    expect(c.equipment).toEqual(['fuel-scoops', 'ecm', 'extra-energy']);
    expect(c.lasers).toEqual({ front: 'military', rear: 'beam' });
  });
});
