import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { newCommander } from './commander';
import { EDITIONS } from '../content/editions';
import { editionGiftSpec, editionQuote, collection, collectOrder, TRADE_IN, cancelOrder, cleanName, defaultSpec, depositFor, LUXURIES, PALETTE, placeOrder, production, PRODUCTION_HOURS, quote, UPGRADES } from './shipyard';

const fdl = shipById('fer-de-lance')!;
const cobra = shipById('cobra-mk3')!;
const yard = { galaxy: 0, system: 7 };
const H = 3600_000;

describe('speccing a ship', () => {
  it('prices the hull, its laser and its upgrades', () => {
    const spec = { ...defaultSpec(fdl), laser: 'beam' as const, upgrades: ['docking-computer' as const, 'fuel-scoops' as const] };
    expect(quote(fdl, spec)).toBe(fdl.stats.price + Math.round((1000 + 1500 + 600) * 1.8));
    expect(depositFor(quote(fdl, spec))).toBe(Math.round(quote(fdl, spec) / 10));
  });

  it('makes a fully specced statement ship cost a fortune, all of it looks and comfort', () => {
    const all = { ...defaultSpec(fdl), colour: '#9b6bff', laser: 'military' as const, upgrades: UPGRADES.map((e) => e.id), glow: 'blazing' as const, trim: '#ff8f7a', luxuries: LUXURIES.map((l) => l.id) };
    expect(quote(fdl, all)).toBeGreaterThan(fdl.stats.price * 2);
    expect(quote(cobra, defaultSpec(cobra))).toBe(cobra.stats.price + 400); // a plain one is the list price, with its pulse laser
  });

  it('keeps the Witch-fire Edition’s colours for the edition, at the price it was announced at', () => {
    expect(editionQuote(fdl, EDITIONS[0])).toBe(468_380);
    // The Dark Edition: fifty, in its own black-light, never dimmer than the yard's own glow.
    const dark = EDITIONS.find((e) => e.id === 'dark')!;
    expect(dark.limit).toBe(50);
    expect(dark.glow).not.toBe('standard');
    const c = newCommander('modern');
    c.credits = 1e6;
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), colour: '#ff4dff' }, yard, 0)).toMatchObject({ ok: false });
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), trim: '#7df9ff' }, yard, 0)).toMatchObject({ ok: false });
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), colour: dark.colour }, yard, 0)).toMatchObject({ ok: false });
    expect(placeOrder(c, fdl, defaultSpec(fdl), yard, 0, { edition: { edition: EDITIONS[0], number: 2 } })).toMatchObject({ ok: true });
  });

  it('keeps the law’s colours off the palette', () => {
    for (const { colour } of PALETTE) expect(colour).not.toMatch(/^#(0000ff|ff0000|ffd700)$/i);
  });

  it('paints only a clean name', () => {
    expect(cleanName('  Brass   Neck!! <script>  ')).toBe('Brass Neck script');
    expect(cleanName('Halcyon')).toBe('Halcyon');
    expect(cleanName('x'.repeat(40))).toHaveLength(24);
  });
});

describe('military lasers', () => {
  it('are sold only to Competent pilots and above, under Modern rules', async () => {
    const { laserLocked } = await import('./shipyard');
    const c = newCommander('modern');
    expect(laserLocked(c, 'military')).toMatch(/Competent/);
    expect(laserLocked(c, 'beam')).toBeNull();
    c.credits = 1e6;
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), laser: 'military' }, yard, 0)).toMatchObject({ ok: false });
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), rear: 'military' }, yard, 0)).toMatchObject({ ok: false });
    c.kills = 128;
    expect(laserLocked(c, 'military')).toBeNull();
    expect(laserLocked({ ...newCommander('classic') }, 'military')).toBeNull(); // 1984 sold them to anyone
  });
});

describe('a deposit', () => {
  it('puts a concept into production, and holds the price', () => {
    const c = newCommander('modern');
    c.credits = 50_000;
    const r = placeOrder(c, fdl, { ...defaultSpec(fdl), name: 'Halcyon' }, yard, 0);
    expect(r.ok).toBe(true);
    expect(c.credits).toBe(50_000 - depositFor(quote(fdl, defaultSpec(fdl))));
    expect(c.order).toMatchObject({ ship: 'fer-de-lance', name: 'Halcyon', system: 7 });
    expect(placeOrder(c, fdl, defaultSpec(fdl), yard, 0).ok).toBe(false); // one at a time
  });

  it('needs the money, and a concept', () => {
    const c = newCommander('modern');
    expect(placeOrder(c, fdl, defaultSpec(fdl), yard, 0)).toMatchObject({ ok: false });
    c.credits = 1e6;
    expect(placeOrder(c, cobra, defaultSpec(cobra), yard, 0)).toMatchObject({ ok: false });
  });

  it('is built stage by stage, and refundable until it is', () => {
    const c = newCommander('modern');
    c.credits = 50_000;
    placeOrder(c, fdl, defaultSpec(fdl), yard, 0);
    expect(production(c.order!, 0)).toMatchObject({ stage: 'Keel laid', built: false, hoursLeft: PRODUCTION_HOURS });
    expect(production(c.order!, PRODUCTION_HOURS * 0.5 * H).stage).toBe('Drives fitted');
    expect(production(c.order!, PRODUCTION_HOURS * H)).toMatchObject({ stage: 'Built', built: true, hoursLeft: 0 });
    expect(cancelOrder(c, PRODUCTION_HOURS * H)).toBe(0); // built: it's yours, not refundable
    const { deposit } = c.order!;
    expect(cancelOrder(c, H)).toBe(deposit);
    expect(c.credits).toBe(50_000);
    expect(c.order).toBeUndefined();
  });
});

