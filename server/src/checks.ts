// The game's own checks, as the Worker runs them, for submissions (submissions.ts):
// the MCP server's validate_ship for a ship; for a module, its schema (compiled by
// tools/mcp-data.ts) and the coupling standard from src/content/modules.ts.

import { validateShip } from '../../src/mcp/tools';
import { checkModule, checkService } from '../../src/content/modules';
import type { ModuleDef, ShipDef } from '../../src/content/types';
import { data, schemaErrors } from './mcp';
import bundle from './mcp-data.json';
import type { Checks } from './submissions';
// @ts-expect-error: generated JavaScript, no types
import checkModuleSchema from './module-schema.js';

const modules = new Map((bundle as unknown as { modules: ModuleDef[] }).modules.map((m) => [m.id, m]));

export const CHECKS: Checks = {
  ship: (ship: ShipDef) => {
    const { errors, warnings } = validateShip(ship, data);
    return { errors, warnings };
  },
  module: (m: ModuleDef) => {
    const schema = schemaErrors(checkModuleSchema, m, 'module').map((e) => `schema: ${e}`);
    if (schema.length) return { errors: schema, warnings: [] };
    const { errors, warnings } = checkModule(m);
    return { errors: [...errors, ...checkService(m, new Map([...modules, [m.id, m]]))], warnings };
  },
  ships: new Map(data.ships.map((s) => [s.id, s])),
  modules,
};
