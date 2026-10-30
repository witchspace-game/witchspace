import { describe, expect, it } from 'vitest';
import { judgeCallsign, nameKey, nameRule } from './names';

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

  it('holds back the Red Baron, but not a plain Baron', () => {
    for (const n of ['Red Baron', 'RedBaron', 'CMDR Red Baron']) expect(rule(n), n).toBe('protected');
    expect(rule('Baron')).toBe('free');
  });

  it('holds back the famous aces, exact only', () => {
    for (const n of ['Biggles', 'Snoopy', 'Iceman', 'Goose']) expect(rule(n), n).toBe('protected');
    for (const n of ['Ace', 'Red', 'Hawk', 'Eagle']) expect(rule(n), n).toBe('free');
  });

  it('lets nobody fly as a real public figure, but leaves common surnames and longer words free', () => {
    for (const n of ['Trump', 'CMDR Trump', 'Pedro Sanchez', 'Pedro Sánchez', 'Erdogan', 'Erdoğan', 'Kim Jong-Un', 'King Charles']) expect(rule(n), n).toBe('never');
    for (const n of ['Trumpet', 'Obamacare Pilot', 'Johnson', 'Harris', 'Sanchez', 'Sánchez', 'Charles', 'William', 'Kim']) expect(rule(n), n).toBe('free');
  });

  it('leaves ordinary names alone', () => {
    for (const n of ['Lead Balloon', 'Campbell', 'Elite Trader', 'Satellite', 'Belle', 'Modesty', 'Jamie', 'Scunthorpe']) expect(rule(n), n).toBe('free');
  });

  it('a never rule wins when a name hits both', () => {
    expect(rule('Jameson the Nazi')).toBe('never');
  });
});

describe('judging a callsign, for the claim and the check alike', () => {
  const holders = new Map([[nameKey('Lead Balloon'), 'acc-1']]);
  const released = new Map([[nameKey('Old Fan'), 'fan@example.com']]);
  const lookups = { holder: (k: string) => holders.get(k) ?? null, releasedTo: (k: string) => released.get(k) ?? null };
  const judge = (n: string, who?: { id: string; email: string }) => judgeCallsign(n, lookups, who);

  it('matches taken names loosely, as reserved names are', () => {
    for (const n of ['Lead Balloon', 'LeadBalloon', 'lead_balloon', 'L3ad Balloon', 'CMDR Lead Balloon']) expect(judge(n).verdict, n).toBe('taken');
    expect(judge('Lead Balloon II').verdict).toBe('free');
    expect(judge('LeadBalloon', { id: 'acc-1', email: 'a@b.c' }).verdict).toBe('yours');
  });

  it('says only "Reserved" for a protected or released name, never why', () => {
    expect(judge('Red Baron')).toEqual({ verdict: 'reserved', reason: 'Reserved' });
    expect(judge('Old Fan')).toEqual({ verdict: 'reserved', reason: 'Reserved' });
    expect(judge('Old Fan', { id: 'x', email: 'fan@example.com' }).verdict).toBe('yours');
  });

  it('gives a plain reason for a name nobody can have', () => {
    expect(judge('Putin')).toEqual({ verdict: 'never', reason: 'Nobody flies as a real public figure' });
    expect(judge('Admin').reason).toBe('Sounds official');
    expect(judge('GalCop').reason).toBe('Sounds official');
    expect(judge('Fuckface').reason).toBe('Offensive');
    expect(judge('Elite').reason).toBe('Not available');
    expect(judge('Commander').reason).toBe('Not available');
  });

  it('leaves a free name free', () => {
    expect(judge('Nova Quill')).toEqual({ verdict: 'free' });
  });
});
