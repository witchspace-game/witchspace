import { describe, expect, it } from 'vitest';
import { FUEL_CAPACITY, STAKE, newCommander } from './commander';
import { claimInsurance, EXCESS, excessFor, kitValue } from './insurance';
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
    expect(claim).toMatchObject({ kind: 'paid', excess: 979, paid: 979 });
    expect(c.credits).toBe(10000 - 979);
    expect(c.equipment).toEqual(['fuel-scoops', 'ecm', 'extra-energy']);
    expect(c.damaged).toEqual([]); // a new ship: everything works
  });

  it('keeps your record: a new ship does not fool the police', () => {
    const c = kitted();
    recordCrime(c, 'offender');
    claimInsurance(c);
    expect(legalStatus(c)).toBe('offender');
  });

  it('never leaves you poorer than a new commander, and fills the tank', () => {
    const c = kitted();
    c.credits = 300;
    c.fuel = 0;
    const claim = claimInsurance(c);
    expect(claim).toMatchObject({ kind: 'paid', excess: 979, paid: 300 - STAKE });
    expect(c.credits).toBe(STAKE);
    expect(c.fuel).toBe(FUEL_CAPACITY);
    expect(c.equipment).toEqual(['fuel-scoops', 'ecm', 'extra-energy']);
    expect(c.impound).toBeNull();
  });

  it("won't pay for a Fugitive: a bare Cobra, and the record stands", () => {
    const c = kitted();
    recordCrime(c, 'fugitive', true);
    expect(claimInsurance(c)).toEqual({ kind: 'void', stake: 0 });
    expect(c.equipment).toEqual([]);
    expect(c.lasers).toEqual({ front: 'pulse' });
    expect(c.credits).toBe(10000);
    expect(legalStatus(c)).toBe('fugitive');
  });

  it('stakes a penniless Fugitive enough to start again', () => {
    const c = kitted();
    c.credits = 12;
    recordCrime(c, 'fugitive', true);
    expect(claimInsurance(c)).toEqual({ kind: 'void', stake: STAKE - 12 });
    expect(c.credits).toBe(STAKE);
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

describe('your own ship back', () => {
  const fdl = () => {
    const c = newCommander('modern');
    c.ship = 'fer-de-lance';
    c.paint = { colour: '#ff4dff', glow: 'standard', trim: null, name: 'Brass Neck', luxuries: [] };
    c.credits = 1e6;
    return c;
  };

  it('replaces a dearer hull, in its paint, for a twentieth of the difference on the excess', () => {
    const c = fdl();
    expect(excessFor(c)).toBe(Math.round(kitValue(c) * EXCESS.fraction + 80_000 * EXCESS.hull));
    claimInsurance(c);
    expect(c.ship).toBe('fer-de-lance');
    expect(c.paint?.name).toBe('Brass Neck');
  });

  it('takes the hull from a Fugitive without a pod', () => {
    const c = fdl();
    recordCrime(c, 'fugitive', true);
    claimInsurance(c);
    expect(c.ship).toBeUndefined();
    expect(c.paint).toBeUndefined();
  });
});
