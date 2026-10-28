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

/** The yard's palette. No police blue and red, no Marshals' gold: only the law wears those. */
export const PALETTE: { colour: string; name: string }[] = [
  { colour: '#c9a8ff', name: 'Lavender' },
  { colour: '#3dffb0', name: 'Witchspace green' },
  { colour: '#9fe8ff', name: 'Ice' },
  { colour: '#ff7a45', name: 'Ember' },
  { colour: '#ff6fae', name: 'Rose' },
  { colour: '#b6ff5c', name: 'Lime' },
  { colour: '#f2f6ff', name: 'White hot' },
  { colour: '#ffb347', name: 'Amber' },
];

/** What a new hull can be fitted with: the ship's own kit, not prizes or the pilot's papers. */
export const UPGRADES = EQUIPMENT.filter((e) => !e.classicOnly && !['wisp', 'weapons-licence', 'transponder'].includes(e.id));

export interface Spec {
  ship: string;
  colour: string;
  name: string;
  laser: ShipOrder['laser'];
  upgrades: EquipmentId[];
}

export const defaultSpec = (def: ShipDef): Spec => ({ ship: def.id, colour: def.style.lineColor, name: '', laser: 'pulse', upgrades: [] });

/** The price: the hull, its laser and its upgrades, all new. */
export function quote(def: ShipDef, spec: Spec): number {
  const kit = spec.upgrades.reduce((sum, id) => sum + (UPGRADES.find((e) => e.id === id)?.price ?? 0), 0);
  return def.stats.price + PLAYER_LASERS[spec.laser].price + kit;
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
