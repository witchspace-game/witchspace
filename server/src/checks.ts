// The game's own checks, as the Worker runs them, for submissions (submissions.ts):
// the MCP server's validate_ship for a ship; for a module, its schema (compiled by
// tools/mcp-data.ts) and the coupling standard from src/content/modules.ts.

import { balanceCheck, validateShip } from '../../src/mcp/tools';
import { NOT_FLOWN } from '../../src/content/slot';
import type { ModuleDef, ShipDef } from '../../src/content/types';
import { moduleCheck } from '../../src/content/modules';
import { data } from './mcp';
import type { Checks } from './submissions';

const modules = new Map<string, ModuleDef>(data.modules.map((m) => [m.id, m]));

export const CHECKS: Checks = {
  ship: (ship: ShipDef) => {
    const { errors, warnings } = validateShip(ship, data);
    // The MCP server's balance_check, as notes: what stands out against the fleet (never a reason to refuse).
    const balance = errors.length || NOT_FLOWN.has(ship.role) ? [] : balanceCheck(ship, data).notes.filter((n) => !n.startsWith('Nothing stands out')).map((n) => `balance: ${n}`);
    return { errors, warnings: [...warnings, ...balance] };
  },
  module: moduleCheck(data.checkModuleSchema, modules),
  ships: new Map(data.ships.map((s) => [s.id, s])),
  modules,
};
