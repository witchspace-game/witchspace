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

  it('holds back Marvel’s characters, but not ordinary words or older myths', () => {
    for (const n of ['Iron Man', 'IronMan2000', 'Spiderman', 'Captain America', 'Thanos', 'Groot', 'CMDR Deadpool', 'Hulk']) expect(rule(n), n).toBe('protected');
    for (const n of ['Thor', 'Loki', 'Storm', 'Vision', 'Falcon', 'Phoenix', 'Iron Duke', 'Hulking Freighter', 'Groote Eylandt']) expect(rule(n), n).toBe('free');
  });

  it('leaves ordinary names alone', () => {
    for (const n of ['Lead Balloon', 'Campbell', 'Elite Trader', 'Satellite', 'Belle', 'Modesty', 'Jamie', 'Scunthorpe']) expect(rule(n), n).toBe('free');
  });

  it('a never rule wins when a name hits both', () => {
    expect(rule('Jameson the Nazi')).toBe('never');
  });
});
