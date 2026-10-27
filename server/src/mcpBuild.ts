// The signed-in MCP address, /mcp/build (docs/design/mcp-server.md, "Signing in
// from an assistant"): the stage 1 tools, plus handing work in as the signed-in
// commander. Every write goes through the same submission routes as the site
// (accounts.ts), marked as from the connector and AI-assisted.

import type { Extra, ExtraTool } from '../../src/mcp/protocol';
import type { ToolResult } from '../../src/mcp/tools';

/** Calls a submission route as the signed-in account (Accounts.asAccount). */
export type AsAccount = (method: string, path: string, body?: unknown) => Promise<{ status: number; data: Record<string, unknown> }>;

interface Submission {
  id: string;
  kind: string;
  itemId: string;
  title: string;
  revises: boolean;
  status: string;
  note: string;
  review: string | null;
  pr: string | null;
  version: number;
  created: number;
  updated: number;
  warnings: string[];
  file?: object;
}

const text = (t: string, isError = false): ToolResult => ({ content: [{ type: 'text', text: t }], ...(isError ? { isError } : {}) });

const STATUS: Record<string, string> = {
  submitted: 'waiting for review',
  changes: 'sent back with notes: revise it and it goes back in the queue',
  accepted: 'accepted',
  withdrawn: 'withdrawn',
};

function describe(s: Submission): string {
  const lines = [`${s.title} (${s.kind} "${s.itemId}"${s.revises ? ', an improvement to one in the game' : ''}): ${STATUS[s.status] ?? s.status}. Submission ${s.id}, version ${s.version}.`];
  if (s.review) lines.push(`The reviewer's notes: ${s.review}`);
  if (s.pr) lines.push(`Pull request: ${s.pr}`);
  if (s.warnings.length) lines.push(`For the reviewer's attention (they don't stop it):\n${s.warnings.map((w) => `- ${w}`).join('\n')}`);
  return lines.join('\n');
}

/** An error from a route, readable: the checks' problems as a list. */
function failure(r: { status: number; data: Record<string, unknown> }): ToolResult {
  const problems = Array.isArray(r.data.problems) ? `\n${(r.data.problems as string[]).map((p) => `- ${p}`).join('\n')}` : '';
  return text(`${String(r.data.error ?? `That didn't work (${r.status})`)}${problems}`, true);
}

const ID = { type: 'string', description: 'The submission id, from submit or my_submissions (10 letters and digits).' };
const FILE = { description: 'The whole file: a JSON object following schemas/ship.schema.json or schemas/module.schema.json (or the same as text).', oneOf: [{ type: 'object' }, { type: 'string' }] };
const idOf = (args: Record<string, unknown>) => (typeof args.id === 'string' && /^[a-z0-9]{10}$/.test(args.id) ? args.id : null);

export function buildTools(as: AsAccount, callsign: string | null): Extra {
  const tools: ExtraTool[] = [
    {
      name: 'submit',
      title: 'Hand it in',
      description:
        'Hand in a ship or a Titanoboa module for review, credited to the signed-in commander and marked AI-assisted. Only when the person asks to hand it in, after they have seen it and it passes validate_ship (or, for a module, the coupling standard). It runs the same checks; a file that fails is not kept and the problems come back. Nothing is public until a maintainer accepts it; accepting opens a pull request, and an accepted module earns its designer a commission in the game.',
      inputSchema: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: ['ship', 'module'] },
          file: FILE,
          note: { type: 'string', description: 'A note to the reviewer, in the person\'s words: what it is for, what they want feedback on.' },
        },
        required: ['kind', 'file'],
      },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: async (args) => {
        const r = await as('POST', '/submissions', { kind: args.kind, file: args.file, note: args.note, ai: true, via: 'connector' });
        if (r.status !== 201) return failure(r);
        return text(`Handed in.\n${describe(r.data.submission as Submission)}\nFollow it with my_submissions. The person can also see it at https://witchspace.org.uk/submit/.`);
      },
    },
    {
      name: 'my_submissions',
      title: 'My submissions',
      description: 'Everything the signed-in commander has handed in, newest first, with each one\'s status and any reviewer\'s notes, and how many more they can send today.',
      inputSchema: { type: 'object', properties: {} },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async () => {
        const r = await as('GET', '/submissions/mine');
        if (r.status !== 200) return failure(r);
        const subs = r.data.submissions as Submission[];
        const l = r.data.limits as { today: number; perDay: number; waiting: number; maxWaiting: number };
        const head = `${l.perDay - l.today} of ${l.perDay} left today; ${l.waiting} of ${l.maxWaiting} waiting.`;
        return text(subs.length ? `${head}\n\n${subs.map(describe).join('\n\n')}` : `Nothing handed in yet. ${head}`);
      },
    },
    {
      name: 'submission',
      title: 'One submission',
      description: 'One of the signed-in commander\'s submissions in full: its status, the reviewer\'s notes and the file as stored (with the credit the server filled in). Use it before revising.',
      inputSchema: { type: 'object', properties: { id: ID }, required: ['id'] },
      annotations: { readOnlyHint: true, openWorldHint: false },
      run: async (args) => {
        const id = idOf(args);
        if (!id) return text('Pass the submission id.', true);
        const r = await as('GET', `/submissions/${id}`);
        if (r.status !== 200) return failure(r);
        const s = r.data.submission as Submission;
        return text(`${describe(s)}\n\nThe file:\n${JSON.stringify(s.file, null, 2)}`);
      },
    },
    {
      name: 'revise',
      title: 'Revise it',
      description: 'Send a new version of a submission that is waiting or was sent back (same id inside the file). The old version is kept; it goes back in the queue. Only when the person asks.',
      inputSchema: { type: 'object', properties: { id: ID, file: FILE, note: { type: 'string', description: 'What changed, for the reviewer.' } }, required: ['id', 'file'] },
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
      run: async (args) => {
        const id = idOf(args);
        if (!id) return text('Pass the submission id.', true);
        const r = await as('PUT', `/submissions/${id}`, { file: args.file, note: args.note, ai: true });
        if (r.status !== 200) return failure(r);
        return text(`Revised.\n${describe(r.data.submission as Submission)}`);
      },
    },
    {
      name: 'withdraw',
      title: 'Withdraw it',
      description: 'Withdraw a submission that is waiting or was sent back. It can\'t be undone (hand it in again instead). Only when the person asks.',
      inputSchema: { type: 'object', properties: { id: ID }, required: ['id'] },
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
      run: async (args) => {
        const id = idOf(args);
        if (!id) return text('Pass the submission id.', true);
        const r = await as('DELETE', `/submissions/${id}`);
        if (r.status !== 200) return failure(r);
        return text(`Withdrawn: ${(r.data.submission as Submission).title}.`);
      },
    },
  ];
  const who = callsign ? `CMDR ${callsign}` : 'a commander with no callsign yet (they must choose one in the game before handing anything in)';
  return {
    tools,
    instructions: `You are signed in as ${who}. When the person asks to hand their work in, use submit: it is credited to them and marked AI-assisted, and a maintainer reviews it before anything is public. Never submit without being asked. my_submissions shows how their work is getting on, and revise answers a reviewer's notes.`,
  };
}
