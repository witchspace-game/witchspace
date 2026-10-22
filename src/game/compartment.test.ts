import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander } from './commander';
import { claimInsurance } from './insurance';
import { carriesContraband, hidingSomething, settle } from './law';
import { COMPARTMENT_TONNES, fitCompartment } from './compartment';
import type { ActiveContract } from './contracts';

const lave = systemAt(0, 7); // a Dictatorship: police scan here

const special = (company: ActiveContract['company'], qty = 2): ActiveContract => ({
  id: `special:${company}:1`,
  company,
  good: 'special',
  label: 'Irregular cargo · crated',
  special: true,
  qty,
  from: { galaxy: 0, system: 7 },
  to: { galaxy: 0, system: 147 },
  jumps: 3,
  jumpsLeft: 3,
  pay: 900,
  danger: 0,
  rush: false,
  needs: 'Contractor',
});

describe('shielded compartments', () => {
  it('is fitted for a special assignment by every company but the Mutual, once', () => {
    const c = newCommander('modern');
    expect(fitCompartment(c, special('mutual'))).toBeNull();
    expect(c.compartment).toBeUndefined();
    expect(fitCompartment(c, special('vorg'))).toMatch(/yours to keep/);
    expect(c.compartment).toEqual({ company: 'vorg', tonnes: COMPARTMENT_TONNES });
    expect(fitCompartment(c, special('hexon'))).toBeNull(); // one is enough
  });

  it('makes banned company cargo visible to a scan, unless a compartment hides it', () => {
    const c = newCommander('modern');
    c.contracts = [special('vorg')];
    expect(carriesContraband(c, lave)).toBe(true);
    fitCompartment(c, special('vorg'));
    expect(carriesContraband(c, lave)).toBe(false);
    expect(hidingSomething(c, lave)).toBe(true);
    // The Mutual's relief supplies are never contraband.
    const m = newCommander('modern');
    m.contracts = [special('mutual')];
    expect(carriesContraband(m, lave)).toBe(false);
  });

  it('hides your own goods up to its size, and no more', () => {
    const c = newCommander('modern');
    c.location = { galaxy: 0, system: 7 };
    fitCompartment(c, special('vorg'));
    c.cargo = { narcotics: 3 };
    expect(carriesContraband(c, lave)).toBe(false);
    c.contracts = [special('vorg', 2)]; // 5 t of trouble in a 4 t compartment
    expect(carriesContraband(c, lave)).toBe(true);
  });

  it('keeps what it hides when you settle, and loses it all once opened', () => {
    const c = newCommander('modern');
    c.location = { galaxy: 0, system: 7 };
    c.credits = 5000;
    c.contracts = [special('vorg')];
    fitCompartment(c, special('vorg'));
    c.cargo = { narcotics: 1 };
    expect(settle(c).confiscated).toEqual([]);
    expect(c.contracts).toHaveLength(1);
    delete c.compartment; // the weighbridge opens it
    const s = settle(c);
    expect(s.confiscated).toContain('narcotics');
    expect(s.confiscated).toContain('Irregular cargo · crated');
    expect(c.contracts).toHaveLength(0);
    expect(c.standing?.vorg).toBe(-2);
  });

  it("isn't replaced by the insurers", () => {
    const c = newCommander('modern');
    fitCompartment(c, special('wy'));
    claimInsurance(c);
    expect(c.compartment).toBeUndefined();
  });
});
