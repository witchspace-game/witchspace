import * as THREE from 'three';
import { poseAt, type Timeline, type TrackData, type TrackEvent } from '../game/track';

// The kill cam's camera work (docs/design/kill-cam.md, "Camera work"): where
// the camera stands for each shot, how it moves between them, which labels
// earn a place on screen, and when the end card comes up. Three.js maths
// only, no renderer, so it's tested in Node.
//
// The rules, from Mark's first real clip (27 October 2026): frame the ship
// that got you and you together, so the shots can be seen landing; never jump
// or snap, so every move is eased and every cut glides; hold on the explosion
// rather than chase the killer away from it; keep the labels to the two that
// matter; and let the explosion play out into the end card.

const WORLD_UP = new THREE.Vector3(0, 1, 0);

/** Where the camera wants to be. `anchor` is what it travels with (`key` names it), so a fast ship can't outrun it. */
export interface Shot {
  key: string;
  anchor: THREE.Vector3;
  pos: THREE.Vector3;
  look: THREE.Vector3;
  /** Vertical field of view, degrees. */
  fov: number;
  /** How long the camera takes to settle on it, seconds (MOVE_TIME if not given): slower for a bigger move. */
  ease?: number;
}

export const MIN_FOV = 16;
export const MAX_FOV = 62;
/** Room left around the ships in a fitted frame (and above them, for their labels). */
const MARGIN = 1.35;

/** Something to keep in frame: a point and how big it is. */
export interface Subject {
  p: THREE.Vector3;
  r: number;
}

/** A unit vector at right angles to `dir`, as near world-up as it can be. */
function upAcross(dir: THREE.Vector3, out = new THREE.Vector3()): THREE.Vector3 {
  out.copy(WORLD_UP).addScaledVector(dir, -WORLD_UP.dot(dir));
  if (out.lengthSq() < 0.01) out.set(1, 0, 0).addScaledVector(dir, -dir.x);
  return out.normalize();
}

/**
 * The narrowest vertical field of view (degrees) that keeps every subject in
 * frame from `pos` looking at `look`, with room to spare. Infinity if one is
 * behind the camera.
 */
export function fitFov(pos: THREE.Vector3, look: THREE.Vector3, aspect: number, subjects: Subject[]): number {
  const f = look.clone().sub(pos).normalize();
  const up = upAcross(f);
  const right = f.clone().cross(up);
  const v = new THREE.Vector3();
  let tan = 0;
  for (const s of subjects) {
    v.copy(s.p).sub(pos);
    const z = v.dot(f);
    if (z <= s.r) return Infinity;
    const x = (Math.abs(v.dot(right)) + s.r) / (z * aspect);
    const y = (Math.abs(v.dot(up)) + s.r * 1.6) / z; // labels sit above a ship
    tan = Math.max(tan, x, y);
  }
  return THREE.MathUtils.radToDeg(2 * Math.atan(tan * MARGIN));
}

/**
 * The two-shot: from behind and above `lead` (the ship that got you), looking
 * past it to `other` (you), far enough back and narrow enough that both are in
 * frame and the shots between them can be seen landing. Further apart, the
 * camera stands further back and zooms in (a long lens brings the far ship up
 * to size). Upright frames stack the two ships top to bottom, wide frames set
 * them across.
 */
