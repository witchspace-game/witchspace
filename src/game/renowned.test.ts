import { describe, expect, it } from 'vitest';
import { galaxy } from '../galaxy/generate';
import { newCommander } from './commander';
import { arrival, CALL_AT, flying, foughtHim, HOUR, KILL_WINDOW, killedHisMan, memoryOf, OUT_OF_ACTION, renownedOf, WARN_AT } from './renowned';

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
