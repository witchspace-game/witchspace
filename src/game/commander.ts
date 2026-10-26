// The player's persistent state. Lives in localStorage, and in the cloud too
// when you're signed in (see net/account.ts).

export type Difficulty = 'classic' | 'modern';

export const DIFFICULTIES: Record<Difficulty, { name: string; tagline: string; blurb: string }> = {
  classic: {
    name: 'Classic',
    tagline: 'The 1984 rules, kept as they were',
    blurb: 'Single-player, as it was in 1984: no companies or contracts, no shared galaxy. Touch the station and you die; without an escape pod it is GAME OVER. Kept as it was, without new features.',
  },
  modern: {
    name: 'Modern',
    tagline: 'Witchspace: the shared galaxy, companies and contracts',
    blurb: 'Scrapes cost shields and hull instead of your life. If you are destroyed, your insurers replace the ship and its equipment, less an excess, but they won\'t pay for a Fugitive. Your cargo is still lost to space.',
  },
};

export type EquipmentId =
  | 'docking-computer' | 'combat-computer' | 'escape-pod' | 'gimbal-mount' | 'fuel-scoops' | 'ecm'
  | 'large-cargo-bay' | 'extra-energy' | 'energy-bomb' | 'galactic-hyperdrive' | 'weapons-licence'
  | 'transponder' | 'distress-jammer' | 'long-range-tanks' | 'survey-scanner'
  | 'survey-autopilot' | 'route-autopilot' | 'wisp' | 'comms-array';

export type Mount = 'front' | 'rear' | 'left' | 'right';

export type LegalStatus = 'clean' | 'offender' | 'fugitive';

export interface Equipment {
  id: EquipmentId;
  name: string;
  price: number;
  blurb: string;
  /** Only offered under Classic rules, where it matters. */
  classicOnly?: boolean;
  /** Only offered under Modern rules (not part of the 1984 game). */
  modernOnly?: boolean;
  /** Only sold at stations with at least this tech level. */
  minTech: number;
  /** Structural: can't be knocked out in combat. */
  undamageable?: boolean;
  /** Used up when used; buy another afterwards. */
  consumable?: boolean;
  /** Fitted to every ship (Modern rules): never sold, only repaired. */
  standard?: boolean;
  /** Against the law wherever police scan: sold only where they don't, and confiscated if found. */
  illegal?: boolean;
  /** Sold only to explorers with at least this many explorer points (Modern). */
  explorer?: number;
  /** Never sold: found out there (the lost courier's prototype). Can't be sold on either. */
  found?: boolean;
  /** Mounted outside the hull: any hit that reaches the hull can knock it out, not only when it's badly hurt. */
  fragile?: boolean;
}

