import type { StarSystem } from '../galaxy/generate';
import { activeEvent, EVENT_KINDS, newsArrives, type WorldEvent } from '../economy/events';
import { hash } from '../economy/seed';
import { FUEL_PRICE, type LegalStatus } from './commander';
import type { CompanyId } from './companies';
import { withinJumps } from './contracts';

// The radio (Modern rules), as set out in docs/design/radio-and-comms.md:
// what ships and stations say when you hail them, what pirates say before
// they open fire, the emergency beacon's fixed calls, and what the comms
// array hears from further out. Pure: the game says it, and decides who's
// in range. Lines come from the system's seed and a number the game picks
// (a ship's serial and the minute), so they're the same each time you ask.

/** Ships hear each other within scanner range. */
export const RADIO_RANGE = 12000; // metres
/** How far the comms array hears the news and the boards: jumps out. */
export const ARRAY_JUMPS = 2;

export type Speaker = 'station' | 'police' | 'marshal' | 'trader' | 'pirate' | 'falcon';

export interface HailContext {
  system: StarSystem;
  /** Picks the line: the same number, the same answer. */
  k: number;
  /** Your record here. */
  status: LegalStatus;
  /** Running dark: they can't tell who you are. */
  dark?: boolean;
  /** The ship has been shot at lately, by you or anyone. */
  scared?: boolean;
  /** You shot at it. */
  wronged?: boolean;
  /** For traders: the company it flies for. */
  company?: string;
  /** Lawless: anarchies and feudal worlds don't check clearance. */
  lawless?: boolean;
}

export interface HailReply {
  text: string;
  /** A pirate's offer: pay this and they leave you be. */
  toll?: number;
}

const pick = <T>(ctx: HailContext, salt: number, lines: T[]): T => lines[Math.floor(hash(ctx.system, 7700 + salt, ctx.k) * lines.length)];

const STATION = [
  'Traffic control. Approach down the slot and match our roll.',
  'Traffic control. Keep it slow near the slot, Commander.',
  "Traffic control. You're on our board. Come in when you're ready.",
  'Traffic control. Busy day. Mind the Cobras coming out.',
];
const STATION_LAWLESS = ["We don't ask, and you don't tell. Come in.", 'Docking is docking. Pay at the pumps.', "Whoever you are, you're welcome. Probably."];
const POLICE = [
  "Fly safe, Commander. We're watching the lanes.",
  "Keep your transponder lit and we'll get along fine.",
  "Nothing to report. That's how we like it.",
  'Move along, Commander.',
  'Report any pirates to traffic control. Or shoot them; we won’t mind.',
];
const TRADER = [
  "Just hauling, Commander. Nothing worth your while.",
  'On schedule. Mostly.',
  'Seen pirates out past the planet. Watch yourself.',
  'Quiet run so far. Long may it last.',
  "If you're heading in, the slot's clear.",
  'Lovely day for it.',
];
const TRADER_COMPANY = ['{c} freight, on schedule.', '{c} run. Nothing to see.', "Flying for {c}. They're watching the clock, as usual."];
const TRADER_SCARED = ['Leave us alone!', "We've got nothing you want!", 'Mayday, mayday. Anyone?'];
const TRADER_WRONGED = ["We've called the police!", 'Murderer!', "Keep away. We've logged your hull."];
const PIRATE = [
  'Nice hold you have there. Be a shame if it spilled.',
  'Wrong system to fly clean, friend.',
  'Cut your engines and we might let you keep the ship.',
  'Drop your cargo and run, Commander.',
  "We've been waiting for someone like you.",
  'Keep talking. It makes you easier to find.',
];
const MARSHAL = ['Co-operative Marshals. Surrender, or be taken.', 'The warrant stands, Commander. Cut your engines.'];
const FALCON = ["You don't want this, Commander.", '...', 'Turn around.'];

