import type { ShipDef } from '../content/types';
import { SLOT } from '../content/slot';

// The owner's manual: how your ship flies, set against the Cobra everyone
// learned in, and what's particular about her. The controls themselves come
// from the game's own lists (main.ts controlRows and the touch drawer), so
// the manual can never drift from the buttons.

/** A few lines a maker would write about one of its hulls. */
const NOTES: Record<string, string[]> = {
  'fer-de-lance': [
    'She is long: twice a Cobra, nose to tail. Line up early for the slot, and remember the barbs reach back past the drives.',
    'Quick in a straight line and steady in a turn. She will out-run most pirates, but she won’t out-turn a Sidewinder: fight her at range.',
    'The shields are her armour. Let them come back between passes; the hull underneath is good, not endless.',
    'A thirty-tonne hold, for a ship that was never meant to haul. Luxuries in, a little cargo out.',
    'Everyone notices her. Pirates go out of their way for a ship this rich, and the police know your name before you hail them.',
  ],
  'cobra-mk3': [
    'The ship everyone learns in, and for good reason: she forgives. Twenty tonnes of hold, rails for four missiles (she leaves the yard with three), a little of everything.',
    'Neither the fastest nor the toughest: you win in a Cobra by choosing your fights.',
  ],
};

export interface Handling {
  label: string;
  value: string;
  /** Against a Cobra: '+18%', 'the same', '−20%'. */
  versus: string;
}

const pct = (a: number, b: number) => {
  const d = Math.round(((a - b) / b) * 100);
  return d === 0 ? 'the same' : `${d > 0 ? '+' : '−'}${Math.abs(d)}%`;
};

/** How she flies, beside a Cobra. */
export function handling(def: ShipDef, cobra: ShipDef): Handling[] {
  const s = def.stats;
  const c = cobra.stats;
  const len = (d: ShipDef) => {
    const zs = d.geometry.vertices.map((v) => v[2]);
    return Math.round(Math.max(...zs) - Math.min(...zs));
  };
  const span = Math.round(Math.max(...def.geometry.vertices.map((v) => Math.abs(v[0]))) * 2);
  return [
    { label: 'Top speed', value: `${s.maxSpeed} m/s`, versus: pct(s.maxSpeed, c.maxSpeed) },
    { label: 'Pitch', value: `${s.pitchRate ?? 1.5} rad/s`, versus: pct(s.pitchRate ?? 1.5, c.pitchRate ?? 1.5) },
    { label: 'Roll', value: `${s.rollRate ?? 2} rad/s`, versus: pct(s.rollRate ?? 2, c.rollRate ?? 2) },
    { label: 'Shields', value: `${s.shields}`, versus: pct(s.shields, c.shields) },
    { label: 'Hull', value: `${s.hull}`, versus: pct(s.hull, c.hull) },
    { label: 'Hold', value: `${s.cargo} t`, versus: pct(Math.max(s.cargo, 0.01), c.cargo) },
    { label: 'Missiles', value: `${s.missiles ?? 0}`, versus: pct(Math.max(s.missiles ?? 0, 0.01), c.missiles ?? 1) },
    { label: 'Length', value: `${len(def)} m`, versus: pct(len(def), len(cobra)) },
    { label: 'Span', value: `${span} m`, versus: `${Math.round(SLOT.halfW * 2 - span)} m to spare in the slot` },
  ];
}

export const notesFor = (def: ShipDef) => NOTES[def.id] ?? [];

// Earned, not bought: the Solos' Falcon. Police and Marshals' hulls have no price.
const NOT_IN_YARDS = new Set(['falcon']);

/** The ships the shipyards show and sell (each comes with an owner's manual). */
export const inYards = (def: ShipDef) => Boolean(def.stats.price) && !NOT_IN_YARDS.has(def.id) && !['missile', 'cargo', 'station', 'debris', 'alien'].includes(def.role);
