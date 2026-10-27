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
import { allowance, isRealClaim, MAX_CLAIMS } from './firsts';
import { FEED_EACH, FLYING_NOW, type FirstEvent, type Flying } from './feed';
import { isHuman, json, networkOf, randomToken, sha256 } from './http';
import { assignmentId, assignmentWaiting, CONTACT, CONTACT_COMPANIES, type CompanyId } from './contact';
import { companyEmail, signInEmail } from './emails';
import { isPushEndpoint, sendPush } from './push';
import type { ClipBoard } from './clips';
import { awake, btcItems, heartItems, LOG_EVERY, logMessage, type LogItem, type LogKinds } from './shipsLog';
import type { BtcOrder, PriceSpan } from '../../src/economy/bitcoin';
import { CHECKS_PER_MINUTE, KINDS, MAX_NOTE, OPEN, OPEN_AT_ONCE, parseFile, PER_DAY, prepare, pullRequestText, repoFile, type Kind, type Status, type Via } from './submissions';
import { gitHubReady, openPullRequest, type GitHubEnv } from './github';
import { CHECKS } from './checks';
import { ACCESS_TTL, challengeOk, clientName, CODE_TTL, connectPage, isMetadataUrl, redirectOk, REFRESH_TTL, REQUEST_TTL, s256, SCOPE, verifierOk, withParams } from './oauth';

