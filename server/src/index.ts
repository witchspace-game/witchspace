// Witchspace shared space (stage 1): a Cloudflare Worker that routes each
// commander's WebSocket to the Durable Object for their star system. Each
// system's object checks moves and relays them to everyone else there. It
// uses hibernating WebSockets, so a system with nobody in it costs nothing.
// See docs/design/servers-and-hosting.md.

import { DurableObject } from 'cloudflare:workers';
import { BUMP_COOLDOWN, cleanName, COLLIDE, ECM_COOLDOWN, ECM_RANGE, GIMBAL_DAMAGE, isQuat, isVec3, LASERS, LOCK_RANGE, MISSILE, RANKS, REWIND, SHIPS, type ClientMessage, type Commander, type ServerMessage, type Vec3 } from './protocol';
import { nameRule } from './names';
import { Accounts, type AccountsEnv } from './accounts';
import { IdeasBoard, type IdeasEnv } from './ideas';
import { CORS as MCP_CORS, mcp } from './mcp';
import { buildTools } from './mcpBuild';
import { authServerMetadata, BUILD_PATH, issuerOf, protectedResourceMetadata } from './oauth';
import { btc, isBtc } from './btc';
import { ClipBoard, type ClipsEnv } from './clips';
import { buildFeed, FEED_MAX_AGE, FEED_WINDOW } from './feed';
import { canFire, checkMove, closestApproach, collisionDamage, positionAt, recharge, reportHealth, resolveShot, stepMissile, takeHit, type Flight, type Health, type Sample, type Track } from './rules';

export interface Env extends IdeasEnv, AccountsEnv, ClipsEnv {
  SYSTEMS: DurableObjectNamespace<SystemRoom>;
  IDEAS: DurableObjectNamespace<IdeasBoard>;
  ACCOUNTS: DurableObjectNamespace<Accounts>;
  CLIPS: DurableObjectNamespace<ClipBoard>;
  /** Only for `wrangler dev`: the local address, as the OAuth issuer (oauth.ts). */
  OAUTH_ISSUER?: string;
}

export { Accounts, ClipBoard, IdeasBoard };

/** The one Accounts object, which holds every account. */
const accountsOf = (env: Env) => env.ACCOUNTS.get(env.ACCOUNTS.idFromName('accounts'));

/** CORS for the ideas board, which the website calls from witchspace.org.uk. */
function cors(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Voter, X-Admin-Key, Authorization',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

/** Pages allowed to connect: the live site and local development. */
const ORIGINS = [/^https:\/\/(www\.)?witchspace\.org\.uk$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const MAX_PER_SYSTEM = 64; // commanders closely simulated in one system (stage 1)
const MAX_MESSAGES_PER_SECOND = 30;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
    // Clip pages (server/src/clips.ts): moments shared as tracks. The card is for link previewers, so open to all.
    const card = url.pathname.match(/^\/clip-card\/([a-z0-9]{8,12})$/);
    if (card) return clipsOf(env).card(card[1]);
    const clip = url.pathname.match(/^\/clips(?:\/([a-z0-9]{8,12})(?:\/(heart|report|admin))?)?$/);
    if (clip) return clipRoute(request, env, clip[1], clip[2]);
    // The live Bitcoin price, for the exchange (server/src/btc.ts): our pages only.
    if (isBtc(url.pathname)) {
      const origin = request.headers.get('Origin') ?? '';
      if (!ORIGINS.some((o) => o.test(origin))) return new Response('Forbidden', { status: 403 });
      return btc(request, url.pathname, cors(origin), ctx);
    }
    // The MCP server for AI assistants: public and read-only, so open to any caller (server/src/mcp.ts).
    if (url.pathname === '/mcp') return mcp(request);
    // Signing in from an assistant (server/src/oauth.ts), and the signed-in MCP address that needs it.
    if (url.pathname === BUILD_PATH) return mcpBuild(request, env);
    if (url.pathname.startsWith('/.well-known/oauth-') || ['/oauth/register', '/oauth/authorize', '/oauth/token'].includes(url.pathname)) return oauthRoute(request, env, url);
    // The live feed for the home page (server/src/feed.ts): public, cached at the edge.
    if (url.pathname === '/feed') return feedRoute(request, env, ctx);
    // A link in an email, so no Origin: stop the companies getting in touch.
    if (url.pathname === '/contact/stop') return accountsOf(env).fetch(request);
    // The ideas board (/ideas…) and accounts (/auth…, /me…, /admin…, /submissions…), called from our pages and tools.
    const ideas = url.pathname === '/ideas' || url.pathname.startsWith('/ideas/');
    const accounts = ['/auth/', '/me/', '/admin/', '/contact/', '/push/', '/stats/', '/firsts/', '/oauth/request/'].some((p) => url.pathname.startsWith(p)) || url.pathname === '/me' || url.pathname === '/submissions' || url.pathname.startsWith('/submissions/');
    if (ideas || accounts) {
      const origin = request.headers.get('Origin') ?? '';
      const allowed = ORIGINS.some((o) => o.test(origin));
      if (!allowed) return new Response('Forbidden', { status: 403 });
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
      const res = await (ideas ? env.IDEAS.get(env.IDEAS.idFromName('board')) : accountsOf(env)).fetch(request);
      const out = new Response(res.body, res);
      for (const [k, v] of Object.entries(cors(origin))) out.headers.set(k, v);
      return out;
    }
    // /system/<galaxy>/<index>
    const m = url.pathname.match(/^\/system\/([0-7])\/(\d{1,3})$/);
    if (!m || Number(m[2]) > 255) return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const origin = request.headers.get('Origin') ?? '';
    if (!ORIGINS.some((o) => o.test(origin))) return new Response('Forbidden', { status: 403 });
    const room = env.SYSTEMS.get(env.SYSTEMS.idFromName(`${m[1]}:${m[2]}`));
    return room.fetch(request);
  },
} satisfies ExportedHandler<Env>;

