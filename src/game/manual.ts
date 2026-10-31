import type { ShipDef } from '../content/types';
import { SLOT } from '../content/slot';

// The owner's manual: how your ship flies, set against the Cobra everyone
// learned in, and what's particular about her. The controls themselves come
// from the game's own lists (main.ts controlRows and the touch drawer), so
// the manual can never drift from the buttons.

/** A few lines a maker would write about one of its hulls. */
const NOTES: Record<string, string[]> = {
  'fer-de-lance': [
    'She is long: nearly two and a half Cobras, nose to tail. Line up early for the slot, and remember the barbs reach back past the drives.',
    'Quick in a straight line and steady in a turn: faster than a Cobra or a Viper, though a pirate’s Sidewinder or Mamba is quicker still, and turns tighter. Fight her at range, where her shields count.',
    'The shields are her armour. Let them come back between passes; the hull underneath is good, not endless.',
    'A thirty-tonne hold, for a ship that was never meant to haul. Luxuries in, a little cargo out.',
    'Everyone notices her. Pirates go out of their way for a ship this rich, and the police know your name before you hail them.',
  ],
  'cobra-mk3': [
    'The ship everyone learns in, and for good reason: she forgives. Twenty tonnes of hold, rails for four missiles (she leaves the yard with three), a little of everything.',
    'Neither the fastest nor the toughest: you win in a Cobra by choosing your fights.',
    'When you outgrow her, the yard will show you what’s next. Most commanders keep their first Cobra longer than they meant to.',
  ],
  'sidewinder': [
    'A scout before she was anything else: flat, wide and light. She turns tighter than anything in the yards and runs faster than a Viper; only a Mamba gets away from her.',
    'There is no hold. Not a tonne. She earns her keep from bounties and surveys, not from cargo.',
    'No missile rails either. Everyone you fight will have them, so an E.C.M. is the first thing to save for.',
    'Her shields are less than half a Cobra’s. Never trade blows: turn inside them, take your shots and leave before it’s even.',
    'Police know what a Sidewinder usually means. Keep your transponder on and your record clean, and they’ll leave you alone.',
  ],
  'mamba': [
    'The fastest hull on any shipyard’s list. She is mostly engine, and she feels it: nothing in the lanes catches her but a Marshal’s Lancer.',
    'Speed is her armour, because there isn’t much else: her shields and hull are both well under a Cobra’s. Choose when the fight starts, and when it ends.',
    'Four tonnes of hold: room for something small and valuable, and no questions asked of it.',
    'One missile rail. Make it count.',
    'Built for racing, flown for raiding. Every pirate in the system will take her for one of their own, and so will the police.',
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

/** A turn rate as players read it: degrees a second, not radians (Marketing's docked audit, item 31). */
const degrees = (radPerSecond: number) => `${Math.round((radPerSecond * 180) / Math.PI)}°/s`;

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
    { label: 'Pitch', value: degrees(s.pitchRate ?? 1.5), versus: pct(s.pitchRate ?? 1.5, c.pitchRate ?? 1.5) },
    { label: 'Roll', value: degrees(s.rollRate ?? 2), versus: pct(s.rollRate ?? 2, c.rollRate ?? 2) },
    { label: 'Shields', value: `${s.shields}`, versus: pct(s.shields, c.shields) },
    { label: 'Hull', value: `${s.hull}`, versus: pct(s.hull, c.hull) },
    { label: 'Hold', value: s.cargo ? `${s.cargo} t` : 'None', versus: pct(Math.max(s.cargo, 0.01), c.cargo) },
    { label: 'Missiles', value: s.missiles ? `${s.missiles}` : 'None', versus: pct(Math.max(s.missiles ?? 0, 0.01), c.missiles ?? 1) },
    { label: 'Length', value: `${len(def)} m`, versus: pct(len(def), len(cobra)) },
    { label: 'Span', value: `${span} m`, versus: `${Math.round(SLOT.halfW * 2 - span)} m to spare in the slot` },
  ];
}

export const notesFor = (def: ShipDef) => NOTES[def.id] ?? [];

