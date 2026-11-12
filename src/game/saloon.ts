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
  /** How they put things (0–3): no two people of one mood in a bar sound alike. */
  voice: number;
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

/** Every mood has this many ways of looking and of putting things. */
const VOICES = 4;
const SLOT = 2 * 3600_000; // who's in changes every two hours
const RANGE = 15; // light years: what a saloon hears about
const EARLY_AHEAD = 30 * 60_000; // an early tip can be about something just about to start

const FIRST = ['Ade', 'Bram', 'Cass', 'Dov', 'Esme', 'Farid', 'Greta', 'Hal', 'Ines', 'Jun', 'Kit', 'Lio', 'Mags', 'Nell', 'Oskar', 'Pria', 'Quin', 'Ros', 'Sami', 'Tova', 'Ulf', 'Vesna', 'Wen', 'Yusuf', 'Zora', 'Bex', 'Cato', 'Dara'];
const LAST = ['Okafor', 'Lindqvist', 'Marsh', 'Vance', 'Ibarra', 'Kowal', 'Achterberg', 'Sato', 'Mbeki', 'Doyle', 'Haddad', 'Novak', 'Quill', 'Ferreira', 'Yates', 'Ruiz', 'Oduya', 'Brand', 'Castellan', 'Ng', 'Petrov', 'Ashby', 'Kaur', 'Moreau'];
const TRADES = ['hauler', 'miner', 'freight broker', 'courier pilot', 'dock hand', 'tanker skipper', 'salvager', 'ore assayer', 'cargo agent', 'shuttle pilot'];

const LOOKS: Record<Mood, string[]> = {
  glad: ['buying rounds and grinning at nobody in particular', 'loud, flush, and on their third drink', 'telling the whole bar about a good week', 'new boots, and wants you to notice'],
  sad: ['nursing one drink and staring into it', 'counting coins on the bar, slowly', 'still in work overalls, nowhere to be', 'reading the same message over and over'],
  mad: ['glaring at the door every time it opens', 'jabbing the bar with a finger as they talk', 'muttering about brokers to anyone who listens', 'snapped a stirrer in half and started on another'],
  bad: ['all easy smiles, leaning in a little close', 'immaculate, and very interested in your ship', 'friendly, unhurried, and already watching you', 'pays for your drink before you can stop them'],
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
  // What's been told at this bar this hour: two people don't bring the same story to one bar.
  const told = new Set<string>();
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
    const tip = tipFor(here, near, mood, now, (k) => r(10 + k, i), told);
    if (tip) told.add(`${tip.system}:${tip.event}`);
    // Their way of putting things: different from anyone else in the same mood here.
    let voice = Math.floor(r(4, i) * VOICES) % VOICES;
    for (let n = 0; n < VOICES && out.some((o) => o.mood === mood && o.voice === voice); n++) voice = (voice + 1) % VOICES;
    const drink = 2 + Math.round(hash(here, 73_000, 0) * 4);
    const price = tip && (tip.kind === 'early' || tip.kind === 'planted') ? 40 + Math.round(r(5, i) * 8) * 15 : 0;
    out.push({ id, name, trade, mood, look: LOOKS[mood][voice], voice, drink, tip, price });
  }
  return out;
}

function tipFor(here: StarSystem, near: StarSystem[], mood: Mood, now: number, r: (k: number) => number, told: Set<string>): Tip | null {
  if (!near.length) return null;
  const events = (s: StarSystem) => eventsAt(s, now - 8 * 3600_000, now + EARLY_AHEAD);
  if (mood === 'bad') {
    // Made up: a place that's quiet, and trouble that isn't happening there.
    const quiet = near.filter((s) => events(s).length === 0);
    if (!quiet.length) return null;
    const s = pick(quiet, r(1));
    const kinds: EventType[] = ['famine', 'plague', 'strike', 'boom', 'drought'];
    const event = pick(kinds, r(2));
    if (told.has(`${s.index}:${event}`)) return null;
    return { kind: 'planted', event, system: s.index, start: now - Math.round(r(3) * 40) * 60_000 };
  }
  const real = near.flatMap((s) => events(s).filter((e) => e.end > now && e.type !== 'lockdown').map((e) => ({ s, e })));
  // Early: begun (or about to), and the news isn't here yet. Stale: it's on the board.
  const early = real.filter(({ s, e }) => e.start <= now + EARLY_AHEAD && newsArrives(s, here, e.start) > now);
  const stale = real.filter(({ s, e }) => newsArrives(s, here, e.start) <= now);
  const fresh = (list: typeof real) => list.filter(({ s, e }) => !told.has(`${s.index}:${e.type}`));
  const want = mood === 'glad' ? fresh(stale) : fresh(early).length ? fresh(early) : fresh(stale);
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
  const v = (r.voice ?? 0) % VOICES;
  const t = r.tip;
  if (!t) return { said: IDLE[r.mood][v], more: false };
  const w: Words = { where: systemName(t.system), trouble: TROUBLE[t.event], wanted: EVENT_KINDS[t.event].wanted, price: r.price };
  if (r.mood === 'glad') return { said: GLAD[v](w), more: false };
  if (r.mood === 'mad') return { said: MAD[v](w), more: false };
  // Sad and bad both want paying for the part that matters, and look much the same until they're found out.
  if (!paid) return { said: (r.mood === 'sad' ? SAD_ASK : BAD_ASK)[v](w), more: true };
  return { said: (r.mood === 'sad' ? SAD_TELL : BAD_TELL)[v](w), more: false };
}

