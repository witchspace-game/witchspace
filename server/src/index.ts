// Witchspace shared space (stage 1): a Cloudflare Worker that routes each
// commander's WebSocket to the Durable Object for their star system. Each
// system's object checks moves and relays them to everyone else there. It
// uses hibernating WebSockets, so a system with nobody in it costs nothing.
// See docs/design/servers-and-hosting.md.

import { DurableObject } from 'cloudflare:workers';
import { cleanName, GIMBAL_DAMAGE, isQuat, isVec3, LASERS, REWIND, SHIPS, type ClientMessage, type Commander, type ServerMessage, type Vec3 } from './protocol';
import { canFire, checkMove, positionAt, recharge, reportHealth, resolveShot, takeHit, type Health, type Sample, type Track } from './rules';

export interface Env {
  SYSTEMS: DurableObjectNamespace<SystemRoom>;
}

/** Pages allowed to connect: the live site and local development. */
const ORIGINS = [/^https:\/\/(www\.)?witchspace\.org\.uk$/, /^http:\/\/localhost(:\d+)?$/, /^http:\/\/127\.0\.0\.1(:\d+)?$/];

const MAX_PER_SYSTEM = 64; // commanders closely simulated in one system (stage 1)
const MAX_MESSAGES_PER_SECOND = 30;

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === '/health') return new Response('ok');
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

/** What each connection carries through hibernation. */
interface Attachment {
  commander: Commander | null;
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
}

const HISTORY_MS = 1200;

export class SystemRoom extends DurableObject<Env> {
  private readonly combat = new Map<string, Combatant>();

  async fetch(): Promise<Response> {
    if (this.ctx.getWebSockets().length >= MAX_PER_SYSTEM) return new Response('This system is full', { status: 503 });
    const [client, server] = Object.values(new WebSocketPair());
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({ commander: null, track: null, window: 0, count: 0 } satisfies Attachment);
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

    if (msg.type === 'hello' && !a.commander) {
      const ship = msg.ship in SHIPS ? msg.ship : 'cobra-mk3';
      a.commander = { id: crypto.randomUUID().slice(0, 8), name: cleanName(msg.name), ship, p: [0, 0, 0], q: [0, 0, 0, 1], s: 0, f: false };
      ws.serializeAttachment(a);
      const lasers = Array.isArray(msg.lasers) ? msg.lasers.filter((l): l is string => typeof l === 'string' && l in LASERS) : [];
      this.combat.set(a.commander.id, {
        history: [],
        health: { shields: SHIPS[ship].shields, hull: SHIPS[ship].hull, at: now },
        lasers,
        lastShotAt: 0,
        destroyed: false,
      });
      const others = this.commanders().filter((c) => c.id !== a.commander!.id && c.s >= 0);
      this.send(ws, { type: 'welcome', id: a.commander.id, others });
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
      a.track = { p: msg.p, t: now, jumpedAt: verdict === 'jump' ? now : (a.track?.jumpedAt ?? 0) };
      Object.assign(a.commander, { p: msg.p, q: msg.q, s: msg.s, f: Boolean(msg.f) });
      ws.serializeAttachment(a);
      const me = this.combat.get(a.commander.id);
      if (me) {
        me.history.push({ t: now, p: msg.p });
        while (me.history.length > 2 && me.history[0].t < now - HISTORY_MS) me.history.shift();
        me.health = reportHealth(me.health, msg.h, SHIPS[a.commander.ship].shields, now);
      }
      // The first accepted position is when everyone else sees you arrive.
      if (first) this.broadcast(ws, { type: 'join', commander: a.commander });
      else this.broadcast(ws, { type: 'state', id: a.commander.id, p: msg.p, q: msg.q, s: msg.s, f: Boolean(msg.f) });
      return;
    }

    if (msg.type === 'fire' && a.commander && a.track) this.fire(ws, a.commander, msg.d, msg.l, now);
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
      const text: ServerMessage = { type: 'destroyed', id: hitId, by: shooter.id };
      for (const s of this.ctx.getWebSockets()) this.send(s, text);
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