const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/**
 * Her outline from above beside a Cobra's, to scale, as an SVG (Marketing: "explains the Fer-de-lance's
 * 'line up early for the slot'"). The game's manual and the site's (tools/shipFiles.ts) both draw it;
 * `muted` is the page's own colour for the Cobra and the labels.
 */
export function besideACobra(def: ShipDef, cobra: ShipDef, muted = 'var(--dim)') {
  const PX = 0.9; // pixels a metre
  const top = (d: ShipDef) => {
    const v = d.geometry.vertices;
    const xs = v.map((p) => p[0]);
    const zs = v.map((p) => p[2]);
    const [x0, z1] = [Math.min(...xs), Math.max(...zs)];
    const at = (p: number[]) => `${((p[0] - x0) * PX).toFixed(1)},${((z1 - p[2]) * PX).toFixed(1)}`;
    return { w: (Math.max(...xs) - x0) * PX, h: (z1 - Math.min(...zs)) * PX, path: d.geometry.faces.map((f) => `M${f.map((i) => at(v[i])).join('L')}Z`).join('') };
  };
  const [a, b] = [top(def), top(cobra)];
  const gap = 28;
  const h = Math.max(a.h, b.h);
  const w = a.w + gap + b.w;
  const ship = (t: typeof a, x: number, colour: string, name: string) =>
    `<g transform="translate(${x.toFixed(1)} ${(h - t.h).toFixed(1)})"><path d="${t.path}" fill="none" stroke="${colour}" stroke-width="1" stroke-linejoin="round" /></g><text x="${(x + t.w / 2).toFixed(1)}" y="${(h + 16).toFixed(1)}" text-anchor="middle" fill="${muted}" font-size="11">${esc(name)}</text>`;
  return `<svg class="man-draw" viewBox="-4 -4 ${(w + 8).toFixed(0)} ${(h + 26).toFixed(0)}" style="max-width:${Math.round(w + 8)}px" role="img" aria-label="${esc(def.name)} beside a Cobra Mk III, from above, to scale">
    ${ship(a, 0, def.style.lineColor, def.name)}${ship(b, a.w + gap, muted, cobra.name)}
  </svg>`;
}

/** Tilt, drawn: a phone on its side, its top edge tipping towards you, and the ship climbing (`muted` as above). */
export const tiltDrawing = (muted = 'var(--dim)') => `<svg class="man-draw" viewBox="0 0 260 110" role="img" aria-label="Tip the top of the phone towards you, and she climbs">
  <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M40 92 L70 22" stroke-width="7" stroke="${muted}" />
    <path d="M28 88 L58 18" stroke-dasharray="3 5" stroke="${muted}" />
    <path d="M86 30 C 92 14, 80 6, 66 8" stroke="var(--accent)" /><path d="M72 3 L66 8 L72 13" stroke="var(--accent)" />
    <path d="M150 74 L230 74 L190 92 Z" stroke="var(--accent)" transform="rotate(-18 190 80)" />
    <path d="M192 52 L208 22" stroke="var(--accent)" /><path d="M199 24 L208 22 L211 31" stroke="var(--accent)" />
  </g>
  <text x="18" y="108" fill="${muted}" font-size="11">the top, towards you</text>
  <text x="166" y="108" fill="${muted}" font-size="11">she climbs</text>
</svg>`;

/** "Twice the length", said from her Length row against a Cobra's. */
export function lengthWords(def: ShipDef, cobra: ShipDef) {
  const len = (d: ShipDef) => Math.max(...d.geometry.vertices.map((v) => v[2])) - Math.min(...d.geometry.vertices.map((v) => v[2]));
  const r = len(def) / len(cobra);
  if (r > 1.85 && r < 2.15) return 'twice the length';
  if (r >= 1.15) return `${r.toFixed(1)} times the length`;
  if (r <= 0.87) return `${Math.round(r * 100)}% of the length`;
  return 'about the same length';
}

// Earned, not bought: the Solos' Falcon. Police and Marshals' hulls have no price.
const NOT_IN_YARDS = new Set(['falcon']);

/** The ships the shipyards show and sell (each comes with an owner's manual). */
export const inYards = (def: ShipDef) => Boolean(def.stats.price) && !NOT_IN_YARDS.has(def.id) && !['missile', 'cargo', 'station', 'debris', 'alien'].includes(def.role);