export interface AccountsEnv extends GitHubEnv {
  /** Resend, for sign-in emails. Without it (local development) the link is returned instead of sent. */
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  ADMIN_KEY?: string;
  /** Web Push (VAPID): the public key (a var) and the private key as a P-256 JWK (a secret). */
  VAPID_PUBLIC?: string;
  VAPID_PRIVATE?: string;
  /** Shared clips (clips.ts): their hearts go in the ship's log. */
  CLIPS?: DurableObjectNamespace<ClipBoard>;
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
    // The ship's log (shipsLog.ts): which kinds, your time zone for quiet hours, when the last went, what it's said.
    for (const col of ["kinds TEXT NOT NULL DEFAULT '{}'", 'tz INTEGER NOT NULL DEFAULT 0', 'logged INTEGER NOT NULL DEFAULT 0', "seen TEXT NOT NULL DEFAULT '[]'"]) {
      try {
        this.sql.exec(`ALTER TABLE contact ADD COLUMN ${col}`);
      } catch {
        /* already there */
      }
    }
    // Every device that has switched notifications on (Mark): each gets the same messages. Replaces contact.push,
    // which held only the latest device; any address still there moves across once.
    this.sql.exec('CREATE TABLE IF NOT EXISTS devices (hash TEXT PRIMARY KEY, account TEXT NOT NULL, endpoint TEXT NOT NULL, added INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS devices_account ON devices (account)');
    for (const old of this.sql.exec('SELECT account, push, push_hash FROM contact WHERE push IS NOT NULL AND push_hash IS NOT NULL').toArray()) {
      const endpoint = (JSON.parse(old.push as string) as { endpoint: string }).endpoint;
      this.sql.exec('INSERT OR IGNORE INTO devices (hash, account, endpoint, added) VALUES (?, ?, ?, ?)', old.push_hash, old.account, endpoint, Date.now());
    }
    this.sql.exec('UPDATE contact SET push = NULL, push_hash = NULL WHERE push IS NOT NULL');
    // Your name on the galaxy: the first account to bring each world's, moon's or signal's data home.
    // The name shown is the account's callsign now, so a rename follows and a deleted account drops out.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS firsts (
      galaxy INTEGER NOT NULL, system INTEGER NOT NULL, body TEXT NOT NULL, account TEXT NOT NULL, at INTEGER NOT NULL,
      PRIMARY KEY (galaxy, system, body))`);
    // Submissions (submissions.ts): ships and modules handed in, private to their author and the maintainers.
    this.sql.exec(`CREATE TABLE IF NOT EXISTS submissions (
      id TEXT PRIMARY KEY, account TEXT NOT NULL, kind TEXT NOT NULL, item TEXT NOT NULL, title TEXT NOT NULL, revises INTEGER NOT NULL,
      status TEXT NOT NULL, note TEXT NOT NULL, ai INTEGER NOT NULL, via TEXT NOT NULL, review TEXT, pr TEXT, version INTEGER NOT NULL,
      file TEXT NOT NULL, warnings TEXT NOT NULL, history TEXT NOT NULL DEFAULT '[]', created INTEGER NOT NULL, updated INTEGER NOT NULL)`);
    this.sql.exec('CREATE INDEX IF NOT EXISTS submissions_account ON submissions (account)');
    // Signing in from an assistant (oauth.ts): the clients, the sign-ins waiting on the connect page, and only
    // the hashes of codes and tokens.
    this.sql.exec('CREATE TABLE IF NOT EXISTS oauth_clients (id TEXT PRIMARY KEY, name TEXT NOT NULL, uri TEXT, redirects TEXT NOT NULL, created INTEGER NOT NULL)');
    this.sql.exec(`CREATE TABLE IF NOT EXISTS oauth_requests (id TEXT PRIMARY KEY, client TEXT NOT NULL, redirect TEXT NOT NULL, state TEXT,
      challenge TEXT NOT NULL, expires INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS oauth_codes (hash TEXT PRIMARY KEY, client TEXT NOT NULL, redirect TEXT NOT NULL, challenge TEXT NOT NULL,
      account TEXT NOT NULL, expires INTEGER NOT NULL)`);
    this.sql.exec('CREATE TABLE IF NOT EXISTS oauth_tokens (hash TEXT PRIMARY KEY, kind TEXT NOT NULL, account TEXT NOT NULL, client TEXT NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE INDEX IF NOT EXISTS oauth_tokens_account ON oauth_tokens (account)');
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
    if (m === 'POST' && path === '/submissions/check') return this.checkOnly(request);
    const signIn = path.match(/^\/oauth\/request\/([A-Za-z0-9_-]{20,64})$/);
    if (signIn && m === 'GET') return this.describeSignIn(request, signIn[1]);
    if (signIn && m === 'POST') return this.answerSignIn(request, signIn[1]);
    const sub = path.match(/^\/submissions(?:\/(mine|[a-z0-9]{10})(?:\/(review))?)?$/);
    if (sub && request.headers.has('X-Admin-Key')) return this.reviewQueue(request, url, sub[1], sub[2]);

    const account = await this.sessionAccount(request);
    if (!account) return json({ error: 'Please sign in' }, 401);
    if (m === 'GET' && path === '/me') return json({ account, saveUpdated: this.saveUpdated(account.id) });
    if (m === 'POST' && path === '/me/callsign') return this.setCallsign(request, account);
    if (m === 'GET' && path === '/me/save') return this.getSave(account);
    if (m === 'PUT' && path === '/me/save') return this.putSave(request, account);
    if (m === 'POST' && path === '/auth/signout') return this.signOut(request);
    if (m === 'DELETE' && path === '/me') return this.deleteAccount(account);
    if (m === 'GET' && path === '/me/contact') return this.getContact(account, url);
    if (m === 'PUT' && path === '/me/contact') return this.putContact(request, account);
    if (m === 'POST' && path === '/me/firsts') return this.claimFirsts(request, account);
    if (m === 'GET' && path === '/me/connections') return this.connections(account);
    if (m === 'DELETE' && path === '/me/connections') return this.disconnect(account, url.searchParams.get('client') ?? '');
    if (sub && !sub[2]) {
      if (m === 'POST' && !sub[1]) return this.submit(request, account);
      if (m === 'GET' && sub[1] === 'mine') return this.mySubmissions(account);
      if (sub[1] && sub[1] !== 'mine') {
        if (m === 'GET') return this.oneSubmission(account, sub[1]);
        if (m === 'PUT') return this.revise(request, account, sub[1]);
        if (m === 'DELETE') return this.withdraw(account, sub[1]);
      }
    }
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

  /** For the live feed (feed.ts): firsts since `since` by commanders with a callsign, and how many are flying. Public totals only. */
  feed(since: number): { firsts: FirstEvent[]; flying: Flying } {
    const firsts = this.sql
      .exec('SELECT f.at, f.galaxy, f.system, f.body, a.callsign FROM firsts f JOIN accounts a ON a.id = f.account WHERE f.at > ? AND a.callsign IS NOT NULL ORDER BY f.at DESC LIMIT ?', since, FEED_EACH)
      .toArray()
      .map((r): FirstEvent => ({ kind: 'first', t: r.at as number, callsign: r.callsign as string, galaxy: r.galaxy as number, system: r.system as number, body: r.body as string }));
    const now = this.sql.exec('SELECT COUNT(*) AS n FROM saves WHERE updated > ?', Date.now() - FLYING_NOW).one().n as number;
    const day = new Date().toISOString().slice(0, 10);
    const today = (this.sql.exec("SELECT n FROM stats WHERE day = ? AND key = 'devices'", day).toArray()[0]?.n as number | undefined) ?? 0;
    return { firsts, flying: { now, today } };
  }

  /** POST /me/firsts {claims: [{galaxy, system, body}]}: data you just brought home. Returns the ones that are yours. */
  private async claimFirsts(request: Request, account: Account): Promise<Response> {
    if (!account.callsign) return json({ error: 'Choose a callsign first' }, 409);
    const body = (await request.json().catch(() => null)) as { claims?: unknown } | null;
    const claims = Array.isArray(body?.claims) ? body.claims.slice(0, MAX_CLAIMS) : [];
    const won: { galaxy: number; system: number; body: string }[] = [];
    const now = Date.now();
    // At a human pace: what's over the allowance stays unclaimed, for whoever brings it home next.
    const since = (ms: number) => this.sql.exec('SELECT COUNT(*) AS n FROM firsts WHERE account = ? AND at > ?', account.id, now - ms).one().n as number;
    let left = allowance(since(3_600_000), since(86_400_000));
    for (const c of claims) {
      if (left <= 0) break;
      if (!isRealClaim(c)) continue;
      const added = this.sql.exec('INSERT OR IGNORE INTO firsts (galaxy, system, body, account, at) VALUES (?, ?, ?, ?, ?)', c.galaxy, c.system, c.body, account.id, now).rowsWritten;
      if (added) {
        won.push({ galaxy: c.galaxy, system: c.system, body: c.body });
        left--;
      }
    }
    return json({ firsts: won });
  }

  /** For the shared space servers: who a session belongs to, if anyone. */
  /**
   * Where each signed-in account is flying in shared space, so an account has
   * one ship at a time. In memory: if this object restarts, the worst case is
   * a duplicate ship until one of them next joins.
   */
  private readonly present = new Map<string, { room: string; id: string }>();
  /** Checks without storing, per network this minute (one Accounts object, so this is every check). */
  private checksByNet = { minute: 0, counts: new Map<string, number>() };

  /** An account's ship joined a system: record it, and return the ship it replaces (if any). */
  async arrive(account: string, room: string, id: string): Promise<{ room: string; id: string } | null> {
    const before = this.present.get(account);
    this.present.set(account, { room, id });
    return before && before.id !== id ? before : null;
  }

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
    // First discoveries: who's been claiming most lately, and wiping one account's claims (a cheat).
    if (request.method === 'GET' && path === '/admin/firsts') {
      const since = Date.now() - 7 * 86_400_000;
      const rows = this.sql
        .exec(
          `SELECT a.callsign, a.email, COUNT(*) AS week, SUM(CASE WHEN f.at > ? THEN 1 ELSE 0 END) AS day, MAX(f.at) AS last
           FROM firsts f JOIN accounts a ON a.id = f.account WHERE f.at > ? GROUP BY f.account ORDER BY week DESC LIMIT 25`,
          Date.now() - 86_400_000,
          since,
        )
        .toArray();
      return json({ top: rows, total: this.sql.exec('SELECT COUNT(*) AS n FROM firsts').one().n });
    }
    if (request.method === 'POST' && path === '/admin/firsts/wipe') {
      const body = (await request.json().catch(() => null)) as { callsign?: unknown } | null;
      const key = typeof body?.callsign === 'string' ? body.callsign.trim().toLowerCase() : '';
      const who = this.sql.exec('SELECT id, callsign FROM accounts WHERE callsign_key = ?', key).toArray()[0];
      if (!who) return json({ error: 'No commander with that callsign' }, 404);
      const wiped = this.sql.exec('DELETE FROM firsts WHERE account = ?', who.id).rowsWritten;
      return json({ wiped, callsign: who.callsign });
    }
    // Why a ship's log didn't arrive: each thing it needs, for one commander. No addresses or keys, just yes or no.
    if (request.method === 'GET' && path === '/admin/log') {
      const key = (new URL(request.url).searchParams.get('callsign') ?? '').trim().toLowerCase();
      const who = this.sql.exec('SELECT id, callsign FROM accounts WHERE callsign_key = ?', key).toArray()[0];
      if (!who) return json({ error: 'No commander with that callsign' }, 404);
      const row = this.contactRow(who.id as string);
      const said = this.sql.exec('SELECT title, body FROM contact WHERE account = ?', who.id).toArray()[0];
      const save = this.sql.exec('SELECT data, updated FROM saves WHERE account = ?', who.id).toArray()[0];
      const orders = save ? ((JSON.parse(save.data as string) as { btcOrders?: BtcOrder[] }).btcOrders ?? []) : [];
      const now = Date.now();
      return json({
        callsign: who.callsign,
        alarm: await this.ctx.storage.getAlarm(),
        // The devices it reaches, by push service (Apple's is an iPhone, iPad or Safari on a Mac; Google's is Chrome).
        devices: this.devicesOf(who.id as string).map((d) => ({ service: new URL(d.endpoint).hostname, added: d.added })),
        kinds: JSON.parse(row?.kinds ?? '{}'),
        tz: row?.tz ?? null,
        awake: awake(now, row?.tz ?? 0),
        logged: row?.logged ?? 0,
        seen: JSON.parse(row?.seen ?? '[]'),
        last: said?.title ? { title: said.title, body: said.body } : null,
        saved: save ? (save.updated as number) : null,
        orders: orders.map((o) => ({ id: o.id, side: o.side, limit: o.limit, placed: o.placed })),
        wouldSay: orders.length ? await btcItems(orders, now, relayCandles, await relayPrice()) : [],
      });
    }
    // Send one commander a test ship's log now, to see whether their device shows it.
    if (request.method === 'POST' && path === '/admin/log/test') {
      const key = (new URL(request.url).searchParams.get('callsign') ?? '').trim().toLowerCase();
      const who = this.sql.exec('SELECT id FROM accounts WHERE callsign_key = ?', key).toArray()[0];
      if (!who || !this.devicesOf(who.id as string).length) return json({ error: 'No devices for that commander' }, 404);
      const sent = await this.notify(who.id as string, "Ship's log · test", 'If you can read this, notifications reach you, Commander.');
      return json({ sent, devices: this.devicesOf(who.id as string).length });
    }
    // Run the companies' hourly check now (testing), and see how many have asked to be contacted.
    if (request.method === 'POST' && path === '/admin/contact/run') {
      await this.alarm();
      const n = this.sql.exec(`SELECT COUNT(*) AS n FROM contact WHERE email = 1 OR ${HAS_DEVICE}`).one().n;
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
    return (this.sql.exec('SELECT account, email, stop, sent, kinds, tz, logged, seen FROM contact WHERE account = ?', id).toArray()[0] as unknown as ContactRow | undefined) ?? null;
  }

  /** The devices an account's notifications go to. */
  private devicesOf(account: string): { hash: string; endpoint: string; added: number }[] {
    return this.sql.exec('SELECT hash, endpoint, added FROM devices WHERE account = ? ORDER BY added', account).toArray() as unknown as { hash: string; endpoint: string; added: number }[];
  }

  /** Send a notification to every device on the account; a device that's gone is forgotten. True if any took it. */
  private async notify(account: string, title: string, body: string): Promise<boolean> {
    if (!this.env.VAPID_PUBLIC || !this.env.VAPID_PRIVATE) return false;
    this.sql.exec('UPDATE contact SET title = ?, body = ? WHERE account = ?', title, body, account);
    let sent = false;
    for (const d of this.devicesOf(account)) {
      const result = await sendPush(d.endpoint, { publicKey: this.env.VAPID_PUBLIC, privateJwk: this.env.VAPID_PRIVATE });
      if (result === 'gone') this.sql.exec('DELETE FROM devices WHERE hash = ?', d.hash);
      if (result === 'sent') sent = true;
    }
    return sent;
  }

  /** GET /me/contact?e=sha256(endpoint): `push` is whether this device (`e`) is on; `devices`, how many are. */
  private getContact(account: Account, url: URL): Response {
    const row = this.contactRow(account.id);
    const devices = this.devicesOf(account.id);
    const e = url.searchParams.get('e');
    return json({ push: e ? devices.some((d) => d.hash === e) : devices.length > 0, devices: devices.length, email: Boolean(row?.email), kinds: JSON.parse(row?.kinds ?? '{}') as LogKinds, key: this.env.VAPID_PUBLIC ?? null });
  }

  /**
   * PUT /me/contact {push?: {endpoint}, unpush?: {endpoint}, email?: boolean, kinds?: {exchange, hearts}, tz?: minutes}.
   * `push` adds this device and `unpush` removes it; other devices are left alone.
   */
  private async putContact(request: Request, account: Account): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { push?: { endpoint?: unknown } | null; unpush?: { endpoint?: unknown }; email?: unknown; kinds?: Record<string, unknown>; tz?: unknown } | null;
    if (!body) return json({ error: 'Nothing to change' }, 400);
    const row = this.contactRow(account.id);
    const email = body.email === undefined ? (row?.email ?? 0) : body.email ? 1 : 0;
    this.sql.exec(
      `INSERT INTO contact (account, email, stop) VALUES (?, ?, ?) ON CONFLICT(account) DO UPDATE SET email = excluded.email`,
      account.id, email, row?.stop ?? randomToken(),
    );
    let here: boolean | undefined;
    if (body.push) {
      if (!isPushEndpoint(body.push.endpoint)) return json({ error: 'That isn’t a browser’s notification address' }, 400);
      // A device belongs to whoever switched it on last.
      this.sql.exec('INSERT OR REPLACE INTO devices (hash, account, endpoint, added) VALUES (?, ?, ?, ?)', await sha256(body.push.endpoint as string), account.id, body.push.endpoint, Date.now());
      here = true;
    }
    if (body.unpush && typeof body.unpush.endpoint === 'string') {
      this.sql.exec('DELETE FROM devices WHERE hash = ? AND account = ?', await sha256(body.unpush.endpoint), account.id);
      here = false;
    }
    const devices = this.devicesOf(account.id).length;
    // The ship's log: which kinds, and the device's time zone (for quiet hours).
    const was = JSON.parse(this.contactRow(account.id)?.kinds ?? '{}') as LogKinds;
    const kinds: LogKinds = { exchange: body.kinds?.exchange === undefined ? was.exchange : body.kinds.exchange === true, hearts: body.kinds?.hearts === undefined ? was.hearts : body.kinds.hearts === true };
    const tz = typeof body.tz === 'number' && Number.isFinite(body.tz) ? Math.max(-840, Math.min(840, Math.round(body.tz))) : null;
    this.sql.exec('UPDATE contact SET kinds = ?, tz = COALESCE(?, tz) WHERE account = ?', JSON.stringify(kinds), tz, account.id);
    if ((devices || email) && !(await this.ctx.storage.getAlarm())) await this.ctx.storage.setAlarm(Date.now() + 60_000);
    return json({ push: here ?? devices > 0, devices, email: Boolean(email), kinds });
  }

  /** For the service worker: the latest message for its push address. */
  private latest(url: URL): Response {
    const row = this.sql.exec('SELECT c.title, c.body FROM devices d JOIN contact c ON c.account = d.account WHERE d.hash = ?', url.searchParams.get('e') ?? '').toArray()[0];
    return json(row?.title ? { title: row.title, body: row.body, url: `${SITE}/play/` } : { title: 'Witchspace', body: 'Someone would like a word, Commander.', url: `${SITE}/play/` });
  }

  /** One click from an email: no more contact. */
  private stop(url: URL): Response {
    const who = this.sql.exec('SELECT account FROM contact WHERE stop = ?', url.searchParams.get('t') ?? '').toArray()[0];
    const done = who ? this.sql.exec('UPDATE contact SET email = 0 WHERE account = ?', who.account).rowsWritten + this.sql.exec('DELETE FROM devices WHERE account = ?', who.account).rowsWritten : 0;
    const html = `<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#05070d;color:#eaf0f6;font-family:Arial,sans-serif;padding:40px;text-align:center">
      <h1 style="color:#3dffb0">${done ? 'Understood, Commander.' : 'Nothing to stop.'}</h1><p>${done ? 'The companies won’t contact you again. You can change this in the game, under A · Account.' : 'That link has already been used.'}</p>
      <p><a style="color:#3dffb0" href="${SITE}/play/">Back to Witchspace</a></p></body>`;
    return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }

  /** Every hour: anyone with an assignment waiting hears from the company. */
  async alarm(): Promise<void> {
    const rows = this.sql.exec(`SELECT account, email, stop, sent, kinds, tz, logged, seen FROM contact WHERE email = 1 OR ${HAS_DEVICE}`).toArray() as unknown as ContactRow[];
    const now = Date.now();
    for (const row of rows) {
      try {
        await this.contactOne(row, now);
        await this.shipsLog(row, now);
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
    told = await this.notify(row.account, title, body);
    if (!told && row.email && this.env.RESEND_API_KEY) told = await this.contactEmail(row, company, name, subject);
    if (told) this.sql.exec('UPDATE contact SET sent = ? WHERE account = ?', JSON.stringify([...week, { id: assignmentId(company, now), t: now }]), row.account);
  }

  /**
   * The ship's log (shipsLog.ts): Bitcoin orders filled and hearts on your
   * clips, as you've chosen, in one notification at most a day, never in quiet
   * hours. Each thing is said once.
   */
  private async shipsLog(row: ContactRow, now: number) {
    const kinds = JSON.parse(row.kinds ?? '{}') as LogKinds;
    if (!this.devicesOf(row.account).length || !(kinds.exchange || kinds.hearts)) return;
    if (now - (row.logged ?? 0) < LOG_EVERY || !awake(now, row.tz ?? 0)) return;
    const seen = new Set(JSON.parse(row.seen ?? '[]') as string[]);
    const items: LogItem[] = [];
    if (kinds.exchange) {
      const save = this.sql.exec('SELECT data FROM saves WHERE account = ?', row.account).toArray()[0];
      const orders = save ? ((JSON.parse(save.data as string) as { btcOrders?: BtcOrder[] }).btcOrders ?? []) : [];
      if (orders.length) items.push(...(await btcItems(orders, now, relayCandles, await relayPrice())));
    }
    if (kinds.hearts && this.env.CLIPS) items.push(...heartItems(await this.env.CLIPS.get(this.env.CLIPS.idFromName('clips')).heartsFor(row.account)));
    const fresh = items.filter((i) => !seen.has(i.key));
    if (!fresh.length) return;
    const { title, body } = logMessage(fresh);
    if (await this.notify(row.account, title, body)) this.sql.exec('UPDATE contact SET logged = ?, seen = ? WHERE account = ?', now, JSON.stringify([...seen, ...fresh.map((i) => i.key)].slice(-300)), row.account);
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

  // --- Submissions (docs/design/submissions.md) -------------------------------------

  /** POST /submissions {kind, file, note?, ai, via}: checked on the way in; a file that fails isn't kept. */
  private async submit(request: Request, account: Account): Promise<Response> {
    if (!account.callsign) return json({ error: 'Choose a callsign first: your work is credited to it' }, 403);
    const body = (await request.json().catch(() => null)) as { kind?: unknown; file?: unknown; note?: unknown; ai?: unknown; via?: unknown } | null;
    if (!body) return json({ error: 'Send JSON: {kind, file, note, ai, via}' }, 400);
    if (!KINDS.includes(body.kind as Kind)) return json({ error: `kind must be one of: ${KINDS.join(', ')}` }, 400);
    if (typeof body.ai !== 'boolean') return json({ error: 'Say whether an AI assistant helped: ai, true or false' }, 400);
    const via: Via = body.via === 'connector' ? 'connector' : 'site';
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : '';
    const now = Date.now();
    const today = this.sql.exec('SELECT COUNT(*) AS n FROM submissions WHERE account = ? AND created > ?', account.id, now - 86_400_000).one().n as number;
    if (today >= PER_DAY) return json({ error: `That's ${PER_DAY} today: send more tomorrow` }, 429);
    const open = this.sql.exec(`SELECT COUNT(*) AS n FROM submissions WHERE account = ? AND status IN ('submitted', 'changes')`, account.id).one().n as number;
    if (open >= OPEN_AT_ONCE) return json({ error: `You have ${open} waiting: wait for a review, or withdraw one` }, 429);
    const checked = this.checkFile(body.kind as Kind, body.file, account.callsign, body.ai);
    if ('error' in checked) return checked.error;
    const p = checked.prepared;
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    this.sql.exec(
      'INSERT INTO submissions (id, account, kind, item, title, revises, status, note, ai, via, version, file, warnings, created, updated) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)',
      id, account.id, body.kind as string, p.itemId, p.title, p.revises ? 1 : 0, 'submitted', note, body.ai ? 1 : 0, via, JSON.stringify(p.file), JSON.stringify(p.warnings), now, now,
    );
    return json({ submission: this.submissionOut(this.submissionRow(id)!, true) }, 201);
  }

  private checkFile(kind: Kind, raw: unknown, callsign: string, ai: boolean): { prepared: NonNullable<ReturnType<typeof prepare>['prepared']> } | { error: Response } {
    const parsed = parseFile(raw);
    if (!parsed.file) return { error: json({ error: parsed.error }, parsed.error?.includes('KB') ? 413 : 400) };
    const { prepared, problems } = prepare(kind, parsed.file, callsign, ai, CHECKS);
    if (!prepared) return { error: json({ error: "It doesn't pass the checks yet", problems }, 400) };
    return { prepared };
  }

  /** POST /submissions/check {kind, file}: the same checks, nothing stored, signed in or not. */
  private async checkOnly(request: Request): Promise<Response> {
    const minute = Math.floor(Date.now() / 60_000);
    if (this.checksByNet.minute !== minute) this.checksByNet = { minute, counts: new Map() };
    const net = await networkOf(request, (this.env.ADMIN_KEY ?? 'witchspace') + ':checks');
    const n = (this.checksByNet.counts.get(net) ?? 0) + 1;
    this.checksByNet.counts.set(net, n);
    if (n > CHECKS_PER_MINUTE) return json({ error: 'That’s a lot of checks: try again in a minute' }, 429);
    const body = (await request.json().catch(() => null)) as { kind?: unknown; file?: unknown } | null;
    if (!KINDS.includes(body?.kind as Kind)) return json({ error: `kind must be one of: ${KINDS.join(', ')}` }, 400);
    const account = await this.sessionAccount(request);
    const parsed = parseFile(body!.file);
    if (!parsed.file) return json({ error: parsed.error }, parsed.error?.includes('KB') ? 413 : 400);
    const { prepared, problems } = prepare(body!.kind as Kind, parsed.file, account?.callsign ?? 'You', true, CHECKS);
    return json(prepared ? { problems: [], warnings: prepared.warnings, title: prepared.title, itemId: prepared.itemId, revises: prepared.revises } : { problems, warnings: [], title: null, itemId: null, revises: null });
  }

  /** GET /submissions/mine: newest first, without the files, and how many more can be sent today. */
  private mySubmissions(account: Account): Response {
    const rows = this.sql.exec('SELECT * FROM submissions WHERE account = ? ORDER BY created DESC', account.id).toArray();
    const today = rows.filter((r) => (r.created as number) > Date.now() - 86_400_000).length;
    const waiting = rows.filter((r) => OPEN.includes(r.status as Status)).length;
    return json({ submissions: rows.map((r) => this.submissionOut(r, false)), limits: { today, perDay: PER_DAY, waiting, maxWaiting: OPEN_AT_ONCE } });
  }

  /** GET /submissions/<id>: yours, with the file. Anyone else's is "not found", so ids can't be fished for. */
  private oneSubmission(account: Account, id: string): Response {
    const row = this.submissionRow(id);
    if (!row || row.account !== account.id) return json({ error: 'No such submission' }, 404);
    return json({ submission: this.submissionOut(row, true) });
  }

  /** PUT /submissions/<id> {file, note?, ai?}: a new version, back in the queue. The old one is kept. */
  private async revise(request: Request, account: Account, id: string): Promise<Response> {
    const row = this.submissionRow(id);
    if (!row || row.account !== account.id) return json({ error: 'No such submission' }, 404);
    if (!OPEN.includes(row.status as Status)) return json({ error: `It's ${row.status}: it can't be changed now` }, 409);
    if (!account.callsign) return json({ error: 'Choose a callsign first: your work is credited to it' }, 403);
    const body = (await request.json().catch(() => null)) as { file?: unknown; note?: unknown; ai?: unknown } | null;
    if (!body) return json({ error: 'Send JSON: {file, note, ai}' }, 400);
    const ai = typeof body.ai === 'boolean' ? body.ai : row.ai === 1;
    const checked = this.checkFile(row.kind as Kind, body.file, account.callsign, ai);
    if ('error' in checked) return checked.error;
    const p = checked.prepared;
    if (p.itemId !== row.item) return json({ error: `This submission is "${row.item}": send "${p.itemId}" as a new submission` }, 400);
    const history = [...(JSON.parse(row.history as string) as unknown[]), { version: row.version, file: JSON.parse(row.file as string), note: row.note, at: row.updated }].slice(-10);
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, MAX_NOTE) : (row.note as string);
    this.sql.exec(
      `UPDATE submissions SET file = ?, warnings = ?, title = ?, note = ?, ai = ?, version = version + 1, status = 'submitted', history = ?, updated = ? WHERE id = ?`,
      JSON.stringify(p.file), JSON.stringify(p.warnings), p.title, note, ai ? 1 : 0, JSON.stringify(history), Date.now(), id,
    );
    return json({ submission: this.submissionOut(this.submissionRow(id)!, true) });
  }

  /** DELETE /submissions/<id>: withdrawn, while it's still waiting or sent back. */
  private withdraw(account: Account, id: string): Response {
    const row = this.submissionRow(id);
    if (!row || row.account !== account.id) return json({ error: 'No such submission' }, 404);
    if (!OPEN.includes(row.status as Status)) return json({ error: `It's ${row.status}: it can't be withdrawn now` }, 409);
    this.sql.exec(`UPDATE submissions SET status = 'withdrawn', updated = ? WHERE id = ?`, Date.now(), id);
    return json({ submission: this.submissionOut(this.submissionRow(id)!, false) });
  }

  /**
   * The maintainers' side, with the admin key: GET /submissions?status=… (oldest first), GET /submissions/<id>,
   * POST /submissions/<id>/review {decision: 'accept' | 'changes', notes?}.
   */
  private async reviewQueue(request: Request, url: URL, id: string | undefined, action: string | undefined): Promise<Response> {
    const key = request.headers.get('X-Admin-Key');
    if (!this.env.ADMIN_KEY || key !== this.env.ADMIN_KEY) return json({ error: 'Forbidden' }, 403);
    if (request.method === 'GET' && !id) {
      const status = url.searchParams.get('status') ?? 'submitted';
      const rows = this.sql.exec('SELECT s.*, a.callsign FROM submissions s JOIN accounts a ON a.id = s.account WHERE s.status = ? ORDER BY s.created', status).toArray();
      return json({ submissions: rows.map((r) => this.submissionOut(r, false, true)) });
    }
    if (!id || id === 'mine') return json({ error: 'Not found' }, 404);
    const row = this.sql.exec('SELECT s.*, a.callsign FROM submissions s JOIN accounts a ON a.id = s.account WHERE s.id = ?', id).toArray()[0];
    if (!row) return json({ error: 'No such submission' }, 404);
    if (request.method === 'GET' && !action) return json({ submission: this.submissionOut(row, true, true) });
    if (request.method !== 'POST' || action !== 'review') return json({ error: 'Not found' }, 404);
    const body = (await request.json().catch(() => null)) as { decision?: unknown; notes?: unknown } | null;
    const notes = typeof body?.notes === 'string' ? body.notes.trim().slice(0, MAX_NOTE) : '';
    if (!OPEN.includes(row.status as Status)) return json({ error: `It's ${row.status} already` }, 409);
    const now = Date.now();
    if (body?.decision === 'changes') {
      if (!notes) return json({ error: 'Say what to change: notes' }, 400);
      this.sql.exec(`UPDATE submissions SET status = 'changes', review = ?, updated = ? WHERE id = ?`, notes, now, id);
      await this.notify(row.account as string, `Your ${row.title as string} needs a change`, notes.slice(0, 160));
    } else if (body?.decision === 'accept') {
      let pr: string | null = null;
      if (gitHubReady(this.env)) {
        const s = this.submissionOut(row, true, true);
        try {
          pr = await openPullRequest(this.env, repoFile(s.kind, s.itemId, s.file!), pullRequestText({ ...s, callsign: s.callsign!, review: notes || null }));
        } catch (e) {
          return json({ error: (e as Error).message }, 502);
        }
      }
      this.sql.exec(`UPDATE submissions SET status = 'accepted', review = ?, pr = ?, updated = ? WHERE id = ?`, notes || null, pr, now, id);
      await this.notify(row.account as string, `Your ${row.title as string} is accepted`, 'A maintainer accepted it: it’s on its way into Witchspace, with your name on it.');
    } else return json({ error: "decision must be 'accept' or 'changes'" }, 400);
    return json({ submission: this.submissionOut({ ...this.submissionRow(id)!, callsign: row.callsign }, false, true) });
  }

  private submissionRow(id: string): Record<string, SqlStorageValue> | undefined {
    return this.sql.exec('SELECT * FROM submissions WHERE id = ?', id).toArray()[0];
  }

  private submissionOut(r: Record<string, SqlStorageValue>, withFile: boolean, withCallsign = false) {
    return {
      id: r.id as string,
      kind: r.kind as Kind,
      itemId: r.item as string,
      title: r.title as string,
      revises: r.revises === 1,
      status: r.status as Status,
      note: r.note as string,
      ai: r.ai === 1,
      via: r.via as Via,
      review: (r.review as string | null) ?? null,
      pr: (r.pr as string | null) ?? null,
      version: r.version as number,
      created: r.created as number,
      updated: r.updated as number,
      warnings: JSON.parse(r.warnings as string) as string[],
      ...(withFile ? { file: JSON.parse(r.file as string) as object } : {}),
      ...(withCallsign ? { callsign: r.callsign as string } : {}),
    };
  }

  // --- Signing in from an assistant (oauth.ts; docs/design/mcp-server.md) --------------

  /** POST /oauth/register (RFC 7591): any client may register; what it can do is still up to the person. */
  async oauthRegister(meta: { redirect_uris?: unknown; client_name?: unknown; client_uri?: unknown }): Promise<{ status: number; body: string }> {
    const redirects = Array.isArray(meta.redirect_uris) ? meta.redirect_uris : [];
    if (!redirects.length || redirects.length > 10 || !redirects.every(redirectOk)) return { status: 400, body: JSON.stringify({ error: 'invalid_redirect_uri', error_description: 'redirect_uris: one to ten https addresses (or http on localhost)' }) };
    const id = `wsc_${randomToken(18)}`;
    const name = clientName(meta.client_name);
    const uri = typeof meta.client_uri === 'string' && redirectOk(meta.client_uri) ? meta.client_uri : null;
    const now = Date.now();
    this.sql.exec('INSERT INTO oauth_clients (id, name, uri, redirects, created) VALUES (?, ?, ?, ?, ?)', id, name, uri, JSON.stringify(redirects), now);
    return {
      status: 201,
      body: JSON.stringify({ client_id: id, client_id_issued_at: Math.floor(now / 1000), client_name: name, ...(uri ? { client_uri: uri } : {}), redirect_uris: redirects, grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], token_endpoint_auth_method: 'none' }),
    };
  }

  /** A client by id: registered here, or (a URL) its metadata document, fetched and kept. */
  private async oauthClient(id: string): Promise<{ id: string; name: string; uri: string | null; redirects: string[] } | null> {
    const row = this.sql.exec('SELECT * FROM oauth_clients WHERE id = ?', id).toArray()[0];
    if (row && (!isMetadataUrl(id) || (row.created as number) > Date.now() - 86_400_000)) {
      return { id, name: row.name as string, uri: (row.uri as string | null) ?? null, redirects: JSON.parse(row.redirects as string) as string[] };
    }
    if (!isMetadataUrl(id)) return null;
    try {
      const res = await fetch(id, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(5000) });
      const doc = (await res.json()) as { client_id?: unknown; client_name?: unknown; client_uri?: unknown; redirect_uris?: unknown };
      const redirects = Array.isArray(doc.redirect_uris) ? doc.redirect_uris.filter(redirectOk) : [];
      if (!res.ok || doc.client_id !== id || !redirects.length) return null;
      const name = clientName(doc.client_name);
      const uri = typeof doc.client_uri === 'string' && redirectOk(doc.client_uri) ? doc.client_uri : null;
      this.sql.exec('INSERT OR REPLACE INTO oauth_clients (id, name, uri, redirects, created) VALUES (?, ?, ?, ?, ?)', id, name, uri, JSON.stringify(redirects), Date.now());
      return { id, name, uri, redirects };
    } catch {
      return null;
    }
  }

  /**
   * GET /oauth/authorize: check the request, keep it, and send the browser to the site's connect page.
   * A bad client or return address gets a page (never a redirect to somewhere unchecked); anything else
   * goes back to the client as an OAuth error.
   */
  async oauthStart(q: Record<string, string>, issuer: string): Promise<{ redirect: string } | { page: string }> {
    const client = q.client_id ? await this.oauthClient(q.client_id) : null;
    if (!client) return { page: 'That assistant isn’t known to Witchspace. Try adding the connector again.' };
    const redirect = q.redirect_uri ?? (client.redirects.length === 1 ? client.redirects[0] : '');
    if (!client.redirects.includes(redirect)) return { page: 'That assistant asked to be sent somewhere it didn’t register. Try adding the connector again.' };
    const fail = (error: string, description: string) => ({ redirect: withParams(redirect, { error, error_description: description, state: q.state }) });
    if (q.response_type !== 'code') return fail('unsupported_response_type', 'Only response_type=code');
    if (q.code_challenge_method !== 'S256' || !challengeOk(q.code_challenge)) return fail('invalid_request', 'PKCE with S256 is required');
    if (q.scope && !q.scope.split(' ').every((s) => s === SCOPE)) return fail('invalid_scope', `The only scope is "${SCOPE}"`);
    const now = Date.now();
    this.sql.exec('DELETE FROM oauth_requests WHERE expires < ?', now);
    const id = randomToken(24);
    this.sql.exec('INSERT INTO oauth_requests (id, client, redirect, state, challenge, expires) VALUES (?, ?, ?, ?, ?, ?)', id, client.id, redirect, q.state ?? null, q.code_challenge, now + REQUEST_TTL);
    return { redirect: withParams(connectPage(issuer), { request: id }) };
  }

  private signInRequest(id: string) {
    return this.sql.exec('SELECT r.*, c.name, c.uri FROM oauth_requests r JOIN oauth_clients c ON c.id = r.client WHERE r.id = ? AND r.expires > ?', id, Date.now()).toArray()[0];
  }

  /** GET /oauth/request/<id>, for the connect page: who's asking, and (signed in) as whom. */
  private async describeSignIn(request: Request, id: string): Promise<Response> {
    const r = this.signInRequest(id);
    if (!r) return json({ error: 'That sign-in has expired: start again from your assistant' }, 404);
    const account = await this.sessionAccount(request);
    return json({ client: { name: r.name as string, uri: (r.uri as string | null) ?? null }, scope: SCOPE, expires: r.expires as number, ...(account ? { callsign: account.callsign } : {}) });
  }

  /** POST /oauth/request/<id> {allow}, signed in: the address to send the browser back to the client. */
  private async answerSignIn(request: Request, id: string): Promise<Response> {
    const account = await this.sessionAccount(request);
    if (!account) return json({ error: 'Please sign in' }, 401);
    const r = this.signInRequest(id);
    if (!r) return json({ error: 'That sign-in has expired: start again from your assistant' }, 404);
    const body = (await request.json().catch(() => null)) as { allow?: unknown } | null;
    const state = (r.state as string | null) ?? undefined;
    if (body?.allow !== true) {
      this.sql.exec('DELETE FROM oauth_requests WHERE id = ?', id);
      return json({ redirect: withParams(r.redirect as string, { error: 'access_denied', error_description: 'The commander said no', state }) });
    }
    if (!account.callsign) return json({ error: 'Choose a callsign first: your work is credited to it' }, 403);
    this.sql.exec('DELETE FROM oauth_requests WHERE id = ?', id);
    const code = randomToken(32);
    this.sql.exec('DELETE FROM oauth_codes WHERE expires < ?', Date.now());
    this.sql.exec('INSERT INTO oauth_codes (hash, client, redirect, challenge, account, expires) VALUES (?, ?, ?, ?, ?, ?)', await sha256(code), r.client, r.redirect, r.challenge, account.id, Date.now() + CODE_TTL);
    return json({ redirect: withParams(r.redirect as string, { code, state }) });
  }

  /** POST /oauth/token: a code (with its PKCE verifier) or a refresh token, for a new pair. */
  async oauthToken(f: Record<string, string>): Promise<{ status: number; body: string }> {
    const bad = (error: string, error_description: string, status = 400) => ({ status, body: JSON.stringify({ error, error_description }) });
    const now = Date.now();
    let account: string;
    let client: string;
    if (f.grant_type === 'authorization_code') {
      if (!f.code || !f.client_id || !verifierOk(f.code_verifier)) return bad('invalid_request', 'code, client_id and code_verifier are needed');
      const hash = await sha256(f.code);
      const c = this.sql.exec('SELECT * FROM oauth_codes WHERE hash = ?', hash).toArray()[0];
      this.sql.exec('DELETE FROM oauth_codes WHERE hash = ?', hash); // once only, right or wrong
      if (!c || (c.expires as number) < now) return bad('invalid_grant', 'That code has expired or been used');
      if (c.client !== f.client_id || (f.redirect_uri && f.redirect_uri !== c.redirect)) return bad('invalid_grant', 'That code was issued to someone else');
      if ((await s256(f.code_verifier)) !== c.challenge) return bad('invalid_grant', 'The PKCE verifier doesn’t match');
      account = c.account as string;
      client = c.client as string;
    } else if (f.grant_type === 'refresh_token') {
      if (!f.refresh_token) return bad('invalid_request', 'refresh_token is needed');
      const hash = await sha256(f.refresh_token);
      const t = this.sql.exec(`SELECT * FROM oauth_tokens WHERE hash = ? AND kind = 'refresh'`, hash).toArray()[0];
      if (!t || (t.expires as number) < now || (f.client_id && f.client_id !== t.client)) return bad('invalid_grant', 'That refresh token has expired or been used');
      this.sql.exec('DELETE FROM oauth_tokens WHERE hash = ?', hash); // replaced at each use
      account = t.account as string;
      client = t.client as string;
    } else return bad('unsupported_grant_type', 'authorization_code or refresh_token');
    if (!this.sql.exec('SELECT 1 FROM accounts WHERE id = ?', account).toArray().length) return bad('invalid_grant', 'That account no longer exists');
    this.sql.exec('DELETE FROM oauth_tokens WHERE expires < ?', now);
    const access = `wsa_${randomToken(32)}`;
    const refresh = `wsr_${randomToken(32)}`;
    this.sql.exec(`INSERT INTO oauth_tokens (hash, kind, account, client, expires) VALUES (?, 'access', ?, ?, ?)`, await sha256(access), account, client, now + ACCESS_TTL);
    this.sql.exec(`INSERT INTO oauth_tokens (hash, kind, account, client, expires) VALUES (?, 'refresh', ?, ?, ?)`, await sha256(refresh), account, client, now + REFRESH_TTL);
    return { status: 200, body: JSON.stringify({ access_token: access, token_type: 'Bearer', expires_in: ACCESS_TTL / 1000, refresh_token: refresh, scope: SCOPE }) };
  }

  /** The account an access token acts for, from the MCP route. */
  async oauthAccount(token: string): Promise<{ id: string; callsign: string | null } | null> {
    if (typeof token !== 'string' || !token.startsWith('wsa_')) return null;
    const row = this.sql
      .exec(`SELECT a.id, a.callsign FROM oauth_tokens t JOIN accounts a ON a.id = t.account WHERE t.hash = ? AND t.kind = 'access' AND t.expires > ?`, await sha256(token), Date.now())
      .toArray()[0];
    return row ? { id: row.id as string, callsign: (row.callsign as string | null) ?? null } : null;
  }

  /** GET /me/connections: the assistants signed in as you, and until when (the latest refresh token's end). */
  private connections(account: Account): Response {
    const rows = this.sql
      .exec(`SELECT t.client, c.name, c.uri, MAX(t.expires) AS until FROM oauth_tokens t JOIN oauth_clients c ON c.id = t.client
        WHERE t.account = ? AND t.expires > ? GROUP BY t.client ORDER BY until DESC`, account.id, Date.now())
      .toArray();
    return json({ connections: rows.map((r) => ({ client: r.client as string, name: r.name as string, uri: (r.uri as string | null) ?? null, until: r.until as number })) });
  }

  /** DELETE /me/connections?client=<id>: sign that assistant out now, every token and code it holds. */
  private disconnect(account: Account, client: string): Response {
    if (!client) return json({ error: 'Which assistant? ?client=<id>' }, 400);
    this.sql.exec('DELETE FROM oauth_tokens WHERE account = ? AND client = ?', account.id, client);
    this.sql.exec('DELETE FROM oauth_codes WHERE account = ? AND client = ?', account.id, client);
    return json({ disconnected: true });
  }

  /** The connector's tools, as the signed-in account: the same submission routes the site uses. */
  async asAccount(accountId: string, method: string, path: string, body?: string): Promise<{ status: number; data: string }> {
    const row = this.sql.exec('SELECT id, email, callsign FROM accounts WHERE id = ?', accountId).toArray()[0];
    if (!row) return { status: 401, data: JSON.stringify({ error: 'That account no longer exists' }) };
    const account: Account = { id: row.id as string, email: row.email as string, callsign: (row.callsign as string | null) ?? null };
    const url = new URL(path, 'https://accounts.internal');
    const request = new Request(url, { method, ...(body === undefined ? {} : { body, headers: { 'Content-Type': 'application/json' } }) });
    const sub = url.pathname.match(/^\/submissions(?:\/(mine|[a-z0-9]{10}))?$/);
    let res: Response = json({ error: 'Not found' }, 404);
    if (sub && method === 'POST' && !sub[1]) res = await this.submit(request, account);
    else if (sub && method === 'GET' && sub[1] === 'mine') res = this.mySubmissions(account);
    else if (sub && sub[1] && sub[1] !== 'mine') {
      if (method === 'GET') res = this.oneSubmission(account, sub[1]);
      if (method === 'PUT') res = await this.revise(request, account, sub[1]);
      if (method === 'DELETE') res = this.withdraw(account, sub[1]);
    }
    return { status: res.status, data: await res.text() };
  }

  private deleteAccount(account: Account): Response {
    for (const table of ['saves', 'sessions', 'contact', 'devices', 'firsts', 'submissions', 'oauth_codes', 'oauth_tokens']) this.sql.exec(`DELETE FROM ${table} WHERE account = ?`, account.id);
    this.sql.exec('DELETE FROM links WHERE email = ?', account.email);
    this.sql.exec('DELETE FROM codes WHERE email = ?', account.email);
    this.sql.exec('DELETE FROM accounts WHERE id = ?', account.id);
    return json({ deleted: true });
  }
}

