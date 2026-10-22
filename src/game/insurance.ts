import { EQUIPMENT, FUEL_CAPACITY, MISSILE_PRICE, STAKE, newCommander, removeEquipment, type Commander } from './commander';
import { legalStatus, spareCredits } from './law';
import { PLAYER_LASERS } from './weapons';

// Losing your ship under Modern rules, as set out in docs/design/law-and-travel.md
// (section 7). The insurers replace the ship and its kit, less an excess, but
// they won't pay for a Fugitive: then the Co-operative issues a bare Cobra.
// Either way the police still know who you are, so your record stands.
// An escape pod gets you out alive, so even a Fugitive keeps the ship's kit.
// The new ship comes with a full tank, and you never wake up poorer than a
// new commander (STAKE): losing the hold hurts enough to start again from.
// Whatever part of the excess you can't pay is written off.

export const EXCESS = { fraction: 0.1, minimum: 250 };

/** What the fitted kit would cost new: equipment, lasers and missiles. */
export function kitValue(c: Commander) {
  const equipment = c.equipment.reduce((sum, id) => sum + (EQUIPMENT.find((e) => e.id === id)?.price ?? 0), 0);
  const lasers = Object.values(c.lasers).reduce((sum, id) => sum + (id ? PLAYER_LASERS[id].price : 0), 0);
  return equipment + lasers + c.missiles * MISSILE_PRICE;
}

export const excessFor = (c: Commander) => Math.max(EXCESS.minimum, Math.round(kitValue(c) * EXCESS.fraction));

export type Claim =
  | { kind: 'paid'; pod: boolean; excess: number; paid: number }
  | { kind: 'void'; stake: number };

/** Settle the loss of the ship (Modern rules). Call once the cargo has spilled. */
export function claimInsurance(c: Commander): Claim {
  const pod = c.equipment.includes('escape-pod');
  c.fuel = FUEL_CAPACITY;
  if (legalStatus(c) === 'fugitive' && !pod) {
    const bare = newCommander(c.difficulty);
    c.equipment = [];
    c.damaged = [];
    c.lasers = bare.lasers;
    c.missiles = bare.missiles;
    // The Co-operative won't leave anyone stranded: enough to start again.
    const stake = Math.max(0, STAKE - c.credits);
    c.credits += stake;
    return { kind: 'void', stake };
  }
  if (pod) removeEquipment(c, 'escape-pod');
  // Kit that was already broken comes back broken: the insurers replace the
  // ship, not the wear and tear.
  const excess = excessFor(c);
  const paid = Math.min(excess, spareCredits(c));
  c.credits = Math.round((c.credits - paid) * 10) / 10;
  return { kind: 'paid', pod, excess, paid };
}