export const EQUIPMENT: Equipment[] = [
  {
    id: 'docking-computer',
    name: 'Docking Computer',
    price: 1500,
    blurb: 'Press C near a station and enjoy the waltz.',
    minTech: 5,
  },
  {
    id: 'combat-computer',
    name: 'Combat Computer',
    price: 6000,
    blurb: 'Flies the ship in a fight while you man a turret. Press O; needs a rear or side laser. Kills count half towards your rating.',
    modernOnly: true,
    minTech: 9,
  },
  {
    id: 'fuel-scoops',
    name: 'Fuel Scoops',
    price: 600,
    blurb: 'Skim a star for free fuel, if you can stand the heat. Fly slowly over cargo canisters to scoop them into the hold.',
    minTech: 5,
  },
  {
    id: 'ecm',
    name: 'E.C.M. System',
    price: 600,
    blurb: 'Press Z to destroy every missile nearby, including your own.',
    minTech: 6,
  },
  {
    id: 'large-cargo-bay',
    name: 'Large Cargo Bay',
    price: 400,
    blurb: 'Fifteen more tonnes of hold. The trader\'s first big upgrade.',
    minTech: 4,
    undamageable: true,
  },
  {
    id: 'extra-energy',
    name: 'Extra Energy Unit',
    price: 1500,
    blurb: 'Shields recharge twice as fast.',
    minTech: 8,
  },
  {
    id: 'energy-bomb',
    name: 'Energy Bomb',
    price: 900,
    blurb: 'Press B and every ship within 6 km is destroyed, whoever they are. Single use.',
    minTech: 7,
    consumable: true,
  },
  {
    id: 'galactic-hyperdrive',
    name: 'Galactic Hyperdrive',
    price: 5000,
    blurb: 'One jump to the next of the eight galaxies, from the galaxy chart (or Y). Single use.',
    minTech: 10,
    consumable: true,
  },
  {
    id: 'gimbal-mount',
    name: 'Gimballed Laser Mount',
    price: 450,
    blurb: "Lasers swivel to hit what's under the aiming ring. A little less punch than fixed lasers.",
    modernOnly: true,
    minTech: 7,
  },
  {
    id: 'escape-pod',
    name: 'Escape Pod',
    price: 1000,
    blurb: 'Ejects you if the ship is destroyed, and your equipment is saved, whatever the insurers say. Single use.',
    minTech: 5,
  },
  {
    id: 'weapons-licence',
    name: 'Weapons Licence',
    price: 300,
    blurb: 'Lets you trade and carry Firearms where they are licensed rather than banned.',
    modernOnly: true,
    minTech: 1,
    undamageable: true,
  },
  {
    id: 'long-range-tanks',
    name: 'Long-Range Fuel Tanks',
    price: 2200,
    blurb: 'Ten light years in the tank instead of seven: the explorer\'s first upgrade.',
    modernOnly: true,
    minTech: 8,
    undamageable: true,
  },
  {
    id: 'survey-scanner',
    name: 'Deep Survey Scanner',
    price: 1800,
    blurb: 'Surveys from twice as far in half the time, and picks up signals from four times as far.',
    modernOnly: true,
    minTech: 7,
  },
  {
    id: 'survey-autopilot',
    name: 'Survey Autopilot',
    price: 3000,
    blurb: 'Press 9: it flies to whatever is left to survey or find here and holds you in range. It leaves the star to you. Sold to Pathfinders.',
    modernOnly: true,
    minTech: 8,
    explorer: 400, // Pathfinder (EXPLORER_DOORS)
  },
  {
    id: 'route-autopilot',
    name: 'Route Autopilot',
    price: 5000,
    blurb: 'Starts each jump of a plotted course for you, when there is fuel and nothing hostile near. H stops it. Sold to Pioneers.',
    modernOnly: true,
    minTech: 10,
    explorer: 4000, // Pioneer
  },
  {
    id: 'wisp',
    name: 'Will-o’-the-Wisp',
    price: 20000,
    blurb: 'A Science Division prototype, never sold: the light you chase and never catch. It jinks you out of the way, so enemy lasers miss half the time and half the missiles fired at you are spoofed, while your own lasers are cold: an escape, not armour.',
    modernOnly: true,
    minTech: 99,
    undamageable: true,
    found: true,
  },
  {
    id: 'comms-array',
    name: 'Comms Array',
    price: 4000,
    blurb: 'A dish on the hull: companies reach you anywhere in the system, you can accept their work in flight, and you hear distress calls and news from a jump or two out. Fragile, and pirates aim for it.',
    modernOnly: true,
    minTech: 9,
    fragile: true,
  },
  {
    id: 'transponder',
    name: 'Transponder',
    price: 300,
    blurb: 'Tells police and stations who you are. Every ship has one. Press 0 to switch it off and run dark.',
    modernOnly: true,
    minTech: 1,
    standard: true,
  },
  {
    id: 'distress-jammer',
    name: 'Distress Jammer',
    price: 800,
    blurb: "A ship you attack can't call the police. Illegal wherever police scan: they'll confiscate it and fine you.",
    modernOnly: true,
    minTech: 6,
    illegal: true,
  },
];

import { cargoTonnage } from '../economy/commodities';
import type { MarketState } from '../economy/market';
import type { LaserId } from './weapons';
import type { ExploreRecord } from './explore';
import type { ActiveContract, CompanyLog } from './contracts';
import type { AdriftCase, Message } from './assignments';
import type { WorldEvent } from '../economy/events';
import type { CompanyId } from './companies';
import type { BtcTrade } from '../economy/bitcoin';
import type { Heard } from './saloon';

