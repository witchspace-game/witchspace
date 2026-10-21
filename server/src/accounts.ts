// Accounts: sign in with an email link (no passwords), a callsign that's yours
// alone, and a cloud save of your commander so you can play on any device.
// One Durable Object holds them all in its own SQLite database.
//
// Privacy: we keep your email address, your callsign and your save, and
// nothing else about you. Sign-in links and sessions are stored only as
// hashes, so a copy of the database can't be used to sign in as anyone.
// Deleting your account removes all of it.

import { DurableObject } from 'cloudflare:workers';
import { cleanName } from './protocol';
import { isHuman, json, networkOf, randomToken, sha256 } from './http';

export interface AccountsEnv {
  /** Resend, for sign-in emails. Without it (local development) the link is returned instead of sent. */
  RESEND_API_KEY?: string;
  TURNSTILE_SECRET?: string;
  ADMIN_KEY?: string;
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
    this.sql.exec('CREATE TABLE IF NOT EXISTS sessions (hash TEXT PRIMARY KEY, account TEXT NOT NULL, expires INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS saves (account TEXT PRIMARY KEY, data TEXT NOT NULL, updated INTEGER NOT NULL)');
    this.sql.exec('CREATE TABLE IF NOT EXISTS sends (email TEXT NOT NULL, net TEXT NOT NULL, t INTEGER NOT NULL)');
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;
    const m = request.method;
    if (m === 'POST' && path === '/auth/request') return this.requestLink(request);
    if (m === 'POST' && path === '/auth/verify') return this.verify(request);

    const account = await this.sessionAccount(request);
    if (!account) return json({ error: 'Please sign in' }, 401);
    if (m === 'GET' && path === '/me') return json({ account, saveUpdated: this.saveUpdated(account.id) });
    if (m === 'POST' && path === '/me/callsign') return this.setCallsign(request, account);
    if (m === 'GET' && path === '/me/save') return this.getSave(account);
    if (m === 'PUT' && path === '/me/save') return this.putSave(request, account);
    if (m === 'POST' && path === '/auth/signout') return this.signOut(request);
    if (m === 'DELETE' && path === '/me') return this.deleteAccount(account);
    return json({ error: 'Not found' }, 404);
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

    if (!this.env.RESEND_API_KEY) {
      // Local development: no email service, so hand the link back to be shown.
      if (site !== SITE) return json({ sent: false, devLink: link });
      return json({ error: 'Sign-in email isn’t set up yet' }, 503);
    }
    const sent = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'Witchspace <signin@witchspace.org.uk>',
        to: [email],
        subject: 'Your Witchspace sign-in link',
        text: `Right on, Commander.\n\nSign in to Witchspace with this link (it works once, for ${LINK_MINUTES} minutes):\n\n${link}\n\nIf you didn't ask for this, you can ignore this email.\n\nWitchspace · ${SITE}`,
        html: emailHtml(link),
      }),
    });
    if (!sent.ok) return json({ error: 'The email couldn’t be sent just now: please try again' }, 502);
    return json({ sent: true });
  }

  private async verify(request: Request): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { token?: unknown } | null;
    if (typeof body?.token !== 'string') return json({ error: 'No sign-in link' }, 400);
    const hash = await sha256(body.token);
    const link = this.sql.exec('SELECT email, expires FROM links WHERE hash = ?', hash).toArray()[0];
    // A link works once.
    this.sql.exec('DELETE FROM links WHERE hash = ?', hash);
    if (!link || (link.expires as number) < Date.now()) return json({ error: 'That sign-in link has expired or been used: ask for a new one' }, 400);
    const email = link.email as string;
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
    const row = this.sql
      .exec('SELECT a.id, a.email, a.callsign FROM sessions s JOIN accounts a ON a.id = s.account WHERE s.hash = ? AND s.expires > ?', await sha256(token), Date.now())
      .toArray()[0];
    return row ? { id: row.id as string, email: row.email as string, callsign: (row.callsign as string | null) ?? null } : null;
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
    const key = callsign.toLowerCase();
    const taken = this.sql.exec('SELECT id FROM accounts WHERE callsign_key = ? AND id != ?', key, account.id).toArray()[0];
    if (taken) return json({ error: `CMDR ${callsign} is already taken: try another` }, 409);
    this.sql.exec('UPDATE accounts SET callsign = ?, callsign_key = ? WHERE id = ?', callsign, key, account.id);
    return json({ callsign });
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

  private deleteAccount(account: Account): Response {
    for (const table of ['saves', 'sessions']) this.sql.exec(`DELETE FROM ${table} WHERE account = ?`, account.id);
    this.sql.exec('DELETE FROM links WHERE email = ?', account.email);
    this.sql.exec('DELETE FROM accounts WHERE id = ?', account.id);
    return json({ deleted: true });
  }
}

function emailHtml(link: string): string {
  return `<!doctype html><html><body style="margin:0;background:#05070d;font-family:Arial,Helvetica,sans-serif;color:#eaf0f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" style="max-width:480px;background:#0b111c;border:1px solid #1f2a3a;border-radius:16px" cellpadding="0" cellspacing="0"><tr><td style="padding:32px">
<p style="margin:0 0 6px;font-size:13px;letter-spacing:4px;color:#3dffb0">WITCHSPACE</p>
<h1 style="margin:0 0 14px;font-size:24px;color:#eaf0f6">Right on, Commander.</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.5;color:#c2cddb">Here's your link to sign in. It works once, for ${LINK_MINUTES} minutes.</p>
<p style="margin:0 0 24px"><a href="${link}" style="display:inline-block;padding:13px 26px;border-radius:999px;background:#3dffb0;color:#03140e;font-weight:bold;text-decoration:none">Sign in to Witchspace</a></p>
<p style="margin:0;font-size:13px;line-height:1.5;color:#95a3b8">If you didn't ask for this, you can ignore this email: nobody can sign in without the link.</p>
</td></tr></table>
<p style="margin:18px 0 0;font-size:12px;color:#5d6b80">witchspace.org.uk · a free, open-source tribute to Elite (1984)</p>
</td></tr></table></body></html>`;
}
