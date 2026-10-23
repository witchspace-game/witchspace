// First discoveries (server/src/firsts.ts): who has been claiming most this
// week, and wiping one commander's claims if they cheated. Their finds go back
// to being unclaimed, for whoever brings them home next.
//
//   npx tsx tools/firsts.ts list
//   npx tsx tools/firsts.ts wipe "Callsign"
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

const [command, callsign] = args;
if (command === 'list') {
  const { top, total } = (await call('/admin/firsts')) as { top: { callsign: string; email: string; week: number; day: number; last: number }[]; total: number };
  console.log(`${total} firsts on the galaxy. Most claimed this week:`);
  if (!top.length) console.log('  none');
  for (const r of top) console.log(`  ${String(r.callsign).padEnd(16)} ${String(r.week).padStart(4)} this week · ${String(r.day).padStart(3)} today · last ${new Date(r.last).toISOString().slice(0, 16).replace('T', ' ')} · ${r.email}`);
} else if (command === 'wipe' && callsign) {
  const r = await call('/admin/firsts/wipe', { callsign });
  console.log(`Wiped ${r.wiped} firsts from CMDR ${r.callsign}.`);
} else {
  console.log('Usage: npx tsx tools/firsts.ts list | wipe "<callsign>"   [--local]');
}
