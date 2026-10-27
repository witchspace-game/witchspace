import { describe, expect, it } from 'vitest';
import { moduleById, shipModules } from '../content/moduleFiles';
import { checkService } from '../content/modules';
import type { ModuleDef } from '../content/types';
import { newCommander } from './commander';
import { COMMISSION_FEE, commissionsDue, commissionsFitted, firstFitted, firstFittingsAt, inService, lineUpFor, payCommission, REVISION_FEE } from './commissions';
import { buildsFrom, lineUpOf, STANDARD_LINE_UP } from './yards';

const FROM = '2026-11-03';
const T = Date.parse(`${FROM}T00:00:00Z`);
const DAY = 86_400_000;

// A community hold, accepted to take the core hold's place in half the builds from 3 November.
const iceHold: ModuleDef = { ...moduleById('hold')!, id: 'ice-hold', name: 'Ice hold', designer: 'NOVA', inService: { from: FROM, replaces: 'hold' } };
// And an add-on that joins the line-up instead of replacing anything.
const chapel: ModuleDef = { ...moduleById('science')!, id: 'chapel', name: 'Chapel', zone: 'add-on', designer: 'Kestrel', inService: { from: FROM, share: 1 } };
const mods = [...shipModules, iceHold];

describe('community modules in the line-up', () => {
  it('only in builds that begin once it is in service, and only a share of them', () => {
    const extras = inService(mods);
    for (const y of buildsFrom(0, T - 60 * DAY, 4)) if (y.start < T) expect(lineUpOf(y, extras)).not.toContain('ice-hold');
    const after = [0, 1, 2, 3].flatMap((g) => buildsFrom(g, T, 20));
    const carrying = after.filter((y) => lineUpOf(y, extras).includes('ice-hold'));
    expect(carrying.length / after.length).toBeGreaterThan(0.3);
    expect(carrying.length / after.length).toBeLessThan(0.7);
    for (const y of carrying) {
      const line = lineUpOf(y, extras);
      expect(line).not.toContain('hold'); // it takes the hold's place
      expect(line.indexOf('ice-hold')).toBe(STANDARD_LINE_UP.indexOf('hold'));
    }
  });

  it('an added module goes in at its zone, before the reactor', () => {
    const y = buildsFrom(0, T, 1)[0];
    const line = lineUpOf(y, inService([...shipModules, chapel]));
    expect(line).toContain('chapel');
    expect(line.at(-1)).toBe('reactor');
    expect(line.indexOf('chapel')).toBeGreaterThan(line.indexOf('fabricator'));
  });

  it('changes nothing while there are no community modules', () => {
    for (const y of buildsFrom(0, T, 10)) expect(lineUpFor(y)).toEqual(lineUpOf(y));
    expect(commissionsFitted(T + 400 * DAY)).toEqual([]);
  });
});

describe('first fitted', () => {
  it('is the earliest build anywhere, from its date, that carries it', () => {
    const y = firstFitted('ice-hold', T, mods)!;
    expect(y.start).toBeGreaterThanOrEqual(T);
    expect(lineUpFor(y, mods)).toContain('ice-hold');
    for (let g = 0; g < 8; g++) for (const b of buildsFrom(g, T, 50)) if (b.start < y.start) expect(lineUpFor(b, mods)).not.toContain('ice-hold');
    expect(firstFitted('ice-hold', T, mods)).toEqual(y); // the same for everyone
  });

  it('makes the yard news there, and only there', () => {
    const y = firstFitted('ice-hold', T, mods)!;
    expect(firstFittingsAt(y, mods).map((x) => x.key)).toEqual(['design:ice-hold']);
    const other = buildsFrom(y.galaxy, y.start + 1, 3)[0];
    expect(firstFittingsAt(other, mods)).toEqual([]);
  });
});

describe('paid on commission', () => {
  const fitted = firstFitted('ice-hold', T, mods)!.start;

  it('nothing before it is fitted', () => {
    expect(commissionsDue(newCommander('modern'), 'NOVA', fitted - 1, mods)).toEqual([]);
  });

  it('5,000 Cr to the commander signed in with the designer callsign, once', () => {
    const c = newCommander('modern');
    const credits = c.credits;
    expect(commissionsDue(c, 'Someone', fitted, mods)).toEqual([]);
    expect(commissionsDue(c, null, fitted, mods)).toEqual([]);
    const due = commissionsDue(c, 'nova', fitted + DAY, mods); // callsigns match whatever the case
    expect(due.map((x) => [x.key, x.fee])).toEqual([['design:ice-hold', COMMISSION_FEE]]);
    expect(payCommission(c, due[0], fitted + DAY)).toMatch(/5,000 Cr/);
    expect(c.credits).toBe(credits + COMMISSION_FEE);
    expect(c.messages?.[0]).toMatchObject({ company: 'wy', subject: 'Commission paid' });
    expect(c.messages?.[0].body).toContain('Designed by CMDR NOVA');
    expect(commissionsDue(c, 'NOVA', fitted + 30 * DAY, mods)).toEqual([]);
  });

  it('2,000 Cr to an improver when the first build after the revision is fitted; the designer is not paid again', () => {
    const revised: ModuleDef = { ...iceHold, revisions: [{ by: 'WREN', from: '2027-01-10', note: 'A cleaner dock' }] };
    const set = [...shipModules, revised];
    const at = firstFitted('ice-hold', Date.parse('2027-01-10T00:00:00Z'), set)!.start;
    const c = newCommander('modern');
    expect(commissionsDue(c, 'WREN', at - 1, set)).toEqual([]);
    expect(commissionsDue(c, 'WREN', at, set).map((x) => [x.key, x.fee])).toEqual([['revision:ice-hold:0', REVISION_FEE]]);
    expect(commissionsDue(c, 'NOVA', at, set).map((x) => x.kind)).toEqual(['design']);
  });

  it('Modern rules only: Wexley-Yorozu does no business in a Classic game', () => {
    expect(commissionsDue(newCommander('classic'), 'NOVA', fitted + DAY, mods)).toEqual([]);
  });
});

describe('the validator', () => {
  const all = new Map([...mods, chapel].map((m) => [m.id, m]));
  it('accepts a proper community module', () => {
    expect(checkService(iceHold, all)).toEqual([]);
    expect(checkService(chapel, all)).toEqual([]);
  });
  it('wants a callsign, a real date and a fitting place', () => {
    expect(checkService({ ...iceHold, designer: 'Witchspace' }, all).join()).toMatch(/callsign/);
    expect(checkService({ ...iceHold, inService: { from: '2026-02-30', replaces: 'hold' } }, all).join()).toMatch(/real date/);
    expect(checkService({ ...iceHold, inService: { from: FROM, replaces: 'reactor' } }, all).join()).toMatch(/must be one too/);
    expect(checkService({ ...iceHold, inService: { from: FROM, replaces: 'nothing' } }, all).join()).toMatch(/no such module/);
    expect(checkService({ ...iceHold, revisions: [{ by: 'A', from: '2027-02-01' }, { by: 'B', from: '2027-01-01' }] }, all).join()).toMatch(/oldest first/);
  });
});
