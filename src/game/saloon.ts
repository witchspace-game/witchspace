// The saloon (docs/design/trading.md, section 3), stage 1: every station has
// somewhere traders rest, and two to four regulars in it who come and go with
// the clock. Buy one a drink and they talk. What they know comes from the
// galaxy itself (economy/events.ts): world events come from each system's
// seed and the clock, so the game knows a famine has begun before its news
// reaches this station.
//
// A tip is one of:
// - stale: news already on the board here. True, and probably too late.
// - early: a real event nearby whose news hasn't arrived yet. True, and the
//   one worth paying for.
// - planted: made up by someone who profits if you believe it. False.
// Nothing is labelled. How someone behaves is a hint; what they've told you
// before, and whether it came true, is the rest.
//
// Pure: the same regulars for everyone at the same station and hour.

import { distanceLy, galaxy, GOVERNMENTS, type StarSystem } from '../galaxy/generate';
import { EVENT_KINDS, eventsAt, newsArrives, type EventType } from '../economy/events';
import { hash } from '../economy/seed';

export type Mood = 'glad' | 'sad' | 'mad' | 'bad';
export type TipKind = 'stale' | 'early' | 'planted';

export interface Tip {
  kind: TipKind;
  event: EventType;
  /** The system it's about (index in this galaxy). */
  system: number;
  /** When it starts (or, planted, when they claim it did). */
  start: number;
}

export interface Regular {
  /** Stable for this person at this station: their reputation follows it. */
  id: string;
  name: string;
  trade: string;
  mood: Mood;
  /** What you notice before they say a word. */
  look: string;
  /** Credits for a drink. */
  drink: number;
  /** What they know, if anything worth telling. */
  tip: Tip | null;
  /** Credits for the rest of it (where and what), if they want paying properly. */
  price: number;
}

/** A tip you've heard, kept so the regular's word can be judged later. */
export interface Heard {
  /** The regular. */
  who: string;
  name: string;
  /** The station's galaxy and system, where you heard it. */
  galaxy: number;
  at: number;
  /** The hour slot it was heard in, so a visit's drinks aren't paid for twice. */
  slot: number;
  tip: Tip;
  /** Paid for the whole of it (where and what). */
  paid: boolean;
}

const SLOT = 2 * 3600_000; // who's in changes every two hours
const RANGE = 15; // light years: what a saloon hears about
const EARLY_AHEAD = 30 * 60_000; // an early tip can be about something just about to start

const FIRST = ['Ade', 'Bram', 'Cass', 'Dov', 'Esme', 'Farid', 'Greta', 'Hal', 'Ines', 'Jun', 'Kit', 'Lio', 'Mags', 'Nell', 'Oskar', 'Pria', 'Quin', 'Ros', 'Sami', 'Tova', 'Ulf', 'Vesna', 'Wen', 'Yusuf', 'Zora', 'Bex', 'Cato', 'Dara'];
const LAST = ['Okafor', 'Lindqvist', 'Marsh', 'Vance', 'Ibarra', 'Kowal', 'Achterberg', 'Sato', 'Mbeki', 'Doyle', 'Haddad', 'Novak', 'Quill', 'Ferreira', 'Yates', 'Ruiz', 'Oduya', 'Brand', 'Castellan', 'Ng', 'Petrov', 'Ashby', 'Kaur', 'Moreau'];
const TRADES = ['hauler', 'miner', 'freight broker', 'courier pilot', 'dock hand', 'tanker skipper', 'salvager', 'ore assayer', 'cargo agent', 'shuttle pilot'];

const LOOKS: Record<Mood, string[]> = {
  glad: ['buying rounds and grinning at nobody in particular', 'loud, flush, and on their third drink', 'telling the whole bar about a good week'],
  sad: ['nursing one drink and staring into it', 'counting coins on the bar, slowly', 'still in work overalls, nowhere to be'],
  mad: ['glaring at the door every time it opens', 'jabbing the bar with a finger as they talk', 'muttering about brokers to anyone who listens'],
  bad: ['all easy smiles, leaning in a little close', 'immaculate, and very interested in your ship', 'friendly, unhurried, and already watching you'],
};