export interface Commander {
  name: string;
  difficulty: Difficulty;
  credits: number;
  equipment: EquipmentId[];
  /** Tonnes carried, by commodity name. Filled by trading in the next milestone. */
  cargo: Record<string, number>;
  /** Your record in each system you've broken the law in ("galaxy:index"). */
  records: Record<string, { status: LegalStatus; jumps: number }>;
  /** A Co-operative Marshals warrant for a serious crime: wanted everywhere with a government (Modern). */
  warrant: boolean;
  /** Equipment held at a station until a fine is paid. */
  impound: { at: string; items: EquipmentId[]; owed: number } | null;
  /** Fitted equipment knocked offline in combat (Modern rules); repaired at a station. */
  damaged: EquipmentId[];
  /** Where you are: galaxy 0..7 and system index 0..255. */
  location: { galaxy: number; system: number };
  /** Chosen hyperspace destination (system index in the current galaxy), if any. */
  target: number | null;
  /** A destination more than one jump away: the next hop is plotted after each jump. */
  courseTo?: number | null;
  /** Market state per system ("galaxy:index") you've traded at. */
  markets: Record<string, MarketState>;
  /** Number of times you've docked; Classic prices change with each visit. */
  visits: number;
  /** Witchspace fuel, in light years. */
  fuel: number;
  /** Ships destroyed, for the combat rating. */
  kills: number;
  /** When you last drove off the Falcon (epoch ms): she keeps away from you for a day after. */
  falconDrivenOff?: number;
  /** Co-operative Marshals carriers destroyed: each one brings the next sooner. */
  bastionsDestroyed?: number;
  /** Slaves handed to abolitionists to be freed (Modern rules). */
  freed?: number;
  /** Of the cargo, how much of each good is stolen: scooped from a clean ship you destroyed. */
  stolen?: Record<string, number>;
  /** Company contracts in hand (Modern rules); their cargo is in the hold. */
  contracts?: ActiveContract[];
  /** Contracts finished or given up recently, so a board doesn't offer them again. */
  contractsDone?: string[];
  /** Standing with each trading company, in points. */
  standing?: Partial<Record<CompanyId, number>>;
  /** When companies last forgave a day of bad standing (see contracts.forgive). */
  forgiven?: number;
  /** Each company's record of your work for it (for its file on you). */
  companyLog?: Partial<Record<CompanyId, CompanyLog>>;
  /** Messages from the companies, newest first. */
  messages?: Message[];
  /** Favours you owe each company (a lawyer here, a word there): leverage for later. */
  favours?: Partial<Record<CompanyId, number>>;
  /** World events you caused (a case opened, or fallen): yours, and the galaxy's now. */
  caused?: WorldEvent[];
  /** A shielded compartment a company fitted for a special assignment (game/compartment.ts). */
  compartment?: { company: CompanyId; tonnes: number };
  /** Special cargo adrift where your ship was lost, waiting to be recovered. */
  adrift?: AdriftCase[];
  /** Missiles on the rails. */
  missiles: number;
  /** The laser fitted to each mount, if any. */
  lasers: Partial<Record<Mount, LaserId>>;
  /** Where you've been, what you've surveyed and found (game/explore.ts). */
  explore?: ExploreRecord;
  /** Bitcoin in your own wallet, in sats (Modern rules, economy/bitcoin.ts): no hold space, and it survives the ship. */
  sats?: number;
  /** Your recent Bitcoin trades, oldest first. */
  btcTrades?: BtcTrade[];
  /** The saloon: drinks bought this visit, and the tips you've heard (game/saloon.ts). */
  saloon?: { drinks: string[]; heard: Heard[] };
}

const KEY = 'witchspace.commander.v1';

/**
 * A new commander's 100 credits. Nothing the law or the insurers take leaves
 * you with less, so you can always buy a hold of something and start again.
 */
export const STAKE = 100;

// Every commander starts as in 1984: a Cobra, Lave and 100 credits.
export const newCommander = (difficulty: Difficulty): Commander => ({
  name: 'Jameson',
  difficulty,
  credits: STAKE,
  equipment: [],
  cargo: {},
  records: {},
  warrant: false,
  impound: null,
  damaged: [],
  location: { galaxy: 0, system: 7 }, // Lave, as in 1984
  target: null,
  markets: {},
  visits: 0,
  fuel: 7,
  kills: 0,
  missiles: 3, // as in 1984
  lasers: { front: 'pulse' },
});

/** Cargo space: the hull's own, plus the large cargo bay. */
export const LARGE_CARGO_BAY = 15;
export const cargoCapacity = (c: Commander, hullCargo: number) =>
  hullCargo + (hasEquipment(c, 'large-cargo-bay') ? LARGE_CARGO_BAY : 0);

export const FUEL_CAPACITY = 7; // light years
/** Long-range tanks hold this much more. */
export const LONG_RANGE_EXTRA = 3;
/** What this ship's tanks hold. */
export const fuelCapacity = (c: Commander) => FUEL_CAPACITY + (c.equipment.includes('long-range-tanks') ? LONG_RANGE_EXTRA : 0);
export const FUEL_PRICE = 2; // credits per light year
export const MISSILE_PRICE = 30;

export function loadCommander(): Commander | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { legal: _old, ...saved } = JSON.parse(raw); // pre-records saves had one global status
      const c: Commander = { ...newCommander('modern'), ...saved };
      if (c.impound && !c.impound.items.length) c.impound = null; // a debt with nothing held is written off
      return c;
    }
  } catch {
    // Private mode or blocked storage: play without saving.
  }
  return null;
}

const saveListeners: ((c: Commander) => void)[] = [];
/** Be told after every save (the cloud save uses this). */
export const onSave = (fn: (c: Commander) => void) => saveListeners.push(fn);

export function saveCommander(c: Commander) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Ignore; see loadCommander.
  }
  for (const fn of saveListeners) fn(c);
}

export function deleteCommander() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore; see loadCommander.
  }
}

