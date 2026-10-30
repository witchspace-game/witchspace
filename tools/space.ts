// Shared space's budget and off switch (server/src/spaceBudget.ts), from the repo root:
//
//   npx tsx tools/space.ts              today's use, the budget, and whether it's on
//   npx tsx tools/space.ts budget 10    raise (or lower) the daily budget, in dollars
//   npx tsx tools/space.ts off          everyone flies solo (within a minute) until it's on again
//   npx tsx tools/space.ts on
//
// Add --local to talk to `wrangler dev` instead of the live server. The admin key comes from
// WITCHSPACE_ADMIN_KEY or ~/.witchspace-admin-key.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const local = argv.includes('--local');
const [command, value] = argv.filter((a) => !a.startsWith('--'));
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

const body = command === 'off' ? { off: true } : command === 'on' ? { off: false } : command === 'budget' ? { budget: Number(value) } : undefined;
if (command && !body) {
  console.error('Usage: npx tsx tools/space.ts [budget <dollars> | off | on] [--local]');
  process.exit(1);
}
const res = await fetch(`${API}/admin/space`, {
  method: body ? 'POST' : 'GET',
  headers: { 'X-Admin-Key': adminKey(), Origin: ORIGIN, 'Content-Type': 'application/json' },
  body: body ? JSON.stringify(body) : undefined,
});
const d = (await res.json()) as { error?: string; day?: string; off?: boolean; budget?: number; cost?: number; busyHours?: number; messages?: number };
if (!res.ok) {
  console.error(d.error ?? `HTTP ${res.status}`);
  process.exit(1);
}
console.log(`Shared space ${d.off ? 'OFF' : 'on'} · ${d.day} (UTC) · spent about $${(d.cost ?? 0).toFixed(2)} of $${d.budget} a day${d.busyHours !== undefined ? ` · ${d.busyHours} busy system-hours, ${d.messages} messages` : ''}`);
