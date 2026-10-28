// The numbered editions and the ledger checks (server/src/ledger.ts): who holds
// which number, putting one back, and the accounts whose ledgers didn't add up.
//
//   npx tsx tools/editions.ts list
//   npx tsx tools/editions.ts revoke witch-fire 37
//   npx tsx tools/editions.ts flagged
//   npx tsx tools/editions.ts clear <callsign>     (after looking: lets them reserve again)
//
// Add --local to talk to `wrangler dev` instead of the live server. The admin
// key comes from WITCHSPACE_ADMIN_KEY or ~/.witchspace-admin-key.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

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

const [command, a, b] = args;
if (command === 'list') {
  const r = (await call('/admin/editions')) as { holders: { edition: string; number: number; at: number; callsign: string | null; email: string | null; flags: string[] }[] };
  for (const h of r.holders) console.log(`${h.edition.padEnd(11)} ${String(h.number).padStart(3, '0')}  ${new Date(h.at).toISOString().slice(0, 10)}  ${h.callsign ?? '(held for a voucher)'}${h.email ? ` <${h.email}>` : ''}${h.flags.length ? `  ⚠ ${h.flags.join('; ')}` : ''}`);
  if (!r.holders.length) console.log('No numbers taken yet.');
} else if (command === 'revoke' && a && b) {
  const r = await call('/admin/editions/revoke', { edition: a, number: Number(b) });
  console.log(r.revoked ? `Revoked ${a} ${String(b).padStart(3, '0')}: it's free for the next pilot.` : 'No such number held.');
} else if (command === 'flagged') {
  const r = (await call('/admin/ledger')) as { flagged: { callsign: string | null; email: string | null; flags: string[] }[] };
  for (const f of r.flagged) console.log(`${f.callsign ?? '(no callsign)'} <${f.email}>\n  ${f.flags.join('\n  ')}`);
  if (!r.flagged.length) console.log('Every ledger checked is in good order.');
} else if (command === 'clear' && a) {
  await call('/admin/ledger/clear', { callsign: a });
  console.log(`Cleared ${a}'s flags.`);
} else {
  console.log('Usage: npx tsx tools/editions.ts list | revoke <edition> <number> | flagged | clear <callsign>   [--local]');
}