/** What a ship or station says back when you hail it. */
export function hailReply(who: Speaker, ctx: HailContext): HailReply {
  switch (who) {
    case 'station':
      if (ctx.status === 'fugitive' && !ctx.lawless) return { text: 'You are not cleared to dock here. Surrender to the police.' };
      if (ctx.dark && !ctx.lawless) return { text: 'Unidentified ship, switch on your transponder.' };
      return { text: pick(ctx, 1, ctx.lawless ? STATION_LAWLESS : STATION) };
    case 'police':
      if (ctx.status === 'fugitive') return { text: 'Cut your engines and surrender, Commander.' };
      if (ctx.dark) return { text: 'Unidentified ship, switch on your transponder.' };
      if (ctx.status === 'offender') return { text: "We have your record here, Commander. Settle up at the station." };
      return { text: pick(ctx, 2, POLICE) };
    case 'marshal':
      return { text: pick(ctx, 3, MARSHAL) };
    case 'trader':
      if (ctx.wronged) return { text: pick(ctx, 4, TRADER_WRONGED) };
      if (ctx.scared) return { text: pick(ctx, 5, TRADER_SCARED) };
      if (ctx.company && hash(ctx.system, 7706, ctx.k) < 0.4) return { text: pick(ctx, 6, TRADER_COMPANY).replace('{c}', ctx.company) };
      return { text: pick(ctx, 7, TRADER) };
    case 'falcon':
      return { text: pick(ctx, 8, FALCON) };
    case 'pirate':
      return { text: pick(ctx, 9, PIRATE) };
  }
}

/** Now and then a hailed pirate band would rather be paid than fight. */
export const DEAL_CHANCE = 0.15;
/** Pirates' asking price: a slice of what your hold's worth, never less than 50 Cr. */
export const tollFor = (holdValue: number) => Math.max(50, Math.round((holdValue * 0.15) / 10) * 10);

/** A hailed pirate's answer: usually a threat, sometimes (when you have something worth taking) a price. */
export function pirateAnswer(ctx: HailContext, holdValue: number, credits: number): HailReply {
  const toll = tollFor(holdValue);
  if (hash(ctx.system, 7710, ctx.k) < DEAL_CHANCE && credits >= toll) return { text: `Tell you what: ${toll} Cr and we never saw you.`, toll };
  return hailReply('pirate', ctx);
}

/** What a pirate says when it first comes at you, if you're in radio range to hear it. */
export const pirateThreat = (ctx: HailContext) => hailReply('pirate', ctx).text;

// --- Distress calls --------------------------------------------------------------------

/** What answering a trader's distress call pays: a little, and standing (the Carriers' Mutual remembers more). */
export function distressReward(pirates: number, company?: CompanyId): { credits: number; standing: number } {
  const credits = 60 + 40 * Math.max(1, pirates);
  if (!company) return { credits, standing: 0 };
  return company === 'mutual' ? { credits: Math.round(credits * 1.5), standing: 2 } : { credits, standing: 1 };
}

// --- News at range ----------------------------------------------------------------------

export interface FarNews {
  event: WorldEvent;
  where: StarSystem;
  jumps: number;
  /** What the array picked up. */
  line: string;
}

/**
 * Events under way within ARRAY_JUMPS jumps whose news hasn't reached here
 * yet by the usual route: the comms array hears them early.
 */
export function newsInReach(here: StarSystem, now: number): FarNews[] {
  const out: FarNews[] = [];
  for (const { s, n } of withinJumps(here, ARRAY_JUMPS)) {
    const e = activeEvent(s, now);
    if (!e || newsArrives(s, here, e.start) <= now) continue;
    const kind = EVENT_KINDS[e.type];
    out.push({ event: e, where: s, jumps: n, line: `${kind.headline(s.name)} · ${n} jump${n === 1 ? '' : 's'} · wanted: ${kind.wanted}` });
  }
  return out;
}

