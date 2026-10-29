import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { newCommander } from './commander';
import { EDITIONS } from '../content/editions';
import { deliverShip, deliveriesArrived, deliveryQuote, editionGiftSpec, editionQuote, collection, collectOrder, swapShip, TRADE_IN, cancelOrder, cleanName, defaultSpec, depositFor, LUXURIES, ORDERABLE, PALETTE, placeOrder, standardKit, production, PRODUCTION_HOURS, quote, UPGRADES } from './shipyard';

const fdl = shipById('fer-de-lance')!;
const cobra = shipById('cobra-mk3')!;
const yard = { galaxy: 0, system: 7 };
const H = 3600_000;

describe('speccing a ship', () => {
  it('prices the hull, its laser and its upgrades', () => {
    const spec = { ...defaultSpec(fdl), laser: 'beam' as const, upgrades: ['docking-computer' as const, 'fuel-scoops' as const] };
    // The docking computer is standard on a hull of her calibre: no charge (Mark).
    expect(quote(fdl, spec)).toBe(fdl.stats.price + Math.round((1000 + 600) * 1.8));
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
    expect(production(c.order!, 0)).toMatchObject({ stage: 'Your hull comes off the line', built: false, hoursLeft: PRODUCTION_HOURS });
    expect(production(c.order!, PRODUCTION_HOURS * 0.5 * H).stage).toBe('Your colours applied');
    expect(production(c.order!, PRODUCTION_HOURS * H)).toMatchObject({ stage: 'Ready', built: true, hoursLeft: 0 });
    // An edition is finished by hand: longer.
    expect(production({ ...c.order!, edition: { id: 'witch-fire', number: 2 } }, PRODUCTION_HOURS * H).built).toBe(false);
    expect(production({ ...c.order!, edition: { id: 'witch-fire', number: 2 } }, 120 * H).built).toBe(true);
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
    // The old ship's kit went with it; your papers stayed, and she came with her own docking computer.
    expect(c.equipment.sort()).toEqual(['docking-computer', 'fuel-scoops', 'transponder', 'weapons-licence']);
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

  it('fits every Fer-de-lance with a docking computer, at no charge, and keeps a signed-over ship at her yard', () => {
    expect(standardKit(fdl)).toEqual(['docking-computer']);
    expect(standardKit(cobra)).toEqual([]);
    expect(defaultSpec(fdl).upgrades).toEqual(['docking-computer']);
    expect(quote(fdl, defaultSpec(fdl))).toBe(fdl.stats.price + Math.round(1000 * 1.8)); // the hull and her beam laser
    const c = newCommander('modern');
    c.gift = { ship: 'fer-de-lance', edition: { id: 'witch-fire', number: 1 }, at: { galaxy: 0, system: 23 } };
    expect(placeOrder(c, fdl, defaultSpec(fdl), yard, 0, { gift: true })).toMatchObject({ ok: false });
    expect(placeOrder(c, fdl, defaultSpec(fdl), { galaxy: 0, system: 23 }, 0, { gift: true }).ok).toBe(true);
    expect(c.order!.upgrades).toEqual(['docking-computer', 'combat-computer']);
  });

  it('prices the Dark Edition at 950,000, with her rear beam and her own luxuries, which nobody else can order', async () => {
    const dark = EDITIONS.find((e) => e.id === 'dark')!;
    expect(editionQuote(fdl, dark)).toBe(950_000);
    const c = newCommander('modern');
    c.credits = 200_000;
    expect(placeOrder(c, fdl, defaultSpec(fdl), yard, 0, { edition: { edition: dark, number: 1 } }).ok).toBe(true);
    expect(c.order).toMatchObject({ rear: 'beam', deposit: 95_000 });
    expect(c.order!.upgrades).toContain('combat-computer');
    expect(c.order!.luxuries).toEqual(expect.arrayContaining(['black-light-lights', 'instrument-cabin']));
    const d = newCommander('modern');
    d.credits = 200_000;
    expect(placeOrder(d, fdl, { ...defaultSpec(fdl), luxuries: ['instrument-cabin'] }, yard, 0)).toMatchObject({ ok: false });
    const { validSpec } = await import('./spec');
    expect(validSpec({ ...defaultSpec(fdl), luxuries: ['black-light-lights'] })).toBeNull();
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
    // Ready on redeem. Let the yard take the starter Cobra and it pays for her kit at the dock's price
    // (her pulse laser, half of 400 Cr) and nothing for the hull the Co-operative gave (Mark).
    expect(collection(c, cobra)).toEqual({ balance: 0, tradeIn: 200, due: -200 });
    expect(collection(c, cobra, true)).toEqual({ balance: 0, tradeIn: 0, due: 0 }); // kept in the hangar: nothing traded
    const before = c.credits;
    expect(collectOrder(c, cobra, fdl, yard, 0, 0)).toEqual({ ok: true, paid: -200 });
    expect(c.credits).toBe(before + 200);
    expect(c.fleet ?? []).toEqual([]);
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
    expect(c.order).toMatchObject({ laser: 'beam', rear: 'beam', upgrades: ['docking-computer', 'combat-computer'] });
    collectOrder(c, cobra, fdl, yard, 0, 0);
    expect(c.lasers).toEqual({ front: 'beam', rear: 'beam' });
    expect(c.equipment).toContain('combat-computer');
  });
});

describe('repainting', () => {
  it('repaints the ship you fly, for the finish and the labour, keeping its name and edition', async () => {
    const { repaint, repaintQuote, repaintLabour } = await import('./shipyard');
    const c = newCommander('modern');
    c.ship = 'fer-de-lance';
    c.paint = { colour: '#ff4dff', glow: 'blazing', trim: '#7df9ff', name: 'Moxon', luxuries: ['suite'], edition: { id: 'witch-fire', number: 1 }, gifted: true };
    c.credits = 1_000_000;
    const f = { colour: '#9fe8ff', glow: 'standard' as const, trim: null };
    expect(repaintQuote(fdl, f)).toBe(repaintLabour(fdl));
    // What she already has costs nothing: only the labour to touch her up.
    expect(repaintQuote(fdl, { colour: '#ff4dff', glow: 'blazing', trim: '#7df9ff' }, c.paint)).toBe(repaintLabour(fdl, 'blazing'));
    expect(repaintLabour(fdl)).toBe(18_000); // a tenth of the hull
    expect(repaintLabour(fdl, 'blazing')).toBe(27_000);
    expect(repaint(c, fdl, f)).toMatchObject({ ok: true });
    expect(c.paint).toMatchObject({ colour: '#9fe8ff', name: 'Moxon', edition: { number: 1 }, gifted: true });
    // An edition owner may have their edition's colours back; nobody else may.
    expect(repaint(c, fdl, { colour: '#ff4dff', glow: 'blazing', trim: '#7df9ff' })).toMatchObject({ ok: true });
    const other = newCommander('modern');
    other.ship = 'fer-de-lance';
    other.credits = 1e6;
    expect(repaint(other, fdl, { colour: '#ff4dff', glow: 'standard', trim: null })).toMatchObject({ ok: false });
    expect(repaint(other, cobra, { colour: '#9fe8ff', glow: 'standard', trim: null })).toMatchObject({ ok: false }); // not the ship he flies
  });
});

describe('a spec from the site', () => {
  const fdl = shipById('fer-de-lance')!;
  it('takes a good spec and cleans its name', async () => {
    const { validSpec } = await import('./spec');
    const s = validSpec({ ...defaultSpec(fdl), name: '  Night <b>Heron</b> ', upgrades: ['ecm', 'ecm'], luxuries: ['suite'], glow: 'deep', trim: ORDERABLE[1].colour });
    expect(s).toMatchObject({ ship: 'fer-de-lance', name: 'Night bHeronb', upgrades: ['ecm'], luxuries: ['suite'], glow: 'deep' });
  });
  it('refuses what the yards do not sell or make', async () => {
    const { validSpec } = await import('./spec');
    const good = defaultSpec(fdl);
    expect(validSpec(null)).toBeNull();
    expect(validSpec({ ...good, ship: 'coriolis' })).toBeNull();
    expect(validSpec({ ...good, ship: 'falcon' })).toBeNull();
    expect(validSpec({ ...good, colour: '#123456' })).toBeNull();
    expect(validSpec({ ...good, colour: PALETTE.find((p) => p.edition)!.colour })).toBeNull();
    expect(validSpec({ ...good, laser: 'antimatter' })).toBeNull();
    expect(validSpec({ ...good, glow: 'nuclear' })).toBeNull();
    expect(validSpec({ ...good, upgrades: ['wisp'] })).toBeNull();
    expect(validSpec({ ...good, luxuries: ['moon'] })).toBeNull();
  });
});

describe('your fleet (Mark: "a hangar where you can store your fleet")', () => {
  const gifted = () => {
    const c = newCommander('modern');
    c.equipment = [...c.equipment, 'fuel-scoops', 'ecm'];
    c.gift = { ship: 'fer-de-lance' };
    placeOrder(c, fdl, { ...defaultSpec(fdl), colour: '#9fe8ff' }, yard, 0, { gift: true });
    return c;
  };

  it('keeps the ship you came in, kit and all, in the hangar where you collected', () => {
    const c = gifted();
    expect(collectOrder(c, cobra, fdl, yard, 0, 0, true)).toEqual({ ok: true, paid: 0 });
    expect(c.ship).toBe('fer-de-lance');
    expect(c.fleet).toHaveLength(1);
    expect(c.fleet![0]).toMatchObject({ ship: 'cobra-mk3', at: yard, lasers: { front: 'pulse' } });
    expect(c.fleet![0].equipment).toEqual(expect.arrayContaining(['fuel-scoops', 'ecm']));
    expect(c.fleet![0].bought).toBeUndefined(); // the starter was a gift too
    expect(c.equipment).not.toContain('fuel-scoops'); // her kit stayed with her
  });

  it('lets the yard take her, paying for her kit as the dock would', () => {
    const c = gifted();
    const kit = Math.round((400 + UPGRADES.find((e) => e.id === 'fuel-scoops')!.price + UPGRADES.find((e) => e.id === 'ecm')!.price) / 2);
    expect(collection(c, cobra)!.tradeIn).toBe(kit);
  });

  it('swaps ships in the hangar where she waits, the hold going with you if it fits', () => {
    const c = gifted();
    collectOrder(c, cobra, fdl, yard, 0, 0, true);
    const id = c.fleet![0].id;
    expect(swapShip(c, fdl, cobra, id, { galaxy: 0, system: 8 }, 0, 1)).toMatchObject({ ok: false }); // not here
    expect(swapShip(c, fdl, cobra, id, yard, 25, 1)).toMatchObject({ ok: false }); // 25 t won't fit a Cobra
    expect(swapShip(c, fdl, cobra, id, yard, 10, 1)).toEqual({ ok: true });
    expect(c.ship).toBe('cobra-mk3');
    expect(c.equipment).toEqual(expect.arrayContaining(['fuel-scoops', 'ecm']));
    expect(c.fleet!.map((s) => s.ship)).toEqual(['fer-de-lance']);
    expect(c.fleet![0].paint?.gifted).toBe(true);
  });

  it("delivers a ship at the Carriers' Mutual's rate, by her size and the distance, as fast as news", () => {
    // A Cobra 15 LY: about 1,200 Cr, more than the fuel to fly back (60 Cr), a fraction of her value.
    const q = deliveryQuote(cobra, 15);
    expect(q.cost).toBe(1200);
    expect(q.cost / cobra.stats.price).toBeLessThan(0.02);
    expect(deliveryQuote(fdl, 15).cost).toBeGreaterThan(q.cost * 2);
    expect(q.ms).toBe(10 * 60_000 + 15 * 12 * 60_000);
    const c = gifted();
    collectOrder(c, cobra, fdl, yard, 0, 0, true);
    c.credits = 5000;
    const here = { galaxy: 0, index: 8 } as Parameters<typeof deliverShip>[3];
    const sent = deliverShip(c, cobra, c.fleet![0].id, here, 15, 1000);
    expect(sent).toMatchObject({ ok: true });
    expect(c.credits).toBe(3800);
    expect(deliveriesArrived(c, 1000 + q.ms - 1)).toEqual([]);
    expect(deliveriesArrived(c, 1000 + q.ms)).toHaveLength(1);
    expect(c.fleet![0].at).toEqual({ galaxy: 0, system: 8 });
  });
});
