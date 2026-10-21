// Reserved callsigns (server/src/names.ts): see them, and release a protected
// one to the right person.
//
//   npx tsx tools/names.ts list
//   npx tsx tools/names.ts release "Witchspace" someone@example.com
//   npx tsx tools/names.ts revoke "Witchspace"
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

const [command, name, email] = args;
if (command === 'list') {
  const { rules, releases } = (await call('/admin/names')) as {
    rules: { name: string; rule: string; within?: boolean; why: string }[];
    releases: { name: string; email: string; created: number }[];
  };
  for (const kind of ['never', 'protected']) {
    console.log(kind === 'never' ? '\nNever usable' : '\nProtected (can be released)');
    for (const r of rules.filter((r) => r.rule === kind)) console.log(`  ${r.name.padEnd(14)}${r.within ? ' (and inside longer names)' : ''} · ${r.why}`);
  }
  console.log('\nReleased');
  if (!releases.length) console.log('  none yet');
  for (const r of releases) console.log(`  ${r.name.padEnd(14)} → ${r.email} (${new Date(r.created).toISOString().slice(0, 10)})`);
} else if (command === 'release' && name && email) {
  const r = await call('/admin/names/release', { name, email });
  console.log(`Released ${r.released} to ${r.to}: they can now claim it when signed in.`);
} else if (command === 'revoke' && name) {
  const r = await call('/admin/names/revoke', { name });
  console.log(`Revoked ${r.revoked}${r.freed ? ': its holder will be asked for a new callsign' : ''}.`);
} else {
  console.log('Usage: npx tsx tools/names.ts list | release "<name>" <email> | revoke "<name>"   [--local]');
}
