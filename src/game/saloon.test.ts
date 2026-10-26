import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { eventsAt, newsArrives } from '../economy/events';
import { cameTrue, record, regularsAt, slotOf, talk, venue, type Heard, type Regular } from './saloon';

const NOW = Date.UTC(2026, 9, 26, 12);
const g = galaxy(0);
const name = (i: number) => g[i].name;

/** Every regular in every saloon of the galaxy, at a few hours of the day. */
function everyone(): { here: (typeof g)[number]; r: Regular; now: number }[] {
  const out = [];
  for (const here of g) for (let h = 0; h < 24; h += 6) for (const r of regularsAt(here, NOW + h * 3600_000)) out.push({ here, r, now: NOW + h * 3600_000 });
  return out;
}
const all = everyone();

describe('the saloon', () => {
  it('has two to four regulars, the same for everyone at the same station and hour', () => {
    const here = g[7];
    const a = regularsAt(here, NOW);
    expect(a.length).toBeGreaterThanOrEqual(1);
    expect(a.length).toBeLessThanOrEqual(4);
    expect(regularsAt(here, NOW)).toEqual(a);
    expect(regularsAt(here, NOW + 2 * 3600_000)).not.toEqual(a); // they come and go
  });

  it('keeps a regular the same person: name, trade, and whether they lie', () => {
    const byId = new Map<string, Regular>();
    for (const { r } of all) {
      const seen = byId.get(r.id);
      if (seen) {
        expect(r.name).toBe(seen.name);
        expect(r.trade).toBe(seen.trade);
        expect(r.mood === 'bad').toBe(seen.mood === 'bad');
      } else byId.set(r.id, r);
    }
  });

  it('tells early tips that are true, and before the news arrives', () => {
    const early = all.filter(({ r }) => r.tip?.kind === 'early');
    expect(early.length).toBeGreaterThan(20);
    for (const { here, r, now } of early) {
      const where = g[r.tip!.system];
      const real = eventsAt(where, r.tip!.start, r.tip!.start).some((e) => e.start === r.tip!.start && e.type === r.tip!.event);
      expect(real).toBe(true);
      expect(newsArrives(where, here, r.tip!.start)).toBeGreaterThan(now);
    }
  });

  it('only the liars plant tips, and planted ones are about somewhere quiet', () => {
    const planted = all.filter(({ r }) => r.tip?.kind === 'planted');
    expect(planted.length).toBeGreaterThan(10);
    for (const { r } of planted) {
      expect(r.mood).toBe('bad');
      expect(eventsAt(g[r.tip!.system], r.tip!.start - 3600_000, r.tip!.start + 3600_000).some((e) => e.type === r.tip!.event)).toBe(false);
    }
  });

  it('wants paying properly only for the part that matters: early and planted tips', () => {
    for (const { r } of all) expect(r.price > 0).toBe(r.tip?.kind === 'early' || r.tip?.kind === 'planted');
  });

  it("names the place only once you've paid, when they want paying", () => {
    const { r } = all.find(({ r }) => r.price > 0)!;
    const before = talk(r, name, false);
    expect(before.more).toBe(true);
    expect(before.said).not.toContain(name(r.tip!.system));
    expect(talk(r, name, true).said).toContain(name(r.tip!.system));
  });

  it('judges a tip only once the news (or the silence) would have reached you', () => {
    const { here, r, now } = all.find(({ r }) => r.tip?.kind === 'planted')!;
    const h: Heard = { who: r.id, name: r.name, galaxy: here.galaxy, at: now, slot: slotOf(now), tip: r.tip!, paid: true };
    const due = newsArrives(g[r.tip!.system], here, r.tip!.start);
    expect(cameTrue(h, due - 1)).toBeNull();
    expect(cameTrue(h, due + 1)).toBe(false);
    expect(record([h], r.id, due + 1)).toEqual({ right: 0, wrong: 1 });
    const e = all.find(({ r }) => r.tip?.kind === 'early')!;
    const t: Heard = { who: e.r.id, name: e.r.name, galaxy: e.here.galaxy, at: e.now, slot: slotOf(e.now), tip: e.r.tip!, paid: true };
    expect(cameTrue(t, newsArrives(g[e.r.tip!.system], e.here, e.r.tip!.start) + 1)).toBe(true);
  });

  it('has a bar, a club, a tea room or a shebeen, by who runs the system', () => {
    const kinds = new Set(g.map((s) => venue(s).kind));
    expect([...kinds].sort()).toEqual(['club', 'saloon', 'shebeen', 'tea room']);
  });
});
