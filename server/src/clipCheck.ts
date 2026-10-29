// Checking a shared clip's track (docs/design/flight-recorder.md, "Clip pages").
// A clip is a flight track, never video: numbers the game recorded. Before one
// is kept, every part of it is checked, and every word shown with it is
// written here, so nothing a player typed reaches the page. Pure: tested in
// clipCheck.test.ts, used by the ClipBoard (clips.ts).

import { focusOf, killerOf, packTrack, TRACK_VERSION, unpackTrack, type TrackData, type TrackEvent } from '../../src/game/track';

export const MAX_TRACK_BYTES = 400_000; // gzipped: a minute of a busy fight is under 100 KB
const MAX_PACKED = 2_000_000;
const MAX_SAMPLES = 61 * 20 + 20;
const MAX_POSES = 96;
const MAX_SHIPS = 160;
const MAX_EVENTS = 6000;
const FAR = 1e7; // metres from the track's origin: anything further is nonsense
const ROLES = new Set(['you', 'pirate', 'police', 'marshal', 'trader', 'missile', 'station']);
// A colour as the game writes one: #3dffb0, or rgb(127,178,255) (three.js's getStyle).
const HEX = /^(#[0-9a-fA-F]{3,8}|rgb\(\d{1,3}, ?\d{1,3}, ?\d{1,3}\))$/;
const SYSTEM = /^[A-Za-z][A-Za-z' -]{0,23}$/;

const finite = (...n: unknown[]) => n.every((x) => typeof x === 'number' && Number.isFinite(x));
const near = (p: unknown) => Array.isArray(p) && p.length === 3 && finite(...p) && p.every((x) => Math.abs(x as number) < FAR);

export interface CheckedClip {
  /** The track, re-packed from what was checked. */
  packed: Uint8Array;
  title: string;
  system: string;
  /** The ship type the clip is about (the killer, or the ship you fought), for its card. */
  focusDef: string | null;
  seconds: number;
}

/** What the player's own ship is called on the page: the signed-in callsign, or no name at all. */
export const commanderLabel = (callsign: string | null) => (callsign ? `CMDR ${callsign}` : 'A commander');

/**
 * Check a packed track (not gzipped) and rebuild it with labels written here.
 * `ships` maps each real ship type to its name. Returns the clip, or why not.
 */
export function checkTrack(bytes: Uint8Array, ships: Map<string, string>, callsign: string | null, wantSeconds: number, claimedKills = 0): CheckedClip | string {
  if (bytes.length > MAX_PACKED) return 'That track is too big';
  let d: TrackData | null;
  try {
    d = unpackTrack(bytes);
  } catch {
    return "That isn't a track";
  }
  if (!d || d.v !== TRACK_VERSION) return 'That track is from another version of the game';
  const scene = d.scene as unknown as Record<string, unknown>;
  if (!scene || typeof scene.system !== 'string' || !SYSTEM.test(scene.system)) return 'Unknown system';
  if (!finite(scene.you, scene.when)) return 'Bad scene';
  const planet = scene.planet as { p?: unknown; r?: unknown; color?: unknown } | undefined;
  if (planet && (!near(planet.p) || !finite(planet.r) || typeof planet.color !== 'string' || !HEX.test(planet.color))) return 'Bad planet';
  if (scene.sun !== undefined && !near(scene.sun)) return 'Bad sun';

  if (!Array.isArray(d.ships) || d.ships.length > MAX_SHIPS) return 'Too many ships';
  const ids = new Set<number>();
  for (const s of d.ships) {
    if (!finite(s.id) || !ships.has(s.def) || !ROLES.has(s.role)) return 'Unknown ship';
    ids.add(s.id);
  }
  if (!ids.has(d.scene.you)) return 'Your ship is missing';

  if (d.samples.length < 2 || d.samples.length > MAX_SAMPLES) return 'Too long or too short';
  let last = -Infinity;
  for (const s of d.samples) {
    if (!finite(s.t) || s.t < last || s.poses.length > MAX_POSES) return 'Bad samples';
    last = s.t;
    for (const p of s.poses) if (!ids.has(p.id) || !near(p.p) || !finite(...p.q)) return 'Bad pose';
  }

  if (!Array.isArray(d.events) || d.events.length > MAX_EVENTS) return 'Too many events';
  const events: TrackEvent[] = [];
  for (const e of d.events as TrackEvent[]) {
    if (!finite(e.t)) return 'Bad event';
    if (e.kind === 'beam') {
      if (!ids.has(e.from) || !near(e.a) || !near(e.b) || typeof e.color !== 'string' || !HEX.test(e.color) || (e.hit !== undefined && !ids.has(e.hit))) return 'Bad shot';
      events.push({ t: e.t, kind: 'beam', from: e.from, a: e.a, b: e.b, color: e.color, ...(e.hit !== undefined ? { hit: e.hit } : {}) });
    } else if (e.kind === 'boom') {
      if (!ids.has(e.id) || !near(e.p)) return 'Bad explosion';
      events.push({ t: e.t, kind: 'boom', id: e.id, p: e.p });
    } else if (e.kind === 'death') {
      if (e.by !== undefined && !ids.has(e.by)) return 'Bad death';
      events.push({ t: e.t, kind: 'death', ...(e.by !== undefined ? { by: e.by } : {}) });
    } else return 'Unknown event';
  }

  // Every word on the page is written here, from the checked numbers.
  const system = scene.system as string;
  const label = (def: string, role: string) =>
    role === 'you' ? commanderLabel(callsign) : role === 'missile' ? 'Missile' : role === 'station' ? `${system} station` : `${ships.get(def)} · ${role}`;
  const clean: TrackData = {
    v: TRACK_VERSION,
    scene: { system, when: scene.when as number, you: d.scene.you, ...(planet ? { planet: { p: planet.p as [number, number, number], r: planet.r as number, color: planet.color as string } } : {}), ...(scene.sun ? { sun: scene.sun as [number, number, number] } : {}) },
    ships: d.ships.map((s) => ({ id: s.id, def: s.def, role: s.role, label: label(s.def, s.role) })),
    samples: d.samples,
    events,
  };

  const seconds = Math.min(60, Math.max(3, finite(wantSeconds) ? wantSeconds : 20));
  const { title, focusDef } = describeClip(clean, commanderLabel(callsign), ships, seconds, claimedKills);
  return { packed: packTrack(clean), title, system, focusDef, seconds };
}

/**
 * The ships you destroyed in a track: each that went up with your shot the last to hit it (missiles and
 * canisters aside). A fight with three kills is called that, as the flight log calls it (game/moments.ts).
 */
export function killsIn(d: TrackData): TrackData['ships'] {
  const you = d.scene.you;
  const out: TrackData['ships'] = [];
  for (const e of d.events) {
    if (e.kind !== 'boom' || e.id === you) continue;
    const ship = d.ships.find((s) => s.id === e.id);
    if (!ship || ship.role === 'missile' || ship.role === 'station' || ship.def === 'cargo-canister') continue;
    const hits = d.events.filter((h) => h.kind === 'beam' && h.hit === e.id && h.t <= e.t);
    const last = hits[hits.length - 1];
    if (last && last.kind === 'beam' && last.from === you && !out.includes(ship)) out.push(ship);
  }
  return out;
}

/** A checked track's title (every word written here) and the ship it's about, for its card. */
/** Ships that blew up in a track, however (yours or not; missiles, canisters and the station aside). */
export function boomsIn(d: TrackData): number {
  const gone = new Set<number>();
  for (const e of d.events) {
    if (e.kind !== 'boom' || e.id === d.scene.you) continue;
    const ship = d.ships.find((s) => s.id === e.id);
    if (ship && ship.role !== 'missile' && ship.role !== 'station' && ship.def !== 'cargo-canister') gone.add(e.id);
  }
  return gone.size;
}

/**
 * A checked track's title (every word written here) and the ship it's about, for its card. The kills
 * are the ones the track shows were yours; the game may claim more (a missile's kill, a ramming: Mark's
 * three were titled two), and is believed up to the ships the track saw blow up.
 */
export function describeClip(d: TrackData, who: string, ships: Map<string, string>, seconds: number, claimedKills = 0): { title: string; focusDef: string | null } {
  const system = d.scene.system;
  const end = d.samples[d.samples.length - 1].t;
  const death = d.events.some((e) => e.kind === 'death');
  const other = death ? killerOf(d) : focusOf(d, Math.max(0, end - seconds), end);
  const otherShip = other !== undefined ? d.ships.find((s) => s.id === other) : undefined;
  const name = (def: string) => (def === 'falcon' ? 'the Falcon' : `a ${ships.get(def)}`);
  const them = otherShip ? name(otherShip.def) : null;
  const mine = killsIn(d);
  const claimed = Number.isFinite(claimedKills) ? Math.floor(claimedKills) : 0;
  const count = Math.max(mine.length, Math.min(claimed, boomsIn(d)));
  const kills = { length: count, first: mine[0] ?? d.ships.find((s) => d.events.some((e) => e.kind === 'boom' && e.id === s.id) && s.id !== d.scene.you) };
  const title = death
    ? `${who}: ${them ? `shot down by ${them}` : 'ship destroyed'} at ${system}`
    : kills.length > 1
      ? `${who}: ${kills.length} kills in one fight at ${system}`
      : kills.length === 1
        ? `${who}: ${(kills.first && ships.get(kills.first.def)) ?? 'A ship'} down at ${system}`
        : them
          ? `${who}: fighting ${them} at ${system}`
          : `${who} at ${system}`;
  return { title, focusDef: otherShip?.def ?? null };
}

/** A baseline or progressive JPEG's width and height, from its frame header; null if it isn't one. */
export function jpegSize(b: Uint8Array): { w: number; h: number } | null {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    const len = (b[i + 2] << 8) | b[i + 3];
    // SOF0 to SOF15, apart from DHT (C4), JPG (C8) and DAC (CC).
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return { h: (b[i + 5] << 8) | b[i + 6], w: (b[i + 7] << 8) | b[i + 8] };
    i += 2 + len;
  }
  return null;
}
