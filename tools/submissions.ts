// The review queue (docs/design/submissions.md): ships and modules handed in
// from the site or an AI assistant. See what's waiting, read one, and accept it
// (which opens the pull request) or send it back with notes.
//
//   npx tsx tools/submissions.ts list [status]        waiting, or: changes, accepted, withdrawn
//   npx tsx tools/submissions.ts show <id>            the details, the checks' warnings, and the file
//   npx tsx tools/submissions.ts save <id>            write the file to content/, to fly it before deciding
//   npx tsx tools/submissions.ts accept <id> ["notes"]
//   npx tsx tools/submissions.ts changes <id> "what to change"
//
// Add --local to talk to `wrangler dev` instead of the live server. The admin
// key comes from WITCHSPACE_ADMIN_KEY or ~/.witchspace-admin-key.

import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

const args = process.argv.slice(2).filter((a) => a !== '--local');
const local = process.argv.includes('--local');
const API = local ? 'http://127.0.0.1:8787' : 'https://space.witchspace.org.uk';
const ORIGIN = local ? 'http://localhost:5173' : 'https://witchspace.org.uk';

function adminKey(): string {
  if (process.env.WITCHSPACE_ADMIN_KEY) return process.env.WITCHSPACE_ADMIN_KEY;
  try {
    return readFileSync(join(homedir(), '.witchspace-admin-key'), 'utf8').trim();
  } catch {
    console.error('No admin key: set WITCHSPACE_ADMIN_KEY or put it in ~/.witchspace-admin-key');
    process.exit(1);
  }
}

interface Submission {
  id: string;
  kind: 'ship' | 'module';
  itemId: string;
  title: string;
  revises: boolean;
  status: string;
  note: string;
  ai: boolean;
  via: string;
  review: string | null;
  pr: string | null;
  version: number;
  created: number;
  updated: number;
  warnings: string[];
  file?: object;
  callsign: string;
}

async function call(path: string, body?: unknown) {
  const res = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', 'X-Admin-Key': adminKey(), Origin: ORIGIN },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    console.error(data.error ?? `${res.status} ${res.statusText}`);
    process.exit(1);
  }
  return data;
}

const day = (t: number) => new Date(t).toISOString().slice(0, 16).replace('T', ' ');
const line = (s: Submission) => `${s.id}  ${s.kind.padEnd(6)} ${s.title} (${s.itemId})${s.revises ? ', an improvement' : ''} · CMDR ${s.callsign} · v${s.version} · ${day(s.updated)}${s.ai ? ' · AI-assisted' : ''}`;

const [command, id, notes] = args;
if (command === 'list') {
  const status = id ?? 'submitted';
  const { submissions } = (await call(`/submissions?status=${encodeURIComponent(status)}`)) as { submissions: Submission[] };
  if (!submissions.length) console.log(`Nothing ${status === 'submitted' ? 'waiting' : status}.`);
  for (const s of submissions) console.log(line(s));
} else if (command === 'show' && id) {
  const { submission: s } = (await call(`/submissions/${id}`)) as { submission: Submission };
  console.log(line(s));
  console.log(`Status: ${s.status}, sent from ${s.via}${s.pr ? `\nPull request: ${s.pr}` : ''}`);
  if (s.note) console.log(`\nTheir note:\n${s.note}`);
  if (s.review) console.log(`\nReview notes:\n${s.review}`);
  if (s.warnings.length) console.log(`\nThe checks noticed:\n${s.warnings.map((w) => `  - ${w}`).join('\n')}`);
  console.log(`\n${JSON.stringify(s.file, null, 2)}`);
} else if (command === 'save' && id) {
  const { submission: s } = (await call(`/submissions/${id}`)) as { submission: Submission };
  const path = resolve(import.meta.dirname, '..', `content/${s.kind === 'ship' ? 'ships' : 'modules'}/${s.itemId}.json`);
  writeFileSync(path, `${JSON.stringify({ $schema: `../../schemas/${s.kind}.schema.json`, ...s.file }, null, 2)}\n`);
  console.log(`Wrote ${path}: try it in the game (npm run dev). Don't commit it: accepting opens the pull request.`);
} else if (command === 'accept' && id) {
  const { submission: s } = (await call(`/submissions/${id}/review`, { decision: 'accept', notes })) as { submission: Submission };
  console.log(s.pr ? `Accepted: ${s.pr}` : 'Accepted. No GitHub App yet, so open the pull request by hand (save it, then commit it crediting the callsign).');
} else if (command === 'changes' && id && notes) {
  await call(`/submissions/${id}/review`, { decision: 'changes', notes });
  console.log('Sent back with your notes. They can revise it, and it comes back to the queue.');
} else {
  console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').filter((l) => l.startsWith('//')).map((l) => l.slice(3)).join('\n'));
}