interface Words {
  where: string;
  trouble: string;
  wanted: string;
  price: number;
}
type Line = (w: Words) => string;

const IDLE: Record<Mood, string[]> = {
  glad: ["Good week. Can't complain, and I won't. Cheers.", 'Nothing to tell. Just glad to be sat down. Your health!', "Me? Paid up, docked, and off shift. That's the news.", "No tips tonight. I'm celebrating, not working."],
  sad: ['Nothing worth your credits, friend. Wish there was.', "I've got nothing. That's rather the problem.", "Wish I could help. Haven't heard a thing worth hearing.", "Ask someone luckier. I'm all out."],
  mad: ["Nothing you'd want. Not today. Ask me tomorrow.", "If I knew anything I'd be using it. I don't.", "Nothing. And don't ask the brokers either, they'll only lie.", "Quiet week. Too quiet to make a living."],
  bad: ['Me? Just passing through. Lovely ship you came in on.', 'Nothing yet. Stay a while, though. Things come up.', "Not tonight. But I'll remember your face. In a good way.", 'Business is slow. How’s yours? Full hold, is it?'],
};

const GLAD: Line[] = [
  (w) => `Made a killing! ${w.where}: ${w.trouble}. Took ${low(w.wanted)} in and sold the lot before the dust settled. You'll have seen it on the board, mind. Everyone has.`,
  (w) => `${w.where}, that's where I've been. ${cap(w.trouble)}, and I had ${low(w.wanted)} aboard. Best run of my life. It's on the board now, so you're late, but cheers anyway!`,
  (w) => `Drink's on me, I'm flush. ${cap(w.trouble)} at ${w.where}, and I was first in with ${low(w.wanted)}. Old news by now, I expect.`,
  (w) => `You heard about ${w.where}? ${cap(w.trouble)}. I sold ${low(w.wanted)} there at twice what I paid. Board's caught up since, worse luck for you.`,
];

const MAD: Line[] = [
  (w) => `You want to know something? ${w.where}. ${cap(w.trouble)}, and my broker knew before anyone and kept it to himself. Take ${low(w.wanted)} and beat him to it. I hope it costs him.`,
  (w) => `${w.where}. ${cap(w.trouble)}. Heard it from a pilot who owes me, and my own company sat on it. Go on, take ${low(w.wanted)}. Spite's free tonight.`,
  (w) => `I'll tell you for nothing, just to watch them squirm: ${w.where}, ${w.trouble}. They'll want ${low(w.wanted)}. Get there before the brokers do.`,
  (w) => `Twenty years I've hauled for them, and they kept this from me. ${w.where}: ${w.trouble}. ${w.wanted}, that's what they'll pay for. Have it.`,
];

const SAD_ASK: Line[] = [
  (w) => `Somewhere close, ${w.trouble}. Nobody here knows yet. I'd tell you where, but I need it more than you do: ${w.price} Cr.`,
  (w) => `I know something. Somewhere near, ${w.trouble}, and the board's not got it. ${w.price} Cr and it's yours. I'm sorry to ask.`,
  (w) => `There's a system not far off where ${w.trouble}. I can't give it away, not this week. ${w.price} Cr?`,
  (w) => `I heard it on the way in: ${w.trouble}, a few jumps from here. It's worth ${w.price} Cr to me. More to you, I'd think.`,
];

const BAD_ASK: Line[] = [
  (w) => `Between us? Somewhere near, ${w.trouble}, and it isn't on any board yet. Worth a lot to the right trader. Call it ${w.price} Cr and I'll tell you where.`,
  (w) => `I like you, so I'll be straight: ${w.trouble}, not far from here, and nobody knows. ${w.price} Cr for the name of the place. A bargain.`,
  (w) => `You look like someone who moves quickly. Somewhere close, ${w.trouble}. ${w.price} Cr and you'll be first there.`,
  (w) => `Keep your voice down. ${cap(w.trouble)}, a short hop away, and the board won't have it for hours. ${w.price} Cr. Friends' rates.`,
];

const SAD_TELL: Line[] = [
  (w) => `${w.where}. ${cap(w.trouble)}. Take ${low(w.wanted)}, and quick. Thank you. I mean it.`,
  (w) => `It's ${w.where}. ${cap(w.trouble)}. They'll need ${low(w.wanted)}. That'll keep me in fuel a while. Thanks.`,
  (w) => `${w.where}: ${w.trouble}. ${w.wanted} is what to take. Good luck. One of us should have some.`,
  (w) => `${w.where}. ${cap(w.trouble)}, so it's ${low(w.wanted)} they want. Go on, before someone else hears.`,
];

const BAD_TELL: Line[] = [
  (w) => `${w.where}. ${cap(w.trouble)}. ${w.wanted}, as much as you can carry. Pleasure doing business.`,
  (w) => `${w.where}. ${cap(w.trouble)}. Fill up on ${low(w.wanted)} and don't stop for anyone. You'll thank me.`,
  (w) => `${w.where}, and ${w.trouble}. ${w.wanted}, every tonne you've got room for. Safe flying, friend.`,
  (w) => `It's ${w.where}. ${cap(w.trouble)}. They'll pay anything for ${low(w.wanted)}. Remember who told you.`,
];

const low = (s: string) => s.toLowerCase();
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
