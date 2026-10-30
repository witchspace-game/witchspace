import * as THREE from 'three';
import type { ClientMessage, Commander, Paint, ServerMessage } from '../../server/src/protocol';

// Shared space (stage 1, Modern rules, opt-in): other commanders in your
// star system, flying their own ships. One WebSocket to that system's server
// (server/), which checks moves and passes them on. We send our position
// about ten times a second and draw everyone else slightly in the past,
// between the two updates either side, so they move smoothly however the
// network behaves. Hyperspace is the handover: leave one system, join the next.

const SEND_INTERVAL = 0.1; // seconds
const DELAY = 0.15; // seconds: draw others this far behind, to interpolate
const KEEP = 1.5; // seconds of history kept per commander
const RETRY = 5; // seconds before reconnecting after losing the server
const FULL_RETRY = 30; // seconds before trying a full system again

/** The shared space servers: local in development (cd server && npm run dev), ours in production. */
export const SPACE_URL: string = import.meta.env.VITE_SPACE_URL ?? (import.meta.env.DEV ? 'ws://127.0.0.1:8787' : 'wss://space.witchspace.org.uk');

interface Snapshot {
  t: number; // seconds, our clock, when it arrived
  p: THREE.Vector3;
  q: THREE.Quaternion;
  f: boolean;
}

export interface Remote {
  id: string;
  name: string;
  rank: string;
  /** Signed in, with their account's callsign; otherwise a guest. */
  verified: boolean;
  ship: string;
  /** Their paint from the yard, if any. */
  paint?: Paint;
  /** Where to draw them now (interpolated). */
  position: THREE.Vector3;
  quaternion: THREE.Quaternion;
  firing: boolean;
  history: Snapshot[];
  /** Until when (our clock, seconds) they count as hostile: they've shot at us. */
  hostileUntil: number;
  /** Running dark: no transponder, so we can't say who they are until we're close. */
  dark: boolean;
}

export type SpaceEvent =
  | { kind: 'joined'; remote: Remote }
  | { kind: 'left'; remote: Remote }
  | { kind: 'connected'; others: number }
  | { kind: 'lost' }
  /** The system's shared space is full: flying solo, trying again now and then. */
  | { kind: 'full'; max: number }
  /** We were hit (by a commander we may not have seen yet): the server's word on our shields and hull. */
  | { kind: 'hit'; by: Remote | null; damage: number; shields: number; hull: number }
  /** Our shot hit them. */
  | { kind: 'hitconfirm'; remote: Remote }
  /** We collided with a commander: the damage, what we have left, and which way to move apart. */
  | { kind: 'bump'; with: Remote | null; damage: number; shields: number; hull: number; push: THREE.Vector3 }
  /** Someone was destroyed: us (`me`), or a commander we can see; by a laser, or in a collision. */
  | { kind: 'destroyed'; me: boolean; remote: Remote | null; by: Remote | null; byMe: boolean; collision: boolean }
  /** A missile is away. `owner` and `target` are null when they're us (see the flags). */
  | { kind: 'missile'; id: string; owner: Remote | null; ownerIsMe: boolean; target: Remote | null; targetIsMe: boolean; p: THREE.Vector3; d: THREE.Vector3; s: number }
  | { kind: 'missileEnd'; id: string; how: 'hit' | 'ecm' | 'expired'; p: THREE.Vector3 }
  /** Someone else fired an ECM. */
  | { kind: 'ecm'; by: Remote | null; p: THREE.Vector3 }
  /** Our account joined from another window or device, which now has the ship. */
  | { kind: 'replaced' }
  | { kind: 'signin'; need: 'account' | 'callsign' };

const HOSTILE_FOR = 15; // seconds a commander who shot at you stays marked hostile

const toV = (a: [number, number, number]) => new THREE.Vector3(...a);
const toQ = (a: [number, number, number, number]) => new THREE.Quaternion(...a);
const round = (n: number) => Math.round(n * 10) / 10;

export class SharedSpace {
  readonly remotes = new Map<string, Remote>();
  private ws: WebSocket | null = null;
  private system = '';
  private sendTimer = 0;
  private clock = 0;
  private correction: THREE.Vector3 | null = null;
  private retryAt = 0;
  private myId = '';
  private lostReported = false;
  /** The server said this system is full (its cap), just before closing. */
  private fullAt = 0;
  private fullReported = false;
  /** Taken out because the account joined elsewhere: stay out until asked back in (resume). */
  private replaced = false;

