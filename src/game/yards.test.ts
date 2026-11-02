import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { shipById } from '../content/ships';
import { checkGeometry } from '../content/geometry';
import { wyWorks } from './contracts';
import { worldOf } from './explore';
import { BUILD_TIME, STAGES, TRANSIT_TIME, behindLabel, buildBar, keepLosses, stageLabel, stationAtStage, stationSpin, withLosses, yardAt, yardNews, yardSeen, yardSites, yardsNear, yardsOf, YARDS_PER_GALAXY, type Yard, type YardLoss } from './yards';

const DAY = 86_400_000;
const now = Date.UTC(2026, 9, 23, 12);

describe('which worlds have yards', () => {
  it('only Wexley-Yorozu worlds with a moon to quarry', () => {
    for (let g = 0; g < 8; g++) {
      expect(yardSites(g).length).toBeGreaterThan(40);
      for (const s of yardSites(g)) {
        expect(wyWorks(s)).toBe(true);
        expect(worldOf(s).moons.length).toBeGreaterThan(0);
      }
    }
  });

  it('a handful at a time in each galaxy, never two at one world', () => {
    for (let g = 0; g < 8; g++) {
      for (let d = 0; d < 60; d += 0.5) {
        const yards = yardsOf(g, now + d * DAY);
        expect(yards.length).toBeLessThanOrEqual(YARDS_PER_GALAXY);
        expect(new Set(yards.map((y) => y.system)).size).toBe(yards.length);
        for (const y of yards) {
          expect(y.moon).toBeLessThan(worldOf(systemAt(g, y.system)).moons.length);
          expect(yardSites(g).some((s) => s.index === y.system)).toBe(true);
        }
      }
      expect(yardsOf(g, now).length).toBeGreaterThanOrEqual(YARDS_PER_GALAXY - 2);
    }
  });
});

describe('a build', () => {
  it('is the same for everyone at the same moment', () => {
    expect(yardsOf(0, now)).toEqual(yardsOf(0, now));
    const y = yardsOf(0, now)[0];
    expect(yardAt(systemAt(0, y.system), now)).toEqual(y);
  });

  it('runs through its stages in order, over days', () => {
    const y = yardsOf(0, now)[0];
    const seen: string[] = [];
    for (let t = y.start; t < y.end; t += DAY / 4) {
      const at = yardAt(systemAt(0, y.system), t)!;
      expect(at.build).toBe(y.build);
      expect(at.progress).toBeGreaterThanOrEqual(0);
      expect(at.progress).toBeLessThanOrEqual(1);
      if (seen.at(-1) !== at.stage) seen.push(at.stage);
    }
    expect(seen).toEqual(STAGES.map((s) => s.stage));
    expect(BUILD_TIME).toBeGreaterThanOrEqual(10 * DAY);
    expect(stageLabel(yardAt(systemAt(0, y.system), y.start + 4 * DAY)!)).toBe('Station: frame');
  });

  it('moves on when it finishes: the constructor is away, then building somewhere else', () => {
    const y = yardsOf(0, now)[0];
    expect(yardAt(systemAt(0, y.system), y.end + 1)).toBeNull();
    const next = yardsOf(0, y.end + TRANSIT_TIME + 1).find((n) => n.slot === y.slot)!;
    expect(next.build).toBe(y.build + 1);
    expect(next.system).not.toBe(y.system);
    expect(next.stage).toBe('refining');
  });

  it('over a season, yards come and go across many worlds', () => {
    const worlds = new Set<number>();
    for (let d = 0; d < 365; d += 5) for (const y of yardsOf(0, now + d * DAY)) worlds.add(y.system);
    expect(worlds.size).toBeGreaterThan(40);
  });

  it('news reaches nearby systems', () => {
    const y = yardsOf(0, now)[0];
    const there = systemAt(0, y.system);
    expect(yardsNear(there, now)[0]).toMatchObject({ yard: { ...y, behind: 0 }, distance: 0 });
  });
});

