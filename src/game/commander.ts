// The player's persistent state. Lives in localStorage until accounts arrive.

export type Difficulty = 'classic' | 'modern';

export const DIFFICULTIES: Record<Difficulty, { name: string; blurb: string }> = {
  classic: {
    name: 'Classic',
    blurb: 'As it was in 1984. Touch the station and you die. Without an escape pod it is GAME OVER and your commander starts again from scratch.',
  },
  modern: {
    name: 'Modern',
    blurb: 'Scrapes cost shields and hull instead of your life. If you are destroyed, your insurers replace the ship and its equipment. Your cargo is still lost to space.',
  },
};

export type EquipmentId = 'docking-computer' | 'escape-pod' | 'gimbal-mount';

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
    blurb: 'Ejects you if the ship is destroyed. Single use.',
    classicOnly: true,
    minTech: 5,
  },
];

import { cargoTonnage } from '../economy/commodities';
import type { MarketState } from '../economy/market';

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
  /** Market state per system ("galaxy:index") you've traded at. */
  markets: Record<string, MarketState>;
  /** Number of times you've docked; Classic prices change with each visit. */
  visits: number;
  /** Witchspace fuel, in light years. */
  fuel: number;
}

const KEY = 'witchspace.commander.v1';

// Every commander starts as in 1984: a Cobra, Lave and 100 credits.
export const newCommander = (difficulty: Difficulty): Commander => ({
  name: 'Jameson',
  difficulty,
  credits: 100,
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
});

export const FUEL_CAPACITY = 7; // light years
export const FUEL_PRICE = 2; // credits per light year

export function loadCommander(): Commander | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const { legal: _old, ...saved } = JSON.parse(raw); // pre-records saves had one global status
      return { ...newCommander('modern'), ...saved };
    }
  } catch {
    // Private mode or blocked storage: play without saving.
  }
  return null;
}

export function saveCommander(c: Commander) {
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {
    // Ignore; see loadCommander.
  }
}

export function deleteCommander() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Ignore; see loadCommander.
  }
}

/** Tonnes used in the hold (gold counts by the kilogram, gems by the gram). */
export const cargoTonnes = (c: Commander) => cargoTonnage(c.cargo);

export const hasEquipment = (c: Commander, id: EquipmentId) => c.equipment.includes(id);

/** Fitted and not damaged. */
export const isWorking = (c: Commander, id: EquipmentId) => hasEquipment(c, id) && !c.damaged.includes(id);

/** Repairs cost a fraction of the item's price. */
export const REPAIR_FRACTION = 0.3;

// When a hit gets through to the hull, there's a chance it takes out
// something fitted: knocked offline under Modern rules (repair at a
// station), destroyed outright under Classic, as in the original.
const EQUIPMENT_HIT_CHANCE = 1 / 12;

/** Returns the affected item, if any, after a hull hit. */
export function rollEquipmentDamage(c: Commander, random = Math.random): Equipment | null {
  if (random() >= EQUIPMENT_HIT_CHANCE) return null;
  const candidates = c.equipment.filter((id) => !c.damaged.includes(id));
  if (!candidates.length) return null;
  const id = candidates[Math.floor(random() * candidates.length)];
  if (c.difficulty === 'classic') removeEquipment(c, id);
  else c.damaged.push(id);
  return EQUIPMENT.find((e) => e.id === id) ?? null;
}

export function removeEquipment(c: Commander, id: EquipmentId) {
  c.equipment = c.equipment.filter((e) => e !== id);
  c.damaged = c.damaged.filter((e) => e !== id);
}
