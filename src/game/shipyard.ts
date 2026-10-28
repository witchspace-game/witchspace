import type { ShipDef } from '../content/types';
import { EQUIPMENT, type Commander, type EquipmentId, type ShipOrder } from './commander';
import { PLAYER_LASERS } from './weapons';

// Speccing a ship and putting down a deposit, as you would on a new car
// (docs/design/ships-and-classes.md, "Spec it, and put down a deposit"). You
// choose its glow, its name and its fit-out at a shipyard, put down a tenth of
// the price, and it goes into production for you at that yard. The deposit is
// refundable until it's built; the price is held at the quote.

export const DEPOSIT_RATE = 0.1;
/** Real hours from deposit to built. */
export const PRODUCTION_HOURS = 72;

/**
 * The yard's palette: five at no charge, and the special glows, which cost.
 * No police blue and red, no Marshals' gold: only the law wears those.
 */
export const PALETTE: { colour: string; name: string; price: number }[] = [
  { colour: '#c9a8ff', name: 'Lavender', price: 0 },
  { colour: '#3dffb0', name: 'Witchspace green', price: 0 },
  { colour: '#9fe8ff', name: 'Ice', price: 0 },
  { colour: '#f2f6ff', name: 'White hot', price: 0 },
  { colour: '#ffb347', name: 'Amber', price: 0 },
  { colour: '#ff7a45', name: 'Ember', price: 9_500 },
  { colour: '#ff6fae', name: 'Rose', price: 9_500 },
  { colour: '#b6ff5c', name: 'Acid lime', price: 12_000 },
  { colour: '#7df9ff', name: 'Witch-fire', price: 18_000 },
  { colour: '#ff4dff', name: 'Nebula', price: 24_000 },
];

/** How hard it glows. Never dimmer than the yard's own: the glow is the signature. */
export const GLOWS = {
  standard: { name: 'Standard', glow: 1, price: 0 },
  deep: { name: 'Deep glow', glow: 1.25, price: 28_000 },
  blazing: { name: 'Blazing', glow: 1.5, price: 65_000 },
} as const;
export type GlowId = keyof typeof GLOWS;

/** A second colour for the fine lines (the canopy, the vents): two-tone, at a price. */
export const TRIM_PRICE = 16_000;

/** Comfort and showing off. Nothing here makes the ship fly or fight better: money buys a statement, not an edge. */
export const LUXURIES: { id: string; name: string; blurb: string; price: number }[] = [
  { id: 'suite', name: 'Owner’s suite', blurb: 'The whole glass deck: a bed under the stars, and a bar.', price: 48_000 },
  { id: 'voice', name: 'A ship’s voice', blurb: 'It greets you by name, and it has opinions about your flying.', price: 32_000 },
  { id: 'gold-name', name: 'Name in gold leaf', blurb: 'Hand-laid, and catches the station lights as you dock.', price: 14_000 },
  { id: 'starlight', name: 'Starlight cabin', blurb: 'The ceiling shows the sky outside, a little brighter than it is.', price: 21_000 },
  { id: 'hangar-crew', name: 'A crew at every berth', blurb: 'Your ship is washed, fuelled and waiting before you are.', price: 38_000 },
];

/** Fitting out a bigger, dearer hull costs more than fitting a Cobra. */
export const fitScale = (def: ShipDef) => Math.max(1, def.stats.price / 100_000);

/** What a new hull can be fitted with: the ship's own kit, not prizes or the pilot's papers. */
export const UPGRADES = EQUIPMENT.filter((e) => !e.classicOnly && !['wisp', 'weapons-licence', 'transponder'].includes(e.id));

export interface Spec {
  ship: string;
  colour: string;
  name: string;
  laser: ShipOrder['laser'];
  upgrades: EquipmentId[];
  glow: GlowId;
  /** The fine lines' colour, if two-tone. */
  trim: string | null;
  luxuries: string[];
}

