import type { ShipDef } from './types';

// Every JSON file in content/ships is bundled automatically; contributors
// never need to touch code to add a ship.
const modules = import.meta.glob<ShipDef>('/content/ships/*.json', { eager: true, import: 'default' });

export const ships: ShipDef[] = Object.values(modules).sort((a, b) => a.name.localeCompare(b.name));

export const shipById = (id: string) => ships.find((s) => s.id === id);
