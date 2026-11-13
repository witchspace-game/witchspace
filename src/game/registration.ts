// Registering your ship (Mark, 9 November 2026; docs/design/shared-space.md, step 4a; the server's side is
// server/src/registry.ts). Mark's answers, 13 November 2026: the game invites a commander to register at their
// first purchase (kit or a ship) or at Mostly Harmless, whichever comes first; it's free; solo play stays open
// whether they register or not; shared space needs it.

import { hullOf, type Commander } from './commander';
import { ratingPoints } from './rating';

/** The stamp, as the server gave it back: kept in the save to show on her papers. */
export interface Registered {
  number: string;
  at: number;
  galaxy: number;
  system: number;
  /** She was a basic Cobra when she was registered. */
  basic: boolean;
}

/** Kit that's yours, not bought for the ship: it doesn't count as a first purchase. */
const PAPERS = new Set(['transponder', 'weapons-licence']);

/** Whether the invitation is due: Modern, not registered, and a first purchase made or Mostly Harmless reached. */
export function inviteDue(c: Commander): boolean {
  if (c.difficulty !== 'modern' || c.registered) return false;
  const bought = c.equipment.some((id) => !PAPERS.has(id)) || hullOf(c) !== 'cobra-mk3' || Boolean(c.order) || (c.lasers.front ?? 'pulse') !== 'pulse' || Boolean(c.lasers.rear || c.lasers.left || c.lasers.right);
  return bought || c.kills >= ratingPoints('Mostly Harmless');
}

/** Take the server's stamp: her number is the registry's from now on. */
export function takeRegistration(c: Commander, r: Registered) {
  c.registered = { number: r.number, at: r.at, galaxy: r.galaxy, system: r.system, basic: r.basic };
  c.shipNumber = r.number;
}
