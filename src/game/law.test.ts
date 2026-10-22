import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { FUEL_CAPACITY, FUEL_PRICE, newCommander } from './commander';
import { coolRecords, equipmentForSale, legalStatus, recordCrime, redeemImpound, settle, fineDue, charge, FINES } from './law';

const LAVE = systemAt(0, 7);

describe('the law', () => {
  it('keeps ordinary crimes local to the system', () => {
    const c = newCommander('modern');
    recordCrime(c, 'offender');
    expect(legalStatus(c)).toBe('offender');
    c.location.system = 147; // Diso
    expect(legalStatus(c)).toBe('clean');
    c.location.system = 7;
    expect(legalStatus(c)).toBe('offender');
  });

  it('only makes records worse when a new crime is recorded', () => {
    const c = newCommander('modern');
    recordCrime(c, 'fugitive');
    recordCrime(c, 'offender');
    expect(legalStatus(c)).toBe('fugitive');
  });

  it('serious crimes bring a galaxy-wide warrant under Modern rules only', () => {
    const modern = newCommander('modern');
    recordCrime(modern, 'fugitive', true);
    modern.location.system = 147;
    expect(legalStatus(modern)).toBe('fugitive');
    const classic = newCommander('classic');
    recordCrime(classic, 'fugitive', true);
    classic.location.system = 147;
    expect(legalStatus(classic)).toBe('clean');
  });

  it('has no law in anarchies', () => {
    const anarchy = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.government === 0)!;
    const c = newCommander('modern');
    c.warrant = true;
    c.location.system = anarchy.index;
    expect(legalStatus(c)).toBe('clean');
  });

  it('cools records in systems you have left', () => {
    const c = newCommander('modern');
    recordCrime(c, 'fugitive');
    c.location.system = 147;
    for (let i = 0; i < 6; i++) coolRecords(c);
    expect(legalStatus(c, LAVE)).toBe('offender');
    for (let i = 0; i < 2; i++) coolRecords(c);
    expect(legalStatus(c, LAVE)).toBe('clean');
  });

  it('settling fines you, confiscates contraband and clears your record', () => {
    const c = newCommander('modern');
    c.credits = 1000;
    c.cargo = { narcotics: 2, food: 3 };
    recordCrime(c, 'offender');
    const s = settle(c);
    expect(s.fine).toBe(FINES.offender);
    expect(c.credits).toBe(1000 - FINES.offender);
    expect(c.cargo).toEqual({ food: 3 });
    expect(legalStatus(c)).toBe('clean');
  });

  it('a warrant adds to the fine, and settling lifts it', () => {
    const c = newCommander('modern');
    c.credits = 5000;
    recordCrime(c, 'fugitive', true);
    expect(fineDue(c)).toBe(FINES.fugitive + FINES.warrant);
    expect(settle(c).fine).toBe(FINES.fugitive + FINES.warrant);
    expect(c.warrant).toBe(false);
    expect(fineDue(c)).toBe(0);
  });

  it('fines are cut to your means, and leave you a tank of fuel', () => {
    const c = newCommander('modern');
    c.credits = 100;
    recordCrime(c, 'fugitive', true);
    const s = settle(c);
    expect(s.fine).toBe(Math.floor((100 - FUEL_CAPACITY * FUEL_PRICE) / 2));
    expect(s.owed).toBe(0);
    expect(c.credits).toBeGreaterThanOrEqual(FUEL_CAPACITY * FUEL_PRICE);
    expect(legalStatus(c)).toBe('clean');
  });

  it('impounds equipment when you are caught and cannot pay, until you do', () => {
    const c = newCommander('modern');
    c.credits = 50;
    c.equipment = ['docking-computer'];
    recordCrime(c, 'fugitive');
    const s = settle(c, true);
    const fine = FINES.fugitive * 1.5;
    expect(s.owed).toBe(fine - 50);
    expect(c.equipment).toEqual([]);
    expect(redeemImpound(c)).toBe(false);
    c.credits = 1000;
    expect(redeemImpound(c)).toBe(true);
    expect(c.equipment).toEqual(['docking-computer']);
    expect(c.credits).toBe(1000 - (fine - 50));
  });

  it('writes off what you cannot pay when there is nothing to hold', () => {
    const c = newCommander('modern');
    c.credits = 20;
    c.equipment = [];
    expect(charge(c, 500)).toEqual({ paid: 20, owed: 0, impounded: [] });
    expect(c.impound).toBeNull();
  });

  it('sells high-tech gear only at high-tech worlds', () => {
    const c = newCommander('modern');
    const low = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.techLevel < 5)!;
    const high = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.techLevel >= 7)!;
    expect(equipmentForSale(c, low).map((e) => e.id)).toEqual(['weapons-licence']); // paperwork, sold everywhere
    expect(equipmentForSale(c, high).map((e) => e.id)).toContain('gimbal-mount');
  });
});