export function twoShot(lead: Subject, other: Subject, aspect: number, key = 'lead'): Shot {
  const d = other.p.clone().sub(lead.p);
  const gap = d.length();
  const dir = gap > 1 ? d.divideScalar(gap) : new THREE.Vector3(0, 0, 1);
  const up = upAcross(dir);
  const side = dir.clone().cross(up);
  // Higher, to look down on the ships: a flat ship like the Cobra seen edge-on was just a glowing smear.
  const lift = aspect < 1 ? 0.5 : 0.42;
  const swing = aspect < 1 ? 0.12 : 0.36;
  // Further back with a longer lens: the far ship comes out nearly the size of the near one, not a third of it
  // (Mark's Orgetibe clip: "CMDR Jameson (you)" was a flat green ellipse the whole clip). fitFov zooms to fit.
  let back = Math.max(lead.r * 5, 70, gap * 1.3);
  const look = lead.p.clone().addScaledVector(dir, gap * 0.5);
  const pos = new THREE.Vector3();
  let fov = Infinity;
  for (let i = 0; i < 8; i++) {
    pos.copy(lead.p).addScaledVector(dir, -back).addScaledVector(up, back * lift).addScaledVector(side, back * swing);
    fov = fitFov(pos, look, aspect, [lead, other]);
    if (fov <= MAX_FOV) break;
    back *= 1.35;
  }
  return { key, anchor: lead.p.clone(), pos, look, fov: THREE.MathUtils.clamp(fov, MIN_FOV, MAX_FOV) };
}

/**
 * After the explosion: hold on it, from the side the camera was already on
 * (`from`, a direction), turning slowly. The ship that did it stays in frame
 * while it's close and in front; once it's gone, the debris has the screen.
 */
export function aftermathShot(boom: Subject, from: THREE.Vector3, since: number, aspect: number, killer: Subject | null): Shot {
  const dir = from.clone().normalize().applyAxisAngle(WORLD_UP, since * 0.08);
  const dist = Math.max(boom.r * 8, 150) * (aspect < 1 ? 1.25 : 1);
  const pos = boom.p.clone().addScaledVector(dir, dist);
  const look = boom.p.clone();
  // The debris flies out at up to 65 m/s, slowing; most of it stays within 40 m/s.
  const debris: Subject = { p: boom.p, r: boom.r * 1.5 + Math.min(since, 3) * 40 };
  let fov = fitFov(pos, look, aspect, [debris]);
  if (killer && killer.p.distanceTo(boom.p) < 900) {
    const both = fitFov(pos, look, aspect, [debris, killer]);
    if (both <= MAX_FOV) fov = both;
  }
  return { key: 'boom', anchor: boom.p.clone(), pos, look, fov: THREE.MathUtils.clamp(fov, MIN_FOV, MAX_FOV), ease: 1.1 };
}

