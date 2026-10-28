// Gift vouchers for a ship (server/src/accounts.ts): make one, and see which
// have been used. The code is shown once, when it's made; only its hash is kept.
// The holder redeems it at any shipyard (signed in) and specs the hull in the
// included colours, with their name on it: upgrades are theirs to earn. With
// --edition, the voucher holds the edition's next number (001 first) and the
// gift wears that edition's look; the fit-out is still the plain one.
//
//   npx tsx tools/voucher.ts make fer-de-lance "Mark Moxon, with thanks"
//   npx tsx tools/voucher.ts make fer-de-lance "Mark Moxon, with thanks" --edition witch-fire
//   npx tsx tools/voucher.ts list
//
// Or sign a ship over to a commander's email address, waiting at one yard: no
// code. They're told in the game when they next play signed in (and by
// notification, if they've an account with notifications on). --number takes
// over the unused voucher holding that edition number, whose code stops working.
//
//   npx tsx tools/voucher.ts gift fer-de-lance <email> --edition witch-fire --at Onrira --callsign Moxon
//
// An edition signed over comes with the maker's letter (once) and her papers: a
// build certificate at a private link (docs/design/ships-and-classes.md). --quiet
// signs her over without the letter. `papers` shows a number's link, sets the
// callsign it's held for, sends the letter (again) or issues a new link:
//
//   npx tsx tools/voucher.ts papers witch-fire 1 [--callsign Moxon] [--send] [--reissue]
//
// Add --local to talk to `wrangler dev` instead of the live server. The admin
// key comes from WITCHSPACE_ADMIN_KEY or ~/.witchspace-admin-key.

import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const argv = process.argv.slice(2);
const flag = (name: string) => {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const edition = flag('--edition');
const number = flag('--number');
const yard = flag('--at');
const callsign = flag('--callsign');
const valued = new Set(['--edition', '--number', '--at', '--callsign']);
const quiet = argv.includes('--quiet');
// Positional arguments: not a flag, and not a flag's value.
const args = argv.filter((a, i) => !a.startsWith('--') && !valued.has(argv[i - 1]));
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
  const r = await call('/admin/vouchers', { ship, note: note ?? '', ...(edition ? { edition } : {}) });
  const held = r.edition ? ` (${r.edition} ${String(r.number).padStart(3, '0')}, held for whoever redeems it)` : '';
  console.log(`Voucher for a ${r.ship}${held}: ${r.code}\nRedeem it at any shipyard in the game, signed in. It works once; this is the only time it's shown.`);
} else if (command === 'list') {
  const r = (await call('/admin/vouchers')) as { vouchers: { ship: string; note: string; created: number; used: number; redeemed: number | null; edition: string | null; number: number | null; signed: number }[] };
  for (const v of r.vouchers)
    console.log(`${new Date(v.created).toISOString().slice(0, 10)}  ${v.ship.padEnd(14)} ${v.edition ? `${v.edition} ${String(v.number).padStart(3, '0')}  ` : ''}${v.signed ? (v.used ? `signed over, attached ${new Date(v.redeemed!).toISOString().slice(0, 10)}` : 'signed over, waiting for them to sign in') : v.used ? `used ${new Date(v.redeemed!).toISOString().slice(0, 10)}` : 'unused'}  ${v.note}`);
  if (!r.vouchers.length) console.log('No vouchers yet.');
} else if (command === 'gift' && ship && note && yard) {
  // `note` is the email address here. The yard is a system name, in whichever galaxy has it first.
  const { galaxy } = await import('../src/galaxy/generate');
  const at = [0, 1, 2, 3, 4, 5, 6, 7].flatMap((g) => galaxy(g)).find((s) => s.name.toLowerCase() === yard.toLowerCase());
  if (!at) {
    console.error(`No system called ${yard}`);
    process.exit(1);
  }
  const r = await call('/admin/gifts', { ship, email: note, galaxy: at.galaxy, system: at.index, ...(edition ? { edition } : {}), ...(number ? { number: Number(number) } : {}), ...(callsign ? { callsign } : {}), ...(quiet ? { quiet: true } : {}) });
  const what = r.edition ? `${r.edition} ${String(r.number).padStart(3, '0')}` : `a ${r.ship}`;
  console.log(`Signed over: ${what}, waiting at ${at.name} (galaxy ${at.galaxy + 1}). ${r.attached ? `Their account has it now${r.told ? ', and a notification went to their devices' : ''}.` : 'It attaches when they sign in with that address.'}`);
  if (r.edition) console.log(`${r.emailed ? 'The maker’s letter has gone.' : `No letter sent${r.why ? ` (${r.why})` : quiet ? ' (--quiet)' : ''}.`}\nHer papers (private: only share it with them): ${r.link}`);
} else if (command === 'papers' && ship && note) {
  // `ship` is the edition here, and `note` its number.
  const r = await call('/admin/papers', { edition: ship, number: Number(note), ...(callsign !== undefined ? { callsign } : {}), ...(argv.includes('--send') ? { send: true } : {}), ...(argv.includes('--reissue') ? { reissue: true } : {}) });
  const day = (t: unknown) => (typeof t === 'number' ? new Date(t).toISOString().slice(0, 10) : 'not yet');
  if ('sent' in r) console.log(r.sent ? 'The maker’s letter has gone.' : `Not sent: ${r.why}`);
  console.log(`${r.edition} ${String(r.number).padStart(3, '0')}: letter ${day(r.emailed)} · collected ${day(r.collected)}${r.name ? ` as “${r.name}”` : ''}\nHer papers (private): ${r.link}`);
} else {
  console.log('Usage: npx tsx tools/voucher.ts make <ship id> "<note>" [--edition <id>] | gift <ship id> <email> --at <system> [--edition <id> [--number <n>] [--callsign <name>] [--quiet]] | papers <edition> <number> [--callsign <name>] [--send] [--reissue] | list   [--local]');
}
