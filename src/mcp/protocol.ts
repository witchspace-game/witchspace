// MCP over JSON-RPC: the messages an assistant sends, answered from TOOLS and
// RESOURCES. Transport-free, so the Worker (streamable HTTP) and the local
// server (stdio) share it. Stateless: no sessions, nothing remembered.

import { RESOURCES, TOOLS, type McpData } from './tools';

export const VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = `Witchspace is a free, open-source browser tribute to Elite (1984): trade, fight, explore and build in eight galaxies of glowing vector space (https://witchspace.org.uk). These tools help you contribute well.

Before writing content, read witchspace://agents (the rules for AI assistants) and, for writing, the worldbuilding guide. For a ship: start from a real one (list_ships, get_ship), keep it original (evoke an idea, never trace an on-screen design), give it a maker and a reason to exist, then run validate_ship and preview_ship and fix what they find, and balance_check it against the fleet. The person you're helping is the author; mark contributions as AI-assisted.

designs and help_wanted show what's being built and what help is wanted, most of it needing no code. galaxy_system puts stories somewhere real. Nothing here changes anything: to submit, see https://witchspace.org.uk/get-involved/.`;

export interface Message {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
}

type Reply = { jsonrpc: '2.0'; id: string | number | null; result?: unknown; error?: { code: number; message: string } };

const ok = (id: Message['id'], result: unknown): Reply => ({ jsonrpc: '2.0', id: id ?? null, result });
const fail = (id: Message['id'], code: number, message: string): Reply => ({ jsonrpc: '2.0', id: id ?? null, error: { code, message } });

/** Answer one message. Notifications (no id) get no reply: null. */
export async function handle(msg: Message, data: McpData, version: string): Promise<Reply | null> {
  if (!msg || typeof msg !== 'object' || typeof msg.method !== 'string') return fail(msg?.id, -32600, 'Invalid request');
  const isNotification = msg.id === undefined;
  const p = msg.params ?? {};
  try {
    switch (msg.method) {
      case 'initialize': {
        const asked = typeof p.protocolVersion === 'string' ? p.protocolVersion : VERSIONS[0];
        return ok(msg.id, {
          protocolVersion: VERSIONS.includes(asked) ? asked : VERSIONS[0],
          capabilities: { tools: {}, resources: {} },
          serverInfo: { name: 'witchspace', title: 'Witchspace', version },
          instructions: INSTRUCTIONS,
        });
      }
      case 'ping':
        return isNotification ? null : ok(msg.id, {});
      case 'tools/list':
        return ok(msg.id, { tools: TOOLS.map(({ name, title, description, inputSchema }) => ({ name, title, description, inputSchema, annotations: { readOnlyHint: true, openWorldHint: false } })) });
      case 'tools/call': {
        const tool = TOOLS.find((t) => t.name === p.name);
        if (!tool) return fail(msg.id, -32602, `Unknown tool: ${String(p.name)}`);
        const args = p.arguments && typeof p.arguments === 'object' ? (p.arguments as Record<string, unknown>) : {};
        try {
          return ok(msg.id, await tool.run(args, data));
        } catch (e) {
          // A tool that throws is reported as a tool error, so the assistant can see it and try again.
          return ok(msg.id, { content: [{ type: 'text', text: `That didn't work: ${(e as Error).message}` }], isError: true });
        }
      }
      case 'resources/list':
        return ok(msg.id, { resources: RESOURCES.map(({ uri, name, title, mimeType }) => ({ uri, name, title, mimeType })) });
      case 'resources/read': {
        const r = RESOURCES.find((x) => x.uri === p.uri);
        if (!r) return fail(msg.id, -32002, `Unknown resource: ${String(p.uri)}`);
        return ok(msg.id, { contents: [{ uri: r.uri, mimeType: r.mimeType, text: r.read(data) }] });
      }
      case 'prompts/list':
        return ok(msg.id, { prompts: [] });
      default:
        if (isNotification) return null; // notifications/initialized and the like
        return fail(msg.id, -32601, `Unknown method: ${msg.method}`);
    }
  } catch (e) {
    return fail(msg.id, -32603, (e as Error).message);
  }
}
