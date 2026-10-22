import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { cargoTonnes, newCommander } from './commander';
import { abandon, afterJump, board, deliver, destinationOf, jumpsBetween, LATE_GRACE, loseContracts, standing, take } from './contracts';
import { presence } from './companies';

const lave = systemAt(0, 7);
const NOW = Date.UTC(2026, 9, 22, 12);

describe('company contracts', () => {
  it('every station board is the same for everyone, and changes every half hour', () => {
    const a = board(newCommander('modern'), lave, NOW);
    expect(a.length).toBeGreaterThan(0);
    expect(board(newCommander('modern'), lave, NOW)).toEqual(a);
    expect(board(newCommander('modern'), lave, NOW + 31 * 60_000).map((o) => o.id)).not.toEqual(a.map((o) => o.id));
  });

  it('offers work a new commander can take, within reach', () => {
    const offers = board(newCommander('modern'), lave, NOW);
    expect(offers.some((o) => o.needs === 'Casual')).toBe(true);
    for (const o of offers) {
      expect(o.pay).toBeGreaterThan(0);
      expect(o.jumps).toBeGreaterThanOrEqual(jumpsBetween(lave, destinationOf(o)));
    }
  });

  it('loads the cargo into the hold, and pays on delivery with standing', () => {
    const c = newCommander('modern');
    const o = board(c, lave, NOW).find((x) => x.needs === 'Casual')!;
    expect(take(c, o, 20)).toBeNull();
    expect(cargoTonnes(c)).toBe(o.qty);
    expect(board(c, lave, NOW).some((x) => x.id === o.id)).toBe(false);
    const credits = c.credits;
    expect(deliver(c, lave)).toEqual([]); // not here
    expect(deliver(c, destinationOf(o))).toHaveLength(1);
    expect(c.credits).toBe(credits + o.pay);
    expect(standing(c, o.company)).toBeGreaterThan(0);
    expect(cargoTonnes(c)).toBe(0);
  });

  it('needs room in the hold, and Modern rules', () => {
    const o = board(newCommander('modern'), lave, NOW).find((x) => x.needs === 'Casual')!;
    expect(take(newCommander('modern'), o, o.qty - 1)).toMatch(/hold/);
    expect(take(newCommander('classic'), o, 20)).toMatch(/Modern/);
  });

  it('counts down in jumps: late pays half, and long overdue fails', () => {
    const c = newCommander('modern');
    const o = board(c, lave, NOW).find((x) => x.needs === 'Casual')!;
    take(c, o, 20);
    for (let i = 0; i <= o.jumps; i++) afterJump(c);
    const credits = c.credits;
    deliver(c, destinationOf(o));
    expect(c.credits).toBe(credits + Math.round(o.pay / 2));

    const d = newCommander('modern');
    take(d, o, 20);
    for (let i = 0; i <= o.jumps + LATE_GRACE; i++) afterJump(d);
    expect(d.contracts).toHaveLength(0);
    expect(standing(d, o.company)).toBeLessThan(0);
  });

  it('losing your ship or giving up costs standing, not money', () => {
    const c = newCommander('modern');
    const o = board(c, lave, NOW).find((x) => x.needs === 'Casual')!;
    take(c, o, 20);
    expect(loseContracts(c)).toHaveLength(1);
    expect(c.credits).toBe(100);
    expect(standing(c, o.company)).toBeLessThan(0);
    const d = newCommander('modern');
    take(d, o, 20);
    expect(abandon(d, o.id)).toMatch(/remember/);
    expect(d.contracts).toHaveLength(0);
  });

  it('companies work where their character says', () => {
    const all = Array.from({ length: 256 }, (_, i) => systemAt(0, i));
    const anarchy = all.find((s) => s.government === 0)!;
    const corporate = all.find((s) => s.government === 7)!;
    expect(presence(anarchy).hexon).toBe(0);
    expect(presence(corporate).vorg).toBe(0);
    expect(presence(anarchy).vorg).toBeGreaterThan(presence(anarchy).mutual);
  });
});
