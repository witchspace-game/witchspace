// Clip pages (docs/design/flight-recorder.md, "Clip pages"): moments shared as
// flight tracks, never video. One Durable Object keeps them in its SQLite
// database with their hearts and reports. Every track is checked and its words
// written by the server (clipCheck.ts). The defences, as on the ideas board:
// - one heart per clip per browser, and only a few from any one network;
// - rate limits on sharing and hearting;
// - reports: a clip reported by enough different browsers is hidden until
//   someone looks; the admin key can hide or restore any clip.

import { DurableObject } from 'cloudflare:workers';
import { json, networkOf } from './http';
import { checkTrack, MAX_TRACK_BYTES } from './clipCheck';
import { FEED_EACH, type ClipEvent } from './feed';
import data from './mcp-data.json';

export interface ClipsEnv {
  ADMIN_KEY?: string;
}

const SHIP_NAMES = new Map((data as { ships: { id: string; name: string }[] }).ships.map((s) => [s.id, s.name]));
const SITE = 'https://witchspace.org.uk';
const HEARTS_PER_NETWORK = 3; // per clip
const REPORTS_TO_HIDE = 3;
const SHARES_PER_HOUR = 6;
const HEARTS_PER_MINUTE = 30;

const voterOk = (v: string | null): v is string => Boolean(v && /^[A-Za-z0-9-]{16,64}$/.test(v));
const idOk = (id: string | undefined): id is string => Boolean(id && /^[a-z0-9]{8,12}$/.test(id));

