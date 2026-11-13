import { describe, expect, it } from 'vitest';
import { newCommander } from '../../src/game/commander';
import { isBasic, ledgerHead, stampOf } from './registry';

const none = () => false;

describe('registering your ship (Mark, 9 November 2026)', () => {
  it('stamps a new Cobra as basic, at the port she registered, with her own number', () => {
    const c = { ...newCommander('modern'), shipNumber: 'WS-7F3K-29', credits: 840, kills: 9 };
    const st = stampOf(c, none);
    expect(st.number).toBe('WS-7F3K-29');
    expect([st.galaxy, st.system]).toEqual([0, 7]);
    expect(st.basic).toBe(true);
    expect(st.fit).toMatchObject({ hull: 'cobra-mk3', lasers: { front: 'pulse' }, equipment: [], missiles: 3, credits: 840, rating: 'Mostly Harmless' });
    expect(st.ledger).toBe('start');
  });

  it('a ship with kit, a better laser, another hull or a higher rank is stamped as she is, not basic', () => {
    const base = newCommander('modern');
    expect(stampOf({ ...base, equipment: ['docking-computer'] }, none).basic).toBe(false);
    expect(stampOf({ ...base, lasers: { front: 'beam' } }, none).basic).toBe(false);
    expect(stampOf({ ...base, ship: 'fer-de-lance' }, none).basic).toBe(false);
    expect(stampOf({ ...base, kills: 40 }, none).basic).toBe(false);
    // Your papers are yours, not the ship's: a licence doesn't make her any less basic.
    expect(stampOf({ ...base, equipment: ['weapons-licence', 'transponder'] }, none).basic).toBe(true);
  });

  it('a number another ship holds, or none at all, gets a new one from the server', () => {
    const c = { ...newCommander('modern'), shipNumber: 'WS-7F3K-29' };
    expect(stampOf(c, (n) => n === 'WS-7F3K-29').number).not.toBe('WS-7F3K-29');
    expect(stampOf({ ...c, shipNumber: 'hacked' }, none).number).toMatch(/^WS-/);
  });

  it("starts the record at the ledger's last entry", () => {
    expect(ledgerHead({ ledger: { entries: [{ h: 'a' }, { h: 'b' }], head: 'start' } })).toBe('b');
    expect(ledgerHead({ ledger: { entries: [], head: 'x' } })).toBe('x');
  });

  it('keeps junk out of the stamp', () => {
    const st = stampOf({ ship: 7, lasers: { front: 3 }, equipment: 'all', missiles: 'lots', location: { galaxy: 99, system: -4 } }, none);
    expect(st.fit).toMatchObject({ hull: 'cobra-mk3', lasers: {}, equipment: [], missiles: 3 });
    expect([st.galaxy, st.system]).toEqual([7, 0]);
    expect(isBasic(st.fit)).toBe(false); // no laser at all isn't the standard fit
  });
});
