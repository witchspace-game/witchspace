import { assemble } from './modules';
import type { ModuleDef, ShipDef } from './types';

// Every JSON file in content/modules is bundled automatically, like the ships.
const files = import.meta.glob<ModuleDef>('/content/modules/*.json', { eager: true, import: 'default' });

export const shipModules: ModuleDef[] = Object.values(files).sort((a, b) => a.name.localeCompare(b.name));

export const moduleById = (id: string) => shipModules.find((m) => m.id === id);

/** A modular ship with a different line-up: the same ship, assembled from these modules instead. */
export function withLineUp(ship: ShipDef, ids: string[]): ShipDef {
  if (ship.modules?.join() === ids.join()) return ship;
  const line = assemble(ids.map((id) => moduleById(id) ?? missing(id)));
  return { ...ship, modules: ids, geometry: line.geometry, insignia: line.insignia };
}

function missing(id: string): never {
  throw new Error(`no module "${id}" in content/modules`);
}
