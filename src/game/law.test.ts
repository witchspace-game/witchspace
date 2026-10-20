import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander } from './commander';
import { coolRecords, equipmentForSale, legalStatus, recordCrime, redeemImpound, settle, FINES } from './law';

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

  it('impounds equipment when you cannot pay, until you do', () => {
    const c = newCommander('modern');
    c.credits = 50;
    c.equipment = ['docking-computer'];
    recordCrime(c, 'fugitive');
    const s = settle(c);
    expect(s.owed).toBe(FINES.fugitive - 50);
    expect(c.equipment).toEqual([]);
    expect(redeemImpound(c)).toBe(false);
    c.credits = 1000;
    expect(redeemImpound(c)).toBe(true);
    expect(c.equipment).toEqual(['docking-computer']);
    expect(c.credits).toBe(1000 - (FINES.fugitive - 50));
  });

  it('sells high-tech gear only at high-tech worlds', () => {
    const c = newCommander('modern');
    const low = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.techLevel < 5)!;
    const high = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.techLevel >= 7)!;
    expect(equipmentForSale(c, low)).toEqual([]);
    expect(equipmentForSale(c, high).map((e) => e.id)).toContain('gimbal-mount');
  });
});