// --- The emergency beacon ----------------------------------------------------------------

export type BeaconCall = 'mayday' | 'fuel' | 'hull' | 'escort';

export const BEACON_CALLS: { call: BeaconCall; label: string }[] = [
  { call: 'mayday', label: 'Mayday' },
  { call: 'fuel', label: 'Out of fuel' },
  { call: 'hull', label: 'Hull failing' },
  { call: 'escort', label: 'Request escort' },
];

/** Seconds between beacon calls: it's a beacon, not a horn. */
export const BEACON_GAP = 15;
/** Seconds a false alarm is remembered: the second in this time is an offence where there's law. */
export const FALSE_MEMORY = 600;
/** Hull failing means it: below this fraction of a full hull. */
export const HULL_FAILING = 0.6;
/** A Carriers' Mutual fuel tender charges this many times the pump price. */
export const TENDER_MARKUP = 3;

export interface BeaconState {
  /** When the last call went out, in seconds of flight. */
  last: number;
  /** When false alarms were raised. */
  falseAlarms: number[];
  /** Systems where a fuel tender has already come out ("galaxy:index"). */
  tendered: string[];
}

export const newBeacon = (): BeaconState => ({ last: -Infinity, falseAlarms: [], tendered: [] });

export interface BeaconFacts {
  /** Police here answer calls. */
  lawful: boolean;
  /** Hostile ships close by. */
  hostilesNear: boolean;
  /** Hull left, 0..1. */
  hull: number;
  fuel: number;
  /** Light years to the nearest other system. */
  nearestLy: number;
  /** The station here will take you. */
  canDock: boolean;
  /** "galaxy:index" of this system. */
  system: string;
}

export type BeaconOutcome =
  | { kind: 'wait'; seconds: number }
  | { kind: 'police' }
  | { kind: 'unanswered' }
  | { kind: 'false'; offence: boolean }
  | { kind: 'escort' }
  | { kind: 'fuel-ok' }
  | { kind: 'dock-for-fuel' }
  | { kind: 'tender'; ly: number; cost: number }
  | { kind: 'tendered' };

/** What comes of a beacon call at time `t` (seconds). Updates the state. */
export function beacon(state: BeaconState, call: BeaconCall, t: number, f: BeaconFacts): BeaconOutcome {
  if (t - state.last < BEACON_GAP) return { kind: 'wait', seconds: Math.ceil(BEACON_GAP - (t - state.last)) };
  state.last = t;
  state.falseAlarms = state.falseAlarms.filter((at) => t - at < FALSE_MEMORY);
  const raiseFalse = (): BeaconOutcome => {
    if (!f.lawful) return { kind: 'unanswered' };
    state.falseAlarms.push(t);
    return { kind: 'false', offence: state.falseAlarms.length > 1 };
  };
  switch (call) {
    case 'mayday':
      if (!f.hostilesNear) return raiseFalse();
      return f.lawful ? { kind: 'police' } : { kind: 'unanswered' };
    case 'hull':
      if (f.hostilesNear) return f.lawful ? { kind: 'police' } : { kind: 'unanswered' };
      if (f.hull >= HULL_FAILING) return raiseFalse();
      return f.lawful ? { kind: 'escort' } : { kind: 'unanswered' };
    case 'escort':
      return f.lawful ? { kind: 'escort' } : { kind: 'unanswered' };
    case 'fuel': {
      if (f.fuel + 1e-9 >= f.nearestLy) return { kind: 'fuel-ok' };
      if (f.canDock) return { kind: 'dock-for-fuel' };
      if (state.tendered.includes(f.system)) return { kind: 'tendered' };
      state.tendered.push(f.system);
      const ly = Math.round((f.nearestLy - f.fuel) * 10 + 0.5) / 10;
      return { kind: 'tender', ly, cost: Math.round(ly * FUEL_PRICE * TENDER_MARKUP * 10) / 10 };
    }
  }
}
