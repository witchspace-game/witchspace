import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { cargoTonnes, newCommander } from './commander';
import { ADRIFT_FALL, ADRIFT_HOLD, ASSIGNMENT_SLOT, assignmentFor, assignmentWaiting, checkMessages, collectHeld, expireCases, fileOn, recoverCase, rivalPrice, sellToRival, setAdrift } from './assignments';
import { deliver, destinationOf, loseContracts, logOf, standing, take } from './contracts';

const lave = systemAt(0, 7);
const T0 = Date.UTC(2026, 9, 22, 12);

/** A time when Hexon has something for this callsign, within the next few windows. */
function waitingTime(callsign: string) {
  for (let k = 0; k < 20; k++) {
    const t = T0 + k * ASSIGNMENT_SLOT + 3600_000;
    if (assignmentWaiting(callsign, 'hexon', 10, t)) return t;
  }
  throw new Error('no window');
}

describe('special assignments', () => {
  it('only come once a company trusts you', () => {
    const c = newCommander('modern');
    const t = waitingTime(c.name);
    expect(assignmentFor(c, 'hexon', lave, t)).toBeNull();
    c.standing = { hexon: 5 };
    expect(assignmentFor(c, 'hexon', lave, t)).not.toBeNull();
  });

  it('are the same in the game and on the notification server', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 8 };
    const t = waitingTime(c.name);
    expect(assignmentWaiting(c.name, 'hexon', 8, t)).toBe(true);
    expect(assignmentFor(c, 'hexon', lave, t)!.id).toBe(assignmentFor(c, 'hexon', lave, t + 60_000)!.id);
  });

  it('arrive as a message once, and pay well with standing to match', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const t = waitingTime(c.name);
    const msgs = checkMessages(c, lave, t);
    expect(msgs.some((m) => m.company === 'hexon')).toBe(true);
    expect(checkMessages(c, lave, t)).toHaveLength(0);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    expect(offer.pay).toBeGreaterThan(400);
    expect(take(c, offer, 20)).toBeNull();
    deliver(c, destinationOf(offer));
    expect(standing(c, 'hexon')).toBe(9);
    expect(logOf(c, 'hexon').special).toBe(1);
    expect(assignmentFor(c, 'hexon', lave, t)).toBeNull(); // done
  });

  it('companies keep a file on you, with redactions', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const file = fileOn(c, 'hexon', lave, T0);
    expect(file.title).toMatch(/Hexon/);
    expect(file.lines.some((l) => l.redacted)).toBe(true);
    expect(file.lines[0].text).toContain(c.name);
  });

  it('Classic commanders are left alone', () => {
    const c = newCommander('classic');
    c.standing = { hexon: 50 };
    expect(checkMessages(c, lave, waitingTime(c.name))).toHaveLength(0);
  });

  it('survives the ship: adrift, recoverable, and gone if left too long', () => {
    const c = newCommander('modern');
    c.standing = { wy: 6, hexon: 6 };
    const t = waitingTime(c.name);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    take(c, offer, 20);
    expect(setAdrift(c, lave, [1, 2, 3], t)).toHaveLength(1);
    expect(loseContracts(c)).toHaveLength(0); // the special one isn't lost with the ship
    expect(cargoTonnes(c)).toBe(0); // it's out there, not in the hold
    expect(recoverCase(c, offer.id)).toMatch(/recovered/);
    expect(cargoTonnes(c)).toBe(offer.qty);

    setAdrift(c, lave, [1, 2, 3], t);
    expect(expireCases(c, t + ADRIFT_HOLD, () => false)).toHaveLength(0); // still holding
    expect(expireCases(c, t + ADRIFT_HOLD + ADRIFT_FALL + 1, () => false)[0]).toMatch(/failed/);
    expect(c.contracts).toHaveLength(0);
    expect(standing(c, 'hexon')).toBeLessThan(6);
  });

  it('rivals will buy what the owner is carrying, and the owner finds out', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    const t = waitingTime(c.name);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    take(c, offer, 20);
    const vorgWorld = Array.from({ length: 256 }, (_, i) => systemAt(0, i)).find((s) => s.government === 0)!;
    const credits = c.credits;
    expect(sellToRival(c, offer.id, vorgWorld)).toMatch(/Vorg/);
    expect(c.credits).toBe(credits + rivalPrice(offer));
    expect(standing(c, 'hexon')).toBe(-4);
    expect(standing(c, 'vorg')).toBe(3);
  });

  it('lost at the station mouth, the station crew picks it up, for a fee', () => {
    const c = newCommander('modern');
    c.standing = { hexon: 6 };
    c.credits = 1000;
    const t = waitingTime(c.name);
    const offer = assignmentFor(c, 'hexon', lave, t)!;
    take(c, offer, 20);
    const [k] = setAdrift(c, lave, [0, 0, 0], t, true);
    expect(k.held).toBe(true);
    expect(expireCases(c, t + 10 * ADRIFT_HOLD, () => false)).toHaveLength(0); // the crew keeps it safe
    expect(collectHeld(c, systemAt(0, 8))).toHaveLength(0); // only at that station
    expect(collectHeld(c, lave)[0]).toMatch(/station crew/);
    expect(c.credits).toBe(1000 - Math.round(offer.pay / 10));
    expect(c.contracts![0].adrift).toBe(false);
  });
});

