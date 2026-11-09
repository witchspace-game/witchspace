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
  /** His own story, for the famous few: what he tells you over a drink. */
  story?: string;
}

/**
 * The famous few, written by hand (drafts for Mark's yes): the renowned pirates nearest Lave, where
 * new commanders meet them first. Riedquat's ties into the Mutual's founding (Odile Venn's story at
 * Meridian: Hale & Ostrander pulled out and left Riedquat with nothing).
 */
const FAMOUS: Record<string, Omit<Renowned, 'key'>> = {
  '0:46': {
    name: 'Ambrose Hale',
    by: 'the Heir',
    ship: 'Inheritance',
    origin: 'is the last of the Hales of Hale & Ostrander, the ones who pulled out and left Riedquat to starve, and the only one who stayed',
    code: "never touches the rose-coloured Cobra that brings the food in. Everyone at Meridian knows why",
    story:
      "My grandfather signed the order that left this place with nothing. I was nine. I watched the last company ship lift off from that window. Somebody had to stay and make it right, and honest work doesn't pay what Riedquat is owed. There's a captain in a rose Cobra who brings the food in at cost. Anyone touches her answers to me.",
  },
  '0:27': {
    name: 'Osric Lasko',
    by: 'the Undertaker',
    ship: 'Short Straw',
    origin: 'was a Navy gunner, cashiered for refusing to fire on a ship of refugees whose papers were wrong',
    code: "buries every man he loses, and every one he kills, on the same rock off Quator's moon",
    story:
      "They asked me to fire on a ship full of farmers because their papers were wrong. I said no. They took my rank, my pension and my name off the wall. Now I bury people for a living, one way or another. They all go to the same rock. Yours too, if it comes to it.",
  },
  '0:155': {
    name: 'Jory Petrakis',
    by: 'Long Shot',
    ship: 'Bad Penny',
    origin: 'was the best shot the Lave Cup ever banned',
    code: "never comes closer than a kilometre. He doesn't need to",
    story:
      "They banned me from the Cup for hitting a marker from three kilometres. Said it was unsporting. So I found a sport where it isn't. You'll never see me close, Commander. That's rather the point.",
  },
};

/** The renowned pirate of a system, if it has one: the same man for everyone. */
export function renownedOf(s: StarSystem): Renowned | null {
  const famous = FAMOUS[`${s.galaxy}:${s.index}`];
  if (famous) return { key: `${s.galaxy}:${s.index}`, ...famous };
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
  /** How your last meeting ended, and when: for the saloon (licking his wounds, or gloating). */
  last?: { how: 'beaten' | 'won' | 'ran'; at: number };
}

/**
 * What every commander knows of him: the shared record of signed-in commanders' meetings
 * (server/src/renowned.ts, GET /renowned/<galaxy>). Fights he lost, won, and commanders who ran;
 * when he's back if someone put him in a pod; the latest few, newest first, by callsign.
 */