/** Read a body, gzipped, up to a limit; then unzip it, up to another. */
async function gunzip(body: ArrayBuffer): Promise<Uint8Array | null> {
  if (body.byteLength > MAX_TRACK_BYTES) return null;
  try {
    const out = await new Response(new Blob([body]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return new Uint8Array(out);
  } catch {
    return null;
  }
}
const gzip = async (bytes: Uint8Array) => new Uint8Array(await new Response(new Blob([bytes as BlobPart]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
const b64 = (bytes: Uint8Array) => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export class ClipBoard extends DurableObject<ClipsEnv> {
  private readonly sql = this.ctx.storage.sql;

  constructor(ctx: DurableObjectState, env: ClipsEnv) {
    super(ctx, env);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS clips (
      id TEXT PRIMARY KEY, created INTEGER NOT NULL, title TEXT NOT NULL, system TEXT NOT NULL, focus TEXT,
      seconds REAL NOT NULL, track BLOB NOT NULL, account TEXT, hidden INTEGER NOT NULL DEFAULT 0, hearts INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS hearts (clip TEXT NOT NULL, voter TEXT NOT NULL, net TEXT NOT NULL, PRIMARY KEY (clip, voter))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS reports (clip TEXT NOT NULL, voter TEXT NOT NULL, t INTEGER NOT NULL, PRIMARY KEY (clip, voter))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS activity (voter TEXT NOT NULL, net TEXT NOT NULL, kind TEXT NOT NULL, t INTEGER NOT NULL)`);
    // Who put a clip up, so they can find it and take it down (Mark: "I don't even know where my clips are?"):
    // the account if signed in (kept from the start), and the browser that shared it (from 27 October 2026).
    for (const col of ['sharer TEXT', 'withdrawn INTEGER NOT NULL DEFAULT 0']) {
      try {
        this.sql.exec(`ALTER TABLE clips ADD COLUMN ${col}`);
      } catch {
        /* already there */
      }
    }
  }

  /** Share a track. `callsign` and `account` come from the session, checked by the Worker, never from the body. */
  async share(body: ArrayBuffer, seconds: number, voter: string | null, ip: string, account: { id: string; callsign: string | null } | null) {
    if (!voterOk(voter)) return { error: 'No voter id', status: 400 };
    const net = await this.net(ip);
    if (this.recent(voter, net, 'share', 3600_000) >= SHARES_PER_HOUR) return { error: 'That’s plenty of clips for one hour: try again later', status: 429 };
    const packed = await gunzip(body);
    if (!packed) return { error: 'That track is too big, or not a track', status: 400 };
    const c = checkTrack(packed, SHIP_NAMES, account?.callsign ?? null, seconds);
    if (typeof c === 'string') return { error: c, status: 400 };
    const id = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
    this.sql.exec('INSERT INTO clips (id, created, title, system, focus, seconds, track, account, sharer) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', id, Date.now(), c.title, c.system, c.focusDef, c.seconds, await gzip(c.packed), account?.id ?? null, voter);
    this.note(voter, net, 'share');
    return { id, url: `${SITE}/clip/${id}`, title: c.title, status: 200 };
  }

  /** A clip, for its page: what it is, its hearts, and its track (gzipped, base64). */
  get(id: string, voter: string | null) {
    if (!idOk(id)) return null;
    const r = this.sql.exec('SELECT * FROM clips WHERE id = ? AND hidden = 0', id).toArray()[0];
    if (!r) return null;
    const mine = voterOk(voter) && this.sql.exec('SELECT 1 FROM hearts WHERE clip = ? AND voter = ?', id, voter).toArray().length > 0;
    return { id, title: r.title as string, system: r.system as string, focus: (r.focus as string | null) ?? null, seconds: r.seconds as number, created: r.created as number, hearts: r.hearts as number, mine, track: b64(new Uint8Array(r.track as ArrayBuffer)) };
  }

  /** Give or take back a heart. */
  async heart(id: string, voter: string | null, ip: string, on: boolean) {
    if (!voterOk(voter)) return { error: 'No voter id', status: 400 };
    if (!this.get(id, null)) return { error: 'No such clip', status: 404 };
    const net = await this.net(ip);
    if (this.recent(voter, net, 'heart', 60_000) >= HEARTS_PER_MINUTE) return { error: 'Slow down a little', status: 429 };
    const had = this.sql.exec('SELECT 1 FROM hearts WHERE clip = ? AND voter = ?', id, voter).toArray().length > 0;
    if (on && !had) {
      const others = this.sql.exec('SELECT COUNT(*) AS n FROM hearts WHERE clip = ? AND net = ?', id, net).one().n as number;
      if (others >= HEARTS_PER_NETWORK) return { error: 'Enough hearts from your network on this clip', status: 429 };
      this.sql.exec('INSERT INTO hearts (clip, voter, net) VALUES (?, ?, ?)', id, voter, net);
    } else if (!on && had) this.sql.exec('DELETE FROM hearts WHERE clip = ? AND voter = ?', id, voter);
    const hearts = this.sql.exec('SELECT COUNT(*) AS n FROM hearts WHERE clip = ?', id).one().n as number;
    this.sql.exec('UPDATE clips SET hearts = ? WHERE id = ?', hearts, id);
    this.note(voter, net, 'heart');
    return { hearts, mine: on, status: 200 };
  }

  report(id: string, voter: string | null) {
    if (!voterOk(voter) || !idOk(id)) return { error: 'No voter id', status: 400 };
    this.sql.exec('INSERT OR IGNORE INTO reports (clip, voter, t) VALUES (?, ?, ?)', id, voter, Date.now());
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM reports WHERE clip = ?', id).one().n as number;
    if (n >= REPORTS_TO_HIDE) this.sql.exec('UPDATE clips SET hidden = 1 WHERE id = ?', id);
    return { ok: true, status: 200 };
  }

  /** A commander's shared clips and their hearts, for the ship's log. */
  heartsFor(account: string): { id: string; title: string; hearts: number }[] {
    return this.sql.exec('SELECT id, title, hearts FROM clips WHERE account = ? AND hidden = 0', account).toArray().map((r) => ({ id: r.id as string, title: r.title as string, hearts: r.hearts as number }));
  }

  /** Clips shared since `since`, newest first, never hidden ones: for the live feed (feed.ts). */
  latest(since: number): ClipEvent[] {
    return this.sql
      .exec('SELECT id, created, title, system, hearts FROM clips WHERE hidden = 0 AND created > ? ORDER BY created DESC LIMIT ?', since, FEED_EACH)
      .toArray()
      .map((r) => ({ kind: 'clip', t: r.created as number, id: r.id as string, title: r.title as string, system: r.system as string, hearts: r.hearts as number }));
  }

  /** The clips you put up, from this browser or your account, newest first: up, or taken down by you. */
  mine(account: string | null, voter: string | null): { id: string; url: string; title: string; system: string; created: number; hearts: number; up: boolean }[] {
    if (!account && !voterOk(voter)) return [];
    return this.sql
      .exec('SELECT id, title, system, created, hearts, hidden, withdrawn FROM clips WHERE (account = ? OR sharer = ?) AND (hidden = 0 OR withdrawn = 1) ORDER BY created DESC LIMIT 100', account ?? '', voterOk(voter) ? voter : '')
      .toArray()
      .map((r) => ({ id: r.id as string, url: `${SITE}/clip/${r.id as string}`, title: r.title as string, system: r.system as string, created: r.created as number, hearts: r.hearts as number, up: r.hidden === 0 }));
  }

  /** Take your own clip down (or put it back up): gone from its page and the feed. Only its sharer, by account or browser. */
  takeDown(id: string, account: string | null, voter: string | null, down = true) {
    if (!idOk(id)) return { error: 'No such clip', status: 404 };
    const r = this.sql.exec('SELECT account, sharer, hidden, withdrawn FROM clips WHERE id = ?', id).toArray()[0];
    if (!r) return { error: 'No such clip', status: 404 };
    const yours = (account && r.account === account) || (voterOk(voter) && r.sharer === voter);
    if (!yours) return { error: 'That clip isn’t yours to take down', status: 403 };
    // A clip hidden by reports or the admin stays hidden: only a withdrawn one can be put back.
    if (!down && r.hidden === 1 && r.withdrawn !== 1) return { error: 'That clip is hidden for review', status: 409 };
    this.sql.exec('UPDATE clips SET hidden = ?, withdrawn = ? WHERE id = ?', down ? 1 : 0, down ? 1 : 0, id);
    return { ok: true, up: !down, status: 200 };
  }

  /** The admin key hides or restores a clip. */
  admin(id: string, key: string | null, hidden: boolean) {
    if (!this.env.ADMIN_KEY || key !== this.env.ADMIN_KEY) return { error: 'Not allowed', status: 403 };
    this.sql.exec('UPDATE clips SET hidden = ? WHERE id = ?', hidden ? 1 : 0, id);
    return { ok: true, status: 200 };
  }

  /** The small page link previewers see: the title, and the card of the ship involved. */
  card(id: string): Response {
    const c = this.get(id, null);
    const url = `${SITE}/clip/${id}`;
    const title = c ? c.title : 'Witchspace';
    const image = `${SITE}/share/${c?.focus && SHIP_NAMES.has(c.focus) && c.focus !== 'missile' && c.focus !== 'cargo-canister' ? `ships-${c.focus}` : 'play'}.jpg`;
    const desc = c ? `Replayed from the flight recorder at ${c.system}. Watch it from outside, then fly it yourself: Witchspace is free in your browser.` : 'A free, open-source space game in your browser.';
    const html = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><link rel="canonical" href="${url}">
<meta property="og:type" content="video.other"><meta property="og:site_name" content="Witchspace"><meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${url}"><meta property="og:image" content="${image}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}"><meta name="twitter:image" content="${image}">
</head><body><p><a href="${url}">${esc(title)}</a></p></body></html>`;
    return new Response(html, { status: c ? 200 : 404, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  }

  private net(ip: string) {
    return networkOf(new Request('https://x', { headers: { 'CF-Connecting-IP': ip } }), (this.env.ADMIN_KEY ?? 'witchspace') + ':clips');
  }

  private recent(voter: string, net: string, kind: string, ms: number): number {
    const since = Date.now() - ms;
    this.sql.exec('DELETE FROM activity WHERE t < ?', Date.now() - 86_400_000);
    return this.sql.exec('SELECT COUNT(*) AS n FROM activity WHERE (voter = ? OR net = ?) AND kind = ? AND t > ?', voter, net, kind, since).one().n as number;
  }

  private note(voter: string, net: string, kind: string) {
    this.sql.exec('INSERT INTO activity (voter, net, kind, t) VALUES (?, ?, ?, ?)', voter, net, kind, Date.now());
  }
}
