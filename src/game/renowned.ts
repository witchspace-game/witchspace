// Renowned pirates (Mark, 9 November 2026): "a single pirate with a backstory per system that is
// renowned and revered … to level the playing field rather than having a player that can just keep
// blasting Mambas and Sidewinders all day long." Not a spawn: one man, known in his system, who
// comes out in answer to a commander killing his people there. Flies a good Cobra and holds back
// (src/game/npc.ts FightStyle). Beaten, he ejects and is out of action for a while; win or lose,
// his legend is kept. Pure: the same man for everyone in a system, from its seed.
//
// docs/design/pirate-career.md (Renowned pirates).

import type { StarSystem } from '../galaxy/generate';
import { hash } from '../economy/seed';
import type { Commander } from './commander';
import { combatRating } from './rating';

/** How likely a system is to have one, by government (anarchy first): mostly the lawless worlds. */
const CHANCE = [0.9, 0.7, 0.3, 0.25, 0.2, 0.15, 0.1, 0.1];
const SALT = 80_000;

// Seeded parts. Original names, men, as Mark asked; the famous few get hand-written stories later.
const FIRST = ['Rennick', 'Torvald', 'Caspian', 'Dorran', 'Ezra', 'Hollis', 'Idris', 'Jory', 'Lucan', 'Marek', 'Osric', 'Pell', 'Quill', 'Ravel', 'Silas', 'Teague','Ulric', 'Varro', 'Wendell', 'Yusuf', 'Bram', 'Cato', 'Dace', 'Fenwick'];
const LAST = ['Vane', 'Corrow', 'Ashdown', 'Blackmere', 'Strand', 'Kell', 'Morrow', 'Harrow', 'Quaid', 'Rook', 'Saltash', 'Thorne', 'Wick', 'Drummond', 'Grieve', 'Lasko', 'Okafor', 'Petrakis', 'Sorensen', 'Talbot'];
const BY = ['the Tally-man', 'Quiet', 'the Toll', 'Old Iron', 'the Undertaker', 'the Patient', 'Long Shot', 'the Cartwright', 'Half-Price', 'the Saint', 'Lantern', 'the Second Mate'];
const SHIPS = ['Black Ledger', 'Last Orders', 'Debt of Honour', 'Small Mercy', 'Open Secret', 'Fair Warning', 'Bad Penny', 'Short Straw', 'Night Shift', 'Grace Period', 'Cold Comfort', 'Hard Bargain'];
/** Where he came from: one line, for the saloon and the news. */
const ORIGIN = [
  'flew escort for the Mutual until a convoy was sold out from under him',
  'was a Navy gunner, cashiered for refusing an order',
  'grew up on the haulers, and knows every lane by the hour',
  'won his Cobra at cards from a man who later wanted it back',
  'ran medicine through a blockade, and never went back to honest work',
  'was a police pilot here once; some say he still has friends on the station',
];
/** What he lives by: the line the regulars quote. */
const CODE = [
  "takes half a hold and leaves the rest. Nobody's ever died paying him",
  'never fires first, and never misses second',
  'keeps a tally on his hull, and crosses one off for every debt paid',
  'pays his crew before himself, and buries the ones he loses',
  "won't touch a Mutual ship. Nobody knows why",
  'gives every commander one warning. Only one',
];

export interface Renowned {
  /** "galaxy:system": his home, and the key to what's remembered of him. */
  key: string;
  name: string;
  /** What the regulars call him. */
  by: string;
  ship: string;
  origin: string;
  code: string;
}

/** The renowned pirate of a system, if it has one: the same man for everyone. */
export function renownedOf(s: StarSystem): Renowned | null {
  const r = (i: number) => hash(s, SALT, i);
  if (r(0) >= CHANCE[s.government]) return null;
  const pick = <T>(list: readonly T[], i: number) => list[Math.floor(r(i) * list.length)];
  return { key: `${s.galaxy}:${s.index}`, name: `${pick(FIRST, 1)} ${pick(LAST, 2)}`, by: pick(BY, 3), ship: pick(SHIPS, 4), origin: pick(ORIGIN, 5), code: pick(CODE, 6) };
}

// --- What a commander has to do with him ------------------------------------------------------

