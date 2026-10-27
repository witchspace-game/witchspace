import { describe, expect, it } from 'vitest';
import { buildFeed, FEED_EACH, type ClipEvent, type FirstEvent } from './feed';

const first = (t: number, extra: object = {}): FirstEvent => ({ kind: 'first', t, callsign: 'JAMESON', galaxy: 0, system: 7, body: 'planet', ...extra });
const clip = (t: number, extra: object = {}): ClipEvent => ({ kind: 'clip', t, id: `clip${t}`.padEnd(10, '0'), title: 'JAMESON at Lave', system: 'Lave', hearts: 1, ...extra });

describe('the live feed', () => {
  it('mixes firsts and clips, newest first', () => {
    const f = buildFeed([first(1), first(5)], [clip(3), clip(7)], { now: 1, today: 2 });
    expect(f.events.map((e) => [e.kind, e.t])).toEqual([['clip', 7], ['first', 5], ['clip', 3], ['first', 1]]);
    expect(f.flying).toEqual({ now: 1, today: 2 });
  });

  it('keeps only the newest of each kind', () => {
    const many = Array.from({ length: 30 }, (_, i) => first(i));
    const f = buildFeed(many, [clip(-1)], { now: 0, today: 0 });
    expect(f.events.filter((e) => e.kind === 'first')).toHaveLength(FEED_EACH);
    expect(f.events.at(-1)?.kind).toBe('clip'); // the oldest clip still gets in: the cap is per kind
    expect(Math.min(...f.events.filter((e) => e.kind === 'first').map((e) => e.t))).toBe(30 - FEED_EACH);
  });

  it('carries nothing beyond the agreed fields', () => {
    const f = buildFeed([first(1, { account: 'acc_secret', email: 'a@b.c' })], [clip(2, { account: 'acc_secret', hidden: 0, track: 'xyz' })], { now: 0, today: 0, names: ['JAMESON'] } as never);
    const text = JSON.stringify(f);
    for (const leak of ['acc_secret', 'a@b.c', 'track', 'hidden', 'names']) expect(text).not.toContain(leak);
    expect(Object.keys(f.events[0]).sort()).toEqual(['hearts', 'id', 'kind', 'system', 't', 'title']);
    expect(Object.keys(f.events[1]).sort()).toEqual(['body', 'callsign', 'galaxy', 'kind', 'system', 't']);
  });

  it('is empty, not padded, when nothing real happened', () => {
    expect(buildFeed([], [], { now: 0, today: 0 })).toEqual({ events: [], flying: { now: 0, today: 0 } });
  });
});