const clipsOf = (env: Env) => env.CLIPS.get(env.CLIPS.idFromName('clips'));

/** The authorisation server's public side: metadata, registration, the start of a sign-in, and tokens. Any client, from anywhere. */
async function oauthRoute(request: Request, env: Env, url: URL): Promise<Response> {
  const issuer = issuerOf(env.OAUTH_ISSUER);
  const open = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Protocol-Version' };
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...open, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: open });
  const p = url.pathname;
  if (request.method === 'GET' && p === '/.well-known/oauth-authorization-server') return reply(authServerMetadata(issuer));
  if (request.method === 'GET' && (p === '/.well-known/oauth-protected-resource' || p === `/.well-known/oauth-protected-resource${BUILD_PATH}`)) return reply(protectedResourceMetadata(issuer));
  if (request.method === 'POST' && p === '/oauth/register') {
    const r = await accountsOf(env).oauthRegister(((await request.json().catch(() => null)) ?? {}) as Record<string, string>);
    return reply(JSON.parse(r.body), r.status);
  }
  if (request.method === 'GET' && p === '/oauth/authorize') {
    const r = await accountsOf(env).oauthStart(Object.fromEntries(url.searchParams), issuer);
    if ('redirect' in r) return Response.redirect(r.redirect, 302);
    return new Response(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Witchspace</title><body style="font:16px system-ui;max-width:32em;margin:3em auto;padding:0 1em"><h1>Can't sign in</h1><p>${r.page}</p>`, { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
  if (request.method === 'POST' && p === '/oauth/token') {
    const type = request.headers.get('Content-Type') ?? '';
    const form = type.includes('json') ? (((await request.json().catch(() => null)) ?? {}) as Record<string, string>) : Object.fromEntries(new URLSearchParams(await request.text()));
    const r = await accountsOf(env).oauthToken(form);
    return reply(JSON.parse(r.body), r.status);
  }
  return reply({ error: 'Not found' }, 404);
}

/** /mcp/build: the public tools and the signed-in ones, for an access token from oauthToken. */
async function mcpBuild(request: Request, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') return mcp(request);
  const auth = request.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const who = token ? await accountsOf(env).oauthAccount(token) : null;
  if (!who) {
    const meta = `${issuerOf(env.OAUTH_ISSUER)}/.well-known/oauth-protected-resource${BUILD_PATH}`;
    return new Response(JSON.stringify({ error: 'Sign in to hand in work' }), {
      status: 401,
      headers: { ...MCP_CORS, 'Content-Type': 'application/json', 'WWW-Authenticate': `Bearer resource_metadata="${meta}"${token ? ', error="invalid_token"' : ''}` },
    });
  }
  const accounts = accountsOf(env);
  const as = async (method: string, path: string, body?: unknown) => {
    const r = await accounts.asAccount(who.id, method, path, body === undefined ? undefined : JSON.stringify(body));
    return { status: r.status, data: JSON.parse(r.data) as Record<string, unknown> };
  };
  return mcp(request, buildTools(as, who.callsign));
}

/**
 * GET /feed: anyone may read it (it's all public elsewhere), but only our pages get
 * the CORS header. The edge keeps it a minute, so the home page can't hammer the
 * Durable Objects however often it asks.
 */
async function feedRoute(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const headers: Record<string, string> = ORIGINS.some((o) => o.test(origin)) ? cors(origin) : {};
  if (request.method === 'OPTIONS') return headers['Access-Control-Allow-Origin'] ? new Response(null, { status: 204, headers }) : new Response('Forbidden', { status: 403 });
  if (request.method !== 'GET') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, OPTIONS' } });
  // One cache entry for every caller: the key ignores the query string and the Origin.
  const key = new Request(new URL('/feed', request.url).toString());
  let res = await caches.default.match(key);
  if (!res) {
    const since = Date.now() - FEED_WINDOW;
    const [accounts, clips] = await Promise.all([accountsOf(env).feed(since), clipsOf(env).latest(since)]);
    res = new Response(JSON.stringify(buildFeed(accounts.firsts, clips, accounts.flying)), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${FEED_MAX_AGE}` },
    });
    ctx.waitUntil(caches.default.put(key, res.clone()));
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  out.headers.set('Vary', 'Origin');
  // A cached copy comes back with the zone's four-hour browser TTL in place of ours: put the minute back.
  out.headers.set('Cache-Control', `public, max-age=${FEED_MAX_AGE}`);
  return out;
}

/** /clips (share), /clips/<id> (watch), /clips/<id>/heart, /report, /admin. Our pages only, except the admin key. */
async function clipRoute(request: Request, env: Env, id: string | undefined, action: string | undefined): Promise<Response> {
  const origin = request.headers.get('Origin') ?? '';
  const allowed = ORIGINS.some((o) => o.test(origin));
  const headers: Record<string, string> = allowed ? cors(origin) : {};
  const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });
  if (request.method === 'OPTIONS') return allowed ? new Response(null, { status: 204, headers }) : new Response('Forbidden', { status: 403 });
  const clips = clipsOf(env);
  if (action === 'admin' && id) {
    const body = (await request.json().catch(() => null)) as { hidden?: unknown } | null;
    const r = await clips.admin(id, request.headers.get('X-Admin-Key'), body?.hidden === true);
    return reply(r, r.status);
  }
  if (!allowed) return new Response('Forbidden', { status: 403 });
  const voter = request.headers.get('X-Voter');
  const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
  if (!id && request.method === 'POST') {
    // The credit is the signed-in account's callsign, never anything in the body.
    const auth = request.headers.get('Authorization') ?? '';
    const account = auth.startsWith('Bearer ') ? await accountsOf(env).whoIs(auth.slice(7)) : null;
    const seconds = Number(new URL(request.url).searchParams.get('seconds'));
    const r = await clips.share(await request.arrayBuffer(), seconds, voter, ip, account);
    return reply(r, r.status);
  }
  if (id && !action && request.method === 'GET') {
    const c = await clips.get(id, voter);
    return c ? reply(c) : reply({ error: 'No such clip' }, 404);
  }
  if (id && action === 'heart' && request.method === 'POST') {
    const body = (await request.json().catch(() => null)) as { on?: unknown } | null;
    const r = await clips.heart(id, voter, ip, body?.on !== false);
    return reply(r, r.status);
  }
  if (id && action === 'report' && request.method === 'POST') {
    const r = await clips.report(id, voter);
    return reply(r, r.status);
  }
  return reply({ error: 'Not found' }, 404);
}

/** What each connection carries through hibernation. */
interface Attachment {
  commander: Commander | null;
  /** This system's name, "galaxy:index", for telling other systems where an account now is. */
  room?: string;
  track: Track | null;
  /** Rate limiting: messages in the current second. */
  window: number;
  count: number;
}

/**
 * What the fight needs, per commander: recent positions (to judge shots where
 * the shooter saw them), health, lasers and the last shot. Kept in memory: a
 * system with commanders flying in it never sleeps, and one that has slept
 * has nobody in it to remember.
 */
interface Combatant {
  history: Sample[];
  health: Health;
  lasers: string[];
  lastShotAt: number;
  destroyed: boolean;
  /** Missiles left on the rails, and the ECM. */
  missiles: number;
  ecm: boolean;
  lastEcmAt: number;
}

/** A missile in flight, flown by the server. */
interface InFlight {
  id: string;
  owner: string;
  target: string;
  flight: Flight;
  steppedAt: number; // ms
}

const MISSILE_STEP = 0.05; // seconds: missiles are flown in steps no longer than this

const HISTORY_MS = 1200;

export class SystemRoom extends DurableObject<Env> {
  private readonly combat = new Map<string, Combatant>();
  /** When each pair of commanders last collided (ms), so one contact only hurts once. */
  private readonly bumps = new Map<string, number>();
  private readonly inFlight = new Map<string, InFlight>();

  async fetch(request: Request): Promise<Response> {
    if (this.ctx.getWebSockets().length >= MAX_PER_SYSTEM) return new Response('This system is full', { status: 503 });
    const m = new URL(request.url).pathname.match(/^\/system\/(\d)\/(\d{1,3})$/);
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ commander: null, room: m ? `${m[1]}:${m[2]}` : undefined, track: null, window: 0, count: 0 } satisfies Attachment);
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const a = ws.deserializeAttachment() as Attachment;
    const now = Date.now();
    // Rate limit: drop anything beyond the allowance in each second.
    const window = Math.floor(now / 1000);
    if (window !== a.window) Object.assign(a, { window, count: 0 });
    if (++a.count > MAX_MESSAGES_PER_SECOND) return ws.serializeAttachment(a);

    let msg: ClientMessage;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    // Missiles fly on between messages; catch them up to now.
    this.flyMissiles(now);

    if (msg.type === 'hello' && !a.commander) {
      const ship = msg.ship in SHIPS ? msg.ship : 'cobra-mk3';
      const rank = typeof msg.rank === 'string' && RANKS.includes(msg.rank) ? msg.rank : 'Harmless';
      // Signed in: the callsign comes from the account, not the browser. Otherwise a guest.
      const who = typeof msg.session === 'string' ? await accountsOf(this.env).whoIs(msg.session) : null;
      const verified = Boolean(who?.callsign);
      // A guest can't borrow a reserved name either.
      const guestName = cleanName(msg.name);
      const name = verified ? who!.callsign! : nameRule(guestName) ? 'Commander' : guestName;
      a.commander = { id: crypto.randomUUID().slice(0, 8), name, rank, verified, ship, p: [0, 0, 0], q: [0, 0, 0, 1], s: 0, f: false };
      ws.serializeAttachment(a);
      const lasers = Array.isArray(msg.lasers) ? msg.lasers.filter((l): l is string => typeof l === 'string' && l in LASERS) : [];
      this.combat.set(a.commander.id, {
        history: [],
        health: { shields: SHIPS[ship].shields, hull: SHIPS[ship].hull, at: now },
        lasers,
        lastShotAt: 0,
        destroyed: false,
        missiles: Math.max(0, Math.min(SHIPS[ship].missiles, Math.floor(Number(msg.missiles) || 0))),
        ecm: msg.ecm === true,
        lastEcmAt: 0,
      });
      const others = this.commanders().filter((c) => c.id !== a.commander!.id && c.s >= 0);
      this.send(ws, { type: 'welcome', id: a.commander.id, others });
      // One ship per account: the newest wins, and the old one is taken out wherever it is.
      // Only games that understand being replaced (v2) take part: an older one would
      // just reconnect and throw the newer one out, again and again.
      if (who && a.room && msg.v === 2) {
        const before = await accountsOf(this.env).arrive(who.id, a.room, a.commander.id);
        if (before?.room === a.room) this.replace(before.id);
        else if (before) await this.env.SYSTEMS.get(this.env.SYSTEMS.idFromName(before.room)).replace(before.id);
      }
      return;
    }

    if (msg.type === 'state' && a.commander) {
      if (!isVec3(msg.p) || !isQuat(msg.q) || typeof msg.s !== 'number') return;
      const verdict = checkMove(a.commander.ship, a.track, msg.p, msg.s, now);
      if (verdict !== 'ok' && verdict !== 'jump') {
        if (a.track) this.send(ws, { type: 'correct', p: a.track.p });
        return;
      }
      const first = !a.track;
      const from = a.track ? { p: a.track.p, t: a.track.t } : null;
      a.track = { p: msg.p, t: now, jumpedAt: verdict === 'jump' ? now : (a.track?.jumpedAt ?? 0) };
      Object.assign(a.commander, { p: msg.p, q: msg.q, s: msg.s, f: Boolean(msg.f), d: msg.d === true });
      ws.serializeAttachment(a);
      const me = this.combat.get(a.commander.id);
      if (me) {
        me.history.push({ t: now, p: msg.p });
        while (me.history.length > 2 && me.history[0].t < now - HISTORY_MS) me.history.shift();
        me.health = reportHealth(me.health, msg.h, SHIPS[a.commander.ship].shields, now);
        if (from && verdict === 'ok') this.collide(ws, a.commander, from, now);
      }
      // The first accepted position is when everyone else sees you arrive.
      if (first) this.broadcast(ws, { type: 'join', commander: a.commander });
      else this.broadcast(ws, { type: 'state', id: a.commander.id, p: msg.p, q: msg.q, s: msg.s, f: Boolean(msg.f), d: msg.d === true });
      return;
    }

    if (msg.type === 'fire' && a.commander && a.track) this.fire(ws, a.commander, msg.d, msg.l, now);
    else if (msg.type === 'missile' && a.commander && a.track) this.launch(a.commander, msg.target, now);
    else if (msg.type === 'ecm' && a.commander && a.track) this.ecm(a.commander, now);
  }

  /** Launch a missile, if there's one on the rails and the target is in range. */
  private launch(owner: Commander, targetId: unknown, now: number) {
    const me = this.combat.get(owner.id);
    if (!me || me.destroyed || me.missiles <= 0 || typeof targetId !== 'string' || targetId === owner.id) return;
    const target = this.combat.get(targetId);
    const at = target?.history[target.history.length - 1]?.p;
    if (!target || target.destroyed || !at) return;
    if (Math.hypot(at[0] - owner.p[0], at[1] - owner.p[1], at[2] - owner.p[2]) > LOCK_RANGE) return;
    me.missiles -= 1;
    const d = rotate([0, 0, 1], owner.q);
    const flight: Flight = { p: [owner.p[0] + d[0] * 10, owner.p[1] + d[1] * 10, owner.p[2] + d[2] * 10], d, s: owner.s + MISSILE.launchSpeed, age: 0 };
    const id = crypto.randomUUID().slice(0, 8);
    this.inFlight.set(id, { id, owner: owner.id, target: targetId, flight, steppedAt: now });
    this.broadcastAll({ type: 'missile', id, owner: owner.id, target: targetId, p: flight.p, d: flight.d, s: flight.s });
  }

  /** Fly every missile up to now; resolve hits and burn-outs. */
  private flyMissiles(now: number) {
    for (const m of this.inFlight.values()) {
      let left = (now - m.steppedAt) / 1000;
      m.steppedAt = now;
      let result: 'flying' | 'hit' | 'expired' = 'flying';
      while (left > 0 && result === 'flying') {
        const dt = Math.min(MISSILE_STEP, left);
        left -= dt;
        const target = this.combat.get(m.target);
        const at = target && !target.destroyed ? (target.history[target.history.length - 1]?.p ?? null) : null;
        result = stepMissile(m.flight, at, dt);
      }
      if (result === 'flying') continue;
      this.inFlight.delete(m.id);
      this.broadcastAll({ type: 'missileEnd', id: m.id, how: result, p: m.flight.p });
      if (result === 'hit') this.missileHit(m, now);
    }
  }

  private missileHit(m: InFlight, now: number) {
    const victim = this.combat.get(m.target);
    const victimCmdr = this.commanderById(m.target);
    if (!victim || !victimCmdr || victim.destroyed) return;
    const { health, destroyed } = takeHit(recharge(victim.health, SHIPS[victimCmdr.ship].shields, now), MISSILE.damage);
    victim.health = health;
    const victimWs = this.socketOf(m.target);
    if (victimWs) this.send(victimWs, { type: 'hit', by: m.owner, damage: MISSILE.damage, shields: Math.max(0, health.shields), hull: Math.max(0, health.hull) });
    const ownerWs = this.socketOf(m.owner);
    if (ownerWs) this.send(ownerWs, { type: 'hitconfirm', id: m.target });
    if (destroyed) {
      victim.destroyed = true;
      this.broadcastAll({ type: 'destroyed', id: m.target, by: m.owner, cause: 'missile' });
    }
  }

  /** The ECM destroys every missile near the ship that fires it, friend or foe. */
  private ecm(c: Commander, now: number) {
    const me = this.combat.get(c.id);
    if (!me || me.destroyed || !me.ecm || now - me.lastEcmAt < ECM_COOLDOWN) return;
    me.lastEcmAt = now;
    this.broadcastAll({ type: 'ecm', id: c.id, p: c.p });
    for (const m of this.inFlight.values()) {
      const p = m.flight.p;
      if (Math.hypot(p[0] - c.p[0], p[1] - c.p[1], p[2] - c.p[2]) > ECM_RANGE) continue;
      this.inFlight.delete(m.id);
      this.broadcastAll({ type: 'missileEnd', id: m.id, how: 'ecm', p });
    }
  }

  private broadcastAll(msg: ServerMessage) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(text);
      } catch {
        // Gone; webSocketClose tidies up.
      }
    }
  }

  /** A laser shot: check it could happen, then decide what it hit. */
  private fire(ws: WebSocket, shooter: Commander, direction: unknown, laser: unknown, now: number) {
    const me = this.combat.get(shooter.id);
    if (!me || me.destroyed || !isVec3(direction) || typeof laser !== 'string') return;
    if (!canFire(laser, me.lasers, me.lastShotAt, now)) return;
    me.lastShotAt = now;
    const l = LASERS[laser];
    const seenAt = now - REWIND * 1000;
    const targets = [];
    for (const [id, c] of this.combat) {
      if (id === shooter.id || c.destroyed) continue;
      const p = positionAt(c.history, seenAt);
      const other = this.commanderById(id);
      if (p && other) targets.push({ id, p, radius: SHIPS[other.ship].radius });
    }
    const hitId = resolveShot(shooter.p, direction, l.range, targets);
    if (!hitId) return;
    // Shots well off the nose are gimballed or turret shots: a little weaker.
    const nose = rotate([0, 0, 1], shooter.q);
    const len = Math.hypot(...direction);
    const offNose = Math.acos(Math.min(1, (nose[0] * direction[0] + nose[1] * direction[1] + nose[2] * direction[2]) / len));
    const damage = Math.round(l.damage * (offNose > 0.05 ? GIMBAL_DAMAGE : 1) * 10) / 10;
    const victim = this.combat.get(hitId)!;
    const victimShip = this.commanderById(hitId)!.ship;
    const { health, destroyed } = takeHit(recharge(victim.health, SHIPS[victimShip].shields, now), damage);
    victim.health = health;
    const victimWs = this.socketOf(hitId);
    if (victimWs) this.send(victimWs, { type: 'hit', by: shooter.id, damage, shields: Math.max(0, health.shields), hull: Math.max(0, health.hull) });
    this.send(ws, { type: 'hitconfirm', id: hitId });
    if (destroyed) {
      victim.destroyed = true;
      const text: ServerMessage = { type: 'destroyed', id: hitId, by: shooter.id, cause: 'laser' };
      for (const s of this.ctx.getWebSockets()) this.send(s, text);
    }
  }

  /** Did this move bring the ship into contact with another? Both are damaged and pushed apart. */
  private collide(ws: WebSocket, mover: Commander, from: { p: Vec3; t: number }, now: number) {
    const me = this.combat.get(mover.id);
    if (!me || me.destroyed) return;
    const dt = Math.max(0.05, (now - from.t) / 1000);
    const velocity: Vec3 = [(mover.p[0] - from.p[0]) / dt, (mover.p[1] - from.p[1]) / dt, (mover.p[2] - from.p[2]) / dt];
    for (const [id, other] of this.combat) {
      if (id === mover.id || other.destroyed || !other.history.length) continue;
      const them = this.commanderById(id);
      if (!them) continue;
      const at = other.history[other.history.length - 1].p;
      const touch = (SHIPS[mover.ship].radius + SHIPS[them.ship].radius) * COLLIDE;
      if (closestApproach(from.p, mover.p, at) > touch) continue;
      const pair = [mover.id, id].sort().join(':');
      if (now - (this.bumps.get(pair) ?? 0) < BUMP_COOLDOWN) continue;
      this.bumps.set(pair, now);
      if (this.bumps.size > 256) for (const [k, t] of this.bumps) if (now - t > BUMP_COOLDOWN) this.bumps.delete(k);
      // How fast they met: each ship's speed along its nose (checked against its top
      // speed), which network timing can't skew the way positions over time can.
      const ours = rotate([0, 0, 1], mover.q);
      const theirs = rotate([0, 0, 1], them.q);
      const closing = Math.hypot(ours[0] * mover.s - theirs[0] * them.s, ours[1] * mover.s - theirs[1] * them.s, ours[2] * mover.s - theirs[2] * them.s);
      const damage = collisionDamage(closing);
      let apart: Vec3 = [mover.p[0] - at[0], mover.p[1] - at[1], mover.p[2] - at[2]];
      const len = Math.hypot(...apart);
      apart = len > 0.01 ? [apart[0] / len, apart[1] / len, apart[2] / len] : [-velocity[0] / (Math.hypot(...velocity) || 1), -velocity[1] / (Math.hypot(...velocity) || 1), -velocity[2] / (Math.hypot(...velocity) || 1)];
      const sides: [Commander, Combatant, WebSocket | null, Vec3, string][] = [
        [mover, me, ws, apart, id],
        [them, other, this.socketOf(id), [-apart[0], -apart[1], -apart[2]], mover.id],
      ];
      for (const [c, combatant, socket, push, withId] of sides) {
        const { health, destroyed } = takeHit(recharge(combatant.health, SHIPS[c.ship].shields, now), damage);
        combatant.health = health;
        if (socket) this.send(socket, { type: 'bump', with: withId, damage, shields: Math.max(0, health.shields), hull: Math.max(0, health.hull), push });
        if (destroyed) {
          combatant.destroyed = true;
          const text: ServerMessage = { type: 'destroyed', id: c.id, by: '', cause: 'collision' };
          for (const s of this.ctx.getWebSockets()) this.send(s, text);
        }
      }
    }
  }

  private forget(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a?.commander) this.combat.delete(a.commander.id);
  }

  private commanderById(id: string): Commander | null {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.commander?.id === id) return a.commander;
    }
    return null;
  }

  private socketOf(id: string): WebSocket | null {
    for (const ws of this.ctx.getWebSockets()) {
      const a = ws.deserializeAttachment() as Attachment | null;
      if (a?.commander?.id === id) return ws;
    }
    return null;
  }

  /** The account behind this ship has joined from somewhere else: tell it, and take the ship out. */
  async replace(id: string) {
    const ws = this.socketOf(id);
    if (!ws) return;
    this.send(ws, { type: 'replaced' });
    this.forget(ws);
    this.leave(ws);
  }

  async webSocketClose(ws: WebSocket) {
    this.forget(ws);
    this.leave(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.forget(ws);
    this.leave(ws);
  }

  private leave(ws: WebSocket) {
    const a = ws.deserializeAttachment() as Attachment | null;
    if (a?.commander && a.track) this.broadcast(ws, { type: 'leave', id: a.commander.id });
    try {
      ws.close();
    } catch {
      // Already closed.
    }
  }

  /** Everyone in the system who has a position. */
  private commanders(): Commander[] {
    return this.ctx
      .getWebSockets()
      .map((ws) => ws.deserializeAttachment() as Attachment)
      .filter((a) => a?.commander && a.track)
      .map((a) => a.commander!);
  }

  private send(ws: WebSocket, msg: ServerMessage) {
    try {
      ws.send(JSON.stringify(msg));
    } catch {
      // The socket went away; webSocketClose tidies up.
    }
  }

  private broadcast(from: WebSocket, msg: ServerMessage) {
    const text = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === from) continue;
      try {
        ws.send(text);
      } catch {
        // As above.
      }
    }
  }
}

/** Rotate a vector by a quaternion [x, y, z, w]. */
function rotate(v: Vec3, q: [number, number, number, number]): Vec3 {
  const [x, y, z, w] = q;
  const ix = w * v[0] + y * v[2] - z * v[1];
  const iy = w * v[1] + z * v[0] - x * v[2];
  const iz = w * v[2] + x * v[1] - y * v[0];
  const iw = -x * v[0] - y * v[1] - z * v[2];
  return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
}
