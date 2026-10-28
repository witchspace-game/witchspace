import type { ShipDef } from '../content/types';
import { editionById, type Edition } from '../content/editions';
import { EQUIPMENT, hullOf, LARGE_CARGO_BAY, type Commander, type EquipmentId, type ShipOrder } from './commander';
import { PLAYER_LASERS, type LaserId } from './weapons';
import { PRODUCTION_HOURS, productionHours } from './production';
import { record } from './ledger';
import { combatRating, ratingPoints } from './rating';
import { inYards } from './manual';

// Speccing a ship and putting down a deposit, as you would on a new car
// (docs/design/ships-and-classes.md, "Spec it, and put down a deposit"). You
// choose its glow, its name and its fit-out at a shipyard, put down a tenth of
// the price, and it goes into production for you at that yard. The deposit is
// refundable until it's built; the price is held at the quote.

/** Why a commander can't have this laser yet (Modern: a rating), or null if they can. Classic sells as 1984 did. */
export function laserLocked(c: Commander, id: LaserId): string | null {
  const need = PLAYER_LASERS[id].minRating;
  if (!need || c.difficulty === 'classic' || c.kills >= ratingPoints(need)) return null;
  return `Sold only to pilots rated ${need} and above (you're ${combatRating(c.kills)})`;
}

export const DEPOSIT_RATE = 0.1;
export { PRODUCTION_HOURS, productionHours };

/**
 * The yard's palette: five at no charge, and the special glows, which cost.
 * No police blue and red, no Marshals' gold: only the law wears those.
 */
export const PALETTE: { colour: string; name: string; price: number; line: string; edition?: string }[] = [
  { colour: '#c9a8ff', name: 'Lave Dusk', price: 0, line: 'The sky over Lave as the station lights come on.' },
  { colour: '#3dffb0', name: 'Witchspace Green', price: 0, line: 'The glow of the jump itself.' },
  { colour: '#9fe8ff', name: 'Riedquat Ice', price: 0, line: 'Cold, clean and a long way from help.' },
  { colour: '#f2f6ff', name: 'Coriolis White', price: 0, line: 'The colour of a docking slot at full beam.' },
  { colour: '#ffb347', name: 'Diso Amber', price: 0, line: 'Diso’s old sun, low on the horizon.' },
  { colour: '#ff7a45', name: 'Leesti Ember', price: 9_500, line: 'Hot, like the trade in Leesti’s back rooms.' },
  { colour: '#ff6fae', name: 'Zaonce Rose', price: 9_500, line: 'For pilots who want to be noticed in Zaonce.' },
  { colour: '#b6ff5c', name: 'Reorte Acid', price: 12_000, line: 'Loud. Very loud.' },
  { colour: '#9b6bff', name: 'Xeer Ultraviolet', price: 18_000, line: 'The light the eye half sees, at the edge of Xeer’s sun.' },
  { colour: '#ff8f7a', name: 'Tibedied Coral', price: 14_000, line: 'Warm as the bars on Tibedied’s night side.' },
  // The Witch-fire Edition's own colours: nobody can order them on another ship (Mark: they're for the edition only).
  // Priced as before, so the edition's price holds; they're simply not offered on their own.
  { colour: '#7df9ff', name: 'Witch-fire', price: 18_000, line: 'The light at the edge of a jump that never closed.', edition: 'witch-fire' },
  { colour: '#ff4dff', name: 'Orerve Nebula', price: 24_000, line: 'The cloud you see from Orerve on a clear night.', edition: 'witch-fire' },
  // The Dark Edition's own. Not deeper: a saturated blue-violet thin line breaks into dashes where it runs
  // near-level on screen (the anti-aliasing steps show); this one is as deep as stays clean.
  { colour: '#8f6bff', name: 'Black-light', price: 30_000, line: 'The light you only see in the dark.', edition: 'dark' },
];

/** The colours the configurator offers: everything but an edition's own. */
export const ORDERABLE = PALETTE.filter((p) => !p.edition);

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
export const LUXURIES: { id: string; name: string; blurb: string; price: number; edition?: string }[] = [
  { id: 'suite', name: 'Owner’s suite', blurb: 'The whole glass deck: a bed under the stars, and a bar.', price: 48_000 },
  { id: 'voice', name: 'A ship’s voice', blurb: 'It greets you by name, and it has opinions about your flying.', price: 32_000 },
  { id: 'gold-name', name: 'Name in gold leaf', blurb: 'Hand-laid, and catches the station lights as you dock.', price: 14_000 },
  { id: 'starlight', name: 'Starlight cabin', blurb: 'The ceiling shows the sky outside, a little brighter than it is.', price: 21_000 },
  { id: 'hangar-crew', name: 'A crew at every berth', blurb: 'Your ship is washed, fuelled and waiting before you are.', price: 38_000 },
  // The Dark Edition's own (Mark): like her Black-light paint, nobody else can order them.
  { id: 'black-light-lights', name: 'Black-light running lights', blurb: 'Lights you only see up close, and only if she lets you.', price: 45_000, edition: 'dark' },
  { id: 'instrument-cabin', name: 'An instrument-lit cabin', blurb: 'No lamps aboard: the cabin glows with her own readouts, for the long dark.', price: 60_000, edition: 'dark' },
];
/** The luxuries anyone can order: an edition's own belong to that edition. */
export const ORDERABLE_LUXURIES = LUXURIES.filter((l) => !l.edition);

