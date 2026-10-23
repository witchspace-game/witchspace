// Accounts: sign in with an email link (no passwords), a callsign that's yours
// alone, and a cloud save of your commander so you can play on any device.
// One Durable Object holds them all in its own SQLite database.
//
// Privacy: we keep your email address, your callsign and your save, and
// nothing else about you (plus, only if you ask for them, the address your
// browser gives us for notifications and whether we may email you).
// Notifications are in character: the trading companies get in touch when
// a special assignment is waiting (contact.ts). Sign-in links and sessions are stored only as
// hashes, so a copy of the database can't be used to sign in as anyone.
// Deleting your account removes all of it.

import { DurableObject } from 'cloudflare:workers';
import { cleanName } from './protocol';
import { NAMES, nameKey, nameRule } from './names';
import { isClaim, MAX_CLAIMS } from './firsts';
import { isHuman, json, networkOf, randomToken, sha256 } from './http';
import { assignmentId, assignmentWaiting, CONTACT, CONTACT_COMPANIES, type CompanyId } from './contact';
import { companyEmail, signInEmail } from './emails';
import { isPushEndpoint, sendPush } from './push';

export interface AccountsEnv {
  /** Resend, for sign-in emails. Without it (local development) the link is returned instead of sent. */
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  ADMIN_KEY?: string;
  /** Web Push (VAPID): the public key (a var) and the private key as a P-256 JWK (a secret). */
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
}

export interface Account {
  id: string;
  email: string;
  callsign: string | null;
}

const SITE = 'https://witchspace.org.uk';
const LINK_MINUTES = 20;
const SESSION_DAYS = 30;
const SAVE_MAX = 512 * 1024; // bytes
const LINKS_PER_EMAIL_PER_HOUR = 3;
const LINKS_PER_NETWORK_PER_HOUR = 10;

const EMAIL = /^[^\s@<>()[\]\\,;:"]{1,64}@[^\s@<>()[\]\\,;:"]{1,255}\.[a-z]{2,}$/i;

export class Accounts extends DurableObject<AccountsEnv> {
  private readonly sql = this.ctx.storage.sql;

