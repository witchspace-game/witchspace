import { describe, expect, it } from 'vitest';
import type { Entry } from './ledger';
import { momentTitle } from './moments';
import { EMPTY, filledLine, isRun, newSince, profitOf, runLine, runOf, seenNow } from './tradeMoments';

const e = (k: Entry['k'], d: number, g: string, q: number, s: [number, number] | undefined, h: string): Entry => ({ t: 0, k, d, g, q, s, h });
const LAVE: [number, number] = [0, 7];
const XEAQU: [number, number] = [0, 129];

describe('a trade worth keeping', () => {
  it('is a sale over what its goods cost, matched to the latest buys', () => {
    const ledger = [e('buy', -500, 'medicine', 10, LAVE, 'a'), e('buy', -1500, 'medicine', 20, LAVE, 'b'), e('sell', 6200, 'medicine', -20, XEAQU, 'c')];
    const r = runOf(ledger, 2)!;
    expect(r.cost).toBe(1500); // the 20 just bought, not the cheaper 10 before them
    expect(profitOf(r)).toBe(4700);
    expect(isRun(r)).toBe(true);
  });

  it('needs a real profit and a real margin', () => {
    const small = [e('buy', -500, 'food', 10, LAVE, 'a'), e('sell', 1400, 'food', -10, XEAQU, 'b')];
    expect(isRun(runOf(small, 1)!)).toBe(false); // +900
    const thin = [e('buy', -20000, 'gold', 100, LAVE, 'a'), e('sell', 22000, 'gold', -100, XEAQU, 'b')];
    expect(isRun(runOf(thin, 1)!)).toBe(false); // +2,000 on 20,000: 10%
  });

  it("doesn't boast of goods the ledger never saw bought (scooped, or from before it)", () => {
    const r = runOf([e('buy', -100, 'gems', 2, LAVE, 'a'), e('sell', 9000, 'gems', -10, XEAQU, 'b')], 1)!;
    expect(r.cost).toBeNull();
    expect(isRun(r)).toBe(false);
  });

  it('counts a sell order that filled, but not a cancelled buy order coming back', () => {
    const ledger = [e('fill', -800, 'computers', 10, LAVE, 'a'), e('fill', 3000, 'computers', -10, XEAQU, 'b'), { t: 0, k: 'fill' as const, d: 800, g: 'computers', q: -10, h: 'c' }];
    expect(profitOf(runOf(ledger, 1)!)).toBe(2200);
    expect(runOf(ledger, 2)).toBeNull();
  });

  it('looks only at what is new since last time', () => {
    const ledger = [e('buy', -1, 'food', 1, LAVE, 'a'), e('sell', 2, 'food', -1, LAVE, 'b'), e('sell', 2, 'food', -1, LAVE, 'c')];
    expect(newSince(ledger, 'a')).toBe(1);
    expect(newSince(ledger, undefined)).toBe(3);
    expect(newSince(ledger, 'gone')).toBe(3);
    expect(newSince(ledger, EMPTY)).toBe(0); // the ledger was empty last time: all of it is new
    expect(seenNow([])).toBe(EMPTY);
    expect(seenNow(ledger)).toBe('c');
  });

  it('is titled like the flight log titles everything', () => {
    const ctx = { callsign: 'Jameson', system: 'Xeaqu', galaxy: 1, government: 'Anarchy', rank: 'Average', when: 0 };
    expect(momentTitle([{ kind: 'trade', text: '', subject: runLine('Medicine', 'Plague'), credits: 4200 }], ctx)).toBe('CMDR Jameson: Ran medicine into the plague at Xeaqu: +4,200 Cr');
    expect(momentTitle([{ kind: 'trade', text: '', subject: filledLine('Lave', 'Diso'), credits: 900 }], ctx)).toBe('CMDR Jameson: Order filled at Lave while I was at Diso: +900 Cr');
  });
});
