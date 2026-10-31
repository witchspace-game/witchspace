// The hosted Witchspace MCP server (docs/design/mcp-server.md): POST /mcp,
// MCP's streamable HTTP transport answered with plain JSON, stateless and
// read-only. Add https://space.witchspace.org.uk/mcp to Claude, ChatGPT or
// Cursor as a connector. The tools are shared with the local server in
// src/mcp; the data is bundled by tools/mcp-data.ts before deploying.

import { handle, type Extra, type Message } from '../../src/mcp/protocol';
import type { McpData } from '../../src/mcp/tools';
import bundle from './mcp-data.json';
// Compiled from the ship schema by tools/mcp-data.ts (Workers can't compile it at run time).
// @ts-expect-error: generated JavaScript, no types
import checkShip from './mcp-schema.js';
// @ts-expect-error: generated JavaScript, no types
import checkModule from './module-schema.js';

const VERSION = '1';
const MAX_BODY = 512 * 1024; // a ship file is a few KB; this is plenty
const PER_MINUTE = 120;

type AjvError = { instancePath?: string; message?: string; params?: Record<string, unknown> };
/** A compiled schema check's errors, as plain sentences an assistant (or a person) can act on. */
export function schemaErrors(check: (v: unknown) => boolean, value: unknown, what: string): string[] {
  if (check(value)) return [];
  return ((check as { errors?: AjvError[] }).errors ?? []).map((e) => {
    const extra = e.params?.additionalProperty ? ` ("${e.params.additionalProperty}")` : e.params?.allowedValues ? ` (one of: ${(e.params.allowedValues as string[]).join(', ')})` : '';
    return `${e.instancePath || `(the ${what})`} ${e.message ?? 'is invalid'}${extra}`;
  });
}

export const data: McpData = {
  ...(bundle as unknown as Omit<McpData, 'checkSchema' | 'checkModuleSchema'>),
  checkSchema: (ship) => schemaErrors(checkShip, ship, 'ship'),
  checkModuleSchema: (m) => schemaErrors(checkModule, m, 'module'),
};

// A rough per-address limit, per Worker instance: enough to stop a runaway loop.
const recent = new Map<string, { minute: number; count: number }>();
function limited(ip: string): boolean {
  const minute = Math.floor(Date.now() / 60000);
  const r = recent.get(ip);
  if (!r || r.minute !== minute) {
    if (recent.size > 5000) recent.clear();
    recent.set(ip, { minute, count: 1 });
    return false;
  }
  return ++r.count > PER_MINUTE;
}

// Anyone may call it, from anywhere: it's public and read-only.
export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Accept, Mcp-Protocol-Version, Mcp-Session-Id, Authorization',
  'Access-Control-Expose-Headers': 'Mcp-Protocol-Version, WWW-Authenticate',
};

const reply = (body: unknown, status = 200) => new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...CORS, ...(body === null ? {} : { 'Content-Type': 'application/json' }) } });

/** POST /mcp (public), and /mcp/build with the signed-in tools as `extra` (index.ts checks the token first). */
export async function mcp(request: Request, extra?: Extra): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
  if (request.method === 'GET') {
    // No server-to-client stream: everything is a plain answer to a POST. A browser gets a pointer.
    if ((request.headers.get('Accept') ?? '').includes('text/html')) return Response.redirect('https://witchspace.org.uk/design/mcp-server/', 302);
    return new Response('Use POST: this MCP server answers JSON-RPC over HTTP.', { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } });
  }
  if (request.method === 'DELETE') return new Response(null, { status: 405, headers: { ...CORS, Allow: 'POST, OPTIONS' } });
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });
  if (limited(request.headers.get('CF-Connecting-IP') ?? 'unknown')) return reply({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'Too many requests: try again in a minute.' } }, 429);
  const text = await request.text();
  if (text.length > MAX_BODY) return reply({ jsonrpc: '2.0', id: null, error: { code: -32600, message: 'Request too large.' } }, 413);
  let msg: Message | Message[];
  try {
    msg = JSON.parse(text);
  } catch {
    return reply({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } }, 400);
  }
  const replies = (await Promise.all((Array.isArray(msg) ? msg : [msg]).map((m) => handle(m, data, VERSION, extra)))).filter((r) => r !== null);
  // Only notifications: accepted, nothing to say.
  if (!replies.length) return new Response(null, { status: 202, headers: CORS });
  return reply(Array.isArray(msg) ? replies : replies[0]);
}
