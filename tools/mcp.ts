// The Witchspace MCP server, run locally over stdio, for people working in the
// repo (docs/design/mcp-server.md). The same tools as the hosted one at
// https://space.witchspace.org.uk/mcp, reading the files straight from here,
// so a ship you're editing can be checked before it's committed.
//
//   claude mcp add witchspace -- npx tsx tools/mcp.ts

import { createInterface } from 'node:readline';
import { handle, type Message } from '../src/mcp/protocol';
import type { McpData } from '../src/mcp/tools';
import { compileSchemaCheck, loadMcpData } from './mcp-data';

const loaded = loadMcpData();
const data: McpData = { ...loaded, checkSchema: compileSchemaCheck(loaded.texts.schema) };

const out = (v: unknown) => process.stdout.write(JSON.stringify(v) + '\n');

createInterface({ input: process.stdin }).on('line', async (line) => {
  if (!line.trim()) return;
  let msg: Message | Message[];
  try {
    msg = JSON.parse(line);
  } catch {
    return out({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } });
  }
  for (const m of Array.isArray(msg) ? msg : [msg]) {
    const reply = await handle(m, data, 'local');
    if (reply) out(reply);
  }
});
