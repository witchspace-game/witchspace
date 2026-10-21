// Witchspace shared space (stage 1): a Cloudflare Worker that routes each
// commander's WebSocket to the Durable Object for their star system. Each
// system's object checks moves and relays them to everyone else there. It
// uses hibernating WebSockets, so a system with nobody in it costs nothing.
// See docs/design/servers-and-hosting.md.

import { DurableObject } from 'cloudflare:workers';
import { cleanName, isQuat, isVec3, SHIPS, type ClientMessage, type Commander, type ServerMessage } from './protocol';
import { checkMove, type Track } from './rules';

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

export class SystemRoom extends DurableObject<Env> {
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
      // The first accepted position is when everyone else sees you arrive.
      if (first) this.broadcast(ws, { type: 'join', commander: a.commander });
      else this.broadcast(ws, { type: 'state', id: a.commander.id, p: msg.p, q: msg.q, s: msg.s, f: Boolean(msg.f) });
    }
  }

  async webSocketClose(ws: WebSocket) {
    this.leave(ws);
  }

  async webSocketError(ws: WebSocket) {
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
