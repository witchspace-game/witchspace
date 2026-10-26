import { describe, expect, it } from 'vitest';
import { bracket, focusOf, killerOf, packTrack, SAMPLE_RATE, TrackRecorder, unpackTrack, type Pose } from './track';

const scene = { system: 'Riedquat', when: 0, you: 1 };
const pose = (id: number, x: number, unknown = false): Pose => ({ id, p: [100000 + x, 5000, -20000], q: [0, 0, 0, 1], ...(unknown ? { unknown } : {}) });

function fight(seconds: number) {
  const r = new TrackRecorder();
  r.ship({ id: 1, def: 'cobra-mk3', role: 'player', label: 'You' });
  r.ship({ id: 2, def: 'mamba', role: 'pirate', label: 'Mamba · pirate · 80 Cr' });
  r.ship({ id: 3, def: 'falcon', role: 'pirate', label: 'Falcon' });
  for (let i = 0; i <= seconds * SAMPLE_RATE; i++) {
    const t = i / SAMPLE_RATE;
    r.sample(t, [pose(1, t * 100), pose(2, 500 - t * 10), ...(t > 5 ? [pose(3, -800, t < 8)] : [])]);
  }
  return r;
}

describe('the kill cam track', () => {
  it('keeps only the last minute', () => {
    const r = fight(90);
    const d = r.snapshot(scene)!;
    expect(d.samples[0].t).toBe(0);
    expect(d.samples[d.samples.length - 1].t).toBeCloseTo(60, 5);
    expect(d.samples.length).toBe(60 * SAMPLE_RATE + 1);
  });

  it('samples twenty times a second', () => {
    const r = new TrackRecorder();
    expect(r.due(0)).toBe(true);
    r.sample(0, []);
    expect(r.due(0.02)).toBe(false);
    expect(r.due(0.05)).toBe(true);
  });

  it('lists only the ships that appear in it', () => {
    const r = fight(3);
    expect(r.snapshot(scene)!.ships.map((s) => s.id)).toEqual([1, 2]);
  });

  it('packs small and comes back the same', () => {
    const r = fight(60);
    r.event({ t: 50, kind: 'beam', from: 2, a: [100000, 5000, -20000], b: [100050, 5000, -20000], color: '#ff9a3d', hit: 1 });
    r.event({ t: 55, kind: 'death' });
    const d = r.snapshot(scene)!;
    const packed = packTrack(d);
    expect(packed.length).toBeLessThan(100_000); // a minute, about three ships at a time, before compression (22 bytes a ship a sample)
    const back = unpackTrack(packed)!;
    expect(back.samples.length).toBe(d.samples.length);
    const at = back.samples[300].poses.find((p) => p.id === 2)!;
    const was = d.samples[300].poses.find((p) => p.id === 2)!;
    const origin = d.samples[0].poses.find((p) => p.id === 1)!.p;
    expect(at.p[0]).toBeCloseTo(was.p[0] - origin[0], 2);
    expect(at.q[3]).toBeCloseTo(1, 3);
    expect(back.events[0]).toMatchObject({ kind: 'beam', from: 2, hit: 1, a: [0, 0, 0], b: [50, 0, 0] });
  });

  it('keeps a dark ship dark until it was read', () => {
    const back = unpackTrack(packTrack(fight(10).snapshot(scene)!))!;
    const falcon = (t: number) => bracket(back, t)!.a.poses.find((p) => p.id === 3);
    expect(falcon(4)).toBeUndefined(); // not yet on the scanner
    expect(falcon(6)!.unknown).toBe(true); // a cold white unknown
    expect(falcon(9)!.unknown).toBeUndefined(); // hull read
  });

  it('says who killed you: the last shot that hit you', () => {
    const r = fight(10);
    r.event({ t: 8, kind: 'beam', from: 3, a: [0, 0, 0], b: [1, 0, 0], color: '#f00', hit: 1 });
    r.event({ t: 9, kind: 'beam', from: 2, a: [0, 0, 0], b: [1, 0, 0], color: '#f00', hit: 1 });
    r.event({ t: 9.2, kind: 'beam', from: 3, a: [0, 0, 0], b: [1, 0, 0], color: '#f00' }); // a miss
    r.event({ t: 9.5, kind: 'death' });
    expect(killerOf(r.snapshot(scene)!)).toBe(2);
  });

  it('refuses a track from a version it cannot read', () => {
    const d = fight(2).snapshot(scene)!;
    expect(unpackTrack(packTrack({ ...d, v: 99 }))).toBeNull();
  });

  it('follows the ship you were fighting in a clip that is not a death', () => {
    const r = fight(20);
    r.event({ t: 6, kind: 'beam', from: 1, a: [0, 0, 0], b: [1, 0, 0], color: '#0f0', hit: 2 });
    r.event({ t: 12, kind: 'beam', from: 1, a: [0, 0, 0], b: [1, 0, 0], color: '#0f0', hit: 3 });
    r.event({ t: 13, kind: 'beam', from: 2, a: [0, 0, 0], b: [1, 0, 0], color: '#f00', hit: 1 }); // shot at you: not the focus
    const d = r.snapshot(scene)!;
    expect(focusOf(d, 0, 20)).toBe(3); // the last ship you hit
    expect(focusOf(d, 0, 10)).toBe(2);
    expect(focusOf(d, 14, 20)).toBeUndefined();
    r.event({ t: 18, kind: 'boom', id: 2, p: [0, 0, 0] });
    expect(focusOf(r.snapshot(scene)!, 14, 20)).toBe(2); // or the last ship that went up
  });
});
