import type { ShipDef } from '../content/types';
import { EQUIPMENT, hullOf, LARGE_CARGO_BAY, type Commander, type EquipmentId, type ShipOrder } from './commander';
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

// --- Collecting it --------------------------------------------------------------

/** What the yard gives for the ship you're flying: most of the hull, half the kit. */
export const TRADE_IN = { hull: 0.6, kit: 0.5 };

/** The kit that belongs to the ship, valued as new: its upgrades and lasers. */
function shipKitValue(c: Commander) {
  const kit = c.equipment.reduce((sum, id) => sum + (UPGRADES.find((e) => e.id === id)?.price ?? 0), 0);
  const lasers = Object.values(c.lasers).reduce((sum, id) => sum + (id ? PLAYER_LASERS[id].price : 0), 0);
  return kit + lasers;
}

export const tradeIn = (c: Commander, current: ShipDef) => Math.round(current.stats.price * TRADE_IN.hull + shipKitValue(c) * TRADE_IN.kit);

/** The bill on collection: the balance, less what the yard gives for your ship (it can come out in your favour). */
export function collection(c: Commander, current: ShipDef): { balance: number; tradeIn: number; due: number } | null {
  const o = c.order;
  if (!o) return null;
  const balance = o.quoted - o.deposit;
  const t = tradeIn(c, current);
  return { balance, tradeIn: t, due: balance - t };
}

export type CollectResult = { ok: true; paid: number } | { ok: false; message: string };

/**
 * Take delivery at the yard that built it: your old ship and its kit go in part
 * exchange, and you fly out in the new one, fitted to your spec, in its paint.
 * Your own papers stay yours (the weapons licence, the transponder) and so do
 * prizes nobody sells (the Wisp). The hold has to fit.
 */
export function collectOrder(c: Commander, current: ShipDef, next: ShipDef, here: { galaxy: number; system: number }, cargoTonnes: number, now: number): CollectResult {
  const o = c.order;
  if (!o || o.ship !== next.id) return { ok: false, message: 'Nothing to collect' };
  if (!production(o, now).built) return { ok: false, message: 'Not built yet' };
  if (o.galaxy !== here.galaxy || o.system !== here.system) return { ok: false, message: 'Collect it at the yard that built it' };
  if (hullOf(c) !== current.id) return { ok: false, message: 'That isn’t the ship you’re flying' };
  const bill = collection(c, current)!;
  if (c.credits < bill.due) return { ok: false, message: `You need ${Math.ceil(bill.due).toLocaleString()} Cr to collect it` };
  const room = next.stats.cargo + (o.upgrades.includes('large-cargo-bay') ? LARGE_CARGO_BAY : 0);
  if (cargoTonnes > room + 1e-9) return { ok: false, message: `Your hold won’t fit: sell ${Math.ceil(cargoTonnes - room)} t first` };
  c.credits = Math.round((c.credits - bill.due) * 10) / 10;
  const keep = c.equipment.filter((id) => !UPGRADES.some((e) => e.id === id));
  c.equipment = [...new Set([...keep, ...o.upgrades])];
  c.damaged = [];
  c.lasers = { front: o.laser };
  c.missiles = Math.min(c.missiles, next.stats.missiles ?? 0);
  c.ship = next.id;
  c.paint = { colour: o.colour, glow: o.glow ?? 'standard', trim: o.trim ?? null, name: o.name, luxuries: o.luxuries ?? [] };
  delete c.order;
  return { ok: true, paid: bill.due };
}
