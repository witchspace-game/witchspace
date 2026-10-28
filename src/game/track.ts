// The kill cam's track (docs/design/kill-cam.md, stage 1): the last minute of
// a fight as numbers, so the game can rebuild it and you can watch it from
// outside. Twenty times a second, every ship your scanner sees: where it is
// and which way it faces. As they happen: shots, explosions, your death.
// Only what your ship knew: a ship running dark is kept as unidentified.
// Pure, so it runs in Node too; packed small enough to keep with the clip.

export const TRACK_VERSION = 1;
export const SAMPLE_RATE = 20; // a second
export const TRACK_SECONDS = 60;

/** A ship as the scanner saw it: type (a ship file id), role, and a label for the replay. */
export interface TrackShip {
  id: number;
  def: string;
  role: string;
  label: string;
  /** Its paint from the yard, if any: the kill cam and clips show it. */
  look?: { colour: string; glow: number; trim: string | null; lights?: boolean };
}

export interface Pose {
  id: number;
  /** World position. */
  p: [number, number, number];
  /** Orientation, a unit quaternion (x, y, z, w). */
  q: [number, number, number, number];
  /** Running dark and not yet read: shown as an unidentified contact. */
  unknown?: boolean;
}

export type TrackEvent =
  | { t: number; kind: 'beam'; from: number; a: [number, number, number]; b: [number, number, number]; color: string; hit?: number }
  | { t: number; kind: 'boom'; id: number; p: [number, number, number] }
  | { t: number; kind: 'death'; by?: number };

export interface TrackScene {
  system: string;
  when: number;
  /** The player's ship. */
  you: number;
  planet?: { p: [number, number, number]; r: number; color: string };
  sun?: [number, number, number];
}

/** A finished track: everything the replay needs. Times in seconds; positions relative to `origin`. */
export interface TrackData {
  v: number;
  scene: TrackScene;
  ships: TrackShip[];
  samples: { t: number; poses: Pose[] }[];
  events: TrackEvent[];
}

/** The rolling last minute, as you fly. */
export class TrackRecorder {
  private samples: { t: number; poses: Pose[] }[] = [];
  private events: TrackEvent[] = [];
  private readonly ships = new Map<number, TrackShip>();
  private last = -Infinity;

  constructor(readonly seconds = TRACK_SECONDS) {}

  /** Meet a ship (once is enough; later calls update its label). */
  ship(s: TrackShip) {
    this.ships.set(s.id, s);
  }

  /** Is a sample due at time t? */
  due(t: number): boolean {
    return t - this.last >= 1 / SAMPLE_RATE - 1e-6;
  }

  sample(t: number, poses: Pose[]) {
    this.last = t;
    this.samples.push({ t, poses });
    this.trim(t);
  }

  event(e: TrackEvent) {
    this.events.push(e);
  }

  clear() {
    this.samples = [];
    this.events = [];
    this.ships.clear();
    this.last = -Infinity;
  }

  private trim(now: number) {
    const from = now - this.seconds;
    let i = 0;
    while (i < this.samples.length && this.samples[i].t < from) i++;
    if (i) this.samples.splice(0, i);
    let j = 0;
    while (j < this.events.length && this.events[j].t < from) j++;
    if (j) this.events.splice(0, j);
  }

  /** The track so far: only ships that appear in it, times from the first sample. */
  snapshot(scene: TrackScene): TrackData | null {
    if (this.samples.length < 2) return null;
    const t0 = this.samples[0].t;
    const seen = new Set<number>();
    for (const s of this.samples) for (const p of s.poses) seen.add(p.id);
    return {
      v: TRACK_VERSION,
      scene,
      ships: [...seen].map((id) => this.ships.get(id)).filter((s): s is TrackShip => Boolean(s)),
      samples: this.samples.map((s) => ({ t: s.t - t0, poses: s.poses })),
      events: this.events.map((e) => ({ ...e, t: e.t - t0 })),
    };
  }
}

// --- Packing ----------------------------------------------------------------
// A header (the scene, ships and events, as JSON), then the samples as binary:
// each pose an id (uint16, the top bit for unknown), a position relative to the
// track's origin (3 × float32) and an orientation (4 × int16): 22 bytes.

const UNKNOWN = 0x8000;

