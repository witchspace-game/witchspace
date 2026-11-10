import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { newCommander } from './commander';
import { arrival, CALL_AT, flying, foughtHim, GLOATS_FOR, HOUR, inTheSaloon, KILL_WINDOW, killedHisMan, memoryOf, OUT_OF_ACTION, renownedNews, renownedOf, saloonScene, sharedNews, chartLine, WARN_AT, type SharedRecord } from './renowned';

const NOW = Date.UTC(2026, 10, 9, 12);
const home = galaxy(0).find((s) => s.government === 0 && renownedOf(s))!;
const veteran = () => ({ ...newCommander('modern'), kills: 40 }); // Average

describe('renowned pirates', () => {
  it('are one man per system at most, the same for everyone, mostly in lawless systems', () => {
    let lawless = 0;
    let lawful = 0;
    for (let g = 0; g < 8; g++)
      for (const s of galaxy(g)) {
        const r = renownedOf(s);
        expect(r).toEqual(renownedOf(s));
        if (r && s.government <= 1) lawless++;
        if (r && s.government >= 6) lawful++;
      }
    expect(lawless).toBeGreaterThan(lawful * 3);
    expect(lawless + lawful).toBeGreaterThan(0);
  });

  it('warn you, then come for you, as you keep killing their people', () => {
    const c = veteran();
    const said: (string | null)[] = [];
    for (let i = 0; i < CALL_AT; i++) said.push(killedHisMan(c, home, NOW + i * 60_000)?.what ?? null);
    expect(said[WARN_AT - 1]).toBe('warn');
    expect(said[CALL_AT - 1]).toBe('call');
    expect(said.filter(Boolean)).toHaveLength(2);
    // Once a day at most.
    for (let i = 0; i < CALL_AT; i++) expect(killedHisMan(c, home, NOW + HOUR + i)).toBeNull();
  });

  it('forget kills older than a day', () => {
    const c = veteran();
    for (let i = 0; i < CALL_AT - 1; i++) killedHisMan(c, home, NOW + i);
    expect(killedHisMan(c, home, NOW + KILL_WINDOW + 10)?.what).not.toBe('call');
  });

  it("leave Harmless commanders, and Classic, alone", () => {
    const rookie = newCommander('modern');
    const classic = { ...newCommander('classic'), kills: 40 };
    for (let i = 0; i < CALL_AT * 2; i++) {
      expect(killedHisMan(rookie, home, NOW + i)).toBeNull();
      expect(killedHisMan(classic, home, NOW + i)).toBeNull();
    }
  });

  it('beaten, is out of action for three days and remembers it; winning or your running counts too', () => {
    const c = veteran();
    const who = renownedOf(home)!;
    foughtHim(c, who, 'beaten', NOW);
    const m = memoryOf(c, who.key);
    expect(flying(m, NOW + OUT_OF_ACTION - 1)).toBe(false);
    expect(flying(m, NOW + OUT_OF_ACTION)).toBe(true);
    for (let i = 0; i < CALL_AT; i++) expect(killedHisMan(c, home, NOW + HOUR + i)).toBeNull(); // nobody to call
    expect(arrival(who, m)).toContain('Last time');
    foughtHim(c, who, 'won', NOW);
    foughtHim(c, who, 'ran', NOW);
    expect([m.lost, m.beat, m.ran]).toEqual([1, 1, 1]);
    m.podShot = true;
    expect(arrival(who, m)).toContain('pod');
  });
});

