import { describe, expect, it } from 'vitest';
import { nameRule } from './names';

const rule = (n: string) => nameRule(n)?.rule ?? 'free';

describe('reserved callsigns', () => {
  it('never lets anyone be Elite, or anything official or offensive', () => {
    for (const n of ['Elite', 'Cmdr', 'Admin', 'GalCop', 'Fuckface']) expect(rule(n), n).toBe('never');
  });

  it('holds back Elite’s makers and this project for the right person', () => {
    for (const n of ['Jameson', 'CMDR Jameson', 'J4meson', 'Commander Jameson II', 'Witchspace', 'witch space', 'Moxon', 'Bell', 'Ian Bell', 'D. Braben', 'Braben_fan', 'Oolite']) expect(rule(n), n).toBe('protected');
  });

  it('leaves ordinary names alone', () => {
    for (const n of ['Lead Balloon', 'Campbell', 'Elite Trader', 'Satellite', 'Belle', 'Modesty', 'Jamie', 'Scunthorpe']) expect(rule(n), n).toBe('free');
  });

  it('a never rule wins when a name hits both', () => {
    expect(rule('Jameson the Nazi')).toBe('never');
  });
});