export function packTrack(d: TrackData): Uint8Array {
  const o = d.samples[0]?.poses.find((p) => p.id === d.scene.you)?.p ?? [0, 0, 0];
  const rel = (p: [number, number, number]): [number, number, number] => [round(p[0] - o[0]), round(p[1] - o[1]), round(p[2] - o[2])];
  const head = new TextEncoder().encode(
    JSON.stringify({
      v: d.v,
      origin: o,
      scene: { ...d.scene, planet: d.scene.planet && { ...d.scene.planet, p: rel(d.scene.planet.p) } },
      ships: d.ships,
      events: d.events.map((e) => (e.kind === 'beam' ? { ...e, t: round(e.t, 3), a: rel(e.a), b: rel(e.b) } : e.kind === 'boom' ? { ...e, t: round(e.t, 3), p: rel(e.p) } : { ...e, t: round(e.t, 3) })),
    }),
  );
  const count = d.samples.reduce((n, s) => n + s.poses.length, 0);
  const buf = new ArrayBuffer(4 + head.length + d.samples.length * 6 + count * 22);
  const view = new DataView(buf);
  const bytes = new Uint8Array(buf);
  view.setUint32(0, head.length);
  bytes.set(head, 4);
  let k = 4 + head.length;
  for (const s of d.samples) {
    view.setFloat32(k, s.t);
    view.setUint16(k + 4, s.poses.length);
    k += 6;
    for (const p of s.poses) {
      view.setUint16(k, (p.id & 0x7fff) | (p.unknown ? UNKNOWN : 0));
      view.setFloat32(k + 2, p.p[0] - o[0]);
      view.setFloat32(k + 6, p.p[1] - o[1]);
      view.setFloat32(k + 10, p.p[2] - o[2]);
      for (let i = 0; i < 4; i++) view.setInt16(k + 14 + i * 2, Math.round(Math.max(-1, Math.min(1, p.q[i])) * 32767));
      k += 22;
    }
  }
  return bytes;
}

/** Unpack a track; positions come back relative to its origin. Null if it's from a version this game can't read. */
export function unpackTrack(bytes: Uint8Array): TrackData | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const len = view.getUint32(0);
  const head = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + len)));
  if (head.v !== TRACK_VERSION) return null;
  const samples: TrackData['samples'] = [];
  let k = 4 + len;
  while (k < bytes.length) {
    const t = view.getFloat32(k);
    const n = view.getUint16(k + 4);
    k += 6;
    const poses: Pose[] = [];
    for (let j = 0; j < n; j++) {
      const raw = view.getUint16(k);
      const q = [0, 1, 2, 3].map((i) => view.getInt16(k + 14 + i * 2) / 32767) as Pose['q'];
      const len = Math.hypot(...q) || 1;
      poses.push({
        id: raw & 0x7fff,
        p: [view.getFloat32(k + 2), view.getFloat32(k + 6), view.getFloat32(k + 10)],
        q: q.map((x) => x / len) as Pose['q'],
        ...(raw & UNKNOWN ? { unknown: true } : {}),
      });
      k += 22;
    }
    samples.push({ t, poses });
  }
  return { v: head.v, scene: head.scene, ships: head.ships, samples, events: head.events };
}

const round = (x: number, places = 1) => Math.round(x * 10 ** places) / 10 ** places;