/** One pirate as this commander knows him: kills of his people, meetings and how they went. */
export interface RenownedMemory {
  /** When you killed his people in his system (only the last day's are kept). */
  kills: number[];
  /** You were told whose people they were. */
  warned?: number;
  /** He came out for you: when. */
  called?: number;
  /** He's out of action until then (beaten, ejected): a shipyard and some pride to mend. */
  outUntil?: number;
  /** Fights with you: his wins, yours, and the times you ran. */
  beat: number;
  lost: number;
  ran: number;
  /** You shot his escape pod. He doesn't forget that. */
  podShot?: boolean;
}

export const HOUR = 3600_000;
/** His people killed within this long count towards calling him out. */
export const KILL_WINDOW = 24 * HOUR;
/** A word on the radio at this many; he comes at this many. */
export const WARN_AT = 2;
export const CALL_AT = 4;
/** Seconds from his word to his arrival: time to run, if you want to. */
export const ARRIVES_IN = 90;
/** Beaten, he's out of action this long (Mark: long enough to feel you hurt him, short enough to meet again). */
export const OUT_OF_ACTION = 3 * 24 * HOUR;
/** He breaks off and ejects at this share of his shields and hull. */
export const EJECTS_AT = 0.2;

const fresh = (): RenownedMemory => ({ kills: [], beat: 0, lost: 0, ran: 0 });
export const memoryOf = (c: Commander, key: string): RenownedMemory => (c.renowned ??= {})[key] ??= fresh();

/** Only for commanders who've earned the attention: never Harmless or Mostly Harmless, never Classic. */
export function eligible(c: Commander): boolean {
  if (c.difficulty !== 'modern') return false;
  const r = combatRating(c.kills);
  return r !== 'Harmless' && r !== 'Mostly Harmless';
}

/** Whether he's flying now, for you: not out of action. */
export const flying = (m: RenownedMemory, now: number) => (m.outUntil ?? 0) <= now;

/**
 * One of his people killed by you in his system. Returns what happens: a warning on the radio,
 * him coming for you, or nothing yet.
 */
export function killedHisMan(c: Commander, s: StarSystem, now: number): { who: Renowned; what: 'warn' | 'call' } | null {
  const who = renownedOf(s);
  if (!who || !eligible(c)) return null;
  const m = memoryOf(c, who.key);
  m.kills = [...m.kills.filter((t) => now - t < KILL_WINDOW), now];
  if (!flying(m, now)) return null;
  if (m.called && now - m.called < KILL_WINDOW) return null; // he's already been out for you today
  if (m.kills.length >= CALL_AT) {
    m.called = now;
    m.kills = [];
    return { who, what: 'call' };
  }
  if (m.kills.length >= WARN_AT && !(m.warned && now - m.warned < KILL_WINDOW)) {
    m.warned = now;
    return { who, what: 'warn' };
  }
  return null;
}

/** How it ended. */
export function foughtHim(c: Commander, who: Renowned, how: 'beaten' | 'won' | 'ran', now: number) {
  const m = memoryOf(c, who.key);
  if (how === 'beaten') {
    m.lost++;
    m.outUntil = now + OUT_OF_ACTION;
  } else if (how === 'won') m.beat++;
  else m.ran++;
}

// --- What's said ------------------------------------------------------------------------------

/** One of his men, after you've killed two: whose people these are. */
export const warning = (who: Renowned) => `Easy, Commander. Those were ${who.name}'s people. He'll have heard by now.`;

/** He's coming: the computer's heads-up. */
export const comingFor = (who: Renowned) => `${who.name} is coming for you · Cobra Mk III ${who.ship} · about ${ARRIVES_IN} seconds · jump, dock or wait for him`;

/** His first word, on arrival: what he knows of you sets the tone. */
export function arrival(who: Renowned, m: RenownedMemory): string {
  if (m.podShot) return `You shot my pod. I've been waiting for this.`;
  if (m.lost > 0) return `Last time you got lucky. My ship's new, my crew's angry, and I've had three days to think about you.`;
  if (m.beat > 0) return `You again. You ran last time${m.ran ? ' too' : ''}. Try to make it interesting.`;
  return `They call me ${who.by}. You've been killing my people, Commander. That stops now.`;
}

/** Beaten: his parting word from the pod. */
export const fromThePod = (who: Renowned) => `${who.name}, from a pod. Not bad. Keep the ship, I'll build another. Enjoy the next three days, Commander.`;

/** He beat you: his word over your wreck, for the black box. */
export const overYourWreck = (who: Renowned, beat: number) => `${beat > 1 ? `That's ${beat} times.` : 'Tell them who did it.'} ${who.name}, ${who.by}. Remember it.`;