export const defaultSpec = (def: ShipDef): Spec => ({ ship: def.id, colour: def.style.lineColor, name: '', laser: 'pulse', upgrades: [], glow: 'standard', trim: null, luxuries: [] });

const colourPrice = (colour: string | null) => (colour ? (PALETTE.find((p) => p.colour === colour)?.price ?? 0) : 0);

/** The price, line by line: the hull, its fit-out (scaled to the hull) and its finish. */
export function priceLines(def: ShipDef, spec: Spec): { hull: number; fit: number; finish: number } {
  const k = fitScale(def);
  const kit = spec.upgrades.reduce((sum, id) => sum + (UPGRADES.find((e) => e.id === id)?.price ?? 0), 0);
  const fit = Math.round((PLAYER_LASERS[spec.laser].price + kit) * k);
  const luxuries = spec.luxuries.reduce((sum, id) => sum + (LUXURIES.find((l) => l.id === id)?.price ?? 0), 0);
  const finish = colourPrice(spec.colour) + GLOWS[spec.glow].price + (spec.trim ? TRIM_PRICE + colourPrice(spec.trim) : 0) + luxuries;
  return { hull: def.stats.price, fit, finish };
}

export function quote(def: ShipDef, spec: Spec): number {
  const p = priceLines(def, spec);
  return p.hull + p.fit + p.finish;
}

export const depositFor = (total: number) => Math.round(total * DEPOSIT_RATE);

/** A name fit to paint: letters, digits, spaces and a little punctuation, 24 at most. */
export const cleanName = (s: string) =>
  s
    .replace(/[^\p{L}\p{N} '’.\-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 24);

export type OrderResult = { ok: true; order: ShipOrder } | { ok: false; message: string };

/** Put down the deposit: it goes into production at this yard. Only a concept takes deposits; one order at a time. */
export function placeOrder(c: Commander, def: ShipDef, spec: Spec, at: { galaxy: number; system: number }, now: number): OrderResult {
  if (c.order) return { ok: false, message: 'You already have a ship in production' };
  if (!def.concept) return { ok: false, message: 'Hulls already flying are bought outright, when shipyards sell' };
  const quoted = quote(def, spec);
  const deposit = depositFor(quoted);
  if (c.credits < deposit) return { ok: false, message: `The deposit is ${deposit.toLocaleString()} Cr` };
  c.credits = Math.round((c.credits - deposit) * 10) / 10;
  const order: ShipOrder = { ...spec, name: cleanName(spec.name), upgrades: [...new Set(spec.upgrades)], quoted, deposit, placed: now, ...at };
  c.order = order;
  return { ok: true, order };
}

/** Cancel before it's built: the deposit comes back in full. */
export function cancelOrder(c: Commander, now: number): number {
  const o = c.order;
  if (!o || production(o, now).built) return 0;
  c.credits = Math.round((c.credits + o.deposit) * 10) / 10;
  delete c.order;
  return o.deposit;
}

/** Production, stage by stage, as the yard reports it. */
export const STAGES: { at: number; text: string }[] = [
  { at: 0, text: 'Keel laid' },
  { at: 0.2, text: 'Hull plated' },
  { at: 0.45, text: 'Drives fitted' },
  { at: 0.65, text: 'Your fit-out going in' },
  { at: 0.85, text: 'Your name painted, the glow tested' },
  { at: 1, text: 'Built' },
];

export function production(o: ShipOrder, now: number): { fraction: number; stage: string; built: boolean; hoursLeft: number } {
  const fraction = Math.min(1, Math.max(0, (now - o.placed) / (PRODUCTION_HOURS * 3600_000)));
  const stage = [...STAGES].reverse().find((s) => fraction >= s.at)!.text;
  return { fraction, stage, built: fraction >= 1, hoursLeft: Math.ceil((1 - fraction) * PRODUCTION_HOURS) };
}