/** Critically damped easing toward a target (Unity's SmoothDamp): eases in and out, never overshoots much. */
export function smoothDamp(current: number, target: number, vel: { v: number }, time: number, dt: number): number {
  const omega = 2 / Math.max(1e-4, time);
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

/** How long the camera takes to settle on a new place (seconds, roughly). */
export const MOVE_TIME = 0.55;
/** The fastest it turns, radians a second: a turn, never a snap. */
export const MAX_TURN = 1.4;

/**
 * The camera itself: it eases toward each shot's place and aim, travelling
 * with the shot's anchor; when the anchor changes (a cut to another shot) it
 * starts from where it already is, so a cut is a glide, never a jump. Its up
 * follows its own last up, so it never flips when it looks straight up or down.
 */
export class CameraRig {
  readonly pos = new THREE.Vector3();
  readonly quat = new THREE.Quaternion();
  fov = 50;
  private key = '';
  private ready = false;
  private readonly offset = new THREE.Vector3();
  private readonly aim = new THREE.Vector3(); // the look point, relative to the anchor
  private readonly vel = [0, 1, 2, 3, 4, 5].map(() => ({ v: 0 }));
  private readonly fovVel = { v: 0 };
  private readonly lastAnchor = new THREE.Vector3();
  private readonly anchorVel = new THREE.Vector3();

  /** Jump straight to the shot next time (opening, or the viewer changed the camera). */
  reset() {
    this.ready = false;
  }

  update(shot: Shot, dt: number) {
    const wantOffset = shot.pos.clone().sub(shot.anchor);
    const wantAim = shot.look.clone().sub(shot.anchor);
    if (!this.ready) {
      this.ready = true;
      this.key = shot.key;
      this.offset.copy(wantOffset);
      this.aim.copy(wantAim);
      this.fov = shot.fov;
      for (const v of this.vel) v.v = 0;
      this.fovVel.v = 0;
      this.pos.copy(shot.pos);
      this.quat.copy(lookQuat(shot.pos, shot.look, WORLD_UP));
      this.lastAnchor.copy(shot.anchor);
      this.anchorVel.set(0, 0, 0);
      return;
    }
    if (shot.key !== this.key) {
      // A cut: carry on from where the camera is and what it's looking at.
      const lookingAt = new THREE.Vector3(0, 0, -1).applyQuaternion(this.quat).multiplyScalar(this.aim.clone().sub(this.offset).length() || 100).add(this.pos);
      this.offset.copy(this.pos).sub(shot.anchor);
      this.aim.copy(lookingAt).sub(shot.anchor);
      this.key = shot.key;
      // Keep the camera's speed through the cut: what was the old anchor's motion becomes its own.
      for (let i = 0; i < 3; i++) {
        this.vel[i].v += this.anchorVel.getComponent(i);
        this.vel[i + 3].v += this.anchorVel.getComponent(i);
      }
      this.anchorVel.set(0, 0, 0);
      this.lastAnchor.copy(shot.anchor);
    }
    if (dt <= 0) {
      this.pos.copy(shot.anchor).add(this.offset);
      return;
    }
    this.anchorVel.copy(shot.anchor).sub(this.lastAnchor).divideScalar(dt);
    this.lastAnchor.copy(shot.anchor);
    const ease = shot.ease ?? MOVE_TIME;
    for (let i = 0; i < 3; i++) {
      this.offset.setComponent(i, smoothDamp(this.offset.getComponent(i), wantOffset.getComponent(i), this.vel[i], ease, dt));
      this.aim.setComponent(i, smoothDamp(this.aim.getComponent(i), wantAim.getComponent(i), this.vel[i + 3], ease * 0.7, dt));
    }
    this.fov = smoothDamp(this.fov, shot.fov, this.fovVel, ease * 1.4, dt);
    this.pos.copy(shot.anchor).add(this.offset);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(this.quat).addScaledVector(WORLD_UP, 0.12);
    const want = lookQuat(this.pos, this.aim.clone().add(shot.anchor), up);
    this.quat.rotateTowards(want, MAX_TURN * dt);
  }
}

/** A camera orientation looking from `eye` at `target`, with `up` as near up as it can be. */
export function lookQuat(eye: THREE.Vector3, target: THREE.Vector3, up: THREE.Vector3): THREE.Quaternion {
  const f = target.clone().sub(eye);
  if (f.lengthSq() < 1e-9) f.set(0, 0, -1);
  f.normalize();
  const u = up.clone().addScaledVector(f, -up.dot(f));
  if (u.lengthSq() < 1e-6) u.copy(upAcross(f));
  u.normalize();
  const m = new THREE.Matrix4().lookAt(eye, target, u);
  return new THREE.Quaternion().setFromRotationMatrix(m);
}

// --- Labels -------------------------------------------------------------------

/** A label's box on screen, and how much it matters: 0 the ship that got you, 1 you, then the rest, nearest the fight first. */
export interface LabelBox {
  id: number;
  rank: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where it goes instead (below its ship) if its first place is taken. Ranks 0 and 1 only. */
  altY?: number;
}

/** The most labels besides the killer and you. */
export const MAX_OTHERS = 1;

const overlaps = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }, pad: number) =>
  a.x - pad < b.x + b.w && b.x - pad < a.x + a.w && a.y - pad < b.y + b.h && b.y - pad < a.y + a.h;

/**
 * Which labels go on screen, and where (their y). The ship that got you and
 * you always do: if they'd overlap, yours moves below your ship. Anyone else
 * only where there's clear room, and never more than MAX_OTHERS, so the
 * labels never pile up into an unreadable stack.
 */