  constructor(private readonly onEvent: (e: SpaceEvent) => void) {}

  get connected() {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  /** Be in this system's shared space (or none). Reconnects only when it changes. */
  join(galaxy: number, system: number, name: string, ship: string, lasers: string[], rank: string, missiles: number, ecm: boolean, session?: string, paint?: Paint) {
    const key = `${galaxy}/${system}`;
    if (key === this.system && this.ws) return;
    if (this.clock < this.retryAt || this.replaced) return;
    this.leave();
    this.system = key;
    const ws = new WebSocket(`${SPACE_URL}/system/${key}`);
    this.ws = ws;
    // v2: we understand being replaced (one ship per account), and won't reconnect after it.
    ws.onopen = () => this.send({ type: 'hello', name, ship, lasers, rank, missiles, ecm, session, v: 2, ...(paint ? { paint } : {}) });
    ws.onmessage = (e) => this.receive(JSON.parse(e.data as string) as ServerMessage);
    ws.onclose = () => {
      if (this.ws !== ws) return; // a deliberate leave
      this.ws = null;
      this.system = '';
      this.clearRemotes();
      if (this.fullAt) {
        // Not lost: full. Say so once, and look again less often.
        this.retryAt = this.clock + FULL_RETRY;
        if (!this.fullReported) this.onEvent({ kind: 'full', max: this.fullAt });
        this.fullReported = true;
        this.fullAt = 0;
        return;
      }
      this.retryAt = this.clock + RETRY;
      if (!this.lostReported) this.onEvent({ kind: 'lost' });
      this.lostReported = true;
    };
  }

  /** Back in after being replaced: a deliberate choice on this device (launching, or switching shared space on). */
  resume() {
    this.replaced = false;
  }

  leave() {
    const ws = this.ws;
    this.ws = null;
    this.system = '';
    ws?.close();
    this.clearRemotes();
  }

  /** The server refused a move: where to put the ship back, once. */
  takeCorrection(): THREE.Vector3 | null {
    const c = this.correction;
    this.correction = null;
    return c;
  }

  /** Each frame: send our state now and then, and move everyone else along. */
  /** A laser shot: the server decides whether it hit anyone. */
  fire(direction: THREE.Vector3, laser: string) {
    this.send({ type: 'fire', d: [direction.x, direction.y, direction.z], l: laser });
  }

  /** Launch a missile at a commander: the server flies it. */
  launchMissile(target: string) {
    this.send({ type: 'missile', target });
  }

  ecm() {
    this.send({ type: 'ecm' });
  }

  isHostile(r: Remote) {
    return r.hostileUntil > this.clock;
  }

  update(dt: number, me: { position: THREE.Vector3; quaternion: THREE.Quaternion; speed: number; firing: boolean; shields: number; hull: number; dark: boolean }) {
    this.clock += dt;
    this.sendTimer -= dt;
    if (this.connected && this.sendTimer <= 0) {
      this.sendTimer = SEND_INTERVAL;
      const p = me.position;
      const q = me.quaternion;
      this.send({ type: 'state', p: [round(p.x), round(p.y), round(p.z)], q: [q.x, q.y, q.z, q.w], s: round(me.speed), f: me.firing, h: [round(me.shields), round(me.hull)], ...(me.dark ? { d: true } : {}) });
    }
    const at = this.clock - DELAY;
    for (const r of this.remotes.values()) interpolate(r, at);
  }

  private receive(msg: ServerMessage) {
    switch (msg.type) {
      case 'welcome':
        this.lostReported = false;
        this.fullReported = false;
        this.myId = msg.id;
        for (const c of msg.others) this.add(c);
        this.onEvent({ kind: 'connected', others: msg.others.length });
        break;
      case 'join':
        this.onEvent({ kind: 'joined', remote: this.add(msg.commander) });
        break;
      case 'state': {
        const r = this.remotes.get(msg.id);
        if (!r) break;
        r.history.push({ t: this.clock, p: toV(msg.p), q: toQ(msg.q), f: msg.f });
        r.dark = msg.d === true;
        while (r.history.length > 2 && r.history[1].t < this.clock - KEEP) r.history.shift();
        break;
      }
      case 'leave': {
        const r = this.remotes.get(msg.id);
        if (!r) break;
        this.remotes.delete(msg.id);
        this.onEvent({ kind: 'left', remote: r });
        break;
      }
      case 'correct':
        this.correction = toV(msg.p);
        break;
      case 'full':
        this.fullAt = msg.max;
        break;
      case 'signin':
        // Not for guests: stay out until signed in with a callsign and asked back in (resume).
        this.replaced = true;
        this.leave();
        this.onEvent({ kind: 'signin', need: msg.need });
        break;
      case 'replaced':
        // Don't reconnect, or the two would take turns throwing each other out.
        this.replaced = true;
        this.leave();
        this.onEvent({ kind: 'replaced' });
        break;
      case 'hit': {
        const by = this.remotes.get(msg.by) ?? null;
        if (by) by.hostileUntil = this.clock + HOSTILE_FOR;
        this.onEvent({ kind: 'hit', by, damage: msg.damage, shields: msg.shields, hull: msg.hull });
        break;
      }
      case 'hitconfirm': {
        const r = this.remotes.get(msg.id);
        if (r) this.onEvent({ kind: 'hitconfirm', remote: r });
        break;
      }
      case 'missile':
        this.onEvent({
          kind: 'missile',
          id: msg.id,
          owner: this.remotes.get(msg.owner) ?? null,
          ownerIsMe: msg.owner === this.myId,
          target: this.remotes.get(msg.target) ?? null,
          targetIsMe: msg.target === this.myId,
          p: toV(msg.p),
          d: toV(msg.d),
          s: msg.s,
        });
        if (msg.target === this.myId) {
          const r = this.remotes.get(msg.owner);
          if (r) r.hostileUntil = this.clock + HOSTILE_FOR;
        }
        break;
      case 'missileEnd':
        this.onEvent({ kind: 'missileEnd', id: msg.id, how: msg.how, p: toV(msg.p) });
        break;
      case 'ecm':
        if (msg.id !== this.myId) this.onEvent({ kind: 'ecm', by: this.remotes.get(msg.id) ?? null, p: toV(msg.p) });
        break;
      case 'bump':
        this.onEvent({ kind: 'bump', with: this.remotes.get(msg.with) ?? null, damage: msg.damage, shields: msg.shields, hull: msg.hull, push: toV(msg.push) });
        break;
      case 'destroyed':
        this.onEvent({
          kind: 'destroyed',
          me: msg.id === this.myId,
          remote: this.remotes.get(msg.id) ?? null,
          by: this.remotes.get(msg.by) ?? null,
          byMe: Boolean(msg.by) && msg.by === this.myId,
          collision: msg.cause === 'collision',
        });
        break;
    }
  }

  private add(c: Commander): Remote {
    const r: Remote = { id: c.id, name: c.name, rank: c.rank ?? 'Harmless', verified: Boolean(c.verified), ship: c.ship, ...(c.paint ? { paint: c.paint } : {}), position: toV(c.p), quaternion: toQ(c.q), firing: c.f, history: [{ t: this.clock, p: toV(c.p), q: toQ(c.q), f: c.f }], hostileUntil: 0, dark: c.d === true };
    this.remotes.set(c.id, r);
    return r;
  }

  private clearRemotes() {
    for (const r of this.remotes.values()) this.onEvent({ kind: 'left', remote: r });
    this.remotes.clear();
  }

  private send(msg: ClientMessage) {
    if (this.connected) this.ws!.send(JSON.stringify(msg));
  }
}

/** Where a commander was at time `at`, between the two snapshots either side. */
export function interpolate(r: Remote, at: number) {
  const h = r.history;
  let i = h.length - 1;
  while (i > 0 && h[i - 1].t > at) i--;
  const b = h[i];
  const a = h[Math.max(0, i - 1)];
  if (a === b || at >= b.t) {
    r.position.copy(b.p);
    r.quaternion.copy(b.q);
    r.firing = b.f;
    return;
  }
  const k = THREE.MathUtils.clamp((at - a.t) / (b.t - a.t), 0, 1);
  r.position.lerpVectors(a.p, b.p, k);
  r.quaternion.slerpQuaternions(a.q, b.q, k);
  r.firing = k < 0.5 ? a.f : b.f;
}
