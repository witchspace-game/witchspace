// The game's own checks, as the Worker runs them, for submissions (submissions.ts):
// the MCP server's validate_ship for a ship; for a module, its schema (compiled by
// tools/mcp-data.ts) and the coupling standard from src/content/modules.ts.

import { validateShip } from '../../src/mcp/tools';
import type { ModuleDef, ShipDef } from '../../src/content/types';
import { data, schemaErrors } from './mcp';
import bundle from './mcp-data.json';
import { moduleCheck, type Checks } from './submissions';
// @ts-expect-error: generated JavaScript, no types
import checkModuleSchema from './module-schema.js';

const modules = new Map((bundle as unknown as { modules: ModuleDef[] }).modules.map((m) => [m.id, m]));

export const CHECKS: Checks = {
  ship: (ship: ShipDef) => {
    const { errors, warnings } = validateShip(ship, data);
    return { errors, warnings };
  },
  module: moduleCheck((m) => schemaErrors(checkModuleSchema, m, 'module'), modules),
  ships: new Map(data.ships.map((s) => [s.id, s])),
  modules,
};