/** Fitting out a bigger, dearer hull costs more than fitting a Cobra. */
export const fitScale = (def: ShipDef) => Math.max(1, def.stats.price / 100_000);

/** What a new hull can be fitted with: the ship's own kit, not prizes or the pilot's papers. */
export const UPGRADES = EQUIPMENT.filter((e) => !e.classicOnly && !['wisp', 'weapons-licence', 'transponder'].includes(e.id));

export interface Spec {
  ship: string;
  colour: string;
  name: string;
  laser: ShipOrder['laser'];
  /** The rear mount: none, or a laser. */
  rear?: ShipOrder['laser'];
  upgrades: EquipmentId[];
  glow: GlowId;
  /** The fine lines' colour, if two-tone. */
  trim: string | null;
  luxuries: string[];
}

/** The laser a hull leaves the yard with: a pulse laser on a working ship, a beam on a ship of real calibre (Mark: "a pulse laser is silly on a ship of this calibre"). */
export const standardLaser = (def: ShipDef): ShipOrder['laser'] => (def.stats.price >= 150_000 ? 'beam' : 'pulse');

export const defaultSpec = (def: ShipDef): Spec => ({ ship: def.id, colour: def.style.lineColor, name: '', laser: standardLaser(def), upgrades: [], glow: 'standard', trim: null, luxuries: [] });

const colourPrice = (colour: string | null) => (colour ? (PALETTE.find((p) => p.colour === colour)?.price ?? 0) : 0);

/** A spec in colours anyone can order: an edition's own colours belong to that edition. */
export const orderable = (spec: Spec) =>
  [spec.colour, spec.trim].every((c) => !c || !PALETTE.find((p) => p.colour === c)?.edition) && spec.luxuries.every((id) => !LUXURIES.find((l) => l.id === id)?.edition);

