import { describe, expect, it } from 'vitest';
import { newCommander } from './commander';
import { inviteDue, takeRegistration } from './registration';

describe('the invitation to register (Mark, 13 November 2026)', () => {
  it('waits for a first purchase or Mostly Harmless, whichever comes first', () => {
    const c = newCommander('modern');
    expect(inviteDue(c)).toBe(false);
    expect(inviteDue({ ...c, equipment: ['weapons-licence'] })).toBe(false); // your papers aren't a purchase
    expect(inviteDue({ ...c, equipment: ['fuel-scoops'] })).toBe(true);
    expect(inviteDue({ ...c, lasers: { front: 'beam' } })).toBe(true);
    expect(inviteDue({ ...c, ship: 'fer-de-lance' })).toBe(true);
    expect(inviteDue({ ...c, kills: 8 })).toBe(true);
  });

  it('never in Classic, and never once registered', () => {
    expect(inviteDue({ ...newCommander('classic'), kills: 100 })).toBe(false);
    const c = { ...newCommander('modern'), kills: 100 };
    takeRegistration(c, { number: 'WS-ABCD-23', at: 1, galaxy: 0, system: 7, basic: true });
    expect(inviteDue(c)).toBe(false);
    expect(c.shipNumber).toBe('WS-ABCD-23'); // the registry's number is hers from now on
  });
});