export function pickLabels(boxes: LabelBox[], pad = 4): Map<number, number> {
  const placed: { x: number; y: number; w: number; h: number }[] = [];
  const out = new Map<number, number>();
  let others = 0;
  for (const b of [...boxes].sort((p, q) => p.rank - q.rank)) {
    const at = { x: b.x, y: b.y, w: b.w, h: b.h };
    const free = (y: number) => !placed.some((p) => overlaps({ ...at, y }, p, pad));
    if (b.rank <= 1) {
      const y = free(b.y) || b.altY === undefined || !free(b.altY) ? b.y : b.altY;
      placed.push({ ...at, y });
      out.set(b.id, y);
    } else if (others < MAX_OTHERS && free(b.y)) {
      placed.push(at);
      out.set(b.id, b.y);
      others++;
    }
  }
  return out;
}

/** A label's words: short enough to read on a phone. */
export function labelText(label: string, opts: { you?: boolean; killer?: boolean; unknown?: boolean }): string {
  if (opts.unknown) return opts.killer ? 'Unidentified contact · fired the killing shot' : 'Unidentified contact';
  const name = label.split(' · ')[0];
  if (opts.you) return `${name} (you)`;
  if (opts.killer) return `${name} · fired the killing shot`;
  return label.split(' · ').slice(0, 2).join(' · ');
}

// --- The assessors' note ----------------------------------------------------------

const WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const count = (n: number) => WORDS[n] ?? String(n);

/**
 * What the assessors found, in a line: how often the ship that got you hit
 * you, over how long, from which quarter, and from how far the last shot came.
 * Facts from the track, nothing guessed, so a death teaches you something
 * ("four of them from behind").
 */
export function assessorsNote(d: TrackData, killer: number | undefined, name: string, tl: Map<number, Timeline>): string | null {
  const death = d.events.find((e) => e.kind === 'death');
  if (!death || killer === undefined) return null;
  const hits = d.events.filter((e): e is Extract<TrackEvent, { kind: 'beam' }> => e.kind === 'beam' && e.from === killer && e.hit === d.scene.you && e.t <= death.t + 0.05);
  if (!hits.length) return null;
  const you = tl.get(d.scene.you);
  const quarters: Record<string, number> = { 'from behind': 0, 'from ahead': 0, 'from above': 0, 'from below': 0, 'from the side': 0 };
  const q = new THREE.Quaternion();
  const to = new THREE.Vector3();
  for (const h of hits) {
    const at = you && poseAt(you, h.t);
    if (!at) continue;
    // Which way the shooter was, in your ship's own frame (+Z ahead, +Y up).
    to.set(h.a[0] - h.b[0], h.a[1] - h.b[1], h.a[2] - h.b[2]).normalize().applyQuaternion(q.set(...at.a.q).invert());
    const key = to.z < -0.5 ? 'from behind' : to.z > 0.5 ? 'from ahead' : to.y > 0.5 ? 'from above' : to.y < -0.5 ? 'from below' : 'from the side';
    quarters[key]++;
  }
  const [side, most] = Object.entries(quarters).sort((a, b) => b[1] - a[1])[0];
  const last = hits[hits.length - 1];
  const range = Math.hypot(last.a[0] - last.b[0], last.a[1] - last.b[1], last.a[2] - last.b[2]);
  const far = range >= 1000 ? `${(range / 1000).toFixed(1)} km` : `${Math.max(10, Math.round(range / 10) * 10)} m`;
  const n = hits.length;
  if (n === 1) return `The ${name} hit you once${most ? `, ${side}` : ''}, from ${far}.`;
  const span = Math.max(1, Math.round(death.t - hits[0].t));
  const quarter = !most ? '' : most === n ? `, all ${side}` : most * 2 > n ? `, ${count(most)} of them ${side}` : '';
  return `The ${name} hit you ${count(n)} times in ${count(span)} second${span === 1 ? '' : 's'}${quarter}; the last from ${far}.`;
}
