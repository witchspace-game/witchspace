// The ship and module files, read from content/ for the site's build
// (the pages themselves are made in tools/ships.ts).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import type { ModuleFile, ShipFile } from './ships';

/** Ships worth a page: the fleet, not the props. */
const SKIP = new Set(['missile', 'cargo-canister']);
/** Shown first: the ship every commander starts in. */
const FIRST = 'cobra-mk3';

export function loadShips(root: string): ShipFile[] {
  const dir = join(root, 'content/ships');
  const all = readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(readFileSync(join(dir, f), 'utf8')) as ShipFile)
    .filter((s) => !SKIP.has(s.id));
  return all.sort((a, b) => (a.id === FIRST ? -1 : b.id === FIRST ? 1 : a.name.localeCompare(b.name)));
}

/** The Titanoboa's modules, from content/modules. */
export function loadModules(root: string): Map<string, ModuleFile> {
  const dir = join(root, 'content/modules');
  return new Map(readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => {
    const m = JSON.parse(readFileSync(join(dir, f), 'utf8')) as ModuleFile;
    return [m.id, m];
  }));
}
