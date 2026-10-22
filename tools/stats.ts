// How Witchspace is played, in anonymous totals: devices a day by rules and
// look, new commanders by rules, and the rules of every cloud save.
//
//   npx tsx tools/stats.ts          (add --local for `wrangler dev`)
//
// The admin key comes from WITCHSPACE_ADMIN_KEY or ~/.witchspace-admin-key.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const local = process.argv.includes('--local');
const API = local ? 'http://127.0.0.1:8787' : 'https://space.witchspace.org.uk';
const key = process.env.WITCHSPACE_ADMIN_KEY ?? readFileSync(join(homedir(), '.witchspace-admin-key'), 'utf8').trim();

const res = await fetch(`${API}/admin/stats`, { headers: { 'X-Admin-Key': key, Origin: local ? 'http://localhost:5173' : 'https://witchspace.org.uk' } });
if (!res.ok) {
  console.error(`${res.status} ${await res.text()}`);
  process.exit(1);
}
const { days, saves, accounts } = (await res.json()) as { days: { day: string; key: string; n: number }[]; saves: Record<string, number>; accounts: number };

const totals: Record<string, number> = {};
for (const d of days) totals[d.key] = (totals[d.key] ?? 0) + d.n;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
const devices = totals.devices ?? 0;
const withRules = (totals['rules:modern'] ?? 0) + (totals['rules:classic'] ?? 0);

console.log('Last 30 days (device-days)');
console.log(`  devices            ${devices}`);
console.log(`  Classic commanders ${totals['rules:classic'] ?? 0} (${pct(totals['rules:classic'] ?? 0, withRules)} of those with a commander)`);
console.log(`  Modern commanders  ${totals['rules:modern'] ?? 0}`);
console.log(`  no commander yet   ${totals['rules:none'] ?? 0}`);
console.log(`  1984 look on       ${totals['look:1984'] ?? 0} (${pct(totals['look:1984'] ?? 0, devices)})`);
console.log(`  new commanders     Modern ${totals['new:modern'] ?? 0} · Classic ${totals['new:classic'] ?? 0}`);
console.log(`\nAccounts: ${accounts} · cloud saves by rules: ${Object.entries(saves).map(([k, v]) => `${k} ${v}`).join(' · ') || 'none'}`);