describe('the station in its stages', () => {
  const coriolis = shipById('coriolis')!;

  it('starts from nothing and ends as the station', () => {
    expect(stationAtStage(coriolis, 'refining')).toBeNull();
    expect(stationAtStage(coriolis, 'spin-up')).toBe(coriolis);
    expect(stationAtStage(coriolis, 'finished')).toBe(coriolis);
  });

  it('grows: spine, then a scaffold, then plated a face at a time', () => {
    const spine = stationAtStage(coriolis, 'spine')!;
    const frame = stationAtStage(coriolis, 'frame')!;
    const plating = stationAtStage(coriolis, 'plating')!;
    expect(spine.insignia).toBeUndefined();
    expect(frame.geometry.faces.length).toBe(spine.geometry.faces.length);
    expect(frame.insignia!.lines.length).toBe(28);
    // Plating covers the scaffold as it goes on.
    expect(plating.insignia!.lines.length).toBeLessThan(28);
    expect(plating.geometry.faces.length).toBeGreaterThan(frame.geometry.faces.length);
    expect(plating.geometry.faces.length).toBeLessThan(spine.geometry.faces.length + coriolis.geometry.faces.length);
    // Plated a face at a time over the stage, never quite closed.
    const early = stationAtStage(coriolis, 'plating', 0.05)!.geometry.faces.length;
    const late = stationAtStage(coriolis, 'plating', 1)!.geometry.faces.length;
    expect(early).toBe(spine.geometry.faces.length + 1);
    expect(late).toBe(spine.geometry.faces.length + coriolis.geometry.faces.length - 2);
    // The spine is a closed, sound hull of its own.
    const spineOnly = checkGeometry(spine.geometry.vertices, spine.geometry.faces);
    expect(spineOnly.errors).toEqual([]);
    expect(spineOnly.warnings.filter((w) => w.includes('not closed'))).toEqual([]);
  });

  it('stays still until spin-up, then eases up to speed', () => {
    const y = yardsOf(0, now)[0];
    expect(stationSpin({ ...y, stage: 'plating', progress: 0.5 }, 0.25)).toBe(0);
    expect(stationSpin({ ...y, stage: 'spin-up', progress: 0.5 }, 0.25)).toBeCloseTo(0.125);
    expect(stationSpin({ ...y, stage: 'finished', progress: 0 }, 0.25)).toBe(0.25);
  });
});

describe('losses slow the build (the-world.md step 5, Mark)', () => {
  const H = 3_600_000;
  // A build under way, found from the clock, and a moment a day into its frame.
  const yard = yardsOf(0, Date.UTC(2026, 10, 2))[0] as Yard;
  const s = systemAt(0, yard.system);
  const frameStart = yard.start + 3 * 86_400_000; // refining 1 d + spine 2 d
  const loss = (at: number, tonnes = 20, build = yard.build): YardLoss => ({ galaxy: 0, system: yard.system, build, at, tonnes, ship: 'Keystone', voyage: `v${at}` });

  it('puts the build about two hours behind for a Cobra-load lost', () => {
    const t = frameStart + 12 * H;
    const y = withLosses(yard, [loss(frameStart + H)], t);
    expect(y.behind).toBe(2 * H);
    expect(behindLabel(y.behind)).toBe('2 h behind');
    expect(stageLabel(y)).toBe('Station: frame · 2 h behind');
    // Further back through the stage than the clock says.
    expect(y.progress).toBeLessThan(yardAt(s, t)!.progress);
  });

  it("ignores another build's losses, another system's, and losses still to come", () => {
    const t = frameStart + 12 * H;
    expect(withLosses(yard, [loss(frameStart + H, 20, yard.build - 1)], t).behind).toBe(0);
    expect(withLosses(yard, [{ ...loss(frameStart + H), system: yard.system + 1 }], t).behind).toBe(0);
    expect(withLosses(yard, [loss(t + H)], t).behind).toBe(0);
  });

  it('never sets a stage back by more than its own length, nor the build by more than the passage to the next site', () => {
    const many = Array.from({ length: 200 }, (_, i) => loss(frameStart + i * 60_000, 50));
    const y = withLosses(yard, many, frameStart + 10 * 86_400_000);
    expect(y.behind).toBeLessThanOrEqual(TRANSIT_TIME);
    expect(y.behind).toBeGreaterThan(0);
    expect(y.end).toBe(yard.end + y.behind);
  });

  it('keeps a late build going after the clock says it ended, then lets it finish', () => {
    const losses = [loss(frameStart + H, 50), loss(frameStart + 2 * H, 50), loss(frameStart + 3 * H, 50)];
    const behind = withLosses(yard, losses, frameStart + 4 * H).behind;
    expect(yardSeen(s, yard.end + behind / 2, losses)?.stage).toBe('finished');
    expect(yardSeen(s, yard.end + behind + 1, losses)).toBeNull();
    // Nobody else's view changes.
    expect(yardAt(s, frameStart + 12 * H)?.stage).toBe('frame');
  });

  it('says so in the news, with a bar of the time lost', () => {
    const t = frameStart + 12 * H;
    const losses = [loss(frameStart + H), loss(frameStart + 2 * H), loss(frameStart + 3 * H)];
    const y = withLosses(yard, losses, t);
    expect(yardNews(y, losses, t)).toBe('the frame has fallen behind, three supply ships lost this week');
    expect(yardNews(withLosses(yardAt(s, t)!, [], t), [], t)).toBe(STAGES[2].news);
    const bar = buildBar(y, t);
    expect(bar.lost).toBeCloseTo((6 * H) / BUILD_TIME);
    const near = yardsNear(s, t, 1, losses).find((n) => n.yard.system === yard.system);
    expect(near?.yard.behind).toBe(6 * H);
  });

  it('forgets losses once their build is long over', () => {
    const now = yard.end + 30 * 86_400_000;
    expect(keepLosses([loss(frameStart)], now)).toEqual([]);
    expect(keepLosses([loss(frameStart)], frameStart + H)).toHaveLength(1);
  });
});
