import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { timelines, type TrackData } from '../game/track';
import { assessorsNote, aftermathShot, CameraRig, fitFov, labelText, MAX_FOV, MAX_TURN, pickLabels, twoShot, type Shot } from './killCamShots';
import { cardAlpha, CARD_FADE, videoFrames } from './videoCards';

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** Is a point in the frame of a camera at `pos` looking at `look` with this fov and aspect? */
function inFrame(p: THREE.Vector3, shot: { pos: THREE.Vector3; look: THREE.Vector3; fov: number }, aspect: number) {
  const cam = new THREE.PerspectiveCamera(shot.fov, aspect, 1, 1e6);
  cam.position.copy(shot.pos);
  cam.lookAt(shot.look);
  cam.updateMatrixWorld();
  const s = p.clone().project(cam);
  return s.z < 1 && Math.abs(s.x) <= 1 && Math.abs(s.y) <= 1;
}

describe('the two-shot', () => {
  const cases: [string, THREE.Vector3, THREE.Vector3][] = [
    ['close', v(0, 0, 0), v(0, 0, 120)],
    ['a long way apart', v(0, 0, 0), v(400, -200, 2000)],
    ['one above the other', v(0, 0, 0), v(0, 900, 5)],
    ['far from the origin', v(50000, -3000, 20000), v(50300, -2900, 20600)],
  ];
  for (const aspect of [16 / 9, 9 / 16]) {
    for (const [name, k, y] of cases) {
      it(`keeps both ships in frame: ${name}, ${aspect < 1 ? 'upright' : 'wide'}`, () => {
        const shot = twoShot({ p: k, r: 20 }, { p: y, r: 18 }, aspect);
        expect(inFrame(k, shot, aspect)).toBe(true);
        expect(inFrame(y, shot, aspect)).toBe(true);
        expect(shot.fov).toBeLessThanOrEqual(MAX_FOV);
        // The camera stands behind the lead ship, not between them.
        expect(shot.pos.distanceTo(y)).toBeGreaterThan(shot.pos.distanceTo(k));
      });
    }
  }

  it('keeps the far ship near the near one in size: back further, longer lens (Mark)', () => {
    for (const aspect of [16 / 9, 9 / 16]) {
      for (const y of [v(0, 0, 400), v(300, -100, 1500)]) {
        const shot = twoShot({ p: v(0, 0, 0), r: 20 }, { p: y, r: 18 }, aspect);
        const ratio = shot.pos.distanceTo(y) / shot.pos.distanceTo(v(0, 0, 0));
        expect(ratio).toBeGreaterThan(1); // the lead nearer, still
        expect(ratio).toBeLessThan(2); // but not three times as near
      }
    }
  });

  it('zooms in when the ships are far apart, so the far one is still a ship', () => {
    const near = twoShot({ p: v(0, 0, 0), r: 20 }, { p: v(0, 0, 150), r: 20 }, 16 / 9);
    const far = twoShot({ p: v(0, 0, 0), r: 20 }, { p: v(0, 0, 2500), r: 20 }, 16 / 9);
    expect(far.fov).toBeLessThan(near.fov);
  });

  it('fits nothing behind the camera', () => {
    expect(fitFov(v(0, 0, 0), v(0, 0, 10), 1, [{ p: v(0, 0, -50), r: 5 }])).toBe(Infinity);
  });
});

describe('the aftermath', () => {
  it('holds on the explosion, wherever the killer went', () => {
    const boom = { p: v(100, 0, 0), r: 20 };
    const a = aftermathShot(boom, v(0, 0.3, -1), 0.5, 16 / 9, { p: v(150, 0, 60), r: 20 });
    const b = aftermathShot(boom, v(0, 0.3, -1), 0.5, 16 / 9, { p: v(100, 0, -3000), r: 20 });
    expect(a.look.equals(boom.p)).toBe(true);
    expect(b.look.equals(boom.p)).toBe(true);
    expect(a.pos.distanceTo(b.pos)).toBeLessThan(1);
    expect(inFrame(boom.p, a, 16 / 9)).toBe(true);
  });
});

