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
}

export const EQUIPMENT: Equipment[] = [
  {
    id: 'docking-computer',
    name: 'Docking Computer',
    price: 1500,
    blurb: 'Press C near a station and enjoy the waltz.',
  },
  {
    id: 'gimbal-mount',
    name: 'Gimballed Laser Mount',
    price: 450,
    blurb: "Lasers swivel to hit what's under the aiming ring. A little less punch than fixed lasers.",
    modernOnly: true,
  },
  {
    id: 'escape-pod',
    name: 'Escape Pod',
    price: 1000,
    blurb: 'Ejects you if the ship is destroyed. Single use.',
    classicOnly: true,
  },
];

export interface Commander {
  name: string;
  difficulty: Difficulty;
  credits: number;
  equipment: EquipmentId[];
  /** Tonnes carried, by commodity name. Filled by trading in the next milestone. */
  cargo: Record<string, number>;
  legal: LegalStatus;
  /** Fitted equipment knocked offline in combat (Modern rules); repaired at a station. */
  damaged: EquipmentId[];
}

const KEY = 'witchspace.commander.v1';

// Trading arrives in the next milestone. Until then the Galactic Co-operative
// fronts every new commander enough to try the docking computer.
export const newCommander = (difficulty: Difficulty): Commander => ({
  name: 'Jameson',
  difficulty,
  credits: 2000,
  equipment: [],
  cargo: {},
  legal: 'clean',
  damaged: [],
});

export function loadCommander(): Commander | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...newCommander('modern'), ...JSON.parse(raw) };
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

export const cargoTonnes = (c: Commander) => Object.values(c.cargo).reduce((a, b) => a + b, 0);

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