describe('collecting it', () => {
  const built = PRODUCTION_HOURS * H;
  const ordered = () => {
    const c = newCommander('modern');
    c.credits = 400_000;
    c.equipment = ['docking-computer', 'weapons-licence', 'transponder'];
    placeOrder(c, fdl, { ...defaultSpec(fdl), colour: '#9b6bff', name: 'Brass Neck', laser: 'beam', upgrades: ['fuel-scoops'] }, yard, 0);
    return c;
  };

  it('trades in your ship, charges the balance, and you fly out in the new one, in its paint', () => {
    const c = ordered();
    const bill = collection(c, cobra)!;
    expect(bill.tradeIn).toBe(Math.round(cobra.stats.price * TRADE_IN.hull + (1500 + 400) * TRADE_IN.kit));
    const before = c.credits;
    expect(collectOrder(c, cobra, fdl, yard, 0, built)).toEqual({ ok: true, paid: bill.due });
    expect(c.credits).toBe(Math.round((before - bill.due) * 10) / 10);
    expect(c.ship).toBe('fer-de-lance');
    expect(c.paint).toMatchObject({ colour: '#9b6bff', name: 'Brass Neck' });
    expect(c.lasers).toEqual({ front: 'beam' });
    // The old ship's kit went with it; your papers stayed.
    expect(c.equipment.sort()).toEqual(['fuel-scoops', 'transponder', 'weapons-licence']);
    expect(c.order).toBeUndefined();
  });

  it('waits until it is built, at the yard that built it, with the money and room in the hold', () => {
    expect(collectOrder(ordered(), cobra, fdl, yard, 0, built / 2)).toMatchObject({ ok: false });
    expect(collectOrder(ordered(), cobra, fdl, { galaxy: 0, system: 8 }, 0, built)).toMatchObject({ ok: false });
    expect(collectOrder(ordered(), cobra, fdl, yard, 99, built)).toMatchObject({ ok: false });
    const poor = ordered();
    poor.credits = 0;
    expect(collectOrder(poor, cobra, fdl, yard, 0, built)).toMatchObject({ ok: false });
  });
});

describe('editions and gifts', () => {
  const witch = EDITIONS[0];

  it('builds an edition to its own spec, numbered, at its premium; only the name is yours', () => {
    const c = newCommander('modern');
    c.credits = 200_000;
    const r = placeOrder(c, fdl, { ...defaultSpec(fdl), colour: '#3dffb0', name: 'Halcyon' }, yard, 0, { edition: { edition: witch, number: 37 } });
    expect(r.ok).toBe(true);
    expect(c.order).toMatchObject({ colour: witch.colour, trim: witch.trim, glow: witch.glow, name: 'Halcyon', edition: { id: witch.id, number: 37 } });
    expect(c.order!.quoted).toBe(editionQuote(fdl, witch));
  });

  it('gives a voucher holder the plain hull for nothing, not to be cancelled or sold on', () => {
    const c = newCommander('modern');
    expect(placeOrder(c, fdl, defaultSpec(fdl), yard, 0, { gift: true })).toMatchObject({ ok: false }); // no voucher
    c.gift = { ship: 'fer-de-lance' };
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), colour: '#9b6bff' }, yard, 0, { gift: true })).toMatchObject({ ok: false }); // a special colour costs
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), colour: '#9fe8ff', name: 'Moxon' }, yard, 0, { gift: true })).toMatchObject({ ok: true });
    expect(c.gift).toBeUndefined();
    expect(c.order).toMatchObject({ quoted: 0, deposit: 0, gifted: true });
    expect(cancelOrder(c, 0)).toBe(0);
    // Ready on redeem, and the yard keeps the old Cobra: nothing paid either way.
    expect(collection(c, cobra)).toEqual({ balance: 0, tradeIn: 0, due: 0 });
    const before = c.credits;
    expect(collectOrder(c, cobra, fdl, yard, 0, 0)).toEqual({ ok: true, paid: 0 });
    expect(c.credits).toBe(before);
    expect(c.paint?.gifted).toBe(true);
    // Traded in, a gifted hull fetches nothing but its kit.
    c.equipment = [];
    c.lasers = {};
    c.order = { ...defaultSpec(fdl), quoted: 0, deposit: 0, placed: 0, ...yard };
    expect(collection(c, fdl)!.tradeIn).toBe(0);
  });

  it('dresses a gift with an edition number in that edition, with the plain fit-out', () => {
    const c = newCommander('modern');
    c.gift = { ship: 'fer-de-lance', edition: { id: witch.id, number: 1 } };
    expect(placeOrder(c, fdl, { ...defaultSpec(fdl), name: 'Moxon' }, yard, 0, { gift: true })).toMatchObject({ ok: true });
    expect(c.order).toMatchObject({ ...editionGiftSpec(witch, 'Moxon'), quoted: 0, gifted: true, edition: { id: witch.id, number: 1 } });
    // Beam lasers front and rear, and a combat computer (Mark).
    expect(c.order).toMatchObject({ laser: 'beam', rear: 'beam', upgrades: ['combat-computer'] });
    collectOrder(c, cobra, fdl, yard, 0, 0);
    expect(c.lasers).toEqual({ front: 'beam', rear: 'beam' });
    expect(c.equipment).toContain('combat-computer');
  });
});
