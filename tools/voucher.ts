// Gift vouchers for a ship (server/src/accounts.ts): make one, and see which
// have been used. The code is shown once, when it's made; only its hash is kept.
// The holder redeems it at any shipyard (signed in) and specs the hull in the
// included colours, with their name on it: upgrades are theirs to earn.
//
//   npx tsx tools/voucher.ts make fer-de-lance "Mark Moxon, with thanks"
//   npx tsx tools/voucher.ts list
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

const [command, ship, note] = args;
if (command === 'make' && ship) {
  const r = await call('/admin/vouchers', { ship, note: note ?? '' });
  console.log(`Voucher for a ${r.ship}: ${r.code}\nRedeem it at any shipyard in the game, signed in. It works once; this is the only time it's shown.`);
} else if (command === 'list') {
  const r = (await call('/admin/vouchers')) as { vouchers: { ship: string; note: string; created: number; used: number; redeemed: number | null }[] };
  for (const v of r.vouchers) console.log(`${new Date(v.created).toISOString().slice(0, 10)}  ${v.ship.padEnd(14)} ${v.used ? `used ${new Date(v.redeemed!).toISOString().slice(0, 10)}` : 'unused'}  ${v.note}`);
  if (!r.vouchers.length) console.log('No vouchers yet.');
} else {
  console.log('Usage: npx tsx tools/voucher.ts make <ship id> "<note>" | list   [--local]');
}