/** Tonnes used in the hold (gold counts by the kilogram, gems by the gram). */
/** Tonnes of company cargo carried under contract. */
export const consignedTonnes = (c: Commander) => (c.contracts ?? []).reduce((t, a) => t + (a.adrift || a.reserved ? 0 : a.qty), 0);

/** Tonnes used in the hold, company cargo included. */
export const cargoTonnes = (c: Commander) => cargoTonnage(c.cargo, c.difficulty === 'classic') + consignedTonnes(c);

export const hasEquipment = (c: Commander, id: EquipmentId) => c.equipment.includes(id);

/** Fitted and not damaged. */
export const isWorking = (c: Commander, id: EquipmentId) => hasEquipment(c, id) && !c.damaged.includes(id);

/** Repairs cost a fraction of the item's price. */
export const REPAIR_FRACTION = 0.3;

// When a hit gets through to a badly hurt hull, there's a chance it takes out
// something fitted: knocked offline under Modern rules (repair at a
// station), destroyed outright under Classic, as in the original.
const EQUIPMENT_HIT_CHANCE = 1 / 12;

/**
 * Returns the affected item, if any, after a hull hit. `prefer` is what the
 * attacker is aiming for (pirates go for the comms array): when it's fitted
 * and working, it's the one hit half the time.
 */
export function rollEquipmentDamage(c: Commander, random = Math.random, prefer?: EquipmentId): Equipment | null {
  if (random() >= EQUIPMENT_HIT_CHANCE) return null;
  // Under Modern rules every ship has a transponder, and it can be hit too.
  const fitted: EquipmentId[] = c.difficulty === 'modern' ? [...c.equipment, 'transponder'] : c.equipment;
  const candidates = fitted.filter((id) => !c.damaged.includes(id) && !EQUIPMENT.find((e) => e.id === id)?.undamageable);
  if (!candidates.length) return null;
  const id = prefer && candidates.includes(prefer) && random() < 0.5 ? prefer : candidates[Math.floor(random() * candidates.length)];
  if (c.difficulty === 'classic') removeEquipment(c, id);
  else c.damaged.push(id);
  return EQUIPMENT.find((e) => e.id === id) ?? null;
}

// Fragile kit (the comms array) sits outside the hull: any hit that gets
// through the shields can take it out, whatever state the hull is in.
const FRAGILE_HIT_CHANCE = 1 / 14;

/** After any hull hit: fragile kit knocked out, if it was. Pirates aiming for it (`aimed`) hit it twice as often. */
export function rollFragileDamage(c: Commander, random = Math.random, aimed = false): Equipment | null {
  if (c.difficulty !== 'modern' || random() >= FRAGILE_HIT_CHANCE * (aimed ? 2 : 1)) return null;
  const fragile = c.equipment.filter((id) => !c.damaged.includes(id) && EQUIPMENT.find((e) => e.id === id)?.fragile);
  if (!fragile.length) return null;
  const id = fragile[Math.floor(random() * fragile.length)];
  c.damaged.push(id);
  return EQUIPMENT.find((e) => e.id === id) ?? null;
}

export function removeEquipment(c: Commander, id: EquipmentId) {
  c.equipment = c.equipment.filter((e) => e !== id);
  c.damaged = c.damaged.filter((e) => e !== id);
  c.fuel = Math.min(c.fuel, fuelCapacity(c)); // smaller tanks
}

// --- Stolen goods -------------------------------------------------------------------
//
// Cargo taken from a clean ship you destroyed keeps its provenance. Where
// there's a law, the police treat it as contraband and stations won't buy it
// openly; a fence in the back room will, for less. Stolen units are always a
// part of what's in the hold, never more.

/** Units of a good in the hold that are stolen. */
export const stolenQty = (c: Commander, id: string) => Math.min(c.stolen?.[id] ?? 0, c.cargo[id] ?? 0);

/** Units of a good in the hold that are clean. */
export const cleanQty = (c: Commander, id: string) => (c.cargo[id] ?? 0) - stolenQty(c, id);

export function markStolen(c: Commander, id: string, qty: number) {
  c.stolen = { ...(c.stolen ?? {}), [id]: (c.stolen?.[id] ?? 0) + qty };
  tidyStolen(c);
}

/** Keep the stolen tally within what's actually in the hold. */
export function tidyStolen(c: Commander) {
  if (!c.stolen) return;
  for (const id of Object.keys(c.stolen)) {
    const n = Math.min(c.stolen[id], c.cargo[id] ?? 0);
    if (n > 0) c.stolen[id] = n;
    else delete c.stolen[id];
  }
}

/** Take stolen units out of the hold (confiscated, or sold to a fence). */
export function removeStolen(c: Commander, id: string, qty: number) {
  const n = Math.min(qty, stolenQty(c, id));
  c.cargo[id] -= n;
  if (c.cargo[id] <= 0) delete c.cargo[id];
  c.stolen![id] -= n;
  tidyStolen(c);
  return n;
}
