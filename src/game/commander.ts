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

export type EquipmentId = 'docking-computer' | 'escape-pod';

export interface Equipment {
  id: EquipmentId;
  name: string;
  price: number;
  blurb: string;
  /** Only offered under Classic rules, where it matters. */
  classicOnly?: boolean;
}

export const EQUIPMENT: Equipment[] = [
  {
    id: 'docking-computer',
    name: 'Docking Computer',
    price: 1500,
    blurb: 'Press C near a station and enjoy the waltz.',
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

export function removeEquipment(c: Commander, id: EquipmentId) {
  c.equipment = c.equipment.filter((e) => e !== id);
}