/** What a station's bar is, by its people: a bar, a club, a tea room or a shebeen. */
export function venue(s: StarSystem): { kind: string; name: string } {
  const g = GOVERNMENTS[s.government];
  const kind = g === 'Anarchy' || g === 'Feudal' ? 'shebeen' : g === 'Corporate State' ? 'club' : g === 'Dictatorship' || g === 'Communist' ? 'tea room' : 'saloon';
  const NAMES: Record<string, string[]> = {
    saloon: ['The Long Drop', 'Last Orders', 'The Docking Light', 'The Slot', 'The Spin', 'Witchspace Arms'],
    club: ['The Ledger Room', 'The Members', 'Clearance', 'The Quarterly'],
    'tea room': ['The Approved Kettle', 'Rest Room Seven', 'The Quiet Cup', 'Tea and Papers'],
    shebeen: ["Nobody's", 'The Hole', 'Back of the Hold', 'The Leak'],
  };
  const list = NAMES[kind];
  return { kind, name: list[Math.floor(hash(s, 71_000, 0) * list.length)] };
}

const pick = <T>(list: T[], r: number) => list[Math.floor(r * list.length) % list.length];

/** Who's in at `here` at `now`. */
export function regularsAt(here: StarSystem, now: number): Regular[] {
  const slot = Math.floor(now / SLOT);
  const r = (salt: number, i: number) => hash(here, 70_000 + salt, (slot % 1_000_003) * 7 + i);
  const count = 2 + Math.floor(r(1, 0) * 3);
  const near = galaxy(here.galaxy).filter((s) => s !== here && distanceLy(here, s) <= RANGE);
  const out: Regular[] = [];
  const used = new Set<string>();
  for (let i = 0; i < count; i++) {
    // A regular is one of the station's own: the same few names come back, at different hours.
    const who = Math.floor(r(2, i) * 12);
    const id = `${here.galaxy}:${here.index}:${who}`;
    if (used.has(id)) continue;
    used.add(id);
    const p = (k: number) => hash(here, 72_000 + k, who);
    const name = `${pick(FIRST, p(1))} ${pick(LAST, p(2))}`;
    const trade = pick(TRADES, p(3));
    // Some people are liars, always; the rest are in whatever mood the week has left them.
    const liar = p(4) < 0.22;
    const mood: Mood = liar ? 'bad' : pick<Mood>(['glad', 'sad', 'mad'], r(3, i));
    const tip = tipFor(here, near, mood, now, (k) => r(10 + k, i));
    const drink = 2 + Math.round(hash(here, 73_000, 0) * 4);
    const price = tip && (tip.kind === 'early' || tip.kind === 'planted') ? 40 + Math.round(r(5, i) * 8) * 15 : 0;
    out.push({ id, name, trade, mood, look: pick(LOOKS[mood], r(4, i)), drink, tip, price });
  }
  return out;
}

function tipFor(here: StarSystem, near: StarSystem[], mood: Mood, now: number, r: (k: number) => number): Tip | null {
  if (!near.length) return null;
  const events = (s: StarSystem) => eventsAt(s, now - 8 * 3600_000, now + EARLY_AHEAD);
  if (mood === 'bad') {
    // Made up: a place that's quiet, and trouble that isn't happening there.
    const quiet = near.filter((s) => events(s).length === 0);
    if (!quiet.length) return null;
    const s = pick(quiet, r(1));
    const kinds: EventType[] = ['famine', 'plague', 'strike', 'boom', 'drought'];
    return { kind: 'planted', event: pick(kinds, r(2)), system: s.index, start: now - Math.round(r(3) * 40) * 60_000 };
  }
  const real = near.flatMap((s) => events(s).filter((e) => e.end > now && e.type !== 'lockdown').map((e) => ({ s, e })));
  // Early: begun (or about to), and the news isn't here yet. Stale: it's on the board.
  const early = real.filter(({ s, e }) => e.start <= now + EARLY_AHEAD && newsArrives(s, here, e.start) > now);
  const stale = real.filter(({ s, e }) => newsArrives(s, here, e.start) <= now);
  const want = mood === 'glad' ? stale : early.length ? early : stale;
  if (!want.length) return null;
  const { s, e } = pick(want, r(4));
  return { kind: newsArrives(s, here, e.start) > now ? 'early' : 'stale', event: e.type, system: s.index, start: e.start };
}

