// The ships commanders fly, as shared space needs them (docs/design/shared-space.md, step 3: every
// ship flown as itself). Read straight from their ship files, so the server holds a Fer-de-lance to
// a Fer-de-lance's numbers and nobody types them twice. No dependencies beyond the JSON: the game
// and the server both read this.

import cobra from '../../content/ships/cobra-mk3.json';
import ferDeLance from '../../content/ships/fer-de-lance.json';

export interface Flyable {
  name: string;
  maxSpeed: number;
  shields: number;
  hull: number;
  /** Metres: how close a laser or a hull has to come to touch her. */
  radius: number;
  missiles: number;
}

/** A hit counts within this share of a hull's furthest point: the Cobra's 28 m of her 39.5. */
const HIT_SHARE = 0.71;

function flyable(def: { name: string; stats: { maxSpeed: number; shields: number; hull: number; missiles?: number }; geometry: { vertices: number[][] } }): Flyable {
  const extent = Math.max(...def.geometry.vertices.map((v) => Math.hypot(...v)));
  return { name: def.name, maxSpeed: def.stats.maxSpeed, shields: def.stats.shields, hull: def.stats.hull, radius: Math.round(extent * HIT_SHARE), missiles: def.stats.missiles ?? 0 };
}

/** Every hull a commander can own, by ship id. A ship not listed flies in as a Cobra. */
export const FLYABLE: Record<string, Flyable> = {
  'cobra-mk3': flyable(cobra),
  'fer-de-lance': flyable(ferDeLance),
};

export const flyableOf = (ship: string) => FLYABLE[ship] ?? FLYABLE['cobra-mk3'];