// --- The companies get in touch ----------------------------------------------------

const CONTACT_EVERY = 3600_000; // how often to look for waiting assignments
const CONTACT_PER_WEEK = 2;
/** SQL: the contact row's account has a device to notify. */
const HAS_DEVICE = 'EXISTS (SELECT 1 FROM devices d WHERE d.account = contact.account)';

interface ContactRow {
  account: string;
  email: number;
  stop: string;
  sent: string;
  kinds?: string;
  tz?: number;
  logged?: number;
  seen?: string;
}

// The real price, straight from our relay in Tokyo (the Worker's /btc routes are for our pages).
const RELAY = 'https://witchspace-relay.fly.dev';
const relayCandles = async (interval: string, limit: number, start: number): Promise<PriceSpan[] | null> =>
  (await fetch(`${RELAY}/btc/candles?interval=${interval}&limit=${limit}&start=${start}`, { signal: AbortSignal.timeout(8_000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)) as PriceSpan[] | null;
const relayPrice = async (): Promise<PriceSpan | null> => {
  const q = (await fetch(`${RELAY}/btc`, { signal: AbortSignal.timeout(8_000) })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)) as { price?: number; time?: number } | null;
  return q?.price && q.time ? { t: q.time, h: q.price, l: q.price } : null;
};

