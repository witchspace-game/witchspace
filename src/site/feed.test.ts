import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { poisOf } from '../game/explore';
import { chartedWhat, clipTitle, commanderLines, EMPTY, featuredClip, flyingLine, parseFeed, type Charted } from './feed';

const t = 1_793_045_139_740;

describe('the feed from the server', () => {
  it('keeps what it knows and drops the rest', () => {
    const f = parseFeed({
      events: [
        { kind: 'first', t, callsign: 'Jameson', galaxy: 0, system: 7, body: 'planet' },
        { kind: 'milestone', t, text: 'a kind added later' },
        { kind: 'first', t, callsign: 'Jameson', galaxy: 9, system: 7, body: 'planet' },
        { kind: 'clip', t: t + 1, id: '../evil', title: 'x', system: 'Lave', hearts: 1 },
        { kind: 'clip', t: t + 2, id: 'faf7ea11be', title: 'CMDR Jameson: fighting a Sidewinder', system: 'Lave', hearts: 2 },
      ],
      flying: { now: 1, today: 'lots' },
    });
    expect(f.events.map((e) => e.kind)).toEqual(['clip', 'first']);
    expect(f.flying).toEqual({ now: 1, today: 0 });
  });

  it('survives nothing at all', () => {
    expect(parseFeed(null)).toEqual({ events: [], flying: { now: 0, today: 0 } });
    expect(parseFeed('<html>')).toEqual({ events: [], flying: { now: 0, today: 0 } });
  });
});

describe('a commander’s trip home', () => {
  it('is one line, however many bodies it charted', () => {
    const f = parseFeed({
      events: ['planet', 'moon0', 'poi0'].map((body) => ({ kind: 'first', t, callsign: 'Jameson', galaxy: 0, system: 38, body })).concat([{ kind: 'first', t: t - 9, callsign: 'Jameson', galaxy: 0, system: 252, body: 'planet' }]),
    });
    const lines = commanderLines(f);
    expect(lines).toHaveLength(2);
    expect((lines[0] as Charted).bodies).toHaveLength(3);
  });

  it('says what was charted, in plain words', () => {
    const at = (system: number, bodies: string[]): Charted => ({ kind: 'charted', t, callsign: 'Jameson', where: galaxy(0)[system], bodies });
    expect(chartedWhat(at(7, ['planet']))).toBe('the planet');
    expect(chartedWhat(at(7, ['planet', 'star', 'moon0', 'moon1']))).toBe('the planet, its star and two moons');
    const sys = galaxy(0).findIndex((s) => poisOf(s).some((p) => p.kind === 'derelict'));
    const poi = poisOf(galaxy(0)[sys]).find((p) => p.kind === 'derelict')!;
    expect(chartedWhat(at(sys, ['planet', poi.id]))).toBe('the planet and a derelict');
  });
});

describe('how many are flying', () => {
  it('leaves out noughts rather than boasting or apologising', () => {
    expect(flyingLine({ now: 0, today: 0 })).toBe('');
    expect(flyingLine({ now: 0, today: 1 })).toBe('1 player today');
    expect(flyingLine({ now: 2, today: 5 })).toBe('2 signed-in commanders flying now · 5 players today');
  });
});

describe('the clip on the home page', () => {
  const clip = (t: number, hearts: number) => ({ kind: 'clip' as const, t, id: `c${t}`, title: 'CMDR Jameson: 2 kills', system: 'Lave', hearts });
  it('is the most hearted, and the newest of equals', () => {
    expect(featuredClip({ ...EMPTY, events: [clip(3, 0), clip(2, 4), clip(1, 4)] })?.t).toBe(2);
    expect(featuredClip({ ...EMPTY, events: [clip(1, 0), clip(3, 0), clip(2, 0)] })?.t).toBe(3);
  });
  it('is nothing when nobody has shared one', () => {
    expect(featuredClip(EMPTY)).toBeNull();
  });
  it('sets the commander apart from what they did', () => {
    expect(clipTitle('CMDR Jameson: 3 kills in one fight at Xeaqu')).toEqual({ who: 'CMDR Jameson', what: '3 kills in one fight at Xeaqu' });
    expect(clipTitle('A commander: a run worth boasting of')).toEqual({ who: 'A commander', what: 'a run worth boasting of' });
    expect(clipTitle('Something else')).toEqual({ who: '', what: 'Something else' });
  });
});