export interface SharedRecord {
  beaten: number;
  won: number;
  ran: number;
  /** Out of action until then, for everyone (0: flying). */
  out: number;
  recent: { c: string; how: 'beaten' | 'won' | 'ran'; at: number }[];
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
export function killedHisMan(c: Commander, s: StarSystem, now: number, shared?: SharedRecord): { who: Renowned; what: 'warn' | 'call' } | null {
  const who = renownedOf(s);
  if (!who || !eligible(c)) return null;
  const m = memoryOf(c, who.key);
  m.kills = [...m.kills.filter((t) => now - t < KILL_WINDOW), now];
  if (!flying(m, now) || (shared?.out ?? 0) > now) return null; // out of action: someone put him in a pod
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
  m.last = { how, at: now };
}

// --- What's said ------------------------------------------------------------------------------

/** One of his men, after you've killed two: whose people these are. */
export const warning = (who: Renowned) => `Easy, Commander. Those were ${who.name}'s people. He'll have heard by now.`;

/** He's coming: the computer's heads-up. */
export const comingFor = (who: Renowned) => `${who.name} is coming for you · Cobra Mk III ${who.ship} · about ${ARRIVES_IN} seconds · jump, dock or wait for him`;

/** His first word, on arrival: what he knows of you sets the tone. */
export function arrival(who: Renowned, m: RenownedMemory, shared?: SharedRecord): string {
  if (m.podShot) return `You shot my pod. I've been waiting for this.`;
  if (m.lost > 0) return `Last time you got lucky. My ship's new, my crew's angry, and I've had three days to think about you.`;
  if (m.beat > 0) return `You again. You ran last time${m.ran ? ' too' : ''}. Try to make it interesting.`;
  // What everyone knows of him: his tally against other commanders.
  const tally = shared?.won ? ` I've put down ${shared.won} commander${shared.won === 1 ? '' : 's'}.` : '';
  return `They call me ${who.by}.${tally} You've been killing my people, Commander. That stops now.`;
}

/** Beaten: his parting word from the pod. */
export const fromThePod = (who: Renowned) => `${who.name}, from a pod. Not bad. Keep the ship, I'll build another. Enjoy the next three days, Commander.`;

/** He beat you: his word over your wreck, for the black box. */
export const overYourWreck = (who: Renowned, beat: number) => `${beat > 1 ? `That's ${beat} times.` : 'Tell them who did it.'} ${who.name}, ${who.by}. Remember it.`;

// --- The saloon (Mark: "will he be in the local saloon later on licking his wounds … or celebrating
// and gloating on his win") ------------------------------------------------------------------------

/** He gloats about a win, or a commander who ran, for this long. */
export const GLOATS_FOR = 2 * 24 * HOUR;
/** A drink for him costs this. */
export const HIS_DRINK = 12;
/** On his off hours he's at the bar this often (a share of the saloon's two-hour slots). */
const RESTS = 0.3;

export type SaloonScene = 'wounds' | 'gloating' | 'resting';

/**
 * Whether he's in his home saloon now, and in what mood: always while he's out of action (licking his
 * wounds), for two days after beating you or seeing you run (gloating), and otherwise on some of his
 * off hours, from the seed and the clock, the same for everyone.
 */
export function inTheSaloon(s: StarSystem, m: RenownedMemory | undefined, slot: number, now: number, shared?: SharedRecord): SaloonScene | null {
  if ((m && !flying(m, now)) || (shared?.out ?? 0) > now) return 'wounds';
  if (m?.last && m.last.how !== 'beaten' && now - m.last.at < GLOATS_FOR) return 'gloating';
  const latest = shared?.recent[0];
  if (latest && latest.how !== 'beaten' && now - latest.at < GLOATS_FOR) return 'gloating';
  return hash(s, SALT + 10, slot) < RESTS ? 'resting' : null;
}

/** How he looks, and what he says once you've bought him a drink (or he's bought you one). */
export function saloonScene(who: Renowned, scene: SaloonScene, m: RenownedMemory | undefined, you: string, shared?: SharedRecord, now = Date.now()): { look: string; says: string; refuses?: boolean; buys?: boolean } {
  if (m?.podShot) return { look: 'sees you come in, and puts his glass down very carefully', says: 'You shot at my pod. Get out of my bar.', refuses: true };
  // Someone else's doing, from the shared record: the bar knows who.
  const latest = shared?.recent[0];
  const yours = m?.last && (!latest || m.last.at >= latest.at - 60_000);
  if (scene === 'wounds' && !yours && latest?.how === 'beaten')
    return { look: `in bandages, drinking alone; the regulars say CMDR ${latest.c} put him in a pod`, says: `${latest.c} got lucky. They won't twice. Tell them that, if you see them.` };
  if (scene === 'gloating' && !yours && latest && latest.how !== 'beaten' && now - latest.at < GLOATS_FOR)
    return latest.how === 'won'
      ? { look: `telling the bar how CMDR ${latest.c} went up${shared!.won > 1 ? `; that's ${shared!.won} commanders now, chalked behind the bar` : ''}`, says: `You heard about ${latest.c}? Of course you did. Everyone has. Don't be ${latest.c}, ${you}.` }
      : { look: `laughing about CMDR ${latest.c}, who turned and ran`, says: `${latest.c} ran from me. Sensible. Are you sensible, ${you}?` };
  if (scene === 'wounds') {
    if (m?.last?.how === 'beaten')
      return {
        look: 'his arm in a sling, drinking alone in the corner; the regulars give him room',
        says: `Fair fight, ${you}. I've lost ships to worse and drunk with them after. The ${who.ship} will fly again, and so will I. Enjoy the quiet while it lasts.`,
      };
    return { look: 'in bandages, drinking alone; nobody asks him who did it', says: `Someone got lucky. They won't twice.` };
  }
  if (scene === 'gloating') {
    if (m?.last?.how === 'ran')
      return { look: 'telling his crew, loudly, about a Cobra that turned and ran', says: `There they are! The one that ran. No shame in it, ${you}. I'd have run from me too. Next time, stay.`, buys: true };
    const tally = m?.beat ?? 1;
    return {
      look: `buying rounds for his crew; your ship's name is chalked on the board behind the bar${tally > 1 ? `, with ${tally} marks after it` : ''}`,
      says: `${you}! Sit down, sit down. I was just telling them how you went up. ${tally > 1 ? `That's ${tally} to me` : 'One to me'}, nothing to you. This round's on the ${who.ship}.`,
      buys: true,
    };
  }
  return {
    look: `in the corner booth with his back to the wall. The regulars say he ${who.origin}, and that he ${who.code}`,
    says: `${who.story ?? `They call me ${who.by}.`} ${m?.lost ? `You're the one who put me in a pod. I remember.` : m?.kills.length ? `You've been busy with my people, ${you}. I've noticed.` : `Fly straight here and we'll get along.`}`,
  };
}

/** Whose patch a system is, for the galaxy chart: worth knowing before you go. */
export const chartLine = (who: Renowned, shared?: SharedRecord, now = Date.now()) =>
  `${who.name}, "${who.by}" · Cobra Mk III ${who.ship}${shared && shared.out > now ? ` · out of action${shared.recent[0]?.how === 'beaten' ? `, beaten by CMDR ${shared.recent[0].c}` : ''}` : shared?.won ? ` · ${shared.won} commander${shared.won === 1 ? '' : 's'} put down` : ''}`;

/** News from the shared record: other commanders' meetings in this galaxy, latest first (yours are in renownedNews). */
export function sharedNews(galaxy: number, records: Map<number, SharedRecord>, you: string | null, now: number, systemAt: (g: number, i: number) => StarSystem): { text: string; small: string; where: StarSystem }[] {
  const out: { text: string; small: string; where: StarSystem; at: number }[] = [];
  for (const [i, r] of records) {
    const where = systemAt(galaxy, i);
    const who = renownedOf(where);
    const latest = r.recent[0];
    if (!who || !latest || latest.c === you || now - latest.at > GLOATS_FOR * 2) continue;
    const text =
      latest.how === 'beaten'
        ? `CMDR ${latest.c} puts ${who.name} of ${where.name} in his escape pod`
        : latest.how === 'won'
          ? `${who.name} of ${where.name} claims CMDR ${latest.c}'s ship`
          : `CMDR ${latest.c} runs from ${who.name} at ${where.name}`;
    out.push({ where, at: latest.at, text, small: `${who.by} · ${r.won} put down, ${r.beaten} beaten, ${r.ran} ran${r.out > now ? ' · out of action' : ''}` });
  }
  return out.sort((a, b) => b.at - a.at).slice(0, 3);
}

/** News, for the station's News tab: his pod picked up, or his boast, from what you know of him. */
export function renownedNews(c: Commander, galaxyOf: (key: string) => StarSystem | null, now: number): { text: string; small: string; where: StarSystem }[] {
  const out: { text: string; small: string; where: StarSystem }[] = [];
  for (const [key, m] of Object.entries(c.renowned ?? {})) {
    const where = galaxyOf(key);
    const who = where && renownedOf(where);
    if (!where || !who || !m.last) continue;
    if (m.last.how === 'beaten' && !flying(m, now))
      out.push({ where, text: `${who.name} of ${where.name} picked up from his escape pod; the ${who.ship} being rebuilt`, small: `Beaten by CMDR ${c.name} · back in the air in ${Math.ceil(((m.outUntil ?? now) - now) / (24 * HOUR))} days` });
    else if (m.last.how !== 'beaten' && now - m.last.at < GLOATS_FOR)
      out.push({ where, text: m.last.how === 'won' ? `${who.name} claims another Cobra at ${where.name}` : `${who.name} says a commander ran from him at ${where.name}`, small: `CMDR ${c.name} · he's buying the rounds at ${where.name}` });
  }
  return out;
}
