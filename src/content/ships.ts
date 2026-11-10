import type { ShipDef } from './types';

// Every JSON file in content/ships is bundled automatically; contributors
// never need to touch code to add a ship.
const modules = import.meta.glob<ShipDef>('/content/ships/*.json', { eager: true, import: 'default' });

export const ships: ShipDef[] = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name));

export const shipById = (id: string) => ships.find((s) => s.id === id);

/** The ships anyone may see listed: the showroom, the site. An `unlisted` ship is known to the game but kept quiet. */
export const listedShips = ships.filter((s) => !s.unlisted);
