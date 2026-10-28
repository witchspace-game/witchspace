import { describe, expect, it } from 'vitest';
import { shipById } from '../content/ships';
import { newCommander } from './commander';
import { cancelOrder, cleanName, defaultSpec, depositFor, PALETTE, placeOrder, production, PRODUCTION_HOURS, quote } from './shipyard';

const fdl = shipById('fer-de-lance')!;
const cobra = shipById('cobra-mk3')!;
const yard = { galaxy: 0, system: 7 };
const H = 3600_000;

describe('speccing a ship', () => {
  it('prices the hull, its laser and its upgrades', () => {
    const spec = { ...defaultSpec(fdl), laser: 'beam' as const, upgrades: ['docking-computer' as const, 'fuel-scoops' as const] };
    expect(quote(fdl, spec)).toBe(fdl.stats.price + 1000 + 1500 + 600);
    expect(depositFor(quote(fdl, spec))).toBe(Math.round(quote(fdl, spec) / 10));
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