describe('the camera rig', () => {
  const shot = (pos: THREE.Vector3, look: THREE.Vector3, key = 'a', anchor = v(0, 0, 0)): Shot => ({ key, anchor, pos, look, fov: 40 });
  const dt = 1 / 30;
  const forward = (q: THREE.Quaternion) => v(0, 0, -1).applyQuaternion(q);

  it('eases to a new place instead of jumping', () => {
    const rig = new CameraRig();
    rig.update(shot(v(0, 0, -100), v(0, 0, 0)), dt);
    let last = rig.pos.clone();
    let biggest = 0;
    for (let i = 0; i < 120; i++) {
      rig.update(shot(v(600, 0, -100), v(0, 0, 0)), dt);
      biggest = Math.max(biggest, rig.pos.distanceTo(last));
      last = rig.pos.clone();
    }
    expect(biggest).toBeLessThan(60); // 600 m over many frames, not one
    expect(rig.pos.distanceTo(v(600, 0, -100))).toBeLessThan(5);
  });

  it('starts a move gently (eases in)', () => {
    const rig = new CameraRig();
    rig.update(shot(v(0, 0, -100), v(0, 0, 0)), dt);
    rig.update(shot(v(600, 0, -100), v(0, 0, 0)), dt);
    const first = rig.pos.x;
    rig.update(shot(v(600, 0, -100), v(0, 0, 0)), dt);
    expect(rig.pos.x - first).toBeGreaterThan(first); // the second step is longer than the first
  });

  it("doesn't move on a cut: it glides from where it was", () => {
    const rig = new CameraRig();
    rig.update(shot(v(0, 0, -100), v(0, 0, 0), 'killer', v(0, 0, 0)), dt);
    for (let i = 0; i < 30; i++) rig.update(shot(v(0, 0, -100), v(0, 0, 0), 'killer', v(0, 0, 0)), dt);
    const before = rig.pos.clone();
    rig.update(shot(v(500, 200, 400), v(400, 200, 400), 'boom', v(400, 200, 400)), dt);
    expect(rig.pos.distanceTo(before)).toBeLessThan(8); // a first easy step of a 700 m move
  });

  it('keeps its speed through a cut from a fast ship to a still explosion', () => {
    const rig = new CameraRig();
    let step = 0;
    let last = new THREE.Vector3();
    for (let i = 0; i < 60; i++) {
      const a = v(i * 10, 0, 0); // 300 m a second
      rig.update(shot(a.clone().add(v(0, 20, -100)), a, 'killer', a), dt);
      step = rig.pos.distanceTo(last);
      last = rig.pos.clone();
    }
    const boom = v(600, 0, 0);
    rig.update({ ...shot(boom.clone().add(v(0, 40, -150)), boom, 'boom', boom), ease: 1.1 }, dt);
    const after = rig.pos.distanceTo(last);
    expect(after).toBeGreaterThan(step * 0.8); // no sudden stop
    expect(after).toBeLessThan(step * 1.2);
  });

  it('turns no faster than MAX_TURN, even when its subject swaps sides', () => {
    const rig = new CameraRig();
    rig.update(shot(v(0, 0, 0), v(0, 0, 100)), dt);
    let f = forward(rig.quat);
    for (let i = 0; i < 60; i++) {
      rig.update(shot(v(0, 0, 0), v(0, 0, -100)), dt);
      const g = forward(rig.quat);
      expect(f.angleTo(g)).toBeLessThanOrEqual(MAX_TURN * dt + 1e-6);
      f = g;
    }
  });

  it('never flips over when it looks straight up', () => {
    const rig = new CameraRig();
    rig.update(shot(v(0, 0, 0), v(0, 10, 100)), dt);
    let up = v(0, 1, 0).applyQuaternion(rig.quat);
    // The subject climbs over the top and down the other side.
    for (let i = 0; i <= 90; i++) {
      const a = (i / 90) * Math.PI;
      rig.update(shot(v(0, 0, 0), v(0, Math.sin(a) * 100, Math.cos(a) * 100)), dt);
      const u = v(0, 1, 0).applyQuaternion(rig.quat);
      expect(u.angleTo(up)).toBeLessThan(MAX_TURN * dt + 0.02);
      up = u;
    }
  });

  it('travels with its anchor, so a fast ship never outruns it', () => {
    const rig = new CameraRig();
    for (let i = 0; i < 60; i++) {
      const a = v(i * 20, 0, 0); // 600 m a second
      rig.update(shot(a.clone().add(v(0, 10, -80)), a, 'k', a), dt);
    }
    expect(rig.pos.distanceTo(v(59 * 20, 10, -80))).toBeLessThan(1);
  });
});