describe('a renowned pirate in his saloon', () => {
  const riedquat = galaxy(0)[46];
  const who = renownedOf(riedquat)!;

  it('is hand-written for the famous few near Lave', () => {
    expect(who.name).toBe('Ambrose Hale');
    expect(who.story).toContain('rose Cobra');
  });

  it('licks his wounds while out of action, gloats after a win, and is sometimes in on his off hours', () => {
    const c = veteran();
    foughtHim(c, who, 'beaten', NOW);
    const m = memoryOf(c, who.key);
    expect(inTheSaloon(riedquat, m, 0, NOW + HOUR)).toBe('wounds');
    expect(saloonScene(who, 'wounds', m, 'Jameson').says).toContain('Fair fight');
    foughtHim(c, who, 'won', NOW + OUT_OF_ACTION);
    expect(inTheSaloon(riedquat, m, 0, NOW + OUT_OF_ACTION + HOUR)).toBe('gloating');
    const gloat = saloonScene(who, 'gloating', m, 'Jameson');
    expect(gloat.buys).toBe(true);
    expect(gloat.says).toContain('Jameson');
    // Long after: only on some of his off hours, the same for everyone.
    const later = NOW + OUT_OF_ACTION + GLOATS_FOR + HOUR;
    const slots = Array.from({ length: 200 }, (_, i) => inTheSaloon(riedquat, m, i, later));
    expect(slots.every((x) => x === null || x === 'resting')).toBe(true);
    const share = slots.filter(Boolean).length / slots.length;
    expect(share).toBeGreaterThan(0.15);
    expect(share).toBeLessThan(0.45);
  });

  it("won't drink with you if you shot his pod", () => {
    const c = veteran();
    const m = memoryOf(c, who.key);
    m.podShot = true;
    expect(saloonScene(who, 'resting', m, 'Jameson').refuses).toBe(true);
  });

  it('makes the news: his pod picked up, or his boast', () => {
    const c = veteran();
    const at = (key: string) => galaxy(0)[Number(key.split(':')[1])];
    foughtHim(c, who, 'beaten', NOW);
    expect(renownedNews(c, at, NOW + HOUR)[0].text).toContain('escape pod');
    foughtHim(c, who, 'won', NOW + OUT_OF_ACTION);
    expect(renownedNews(c, at, NOW + OUT_OF_ACTION + HOUR)[0].text).toContain('claims another Cobra');
    expect(renownedNews(c, at, NOW + OUT_OF_ACTION + GLOATS_FOR + HOUR)).toHaveLength(0);
  });
});

describe('what every commander knows of him', () => {
  const riedquat = galaxy(0)[46];
  const who = renownedOf(riedquat)!;
  const shared = (o: Partial<SharedRecord> = {}): SharedRecord => ({ beaten: 0, won: 0, ran: 0, out: 0, recent: [], ...o });

  it("doesn't come for you while someone else has him in a pod", () => {
    const c = veteran();
    const out = shared({ beaten: 1, out: NOW + HOUR, recent: [{ c: 'Kestrel', how: 'beaten', at: NOW - HOUR }] });
    for (let i = 0; i < CALL_AT; i++) expect(killedHisMan(c, riedquat, NOW + i, out)).toBeNull();
  });

  it("tells you, in the saloon, who put him there, or who he's beaten", () => {
    const out = shared({ beaten: 1, out: NOW + HOUR, recent: [{ c: 'Kestrel', how: 'beaten', at: NOW - HOUR }] });
    expect(inTheSaloon(riedquat, undefined, 0, NOW, out)).toBe('wounds');
    expect(saloonScene(who, 'wounds', undefined, 'Jameson', out, NOW).look).toContain('CMDR Kestrel');
    const won = shared({ won: 3, recent: [{ c: 'Wren', how: 'won', at: NOW - HOUR }] });
    expect(inTheSaloon(riedquat, undefined, 0, NOW, won)).toBe('gloating');
    const g = saloonScene(who, 'gloating', undefined, 'Jameson', won, NOW);
    expect(g.says).toContain("Don't be Wren");
    expect(g.buys).toBeFalsy();
    expect(arrival(who, memoryOf(veteran(), who.key), won)).toContain("I've put down 3 commanders");
  });

  it('puts it on the chart and in the news, leaving out your own', () => {
    const out = shared({ beaten: 1, out: NOW + HOUR, recent: [{ c: 'Kestrel', how: 'beaten', at: NOW - HOUR }] });
    expect(chartLine(who, out, NOW)).toContain('beaten by CMDR Kestrel');
    const records = new Map([[46, out]]);
    const at = (g: number, i: number) => galaxy(g)[i];
    expect(sharedNews(0, records, null, NOW, at)[0].text).toBe('CMDR Kestrel puts Ambrose Hale of Riedquat in his escape pod');
    expect(sharedNews(0, records, 'Kestrel', NOW, at)).toHaveLength(0);
  });
});
