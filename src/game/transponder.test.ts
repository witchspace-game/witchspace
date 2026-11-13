import { describe, expect, it } from 'vitest';
import { newCommander } from './commander';
import { claimInsurance } from './insurance';
import { swapShip, stowShip } from './shipyard';
import { shipById } from '../content/ships';
import { isShipNumber, newShipNumber, npcNumber, regionLetters, shipNumberOf } from './transponder';

describe('transponder numbers (Mark, 10 November 2026)', () => {
  it("a commander's ship: WS- and a code with no I, O, 0 or 1", () => {
    for (let i = 0; i < 200; i++) {
      const n = newShipNumber();
      expect(isShipNumber(n)).toBe(true);
      expect(n.slice(3, 7)).not.toMatch(/[IO01]/);
    }
    expect(isShipNumber('WS-7F3K-29')).toBe(true);
    expect(isShipNumber('LA-4471')).toBe(false);
  });

  it("an NPC's: two letters for her home and four digits, the same for everyone, never WS", () => {
    expect(npcNumber('Lave', 'voyage:x')).toMatch(/^LA-\d{4}$/);
    expect(npcNumber('Lave', 'voyage:x')).toBe(npcNumber('Lave', 'voyage:x'));
    expect(npcNumber('Lave', 'voyage:x')).not.toBe(npcNumber('Lave', 'voyage:y'));
    expect(regionLetters('Wsoreti')).toBe('WZ');
    expect(regionLetters('A')).toBe('AX');
  });

  it('an older save gets her number once, and keeps it', () => {
    const c = newCommander('modern');
    const n = shipNumberOf(c);
    expect(isShipNumber(n)).toBe(true);
    expect(shipNumberOf(c)).toBe(n);
  });

  it('the number goes with the hull into the hangar and out again', () => {
    const c = newCommander('modern');
    const cobra = shipById('cobra-mk3')!;
    const first = shipNumberOf(c);
    const here = { galaxy: 0, system: 7 };
    const stowed = stowShip(c, cobra, here, 1);
    expect(stowed.number).toBe(first);
    const other = { ...stowed, id: 'b', number: 'WS-ABCD-12' };
    c.fleet = [other];
    expect(swapShip(c, cobra, cobra, 'b', here, 0, 2)).toEqual({ ok: true });
    expect(c.shipNumber).toBe('WS-ABCD-12');
    expect(c.fleet!.find((s) => s.ship === 'cobra-mk3' && s.id !== 'b')!.number).toBe(first);
  });

  it("new ship, new number: the insurers' replacement is linked to the one she replaces", () => {
    const c = newCommander('modern');
    const lost = shipNumberOf(c);
    c.credits = 5000;
    claimInsurance(c);
    expect(c.shipNumber).not.toBe(lost);
    expect(isShipNumber(c.shipNumber)).toBe(true);
    expect(c.replaces).toBe(lost);
  });
});
