import { systemAt, type StarSystem } from '../galaxy/generate';
import { contrabandAt, stolenAt } from '../economy/legality';
import { EQUIPMENT, removeStolen, tidyStolen, type Commander, type EquipmentId, type LegalStatus } from './commander';

// The law, as set out in docs/design/law-and-travel.md:
// - ordinary crimes are local: your record belongs to the system where it happened;
// - serious crimes (Modern rules) also raise a Co-operative Marshals warrant that
//   follows you into every system with a government;
// - records cool as you travel; surrender always works, and always hurts.

const RANK: Record<LegalStatus, number> = { clean: 0, offender: 1, fugitive: 2 };

export const systemKey = (s: { galaxy: number; index: number }) => `${s.galaxy}:${s.index}`;

const here = (c: Commander) => systemAt(c.location.galaxy, c.location.system);

/** Anarchies have no law at all; nobody checks and nobody protects you. */
export const hasLaw = (s: StarSystem) => s.government > 0;

/** Feudal worlds and anarchies don't check who's docking. */
export const checksClearance = (s: StarSystem) => s.government >= 2;

/** Police scan passing ships for contraband everywhere but anarchies and feudal worlds. */
export const scansCargo = (s: StarSystem) => s.government >= 2;

/** Your standing in a system: its local record, or a Marshals warrant if you carry one. */
export function legalStatus(c: Commander, system: StarSystem = here(c)): LegalStatus {
  if (!hasLaw(system)) return 'clean';
  if (c.warrant) return 'fugitive';
  return c.records[systemKey(system)]?.status ?? 'clean';
}

/** Record a crime in the current system. Records only ever get worse this way. */
export function recordCrime(c: Commander, status: Exclude<LegalStatus, 'clean'>, serious = false) {
  if (!hasLaw(here(c))) return;
  const key = systemKey(here(c));
  const old = c.records[key]?.status ?? 'clean';
  if (RANK[status] > RANK[old]) c.records[key] = { status, jumps: 0 };
  if (serious && c.difficulty === 'modern') c.warrant = true;
}

export function clearRecord(c: Commander, system: StarSystem = here(c)) {
  delete c.records[systemKey(system)];
}

/** Jumps away before a record cools by one step. */
export const COOL_JUMPS: Record<Exclude<LegalStatus, 'clean'>, number> = { offender: 2, fugitive: 6 };

/** After a hyperspace jump: records in the systems you've left cool a little. */
export function coolRecords(c: Commander) {
  const current = systemKey(here(c));
  for (const [key, rec] of Object.entries(c.records)) {
    if (key === current) continue;
    rec.jumps += 1;
    if (rec.status !== 'clean' && rec.jumps >= COOL_JUMPS[rec.status]) {
      if (rec.status === 'fugitive') c.records[key] = { status: 'offender', jumps: 0 };
      else delete c.records[key];
    }
  }
}

export const FINES = { offender: 100, fugitive: 500, warrant: 1000 };

const contraband = (c: Commander, system: StarSystem = here(c)) => contrabandAt(c, system);

/** Anything the police would object to: contraband, or stolen goods. */
export const carriesContraband = (c: Commander, system: StarSystem = here(c)) => contraband(c, system).length > 0 || stolenAt(c, system).length > 0;


export interface Settlement {
  fine: number;
  paid: number;
  confiscated: string[];
  impounded: EquipmentId[];
  owed: number;
}

/**
 * Settle your account with the law in the current system: pay the fine, lose
 * the contraband and get a clean record here (and lose any warrant). Being
 * caught (disabled by police, a later stage) costs more. If you
 * can't pay, your equipment is impounded at this station until you do.
 */
export function settle(c: Commander, caught = false): Settlement {
  const status = legalStatus(c);
  let fine = status === 'clean' ? 0 : FINES[status];
  if (c.warrant) fine += FINES.warrant;
  if (caught) fine = Math.round(fine * 1.5); // handing yourself in is treated more leniently

  const confiscated = contraband(c);
  for (const id of confiscated) delete c.cargo[id];
  // Stolen goods go back to their owners; the rest of the hold stays yours.
  for (const id of stolenAt(c, here(c))) {
    removeStolen(c, id, Infinity);
    if (!confiscated.includes(id)) confiscated.push(id);
  }
  tidyStolen(c);
  if (confiscated.length && status === 'clean') fine = FINES.offender; // caught at inspection

  const { paid, owed, impounded } = charge(c, fine);
  clearRecord(c);
  c.warrant = false;
  return { fine, paid, confiscated, impounded, owed };
}

/** Take what you can pay; if it isn't enough, your equipment is impounded here until you pay the rest. */
export function charge(c: Commander, amount: number): { paid: number; owed: number; impounded: EquipmentId[] } {
  const paid = Math.min(amount, c.credits);
  c.credits = Math.round((c.credits - paid) * 10) / 10;
  const owed = Math.round((amount - paid) * 10) / 10;
  let impounded: EquipmentId[] = [];
  if (owed > 0) {
    impounded = [...c.equipment];
    c.equipment = [];
    c.damaged = [];
    const prev = c.impound && c.impound.at === systemKey(here(c)) ? c.impound : null;
    c.impound = { at: systemKey(here(c)), items: [...(prev?.items ?? []), ...impounded], owed: owed + (prev?.owed ?? 0) };
  }
  return { paid, owed, impounded };
}

/** Pay off an impound at the station holding it and get your equipment back. */
export function redeemImpound(c: Commander): boolean {
  const imp = c.impound;
  if (!imp || imp.at !== systemKey(here(c)) || c.credits < imp.owed) return false;
  c.credits = Math.round((c.credits - imp.owed) * 10) / 10;
  for (const id of imp.items) if (!c.equipment.includes(id)) c.equipment.push(id);
  c.impound = null;
  return true;
}

/** Equipment for sale here: high-tech gear needs a high-tech world. */
export function equipmentForSale(c: Commander, s: StarSystem) {
  return EQUIPMENT.filter(
    (e) => !(e.classicOnly && c.difficulty !== 'classic') && !(e.modernOnly && c.difficulty !== 'modern') && s.techLevel >= e.minTech,
  );
}
