import { describe, expect, it } from 'vitest';
import { distanceLy, galaxy, systemAt } from '../galaxy/generate';
import { fuelCapacity, newCommander, removeEquipment } from './commander';
import { board, deliver, forContract, surveyDone, take, wyWorks } from './contracts';
import {
  advanceTrail,
  bodiesOf,
  exploreOf,
  moonGrade,
  publishReports,
  recordDiscovery,
  recordSurvey,
  REPORT_PRICE,
  sellData,
  TRAIL_END_POINTS,
  trailPoisOf,
  trailsOf,
  TRAILS_PER_GALAXY,
  worldOf,
} from './explore';

const NOW = Date.UTC(2026, 9, 22, 12);

describe('trails', () => {
  it('are sixteen a galaxy, three to five systems, each a jump from the last', () => {
    for (let g = 0; g < 8; g++) {
      const trails = trailsOf(g);
      expect(trails).toHaveLength(TRAILS_PER_GALAXY);
      for (const t of trails) {
        expect(t.systems.length).toBeGreaterThanOrEqual(3);
        expect(t.systems.length).toBeLessThanOrEqual(5);
        for (let i = 1; i < t.systems.length; i++) expect(distanceLy(systemAt(g, t.systems[i - 1]), systemAt(g, t.systems[i]))).toBeLessThanOrEqual(7);
      }
    }
  });

  it('reveal one step at a time, and pay at the end', () => {
    const c = newCommander('modern');
    const t = trailsOf(0)[1];
    const at = (k: number) => systemAt(0, t.systems[k]);
    // Only the first step is there to find; the second appears once it is.
    expect(trailPoisOf(c, at(0)).filter((p) => p.trail?.id === t.id)).toHaveLength(1);
    expect(trailPoisOf(c, at(1)).filter((p) => p.trail?.id === t.id)).toHaveLength(0);
    let points = 0;
    for (let k = 0; k < t.systems.length; k++) {
      const poi = trailPoisOf(c, at(k)).find((p) => p.trail?.id === t.id)!;
      expect(poi).toBeDefined();
      recordDiscovery(c, at(k), poi);
      const next = advanceTrail(c, poi);
      if (k < t.systems.length - 1) {
        expect(next?.index).toBe(t.systems[k + 1]);
        expect(poi.log).toContain(next!.name);
      } else expect(next).toBeNull();
      points = exploreOf(c).points;
    }
    expect(points).toBeGreaterThanOrEqual(TRAIL_END_POINTS);
  });

  it('end the Wexley-Yorozu trail with a report you choose who to give', () => {
    const c = newCommander('modern');
    const t = trailsOf(0).find((x) => x.story === 'colony')!;
    const last = systemAt(0, t.systems.at(-1)!);
    exploreOf(c).trails = { [t.id]: t.systems.length - 1 };
    const poi = trailPoisOf(c, last).find((p) => p.trail?.last)!;
    expect(poi.report).toBe('ninefold');
    recordDiscovery(c, last, poi);
    // It doesn't sell with the rest, except to Wexley-Yorozu.
    expect(sellData(c, last, false).reports).toBe(0);
    expect(exploreOf(c).data.some((d) => d.report)).toBe(true);
    const before = c.credits;
    expect(publishReports(c)).toBe(REPORT_PRICE.published);
    expect(c.credits).toBe(before + REPORT_PRICE.published);
    expect(exploreOf(c).ninefold).toBe('published');
    const d = newCommander('modern');
    recordDiscovery(d, last, poi);
    expect(exploreOf(d).ninefold).toBeUndefined();
    expect(sellData(d, last, true)).toEqual({ credits: REPORT_PRICE.wy, reports: 1 });
    expect(exploreOf(d).ninefold).toBe('wy');
  });

  it('never repeat a log within a trail', () => {
    const c = newCommander('modern');
    for (const t of trailsOf(0)) {
      exploreOf(c).trails = { [t.id]: t.systems.length - 1 };
      const logs = t.systems.map((i) => trailPoisOf(c, systemAt(0, i)).find((p) => p.trail?.id === t.id)!.log);
      expect(new Set(logs).size).toBe(logs.length);
    }
  });
});

describe('terraforming candidates', () => {
  it('are about one moon in six, and worth four times the data', () => {
    const moons = galaxy(0).flatMap((s) => worldOf(s).moons.map((m, i) => moonGrade(s, i, m.size)));
    const share = moons.filter((g) => g === 'Candidate').length / moons.length;
    expect(share).toBeGreaterThan(0.1);
    expect(share).toBeLessThan(0.25);
    const s = galaxy(0).find((x) => worldOf(x).moons.some((m, i) => moonGrade(x, i, m.size) === 'Candidate'))!;
    const candidate = bodiesOf(s).find((b) => b.grade === 'Candidate')!;
    expect(candidate.value).toBe(120);
  });
});

describe('Wexley-Yorozu survey contracts', () => {
  it('are offered where W-Y works, need no hold, and are handed in once the moons are surveyed', () => {
    const c = newCommander('modern');
    let here = galaxy(0)[0];
    let offer;
    for (const s of galaxy(0)) {
      if (!wyWorks(s)) continue;
      offer = board(c, s, NOW).find((o) => o.survey);
      if (offer) {
        here = s;
        break;
      }
    }
    expect(offer).toBeDefined();
    expect(offer!.qty).toBe(0);
    expect(take(c, offer!, 0)).toBeNull(); // an empty hold is enough
    const target = systemAt(offer!.to.galaxy, offer!.to.system);
    expect(deliver(c, here)).toHaveLength(0); // not surveyed yet
    for (const b of bodiesOf(target).filter((b) => b.kind === 'moon')) recordSurvey(c, target, b);
    expect(surveyDone(c, c.contracts![0])).toBe(true);
    const credits = c.credits;
    expect(deliver(c, here)).toHaveLength(1);
    expect(c.credits).toBe(credits + offer!.pay);
    // Wexley-Yorozu keeps the moon data: it isn't paid twice.
    expect(exploreOf(c).data.filter((d) => d.system === target.index && d.body.startsWith('moon'))).toHaveLength(0);
  });

  it("keeps the contract's moon data out of a data sale, so it can't be sold off cheap first", () => {
    const c = newCommander('modern');
    let here = galaxy(0)[0];
    let offer;
    for (const s of galaxy(0)) {
      if (!wyWorks(s)) continue;
      offer = board(c, s, NOW).find((o) => o.survey);
      if (offer) {
        here = s;
        break;
      }
    }
    take(c, offer!, 0);
    const target = systemAt(offer!.to.galaxy, offer!.to.system);
    for (const b of bodiesOf(target)) recordSurvey(c, target, b);
    const moons = exploreOf(c).data.filter((d) => forContract(c, d));
    expect(moons.length).toBeGreaterThan(0);
    const others = exploreOf(c).data.length - moons.length;
    sellData(c, here, true, (d) => forContract(c, d));
    expect(exploreOf(c).data).toEqual(moons); // the rest sold, the contract's kept
    expect(others).toBeGreaterThan(0);
    expect(deliver(c, here)).toHaveLength(1); // and the contract still pays
  });
});

describe("explorer's kit", () => {
  it('long-range tanks hold ten light years, and selling them drains the excess', () => {
    const c = newCommander('modern');
    expect(fuelCapacity(c)).toBe(7);
    c.equipment.push('long-range-tanks');
    expect(fuelCapacity(c)).toBe(10);
    c.fuel = 10;
    removeEquipment(c, 'long-range-tanks');
    expect(c.fuel).toBe(7);
  });
});
