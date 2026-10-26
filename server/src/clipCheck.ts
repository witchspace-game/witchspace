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
export function checkTrack(bytes: Uint8Array, ships: Map<string, string>, callsign: string | null, wantSeconds: number): CheckedClip | string {
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

  const end = clean.samples[clean.samples.length - 1].t;
  const seconds = Math.min(60, Math.max(3, finite(wantSeconds) ? wantSeconds : 20));
  const death = clean.events.some((e) => e.kind === 'death');
  const other = death ? killerOf(clean) : focusOf(clean, Math.max(0, end - seconds), end);
  const otherShip = other !== undefined ? clean.ships.find((s) => s.id === other) : undefined;
  const who = commanderLabel(callsign);
  const them = otherShip ? (otherShip.def === 'falcon' ? 'the Falcon' : `a ${ships.get(otherShip.def)}`) : null;
  const title = death ? `${who}: ${them ? `shot down by ${them}` : 'ship destroyed'} at ${system}` : them ? `${who}: fighting ${them} at ${system}` : `${who} at ${system}`;
  return { packed: packTrack(clean), title, system, focusDef: otherShip?.def ?? null, seconds };
}