/** Pack and compress (gzip, the browser's own CompressionStream). */
export async function trackBlob(d: TrackData): Promise<Blob> {
  const packed = packTrack(d);
  const stream = new Blob([packed as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Response(stream).blob();
}

export async function readTrack(blob: Blob): Promise<TrackData | null> {
  const stream = blob.stream().pipeThrough(new DecompressionStream('gzip'));
  return unpackTrack(new Uint8Array(await new Response(stream).arrayBuffer()));
}

/** Where a ship is at time t, between samples: positions interpolated, orientations slerped by the caller. */
export function bracket(d: TrackData, t: number): { a: TrackData['samples'][number]; b: TrackData['samples'][number]; f: number } | null {
  const s = d.samples;
  if (!s.length) return null;
  if (t <= s[0].t) return { a: s[0], b: s[0], f: 0 };
  if (t >= s[s.length - 1].t) return { a: s[s.length - 1], b: s[s.length - 1], f: 0 };
  let lo = 0;
  let hi = s.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (s[mid].t <= t) lo = mid;
    else hi = mid;
  }
  return { a: s[lo], b: s[hi], f: (t - s[lo].t) / (s[hi].t - s[lo].t || 1) };
}

/** Who killed you: the last shot that hit you before your death, if any. */
export function killerOf(d: TrackData): number | undefined {
  const death = d.events.find((e) => e.kind === 'death');
  if (!death || death.kind !== 'death') return undefined;
  if (death.by !== undefined) return death.by;
  const hits = d.events.filter((e) => e.kind === 'beam' && e.hit === d.scene.you && e.t <= death.t);
  const last = hits[hits.length - 1];
  return last && last.kind === 'beam' ? last.from : undefined;
}

/**
 * Who a moment was about, when it wasn't a death: the last ship you hit in
 * the window, or else the last ship that went up in it. The kill cam follows it.
 */
export function focusOf(d: TrackData, start: number, end: number): number | undefined {
  const you = d.scene.you;
  const inWindow = d.events.filter((e) => e.t >= start && e.t <= end);
  const hits = inWindow.filter((e) => e.kind === 'beam' && e.from === you && e.hit !== undefined && e.hit !== you);
  const hit = hits[hits.length - 1];
  if (hit && hit.kind === 'beam') return hit.hit;
  const booms = inWindow.filter((e) => e.kind === 'boom' && e.id !== you);
  const boom = booms[booms.length - 1];
  return boom && boom.kind === 'boom' ? boom.id : undefined;
}


// --- One ship at a time -------------------------------------------------------
// The replay places each ship from its own run of poses, not sample by sample,
// so a ship missing from one sample (or two) is carried across the gap rather
// than blinking out, which used to throw the camera following it.

/** One ship's poses through the track, in time order. */
export interface Timeline {
  t: number[];
  poses: Pose[];
}

/** Every ship's timeline, by id. */
export function timelines(d: TrackData): Map<number, Timeline> {
  const out = new Map<number, Timeline>();
  for (const s of d.samples) {
    for (const p of s.poses) {
      let tl = out.get(p.id);
      if (!tl) out.set(p.id, (tl = { t: [], poses: [] }));
      tl.t.push(s.t);
      tl.poses.push(p);
    }
  }
  return out;
}

/** A gap longer than this (seconds) means the ship really left the scanner. */
export const MAX_GAP = 1;

/**
 * Where a ship is at time t: the poses either side and how far between (the
 * caller interpolates positions and slerps orientations). Null when it isn't
 * there: before it appeared, after it went, or in a gap longer than `maxGap`.
 * Up to `extend` seconds past its last pose it carries on at its last speed
 * (a track ends a few seconds after a death, and ships shouldn't freeze there).
 */
/** Two samples and how far between them; `around`, the samples either side, for a smooth curve. */
export interface PoseAt {
  a: Pose;
  b: Pose;
  f: number;
  around?: { pa: Pose; nb: Pose; ta: number; tb: number; tpa: number; tnb: number };
}

export function poseAt(tl: Timeline, t: number, maxGap = MAX_GAP, extend = 0): PoseAt | null {
  const ts = tl.t;
  const n = ts.length;
  if (!n) return null;
  const step = 1.5 / SAMPLE_RATE;
  if (t < ts[0] - step) return null;
  if (t <= ts[0]) return { a: tl.poses[0], b: tl.poses[0], f: 0 };
  if (t >= ts[n - 1]) {
    if (t <= ts[n - 1] + step) return { a: tl.poses[n - 1], b: tl.poses[n - 1], f: 0 };
    if (t > ts[n - 1] + extend || n < 2) return null;
    // Carry on: extrapolate from the last two poses (f past 1).
    return { a: tl.poses[n - 2], b: tl.poses[n - 1], f: (t - ts[n - 2]) / (ts[n - 1] - ts[n - 2] || 1) };
  }
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (ts[mid] <= t) lo = mid;
    else hi = mid;
  }
  if (ts[hi] - ts[lo] > maxGap) return null;
  return {
    a: tl.poses[lo],
    b: tl.poses[hi],
    f: (t - ts[lo]) / (ts[hi] - ts[lo] || 1),
    // The samples either side, for a smooth curve through them (smoothPosition).
    around: { pa: tl.poses[Math.max(0, lo - 1)], nb: tl.poses[Math.min(n - 1, hi + 1)], ta: ts[lo], tb: ts[hi], tpa: ts[Math.max(0, lo - 1)], tnb: ts[Math.min(n - 1, hi + 1)] },
  };
}

/**
 * Where a ship is between two samples, on a smooth curve through them (a Hermite spline with each
 * sample's real time): a straight line between samples changes speed with a jolt at every one,
 * which showed as a judder in the replay (Mark's Orgetibe clip). Falls back to a straight line where
 * there's nothing either side (the ends, extrapolating).
 */
export function smoothPosition(at: PoseAt): [number, number, number] {
  const { a, b, f, around } = at;
  if (!around || f < 0 || f > 1 || around.tb <= around.ta) return [0, 1, 2].map((i) => a.p[i] + (b.p[i] - a.p[i]) * f) as [number, number, number];
  const { pa, nb, ta, tb, tpa, tnb } = around;
  const h = tb - ta;
  const f2 = f * f;
  const f3 = f2 * f;
  const h00 = 2 * f3 - 3 * f2 + 1;
  const h10 = f3 - 2 * f2 + f;
  const h01 = -2 * f3 + 3 * f2;
  const h11 = f3 - f2;
  return [0, 1, 2].map((i) => {
    // Velocity at each sample, from its neighbours (one-sided at the ends).
    const ma = (b.p[i] - pa.p[i]) / (tb - tpa || h);
    const mb = (nb.p[i] - a.p[i]) / (tnb - ta || h);
    return h00 * a.p[i] + h10 * h * ma + h01 * b.p[i] + h11 * h * mb;
  }) as [number, number, number];
}