  constructor(ctx: DurableObjectState, env: AccountsEnv) {
    super(ctx, env);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, callsign TEXT, callsign_key TEXT UNIQUE, created INTEGER NOT NULL)`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS links (hash TEXT PRIMARY KEY, email TEXT NOT NULL, expires INTEGER NOT NULL)');
    // The same sign-in as a 6-digit code, for apps the link can't open in (an iPhone Home Screen app).
    this.sql.exec('CREATE TABLE IF NOT EXISTS codes (email TEXT PRIMARY KEY, hash TEXT NOT NULL, expires INTEGER NOT NULL, tries INTEGER NOT NULL DEFAULT 0)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS saves (account TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sends (email TEXT NOT NULL, net TEXT NOT NULL, t INTEGER NOT NULL)');
    // Protected callsigns released to one person (names.ts): only that email's account may claim them.
    this.sql.exec('CREATE TABLE IF NOT EXISTS releases (name_key TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, created INTEGER NOT NULL)');
    // Anonymous daily totals (which rules, which look), to decide Classic's future. Nothing per person:
    // `pings` only stops a network being counted twice in a day, by a salted one-way hash.
    this.sql.exec('CREATE TABLE IF NOT EXISTS stats (day TEXT NOT NULL, key TEXT NOT NULL, n INTEGER NOT NULL, PRIMARY KEY (day, key))');
    this.sql.exec('CREATE TABLE IF NOT EXISTS pings (day TEXT NOT NULL, net TEXT NOT NULL, PRIMARY KEY (day, net))');
    // Letting the companies get in touch: opt-in, per account.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS contact (
      account TEXT PRIMARY KEY, push TEXT, push_hash TEXT, email INTEGER NOT NULL DEFAULT 0, stop TEXT NOT NULL,
      sent TEXT NOT NULL DEFAULT '[]', title TEXT, body TEXT)`);
    // Your name on the galaxy: the first account to bring each world's, moon's or signal's data home.
    // The name shown is the account's callsign now, so a rename follows and a deleted account drops out.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS firsts (
      galaxy INTEGER NOT NULL, system INTEGER NOT NULL, body TEXT NOT NULL, account TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (galaxy, system, body))`);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const m = request.method;
    if (m === 'POST' && path === '/auth/request') return this.requestLink(request);
    if (m === 'POST' && path === '/auth/verify') return this.verify(request);
    if (path.startsWith('/admin/')) return this.admin(request, path);
    if (m === 'GET' && path === '/contact/key') return json({ key: this.env.VAPID_PUBLIC ?? null });
    if (m === 'POST' && path === '/stats/ping') return this.ping(request);
    if (m === 'GET' && path === '/push/latest') return this.latest(url);
    if (m === 'GET' && path === '/contact/stop') return this.stop(url);
    const galaxy = path.match(/^\/firsts\/([0-7])$/);
    if (m === 'GET' && galaxy) return this.firstsOf(Number(galaxy[1]));

    const account = await this.sessionAccount(request);
    if (!account) return json({ error: 'Please sign in' }, 401);
    if (m === 'GET' && path === '/me') return json({ account, saveUpdated: this.saveUpdated(account.id) });
    if (m === 'POST' && path === '/me/callsign') return this.setCallsign(request, account);
    if (m === 'GET' && path === '/me/save') return this.getSave(account);
    if (m === 'PUT' && path === '/me/save') return this.putSave(request, account);
    if (m === 'POST' && path === '/auth/signout') return this.signOut(request);
    if (m === 'DELETE' && path === '/me') return this.deleteAccount(account);
    if (m === 'GET' && path === '/me/contact') return this.getContact(account);
    if (m === 'PUT' && path === '/me/contact') return this.putContact(request, account);
    if (m === 'POST' && path === '/me/firsts') return this.claimFirsts(request, account);
    return json({ error: 'Not found' }, 404);
  }

  // --- Your name on the galaxy (docs/design/exploration.md, stage 1b) -------------

  /** GET /firsts/<galaxy>: who brought each body's data home first, for the chart. Public. */
  private firstsOf(galaxy: number): Response {
    const rows = this.sql
      .exec('SELECT f.system, f.body, a.callsign FROM firsts f JOIN accounts a ON a.id = f.account WHERE f.galaxy = ? AND a.callsign IS NOT NULL', galaxy)
      .toArray()
      .map((r) => ({ s: r.system as number, b: r.body as string, c: r.callsign as string }));
    const res = json({ firsts: rows });
    res.headers.set('Cache-Control', 'public, max-age=300');
    return res;
  }

  /** POST /me/firsts {claims: [{galaxy, system, body}]}: data you just brought home. Returns the ones that are yours. */
  private async claimFirsts(request: Request, account: Account): Promise<Response> {
    if (!account.callsign) return json({ error: 'Choose a callsign first' }, 409);
    const body = (await request.json().catch(() => null)) as { claims?: unknown } | null;
    const claims = Array.isArray(body?.claims) ? body.claims.slice(0, MAX_CLAIMS) : [];
    const won: { galaxy: number; system: number; body: string }[] = [];
    const now = Date.now();
    for (const c of claims) {
      if (!isClaim(c)) continue;
      const added = this.sql.exec('INSERT OR IGNORE INTO firsts (galaxy, system, body, account, at) VALUES (?, ?, ?, ?, ?)', c.galaxy, c.system, c.body, account.id, now).rowsWritten;
      if (added) won.push({ galaxy: c.galaxy, system: c.system, body: c.body });
    }
    return json({ firsts: won });
  }

  /** For the shared space servers: who a session belongs to, if anyone. */
  async whoIs(session: string): Promise<{ id: string; callsign: string | null } | null> {
    if (typeof session !== 'string' || session.length < 20) return null;
    const row = this.sql
      .exec('SELECT a.id, a.callsign FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.hash = ? AND s.expires > ?', await sha256(session), Date.now())
      .toArray()[0];
    return row ? { id: row.id as string, callsign: (row.callsign as string | null) ?? null } : null;
  }

  // --- Signing in ---------------------------------------------------------------

  private async requestLink(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { email?: unknown; turnstile?: unknown } | null;
    const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
    if (!EMAIL.test(email) || email.length > 254) return json({ error: 'That doesn’t look like an email address' }, 400);
    const net = await networkOf(request, (this.env.ADMIN_KEY ?? 'witchspace') + ':accounts');
    const hourAgo = Date.now() - 3600_000;
    this.sql.exec('DELETE FROM sends WHERE t < ?', hourAgo);
    this.sql.exec('DELETE FROM links WHERE expires < ?', Date.now());
    const byEmail = this.sql.exec('SELECT COUNT(*) AS n FROM sends WHERE email = ?', email).one().n as number;
    const byNet = this.sql.exec('SELECT COUNT(*) AS n FROM sends WHERE net = ?', net).one().n as number;
    if (byEmail >= LINKS_PER_EMAIL_PER_HOUR || byNet >= LINKS_PER_NETWORK_PER_HOUR) return json({ error: 'Too many sign-in emails: please wait a while and try again' }, 429);
    if (!(await isHuman(this.env.TURNSTILE_SECRET, body?.turnstile, request))) return json({ error: 'The human check didn’t pass: please try again' }, 403);

    const token = randomToken();
    this.sql.exec('INSERT INTO links (hash, email, expires) VALUES (?, ?, ?)', await sha256(token), email, Date.now() + LINK_MINUTES * 60_000);
    this.sql.exec('INSERT INTO sends (email, net, t) VALUES (?, ?, ?)', email, net, Date.now());
    const origin = request.headers.get('Origin') ?? SITE;
    const site = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : SITE;
    const link = `${site}/play/?signin=${token}`;
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0');
    this.sql.exec('INSERT OR REPLACE INTO codes (email, hash, expires, tries) VALUES (?, ?, ?, 0)', email, await sha256(`${email}:${code}`), Date.now() + LINK_MINUTES * 60_000);

    if (!this.env.RESEND_API_KEY) {
      // Local development: no email service, so hand the link back to be shown.
      if (site !== SITE) return json({ sent: false, devLink: link, devCode: code });
      return json({ error: 'Sign-in email isn’t set up yet' }, 503);
    }
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Witchspace <signin@witchspace.org.uk>',
        to: [email],
        ...signInEmail(link, code, LINK_MINUTES),
      }),
    });
    if (!sent.ok) return json({ error: 'The email couldn’t be sent just now: please try again' }, 502);
    return json({ sent: true });
  }

  private async verify(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { token?: unknown; email?: unknown; code?: unknown } | null;
    let email: string;
    if (typeof body?.code === 'string' && typeof body.email === 'string') {
      // The code: five tries, then it's spent.
      const address = body.email.trim().toLowerCase();
      const row = this.sql.exec('SELECT hash, expires, tries FROM codes WHERE email = ?', address).toArray()[0];
      if (!row || (row.expires as number) < Date.now() || (row.tries as number) >= 5) return json({ error: 'That code has expired: ask for a new one' }, 400);
      if (row.hash !== (await sha256(`${address}:${body.code.trim()}`))) {
        this.sql.exec('UPDATE codes SET tries = tries + 1 WHERE email = ?', address);
        return json({ error: 'That code isn’t right: check the email and try again' }, 400);
      }
      this.sql.exec('DELETE FROM codes WHERE email = ?', address);
      email = address;
    } else {
      if (typeof body?.token !== 'string') return json({ error: 'No sign-in link' }, 400);
      const hash = await sha256(body.token);
      const link = this.sql.exec('SELECT email, expires FROM links WHERE hash = ?', hash).toArray()[0];
      // A link works once.
      this.sql.exec('DELETE FROM links WHERE hash = ?', hash);
      if (!link || (link.expires as number) < Date.now()) return json({ error: 'That sign-in link has expired or been used: ask for a new one' }, 400);
      email = link.email as string;
      this.sql.exec('DELETE FROM codes WHERE email = ?', email);
    }
    let account = this.sql.exec('SELECT id, email, callsign FROM accounts WHERE email = ?', email).toArray()[0];
    if (!account) {
      const id = crypto.randomUUID();
      this.sql.exec('INSERT INTO accounts (id, email, created) VALUES (?, ?, ?)', id, email, Date.now());
      account = { id, email, callsign: null };
    }
    const session = randomToken();
    this.sql.exec('DELETE FROM sessions WHERE expires < ?', Date.now());
    this.sql.exec('INSERT INTO sessions (hash, account, expires) VALUES (?, ?, ?)', await sha256(session), account.id, Date.now() + SESSION_DAYS * 86_400_000);
    return json({ session, account: { id: account.id, email: account.email, callsign: account.callsign ?? null } });
  }

  private async sessionAccount(request: Request): Promise<Account | null> {
    const auth = request.headers.get('Authorization') ?? '';
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
    if (!token) return null;
    const hash = await sha256(token);
    const now = Date.now();
    const row = this.sql
      .exec('SELECT a.id, a.email, a.callsign, s.expires FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.hash = ? AND s.expires > ?', hash, now)
      .toArray()[0];
    if (!row) return null;
    // Playing keeps you signed in: the 30 days run from your last visit (renewed at most once a day).
    const renewed = now + SESSION_DAYS * 86_400_000;
    if (renewed - (row.expires as number) > 86_400_000) this.sql.exec('UPDATE sessions SET expires = ? WHERE hash = ?', renewed, hash);
    return { id: row.id as string, email: row.email as string, callsign: (row.callsign as string | null) ?? null };
  }

  private async signOut(request: Request): Promise<Response> {
    const token = (request.headers.get('Authorization') ?? '').slice(7);
    this.sql.exec('DELETE FROM sessions WHERE hash = ?', await sha256(token));
    return json({ ok: true });
  }

  // --- Your callsign -------------------------------------------------------------

  private async setCallsign(request: Request, account: Account): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { callsign?: unknown } | null;
    const callsign = cleanName(body?.callsign);
    if (callsign.length < 2) return json({ error: 'Callsigns need at least two letters' }, 400);
    const rule = nameRule(callsign);
    if (rule?.rule === 'never') return json({ error: `${callsign} can't be used as a callsign: try another` }, 409);
    const holder = this.releasedTo(callsign);
    if ((rule || holder) && holder !== account.email) return json({ error: `${callsign} is reserved: try another` }, 409);
    const key = callsign.toLowerCase();
    const taken = this.sql.exec('SELECT id FROM accounts WHERE callsign_key = ? AND id != ?', key, account.id).toArray()[0];
    if (taken) return json({ error: `CMDR ${callsign} is already taken: try another` }, 409);
    this.sql.exec('UPDATE accounts SET callsign = ?, callsign_key = ? WHERE id = ?', callsign, key, account.id);
    return json({ callsign });
  }

  /** The email a callsign has been released to, if any. */
  private releasedTo(callsign: string): string | null {
    const row = this.sql.exec('SELECT email FROM releases WHERE name_key = ?', nameKey(callsign)).toArray()[0];
    return row ? (row.email as string) : null;
  }

  // --- Admin: releasing protected callsigns --------------------------------------

  /** GET /admin/names, POST /admin/names/release {name, email}, POST /admin/names/revoke {name}. Needs the admin key. */
  private async admin(request: Request, path: string): Promise<Response> {
    const key = request.headers.get('X-Admin-Key');
    if (!this.env.ADMIN_KEY || key !== this.env.ADMIN_KEY) return json({ error: 'Forbidden' }, 403);
    if (request.method === 'GET' && path === '/admin/names') {
      const releases = this.sql.exec('SELECT name, email, created FROM releases ORDER BY created').toArray();
      return json({ rules: NAMES, releases });
    }
    // Anonymous totals: daily pings over the last 30 days, and the rules of every cloud save.
    if (request.method === 'GET' && path === '/admin/stats') {
      const since = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
      const days = this.sql.exec('SELECT day, key, n FROM stats WHERE day >= ? ORDER BY day', since).toArray();
      const saves: Record<string, number> = {};
      for (const row of this.sql.exec('SELECT data FROM saves').toArray()) {
        const rules = (JSON.parse(row.data as string) as { difficulty?: string }).difficulty ?? 'unknown';
        saves[rules] = (saves[rules] ?? 0) + 1;
      }
      return json({ days, saves, accounts: this.sql.exec('SELECT COUNT(*) AS n FROM accounts').one().n });
    }
    // Run the companies' hourly check now (testing), and see how many have asked to be contacted.
    if (request.method === 'POST' && path === '/admin/contact/run') {
      await this.alarm();
      const n = this.sql.exec('SELECT COUNT(*) AS n FROM contact WHERE push IS NOT NULL OR email = 1').one().n;
      return json({ ran: true, contactable: n });
    }
    const body = (await request.json().catch(() => null)) as { name?: unknown; email?: unknown } | null;
    const name = cleanName(body?.name);
    if (request.method === 'POST' && path === '/admin/names/release') {
      const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
      if (!EMAIL.test(email)) return json({ error: 'That email doesn’t look right' }, 400);
      if (name.length < 2) return json({ error: 'Callsigns need at least two letters' }, 400);
      const holder = this.sql.exec('SELECT email FROM accounts WHERE callsign_key = ?', name.toLowerCase()).toArray()[0];
      if (holder && holder.email !== email) return json({ error: `${name} is already someone’s callsign: revoke it first` }, 409);
      const rule = nameRule(name);
      // Releasing a name that isn't on the list protects it too: how we hold a fan's old callsign for them.
      if (rule?.rule === 'never') return json({ error: `${name} is never released (${rule.why})` }, 409);
      this.sql.exec('INSERT OR REPLACE INTO releases (name_key, name, email, created) VALUES (?, ?, ?, ?)', nameKey(name), name, email, Date.now());
      return json({ released: name, to: email });
    }
    if (request.method === 'POST' && path === '/admin/names/revoke') {
      this.sql.exec('DELETE FROM releases WHERE name_key = ?', nameKey(name));
      // Whoever holds it gives it up: they'll be asked for another callsign.
      const freed = this.sql.exec('UPDATE accounts SET callsign = NULL, callsign_key = NULL WHERE callsign_key = ?', name.toLowerCase()).rowsWritten;
      return json({ revoked: name, freed });
    }
    return json({ error: 'Not found' }, 404);
  }

  // --- The cloud save --------------------------------------------------------------

  private saveUpdated(id: string): number | null {
    return (this.sql.exec('SELECT updated FROM saves WHERE account = ?', id).toArray()[0]?.updated as number | undefined) ?? null;
  }

  private getSave(account: Account): Response {
    const row = this.sql.exec('SELECT data, updated FROM saves WHERE account = ?', account.id).toArray()[0];
    return json(row ? { data: JSON.parse(row.data as string), updated: row.updated } : { data: null, updated: null });
  }

  /** Save, unless the server already has something newer (another device saved since). */
  private async putSave(request: Request, account: Account): Promise<Response> {
    const text = await request.text();
    if (text.length > SAVE_MAX) return json({ error: 'That save is too large' }, 413);
    const body = (() => {
      try {
        return JSON.parse(text) as { data?: unknown; updated?: unknown; base?: unknown };
      } catch {
        return null;
      }
    })();
    if (!body || typeof body.data !== 'object' || body.data === null || typeof body.updated !== 'number') return json({ error: 'Not a save' }, 400);
    const current = this.saveUpdated(account.id);
    // `base` is the version this device last loaded or saved. If the server has moved on since, it's a conflict.
    if (current !== null && typeof body.base === 'number' && current > body.base) return json({ error: 'conflict', updated: current }, 409);
    const updated = Math.max(body.updated, (current ?? 0) + 1);
    this.sql.exec('INSERT OR REPLACE INTO saves (account, data, updated) VALUES (?, ?, ?)', account.id, JSON.stringify(body.data), updated);
    return json({ updated });
  }

  // --- Anonymous totals ----------------------------------------------------------------

  /** POST /stats/ping {rules, look, event?}: add one to today's totals. Counted once a day per network. */
  private async ping(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { rules?: unknown; look?: unknown; event?: unknown } | null;
    const rules = ['modern', 'classic', 'none'].includes(body?.rules as string) ? (body!.rules as string) : null;
    const look = ['neo', '1984'].includes(body?.look as string) ? (body!.look as string) : null;
    if (!rules || !look) return json({ error: 'Not a ping' }, 400);
    const day = new Date().toISOString().slice(0, 10);
    const keys = body?.event === 'new' ? [`new:${rules}`] : [`rules:${rules}`, `look:${look}`, 'devices'];
    if (body?.event !== 'new') {
      const net = await networkOf(request, (this.env.ADMIN_KEY ?? 'witchspace') + ':stats');
      this.sql.exec('DELETE FROM pings WHERE day < ?', day);
      if (this.sql.exec('SELECT 1 FROM pings WHERE day = ? AND net = ?', day, net).toArray().length) return json({ counted: false });
      this.sql.exec('INSERT INTO pings (day, net) VALUES (?, ?)', day, net);
    }
    for (const key of keys) this.sql.exec('INSERT INTO stats (day, key, n) VALUES (?, ?, 1) ON CONFLICT(day, key) DO UPDATE SET n = n + 1', day, key);
    return json({ counted: true });
  }

  // --- The companies get in touch (opt-in) ------------------------------------------

  private contactRow(id: string): ContactRow | null {
    return (this.sql.exec('SELECT account, push, email, stop, sent FROM contact WHERE account = ?', id).toArray()[0] as unknown as ContactRow | undefined) ?? null;
  }

  private getContact(account: Account): Response {
    const row = this.contactRow(account.id);
    return json({ push: Boolean(row?.push), email: Boolean(row?.email), key: this.env.VAPID_PUBLIC ?? null });
  }

  /** PUT /me/contact {push?: subscription | null, email?: boolean}. */
  private async putContact(request: Request, account: Account): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { push?: { endpoint?: unknown } | null; email?: unknown } | null;
    if (!body) return json({ error: 'Nothing to change' }, 400);
    const row = this.contactRow(account.id);
    let push = row?.push ?? null;
    if (body.push === null) push = null;
    else if (body.push !== undefined) {
      if (!isPushEndpoint(body.push.endpoint)) return json({ error: 'That isn’t a browser’s notification address' }, 400);
      push = JSON.stringify({ endpoint: body.push.endpoint });
    }
    const email = body.email === undefined ? (row?.email ?? 0) : body.email ? 1 : 0;
    const hash = push ? await sha256((JSON.parse(push) as { endpoint: string }).endpoint) : null;
    this.sql.exec(
      `INSERT INTO contact (account, push, push_hash, email, stop) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(account) DO UPDATE SET push = excluded.push, push_hash = excluded.push_hash, email = excluded.email`,
      account.id, push, hash, email, row?.stop ?? randomToken(),
    );
    if ((push || email) && !(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 60_000);
    return json({ push: Boolean(push), email: Boolean(email) });
  }

  /** For the service worker: the latest message for its push address. */
  private latest(url: URL): Response {
    const row = this.sql.exec('SELECT title, body FROM contact WHERE push_hash = ?', url.searchParams.get('e') ?? '').toArray()[0];
    return json(row?.title ? { title: row.title, body: row.body, url: `${SITE}/play/` } : { title: 'Witchspace', body: 'Someone would like a word, Commander.', url: `${SITE}/play/` });
  }

  /** One click from an email: no more contact. */
  private stop(url: URL): Response {
    const done = this.sql.exec('UPDATE contact SET push = NULL, push_hash = NULL, email = 0 WHERE stop = ?', url.searchParams.get('t') ?? '').rowsWritten;
    const html = `<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#05070d;color:#eaf0f6;font-family:Arial,sans-serif;padding:40px;text-align:center">
      <h1 style="color:#3dffb0">${done ? 'Understood, Commander.' : 'Nothing to stop.'}</h1><p>${done ? 'The companies won’t contact you again. You can change this in the game, under A · Account.' : 'That link has already been used.'}</p>
      <p><a style="color:#3dffb0" href="${SITE}/play/">Back to Witchspace</a></p></body>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  /** Every hour: anyone with an assignment waiting hears from the company. */
  async alarm(): Promise<void> {
    const rows = this.sql.exec('SELECT account, push, email, stop, sent FROM contact WHERE push IS NOT NULL OR email = 1').toArray() as unknown as ContactRow[];
    const now = Date.now();
    for (const row of rows) {
      try {
        await this.contactOne(row, now);
      } catch (e) {
        console.error('contact failed', row.account, e);
      }
    }
    if (rows.length) await this.ctx.storage.setAlarm(now + CONTACT_EVERY);
  }

  private async contactOne(row: ContactRow, now: number) {
    const save = this.sql.exec('SELECT data FROM saves WHERE account = ?', row.account).toArray()[0];
    if (!save) return;
    const c = JSON.parse(save.data as string) as {
      name?: string; difficulty?: string; standing?: Record<string, number>; contracts?: { id: string }[]; contractsDone?: string[]; messages?: { id: string }[];
    };
    if (c.difficulty !== 'modern' || !c.name) return;
    const sent = JSON.parse(row.sent) as { id: string; t: number }[];
    const week = sent.filter((s) => now - s.t < 7 * 86_400_000);
    if (week.length >= CONTACT_PER_WEEK) return;
    const company = CONTACT_COMPANIES.find((id) => {
      if (!assignmentWaiting(c.name!, id, c.standing?.[id] ?? 0, now)) return false;
      const aid = assignmentId(id, now);
      // Not if you've already seen it in the game, taken it, or been told.
      return ![...(c.contracts ?? []), ...(c.messages ?? [])].some((x) => x.id === aid) && !c.contractsDone?.includes(aid) && !sent.some((s) => s.id === aid);
    });
    if (!company) return;
    const { name, subject } = CONTACT[company];
    const title = name;
    const body = `${subject}. An assignment is waiting: report to any ${name} station within 48 hours.`;
    let told = false;
    if (row.push && this.env.VAPID_PUBLIC && this.env.VAPID_PRIVATE) {
      this.sql.exec('UPDATE contact SET title = ?, body = ? WHERE account = ?', title, body, row.account);
      const result = await sendPush((JSON.parse(row.push) as { endpoint: string }).endpoint, { publicKey: this.env.VAPID_PUBLIC, privateJwk: this.env.VAPID_PRIVATE });
      if (result === 'gone') this.sql.exec('UPDATE contact SET push = NULL, push_hash = NULL WHERE account = ?', row.account);
      told = result === 'sent';
    }
    if (!told && row.email && this.env.RESEND_API_KEY) told = await this.contactEmail(row, company, name, subject);
    if (told) this.sql.exec('UPDATE contact SET sent = ? WHERE account = ?', JSON.stringify([...week, { id: assignmentId(company, now), t: now }]), row.account);
  }

  private async contactEmail(row: ContactRow, company: CompanyId, name: string, subject: string): Promise<boolean> {
    const email = this.sql.exec('SELECT email FROM accounts WHERE id = ?', row.account).toArray()[0]?.email as string | undefined;
    if (!email) return false;
    const stop = `https://space.witchspace.org.uk/contact/stop?t=${encodeURIComponent(row.stop)}`;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: `${name} via Witchspace <contact@witchspace.org.uk>`,
        to: [email],
        ...companyEmail(company, name, subject, `An assignment is waiting for you, Commander. Report to any ${name} station within 48 hours.`, stop),
        headers: { 'List-Unsubscribe': `<${stop}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
      }),
    });
    return res.ok;
  }

  private deleteAccount(account: Account): Response {
    for (const table of ['saves', 'sessions', 'contact', 'firsts']) this.sql.exec(`DELETE FROM ${table} WHERE account = ?`, account.id);
    this.sql.exec('DELETE FROM links WHERE email = ?', account.email);
    this.sql.exec('DELETE FROM codes WHERE email = ?', account.email);
    this.sql.exec('DELETE FROM accounts WHERE id = ?', account.id);
    return json({ deleted: true });
  }
}

// --- The companies get in touch ----------------------------------------------------

const CONTACT_EVERY = 3600_000; // how often to look for waiting assignments
const CONTACT_PER_WEEK = 2;

interface ContactRow {
  account: string;
  push: string | null;
  email: number;
  stop: string;
  sent: string;
}