describe('the labels', () => {
  const box = (id: number, rank: number, x: number, y: number, altY?: number) => ({ id, rank, x, y, w: 120, h: 20, altY });

  it('always shows the killer and you, moving yours below your ship if they would overlap', () => {
    const out = pickLabels([box(2, 0, 100, 100), box(1, 1, 110, 105, 160)]);
    expect(out.get(2)).toBe(100);
    expect(out.get(1)).toBe(160);
  });

  it('drops anyone else whose label would overlap, and keeps the rest to one', () => {
    const out = pickLabels([box(2, 0, 100, 100), box(1, 1, 400, 100), box(5, 2, 120, 110), box(6, 3, 700, 300), box(7, 4, 900, 500)]);
    expect([...out.keys()].sort()).toEqual([1, 2, 6]);
  });

  it('keeps the words short', () => {
    expect(labelText('Sidewinder · pirate · 50 Cr', { killer: true })).toBe('Sidewinder · fired the killing shot');
    expect(labelText('CMDR Jameson', { you: true })).toBe('CMDR Jameson (you)');
    expect(labelText('Mamba · pirate · 80 Cr', {})).toBe('Mamba · pirate');
    expect(labelText('Asp · pirate', { unknown: true })).toBe('Unidentified contact');
  });
});

describe('the end card', () => {
  it('comes up over the last of the scene, eased, and is fully up when the scene ends', () => {
    const scene = 18;
    expect(cardAlpha(scene - CARD_FADE - 0.01, scene)).toBe(0);
    expect(cardAlpha(scene - CARD_FADE / 2, scene)).toBeCloseTo(0.5, 5);
    expect(cardAlpha(scene, scene)).toBe(1);
    expect(cardAlpha(scene + 2, scene)).toBe(1);
    // Eased: slow at the start.
    expect(cardAlpha(scene - CARD_FADE * 0.9, scene)).toBeLessThan(0.05);
  });

  it('holds the card after the scene', () => {
    expect(videoFrames(18, 30)).toEqual({ scene: 540, total: 615 });
  });
});

describe("the assessors' note", () => {
  // You fly along +Z; the pirate sits 400 m behind you and hits you four times, then once from ahead.
  const samples = Array.from({ length: 101 }, (_, i) => ({
    t: i / 20,
    poses: [
      { id: 1, p: [0, 0, i * 5] as [number, number, number], q: [0, 0, 0, 1] as [number, number, number, number] },
      { id: 2, p: [0, 0, i * 5 - 400] as [number, number, number], q: [0, 0, 0, 1] as [number, number, number, number] },
    ],
  }));
  const at = (t: number) => t * 100;
  const shot = (t: number, dz: number) => ({ t, kind: 'beam' as const, from: 2, a: [0, 0, at(t) + dz] as [number, number, number], b: [0, 0, at(t)] as [number, number, number], color: '#f00', hit: 1 });
  const d: TrackData = {
    v: 1,
    scene: { system: 'Raoror', when: 0, you: 1 },
    ships: [],
    samples,
    events: [shot(1, -400), shot(2, -400), shot(3, -400), shot(3.5, -400), shot(4, 640), { t: 4, kind: 'death', by: 2 }],
  };

  it('says how often, how long, from where and how far', () => {
    expect(assessorsNote(d, 2, 'Sidewinder', timelines(d))).toBe('The Sidewinder hit you five times in three seconds, four of them from behind; the last from 640 m.');
  });

  it('says nothing without a killer', () => {
    expect(assessorsNote(d, undefined, 'Sidewinder', timelines(d))).toBeNull();
  });
});
