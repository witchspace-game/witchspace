// The docking slot, and whether a ship fits it. Pure, so the game, the MCP
// server, the submission checks and CI's validator all use the same rule.

import type { ShipDef } from './types';

/** Docking slot on the station's +Z face, in station-local metres: 90 m wide, 26 m tall. */
export const SLOT = { z: 80, halfW: 45, halfH: 13 };

/** Roles that never fly under their own power, so never dock. */
export const NOT_FLOWN = new Set(['station', 'missile', 'cargo', 'debris']);

/**
 * Why a ship can't dock, or null. A ship that flies must fit the slot with its
 * wings level, unless its file says `docks: false` (a carrier, a yard hauler).
 */
export function slotProblem(ship: Pick<ShipDef, 'role' | 'docks' | 'geometry'>): string | null {
  if (NOT_FLOWN.has(ship.role) || ship.docks === false) return null;
  const v = ship.geometry?.vertices;
  if (!Array.isArray(v) || !v.length) return null;
  const halfW = Math.max(...v.map((p) => Math.abs(p[0])));
  const halfH = Math.max(...v.map((p) => Math.abs(p[1])));
  if (halfW < SLOT.halfW && halfH < SLOT.halfH) return null;
  const too = [halfW >= SLOT.halfW ? `${Math.round(halfW * 2)} m across` : '', halfH >= SLOT.halfH ? `${Math.round(halfH * 2)} m tall` : ''].filter(Boolean).join(' and ');
  return `at ${too} (from its centre) it can't fit the docking slot, ${SLOT.halfW * 2} m wide and ${SLOT.halfH * 2} m tall, wings level. Make it fit, or set "docks": false if it never docks (a carrier, a yard hauler)`;
}