/** The price, line by line: the hull, its fit-out (scaled to the hull) and its finish. */
export function priceLines(def: ShipDef, spec: Spec): { hull: number; fit: number; finish: number } {
  const k = fitScale(def);
  const kit = spec.upgrades.reduce((sum, id) => sum + (UPGRADES.find((e) => e.id === id)?.price ?? 0), 0);
  const fit = Math.round((PLAYER_LASERS[spec.laser].price + (spec.rear ? PLAYER_LASERS[spec.rear].price : 0) + kit) * k);
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

/**
 * A spec from outside the game (the site's configurator, an account, a link),
 * made safe or refused: a hull the yards sell, colours anyone can order, and
 * only real glows, lasers, upgrades and luxuries. The ships are passed in, so
 * the server can use its own bundle (docs/design/ship-configurator.md).
 */
export function checkSpec(spec: unknown, find: (id: string) => ShipDef | undefined): Spec | null {
  if (!spec || typeof spec !== 'object') return null;
  const o = spec as Record<string, unknown>;
  const def = typeof o.ship === 'string' ? find(o.ship) : undefined;
  if (!def || !inYards(def)) return null;
  const colour = (c: unknown) => typeof c === 'string' && (c === def.style.lineColor || ORDERABLE.some((p) => p.colour === c));
  const laser = (l: unknown): l is LaserId => typeof l === 'string' && Object.hasOwn(PLAYER_LASERS, l);
  const list = (v: unknown) => (Array.isArray(v) && v.every((x) => typeof x === 'string') ? [...new Set(v as string[])] : null);
  const upgrades = list(o.upgrades ?? []);
  const luxuries = list(o.luxuries ?? []);
  const glow = o.glow ?? 'standard';
  if (!colour(o.colour) || (o.trim != null && !colour(o.trim)) || !laser(o.laser) || (o.rear != null && !laser(o.rear))) return null;
  if (typeof glow !== 'string' || !Object.hasOwn(GLOWS, glow) || !upgrades || !luxuries) return null;
  if (!upgrades.every((id) => UPGRADES.some((e) => e.id === id)) || !luxuries.every((id) => ORDERABLE_LUXURIES.some((l) => l.id === id))) return null;
  return {
    ship: def.id,
    colour: o.colour as string,
    name: cleanName(typeof o.name === 'string' ? o.name : ''),
    laser: o.laser as LaserId,
    ...(o.rear != null ? { rear: o.rear as LaserId } : {}),
    upgrades: upgrades as EquipmentId[],
    glow: glow as GlowId,
    trim: (o.trim as string | null | undefined) ?? null,
    luxuries,
  };
}

export type OrderResult = { ok: true; order: ShipOrder } | { ok: false; message: string };

/** An edition's spec: set by the maker, not you (only the name is yours). */
export const editionSpec = (e: Edition, name = ''): Spec => ({
  ship: e.ship,
  colour: e.colour,
  name,
  laser: e.laser,
  ...(e.rear ? { rear: e.rear } : {}),
  upgrades: e.upgrades as EquipmentId[],
  glow: e.glow,
  trim: e.trim,
  luxuries: [...e.luxuries],
});

export const editionQuote = (def: ShipDef, e: Edition) => e.price ?? quote(def, editionSpec(e)) + (e.premium ?? 0);

/**
 * An edition as a gift: its whole look, beam lasers front and rear, and a combat
 * computer (Mark, for Mark Moxon's 001); the rest of the kit is earned.
 */
export const editionGiftSpec = (e: Edition, name = ''): Spec => ({ ...editionSpec(e, name), laser: 'beam', rear: 'beam', upgrades: ['combat-computer'] });

/** A gift is the hull as it leaves the yard: your choice of the included colours and a name, nothing that costs. */
export const giftable = (def: ShipDef, spec: Spec) => spec.laser === standardLaser(def) && !spec.upgrades.length && priceLines(def, spec).finish === 0;

/**
 * Put down the deposit: it goes into production at this yard. Only a concept
 * takes deposits; one order at a time. An edition carries its number (from the
 * server) and its premium; a gift (a redeemed voucher) costs nothing.
 */
export function placeOrder(
  c: Commander,
  def: ShipDef,
  spec: Spec,
  at: { galaxy: number; system: number },
  now: number,
  extra: { edition?: { edition: Edition; number: number }; gift?: boolean } = {},
): OrderResult {
  if (c.order) return { ok: false, message: 'You already have a ship in production' };
  if (!def.concept) return { ok: false, message: 'Hulls already flying are bought outright, when shipyards sell' };
  const giftEdition = extra.gift && c.gift?.edition ? editionById(c.gift.edition.id) : undefined;
  if (extra.gift && (c.gift?.ship !== def.id || (!giftEdition && !giftable(def, spec)))) return { ok: false, message: 'A gift is the hull with an included colour and its name' };
  if (!extra.edition && !giftEdition && !orderable(spec)) return { ok: false, message: 'Those colours and luxuries belong to an edition' };
  const locked = !giftEdition && !extra.edition ? [spec.laser, spec.rear].map((l) => (l ? laserLocked(c, l) : null)).find(Boolean) : null;
  if (locked) return { ok: false, message: locked };
  const e = extra.edition;
  const s = giftEdition ? editionGiftSpec(giftEdition, spec.name) : e ? editionSpec(e.edition, spec.name) : spec;
  const number = giftEdition ? c.gift!.edition! : e ? { id: e.edition.id, number: e.number } : null;
  const quoted = extra.gift ? 0 : e ? editionQuote(def, e.edition) : quote(def, s);
  const deposit = depositFor(quoted);
  if (c.credits < deposit) return { ok: false, message: `The deposit is ${deposit.toLocaleString()} Cr` };
  c.credits = Math.round((c.credits - deposit) * 10) / 10;
  if (deposit) record(c, { t: now, k: 'yard', d: -deposit });
  const order: ShipOrder = {
    ...s,
    name: cleanName(s.name),
    upgrades: [...new Set(s.upgrades)],
    quoted,
    deposit,
    placed: now,
    ...at,
    ...(number ? { edition: number } : {}),
    ...(extra.gift ? { gifted: true as const } : {}),
  };
  if (extra.gift) delete c.gift;
  c.order = order;
  return { ok: true, order };
}

/** Cancel before it's built: the deposit comes back in full. */
export function cancelOrder(c: Commander, now: number): number {
  const o = c.order;
  // A gift is built whatever: it's yours, not refundable.
  if (!o || o.gifted || production(o, now).built) return 0;
  c.credits = Math.round((c.credits + o.deposit) * 10) / 10;
  record(c, { t: now, k: 'yard', d: o.deposit });
  delete c.order;
  return o.deposit;
}

/** Production, stage by stage, as the yard reports it. */
export const STAGES: { at: number; text: string }[] = [
  { at: 0, text: 'Your hull comes off the line' },
  { at: 0.2, text: 'Your fit-out going in' },
  { at: 0.45, text: 'Your colours applied' },
  { at: 0.7, text: 'Your name painted' },
  { at: 0.85, text: 'The glow tested' },
  { at: 1, text: 'Ready' },
];

export function production(o: ShipOrder, now: number): { fraction: number; stage: string; built: boolean; hoursLeft: number } {
  // A gift is waiting when you redeem it: the yard built it for you already (Mark).
  if (o.gifted) return { fraction: 1, stage: 'Built', built: true, hoursLeft: 0 };
  const hours = productionHours(o);
  const fraction = Math.min(1, Math.max(0, (now - o.placed) / (hours * 3600_000)));
  const stage = [...STAGES].reverse().find((s) => fraction >= s.at)!.text;
  return { fraction, stage, built: fraction >= 1, hoursLeft: Math.ceil((1 - fraction) * hours) };
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

/** A gifted hull isn't for selling on: the yard takes it in part exchange for its kit only. */
export const tradeIn = (c: Commander, current: ShipDef) => Math.round((c.paint?.gifted ? 0 : current.stats.price * TRADE_IN.hull) + shipKitValue(c) * TRADE_IN.kit);

/** The bill on collection: the balance, less what the yard gives for your ship (it can come out in your favour). */
export function collection(c: Commander, current: ShipDef): { balance: number; tradeIn: number; due: number } | null {
  const o = c.order;
  if (!o) return null;
  const balance = o.quoted - o.deposit;
  // With a gift, the yard keeps your old ship as part of it: no windfall for a new pilot (Mark: not too much, too early).
  const t = o.gifted ? 0 : tradeIn(c, current);
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
  if (bill.due) record(c, { t: now, k: 'yard', d: -bill.due });
  const keep = c.equipment.filter((id) => !UPGRADES.some((e) => e.id === id));
  c.equipment = [...new Set([...keep, ...o.upgrades])];
  c.damaged = [];
  c.lasers = { front: o.laser, ...(o.rear ? { rear: o.rear } : {}) };
  c.missiles = Math.min(c.missiles, next.stats.missiles ?? 0);
  c.ship = next.id;
  c.paint = {
    colour: o.colour,
    glow: o.glow ?? 'standard',
    trim: o.trim ?? null,
    name: o.name,
    luxuries: o.luxuries ?? [],
    ...(o.edition ? { edition: o.edition } : {}),
    ...(o.gifted ? { gifted: true as const } : {}),
  };
  delete c.order;
  return { ok: true, paid: bill.due };
}

// --- Repainting --------------------------------------------------------------------

/**
 * The yard's labour for a repaint: a tenth of what the hull is worth (Mark: a respray on a
 * ship like that costs real money), never less than a day's work; half as much again to
 * refinish at Blazing.
 */
export const repaintLabour = (def: ShipDef, glow: GlowId = 'standard') => Math.round(Math.max(2_000, def.stats.price * 0.1) * (glow === 'blazing' ? 1.5 : 1));

export interface Finish {
  colour: string;
  glow: GlowId;
  trim: string | null;
}

/** Colours you may have on this ship: anyone's, and your own edition's. */
export const paintable = (c: Commander, colour: string | null) => {
  const edition = colour ? PALETTE.find((p) => p.colour === colour)?.edition : undefined;
  return !edition || c.paint?.edition?.id === edition;
};

/** What a repaint costs: the labour, and whatever of the finish changes, priced as in the configurator. What she already has is free. */
export function repaintQuote(def: ShipDef, f: Finish, now?: Partial<Finish> | null): number {
  const colour = f.colour === now?.colour ? 0 : colourPrice(f.colour);
  const glow = f.glow === (now?.glow ?? 'standard') ? 0 : GLOWS[f.glow].price;
  const trim = !f.trim || f.trim === now?.trim ? 0 : (now?.trim ? 0 : TRIM_PRICE) + colourPrice(f.trim);
  return repaintLabour(def, f.glow) + colour + glow + trim;
}

/** Repaint the ship you fly, at a yard, while you wait. Its name, edition and luxuries stay. */
export function repaint(c: Commander, def: ShipDef, f: Finish): OrderResult | { ok: true; paid: number } {
  if (hullOf(c) !== def.id) return { ok: false, message: 'The yard repaints the ship you came in' };
  if (![f.colour, f.trim].every((x) => paintable(c, x))) return { ok: false, message: 'Those colours belong to an edition' };
  const cost = repaintQuote(def, f, c.paint);
  if (c.credits < cost) return { ok: false, message: `A repaint like that is ${cost.toLocaleString()} Cr` };
  c.credits = Math.round((c.credits - cost) * 10) / 10;
  record(c, { k: 'yard', d: -cost });
  c.paint = { name: '', luxuries: [], ...c.paint, colour: f.colour, glow: f.glow, trim: f.trim };
  return { ok: true, paid: cost };
}
