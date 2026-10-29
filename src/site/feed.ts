import { galaxy, type StarSystem } from '../galaxy/generate';
import { poisOf } from '../game/explore';

// What real commanders did in the last two days, from GET /feed
// (docs/design/live-feed.md), made into lines for the home page. No DOM here,
// so it can be tested. Nothing is invented: when the feed is empty or can't be
// reached, there are simply no commanders' lines.

export interface FirstEvent {
  kind: 'first';
  t: number;
  callsign: string;
  galaxy: number;
  system: number;
  body: string;
}
export interface ClipEvent {
  kind: 'clip';
  t: number;
  id: string;
  title: string;
  system: string;
  hearts: number;
}
export interface Feed {
  events: (FirstEvent | ClipEvent)[];
  flying: { now: number; today: number };
}

export const EMPTY: Feed = { events: [], flying: { now: 0, today: 0 } };

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const str = (v: unknown) => (typeof v === 'string' && v ? v : null);

/** The feed as sent, keeping only the events it knows and that make sense: new kinds are ignored, not broken on. */
export function parseFeed(raw: unknown): Feed {
  const r = (raw ?? {}) as { events?: unknown; flying?: { now?: unknown; today?: unknown } };
  const events: Feed['events'] = [];
  for (const e of Array.isArray(r.events) ? (r.events as Record<string, unknown>[]) : []) {
    const t = num(e?.t);
    if (t === null) continue;
    if (e.kind === 'first') {
      const g = num(e.galaxy) ?? -1;
      const s = num(e.system) ?? -1;
      const callsign = str(e.callsign);
      const body = str(e.body);
      // Eight galaxies of 256 systems: anything else would generate a galaxy that isn't there.
      if (!Number.isInteger(g) || !Number.isInteger(s) || g < 0 || g > 7 || s < 0 || s > 255 || !callsign || !body) continue;
      events.push({ kind: 'first', t, callsign, galaxy: g, system: s, body });
    } else if (e.kind === 'clip') {
      const id = str(e.id);
      const title = str(e.title);
      if (!id || !/^[\w-]+$/.test(id) || !title) continue;
      events.push({ kind: 'clip', t, id, title, system: str(e.system) ?? '', hearts: num(e.hearts) ?? 0 });
    }
  }
  events.sort((a, b) => b.t - a.t);
  return { events, flying: { now: num(r.flying?.now) ?? 0, today: num(r.flying?.today) ?? 0 } };
}

/** One commander's trip home: everything they claimed first in one system at one moment. */
export interface Charted {
  kind: 'charted';
  t: number;
  callsign: string;
  where: StarSystem;
  bodies: string[];
}
export type CommanderLine = Charted | ClipEvent;

/** Firsts grouped by trip (one claim brings several bodies home at once), with clips, newest first. */
export function commanderLines(feed: Feed): CommanderLine[] {
  const out: CommanderLine[] = [];
  const trips = new Map<string, Charted>();
  for (const e of feed.events) {
    if (e.kind === 'clip') {
      out.push(e);
      continue;
    }
    const key = `${e.t}|${e.callsign}|${e.galaxy}|${e.system}`;
    const trip = trips.get(key);
    if (trip) trip.bodies.push(e.body);
    else {
      const c: Charted = { kind: 'charted', t: e.t, callsign: e.callsign, where: galaxy(e.galaxy)[e.system], bodies: [e.body] };
      trips.set(key, c);
      out.push(c);
    }
  }
  return out.sort((a, b) => b.t - a.t);
}

const NUMBERS = ['no', 'a', 'two', 'three', 'four', 'five', 'six'];
const count = (n: number, one: string, many: string) => (n === 1 ? `${NUMBERS[1]} ${one}` : `${NUMBERS[n] ?? n} ${many}`);

/** "the planet, two moons and a derelict": what a trip charted, in the order the game lists bodies. */
export function chartedWhat(c: Charted): string {
  const has = (b: string) => c.bodies.includes(b);
  const moons = c.bodies.filter((b) => /^moon\d$/.test(b)).length;
  const pois = poisOf(c.where).filter((p) => c.bodies.includes(p.id));
  const signals = c.bodies.filter((b) => /^poi\d$/.test(b)).length - pois.length;
  const parts = [
    has('planet') ? 'the planet' : '',
    has('star') ? 'its star' : '',
    moons ? count(moons, 'moon', 'moons') : '',
    ...pois.map((p) => (p.kind === 'wrecks' ? 'a wreck field' : `a ${p.kind}`)),
    signals > 0 ? count(signals, 'signal', 'signals') : '',
    has('courier') ? 'the lost courier' : '',
    c.bodies.some((b) => b.startsWith('trail:')) ? 'a step on a trail' : '',
  ].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts.at(-1)}` : (parts[0] ?? 'a first');
}

/** "1 commander flying now · 3 players today", leaving out what's nought; empty when both are. */
export function flyingLine(f: Feed['flying']): string {
  return [f.now ? `${f.now} signed-in commander${f.now === 1 ? '' : 's'} flying now` : '', f.today ? `${f.today} player${f.today === 1 ? '' : 's'} today` : ''].filter(Boolean).join(' · ');
}

/** The clip to show off: the most hearts in the feed's two days, the newest if it's a tie (so, while nobody's hearted any, the newest). */
export function featuredClip(feed: Feed): ClipEvent | null {
  let best: ClipEvent | null = null;
  for (const e of feed.events) if (e.kind === 'clip' && (!best || e.hearts > best.hearts || (e.hearts === best.hearts && e.t > best.t))) best = e;
  return best;
}

/** "CMDR Jameson: 3 kills in one fight at Xeaqu" as who and what, so a card can set them apart; a title of another shape is all "what". */
export function clipTitle(title: string): { who: string; what: string } {
  const m = /^(CMDR [^:]+|A commander): (.+)$/.exec(title);
  return m ? { who: m[1], what: m[2] } : { who: '', what: title };
}
