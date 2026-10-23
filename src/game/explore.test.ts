import { describe, expect, it } from 'vitest';
import { galaxy, systemAt } from '../galaxy/generate';
import { commodityById } from '../economy/commodities';
import { newCommander } from './commander';
import { bodiesOf, dataValue, explorerRank, hasVisited, poisOf, recordDiscovery, recordSurvey, recordVisit, sellData, worldOf, exploreOf } from './explore';

const all = Array.from({ length: 8 }, (_, g) => galaxy(g)).flat();
const lave = systemAt(0, 7);

describe('worlds', () => {
  it('are the same for everyone', () => {
    expect(worldOf(lave)).toEqual(worldOf(systemAt(0, 7)));
    expect(poisOf(lave)).toEqual(poisOf(systemAt(0, 7)));
  });

  it('ringed worlds are rare, and moons common', () => {
    const ringed = all.filter((s) => worldOf(s).rings).length / all.length;
    const mooned = all.filter((s) => worldOf(s).moons.length).length / all.length;
    expect(ringed).toBeGreaterThan(0.08);
    expect(ringed).toBeLessThan(0.18);
    expect(mooned).toBeGreaterThan(0.45);
    expect(mooned).toBeLessThan(0.65);
  });

  it('moons orbit clear of the rings and each other', () => {
    for (const s of all) {
      const w = worldOf(s);
      for (const m of w.moons) expect(m.orbit - m.size).toBeGreaterThan((w.rings?.outer ?? 1) + 0.2);
      if (w.moons.length === 2) expect(w.moons[1].orbit - w.moons[0].orbit).toBeGreaterThan(w.moons[0].size + w.moons[1].size);
    }
  });

  it('every body has a name, a value and a survey time', () => {
    for (const b of bodiesOf(lave)) {
      expect(b.name).toBeTruthy();
      expect(b.value).toBeGreaterThan(0);
      expect(b.time).toBeGreaterThan(0);
    }
  });
});

describe('points of interest', () => {
  it('about half the systems have something to find', () => {
    const share = all.filter((s) => poisOf(s).length).length / all.length;
    expect(share).toBeGreaterThan(0.4);
    expect(share).toBeLessThan(0.6);
  });

  it('salvage is real cargo, and every signal has a log', () => {
    for (const s of all) {
      for (const p of poisOf(s)) {
        expect(p.log.length).toBeGreaterThan(20);
        expect(p.log).not.toContain('undefined');
        for (const item of p.salvage) expect(commodityById(item.id), item.id).toBeTruthy();
        expect(Math.hypot(...p.direction)).toBeCloseTo(1);
      }
    }
  });
});

describe('the explorer’s record', () => {
  it('counts a first visit once', () => {
    const c = newCommander('modern');
    expect(recordVisit(c, lave)).toBe(true);
    expect(recordVisit(c, lave)).toBe(false);
    expect(hasVisited(c, lave)).toBe(true);
    expect(exploreOf(c).points).toBe(1);
  });

  it('a survey is data in the hold, once per body', () => {
    const c = newCommander('modern');
    const planet = bodiesOf(lave)[0];
    recordSurvey(c, lave, planet);
    recordSurvey(c, lave, planet);
    expect(exploreOf(c).data).toHaveLength(1);
  });

  it('data is worth more the further it travels', () => {
    const c = newCommander('modern');
    recordSurvey(c, lave, bodiesOf(lave)[0]);
    const d = exploreOf(c).data[0];
    const far = galaxy(0).reduce((a, b) => (Math.hypot(b.x - lave.x, b.y - lave.y) > Math.hypot(a.x - lave.x, a.y - lave.y) ? b : a));
    expect(dataValue(d, lave)).toBe(Math.round(d.value * 0.5));
    expect(dataValue(d, far)).toBe(d.value * 5);
    expect(dataValue(d, systemAt(1, 7))).toBe(d.value * 5); // another galaxy entirely
  });

  it('selling empties the hold and pays', () => {
    const c = newCommander('modern');
    const poi = all.flatMap((s) => poisOf(s).map((p) => [s, p] as const))[0];
    recordDiscovery(c, poi[0], poi[1]);
    const before = c.credits;
    const paid = sellData(c, lave).credits;
    expect(paid).toBeGreaterThan(0);
    expect(c.credits).toBe(before + paid);
    expect(exploreOf(c).data).toHaveLength(0);
  });

  it('ranks rise with points', () => {
    expect(explorerRank(0)).toBe('Homebody');
    expect(explorerRank(40)).toBe('Surveyor');
    expect(explorerRank(10_000)).toBe('Voyager');
  });
});