/**
 * Was it true, as far as you could know by `now`? Null until the news (or the
 * lack of it) would have reached the station you heard it at.
 */
export function cameTrue(h: Heard, now: number): boolean | null {
  const where = galaxy(h.galaxy)[h.tip.system];
  const heardAt = galaxy(h.galaxy).find((s) => h.who.startsWith(`${s.galaxy}:${s.index}:`));
  if (!where || !heardAt) return null;
  if (now < newsArrives(where, heardAt, h.tip.start)) return null;
  return h.tip.kind !== 'planted';
}

/** Their record, as far as you know: tips that came true, and ones that didn't. */
export function record(heard: Heard[], who: string, now: number): { right: number; wrong: number } {
  let right = 0;
  let wrong = 0;
  for (const h of heard) {
    if (h.who !== who || !h.paid) continue;
    const t = cameTrue(h, now);
    if (t === true) right++;
    else if (t === false) wrong++;
  }
  return { right, wrong };
}

export const slotOf = (now: number) => Math.floor(now / SLOT);

// --- What they say ---------------------------------------------------------------------

const TROUBLE: Record<EventType, string> = {
  famine: 'the harvest has failed',
  drought: "the wells are running dry",
  plague: "there's sickness spreading",
  boom: "they're rich and spending",
  strike: 'the mines have walked out',
  war: "they're fighting in the streets",
  blockade: "pirates have the lanes shut",
  incursion: "something's come out of witchspace",
  crackdown: "the police are turning out every hold",
  lockdown: 'the station is shut',
  bloom: "something's growing over the crops",
};

/**
 * Their words. `paid`: whether you've paid for the rest (where, and what to
 * take). Stale and mad tips come out whole for the price of a drink.
 */
export function talk(r: Regular, systemName: (index: number) => string, paid: boolean): { said: string; more: boolean } {
  const t = r.tip;
  if (!t) {
    const idle: Record<Mood, string> = {
      glad: "Good week. Can't complain, and I won't. Cheers.",
      sad: "Nothing worth your credits, friend. Wish there was.",
      mad: "Nothing you'd want. Not today. Ask me tomorrow.",
      bad: "Me? Just passing through. Lovely ship you came in on.",
    };
    return { said: idle[r.mood], more: false };
  }
  const where = systemName(t.system);
  const wanted = EVENT_KINDS[t.event].wanted;
  const trouble = TROUBLE[t.event];
  if (r.mood === 'glad') return { said: `Made a killing! ${where}: ${trouble}. Took ${wanted.toLowerCase()} in and sold the lot before the dust settled. You'll have seen it on the board, mind. Everyone has.`, more: false };
  if (r.mood === 'mad')
    return {
      said: `You want to know something? ${where}. ${cap(trouble)}, and my broker knew before anyone and kept it to himself. Take ${wanted.toLowerCase()} and beat him to it. I hope it costs him.`,
      more: false,
    };
  // Sad and bad both want paying for the part that matters, and look much the same until they're found out.
  if (!paid)
    return {
      said:
        r.mood === 'sad'
          ? `Somewhere close, ${trouble}. Nobody here knows yet. I'd tell you where, but I need it more than you do: ${r.price} Cr.`
          : `Between us? Somewhere near, ${trouble}, and it isn't on any board yet. Worth a lot to the right trader. Call it ${r.price} Cr and I'll tell you where.`,
      more: true,
    };
  return {
    said: r.mood === 'sad' ? `${where}. ${cap(trouble)}. Take ${wanted.toLowerCase()}, and quick. Thank you. I mean it.` : `${where}. ${cap(trouble)}. ${wanted}, as much as you can carry. Pleasure doing business.`,
    more: false,
  };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
