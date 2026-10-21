// The ideas board: anyone can post an idea and vote it up or down, no account
// needed. One Durable Object holds the board in its own SQLite database.
// Ideas go live at once; the defences against abuse, until accounts arrive:
// - one vote per idea per browser (a random id it keeps), and at most a few
//   per idea from any one network (IP addresses are only kept as salted hashes);
// - rate limits on posting and voting;
// - Cloudflare Turnstile, the human check, on posting (when configured);
// - reports: an idea reported by enough different browsers is hidden until
//   someone looks at it.

import { DurableObject } from 'cloudflare:workers';
import { isHuman, json, networkOf } from './http';
import { SEED_IDEAS } from './seed-ideas';

export interface IdeasEnv {
  /** Turnstile's secret key; without it, posting skips the human check (local development). */
  TURNSTILE_SECRET?: string;
  /** For changing an idea's status or unhiding it; without it, there's no admin. */
  ADMIN_KEY?: string;
}

export type Status = 'open' | 'planned' | 'building' | 'built' | 'declined';
const STATUSES: Status[] = ['open', 'planned', 'building', 'built', 'declined'];

export interface Idea {
  id: string;
  title: string;
  body: string;
  status: Status;
  up: number;
  down: number;
  created: number;
  /** This browser's vote: 1, -1 or 0. */
  mine: number;
}

const TITLE_MAX = 80;
const BODY_MAX = 600;
const VOTES_PER_NETWORK = 3; // per idea: a household or office can share an address
const REPORTS_TO_HIDE = 3;
const POSTS_PER_HOUR = 3;
const VOTES_PER_MINUTE = 30;

/** Plain text only: no markup, no control characters, trimmed. */
export function cleanText(s: unknown, max: number): string {
  if (typeof s !== 'string') return '';
  return s
    .replace(/<[^>]*>/g, '')
    .replace(/[<>]/g, '')
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

/** A browser's own id: a random token it keeps. Must look like one. */
const voterOk = (v: string | null): v is string => Boolean(v && /^[A-Za-z0-9-]{16,64}$/.test(v));

export class IdeasBoard extends DurableObject<IdeasEnv> {
  private readonly sql = this.ctx.storage.sql;

  constructor(ctx: DurableObjectState, env: IdeasEnv) {
    super(ctx, env);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS ideas (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
      hidden INTEGER NOT NULL DEFAULT 0, up INTEGER NOT NULL DEFAULT 0, down INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS votes (idea TEXT NOT NULL, voter TEXT NOT NULL, net TEXT NOT NULL, value INTEGER NOT NULL, PRIMARY KEY (idea, voter))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS reports (idea TEXT NOT NULL, voter TEXT NOT NULL, PRIMARY KEY (idea, voter))`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS activity (voter TEXT NOT NULL, net TEXT NOT NULL, kind TEXT NOT NULL, t INTEGER NOT NULL)`);
    // A new board starts with the ideas already written down.
    const count = this.sql.exec('SELECT COUNT(*) AS n FROM ideas').one().n as number;
    if (count === 0) {
      const now = Date.now();
      SEED_IDEAS.forEach((s, i) => {
        this.sql.exec('INSERT INTO ideas (id, title, body, status, created) VALUES (?, ?, ?, ?, ?)', crypto.randomUUID().slice(0, 8), s.title, s.body, s.status ?? 'open', now - i * 1000);
      });
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const voter = request.headers.get('X-Voter');
    const net = await networkOf(request, (this.env.ADMIN_KEY ?? 'witchspace') + ':ideas');
    const parts = url.pathname.split('/').filter(Boolean); // ['ideas', id?, action?]

    if (request.method === 'GET' && parts.length === 1) return json(this.list(url.searchParams.get('sort'), voterOk(voter) ? voter : ''));
    if (!voterOk(voter)) return json({ error: 'No voter id' }, 400);

    if (request.method === 'POST' && parts.length === 1) return this.post(request, voter, net);
    const id = parts[1];
    if (!id || !this.exists(id)) return json({ error: 'No such idea' }, 404);
    if (request.method === 'POST' && parts[2] === 'vote') return this.vote(request, id, voter, net);
    if (request.method === 'POST' && parts[2] === 'report') return this.report(id, voter);
    if (request.method === 'POST' && parts[2] === 'admin') return this.admin(request, id);
    return json({ error: 'Not found' }, 404);
  }

  private list(sort: string | null, voter: string): { ideas: Idea[] } {
    const order =
      sort === 'new' ? 'created DESC' : sort === 'rising' ? '(up - down) * 1.0 / ((? - created) / 3600000.0 + 2) DESC' : '(up - down) DESC, created DESC';
    const rows = (sort === 'rising' ? this.sql.exec(`SELECT * FROM ideas WHERE hidden = 0 ORDER BY ${order} LIMIT 200`, Date.now()) : this.sql.exec(`SELECT * FROM ideas WHERE hidden = 0 ORDER BY ${order} LIMIT 200`)).toArray();
    const mine = new Map<string, number>();
    if (voter) for (const v of this.sql.exec('SELECT idea, value FROM votes WHERE voter = ?', voter).toArray()) mine.set(v.idea as string, v.value as number);
    return {
      ideas: rows.map((r) => ({
        id: r.id as string,
        title: r.title as string,
        body: r.body as string,
        status: r.status as Status,
        up: r.up as number,
        down: r.down as number,
        created: r.created as number,
        mine: mine.get(r.id as string) ?? 0,
      })),
    };
  }

  private async post(request: Request, voter: string, net: string): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { title?: unknown; body?: unknown; turnstile?: unknown } | null;
    const title = cleanText(body?.title, TITLE_MAX);
    const text = cleanText(body?.body, BODY_MAX);
    if (title.length < 4) return json({ error: 'Give your idea a title' }, 400);
    if (this.recent(voter, net, 'post', 3600_000) >= POSTS_PER_HOUR) return json({ error: 'That’s plenty of ideas for one hour: try again later' }, 429);
    if (!(await isHuman(this.env.TURNSTILE_SECRET, body?.turnstile, request))) return json({ error: 'The human check didn’t pass: please try again' }, 403);
    const id = crypto.randomUUID().slice(0, 8);
    this.sql.exec('INSERT INTO ideas (id, title, body, created) VALUES (?, ?, ?, ?)', id, title, text, Date.now());
    this.note(voter, net, 'post');
    // Your own idea starts with your vote.
    this.setVote(id, voter, net, 1);
    return json({ id });
  }

  private async vote(request: Request, id: string, voter: string, net: string): Promise<Response> {
    const body = (await request.json().catch(() => null)) as { value?: unknown } | null;
    const value = body?.value === 1 ? 1 : body?.value === -1 ? -1 : 0;
    if (this.recent(voter, net, 'vote', 60_000) >= VOTES_PER_MINUTE) return json({ error: 'Slow down a little' }, 429);
    const others = this.sql.exec('SELECT COUNT(*) AS n FROM votes WHERE idea = ? AND net = ? AND voter != ?', id, net, voter).one().n as number;
    if (value !== 0 && others >= VOTES_PER_NETWORK) return json({ error: 'Enough votes from your network on this idea' }, 429);
    this.setVote(id, voter, net, value);
    this.note(voter, net, 'vote');
    const r = this.sql.exec('SELECT up, down FROM ideas WHERE id = ?', id).one();
    return json({ up: r.up, down: r.down, mine: value });
  }

  private setVote(id: string, voter: string, net: string, value: number) {
    const before = this.sql.exec('SELECT value FROM votes WHERE idea = ? AND voter = ?', id, voter).toArray()[0]?.value as number | undefined;
    if (before === value) return;
    if (before) this.sql.exec(`UPDATE ideas SET ${before > 0 ? 'up = up - 1' : 'down = down - 1'} WHERE id = ?`, id);
    if (value) this.sql.exec(`UPDATE ideas SET ${value > 0 ? 'up = up + 1' : 'down = down + 1'} WHERE id = ?`, id);
    if (value) this.sql.exec('INSERT OR REPLACE INTO votes (idea, voter, net, value) VALUES (?, ?, ?, ?)', id, voter, net, value);
    else this.sql.exec('DELETE FROM votes WHERE idea = ? AND voter = ?', id, voter);
  }

  private report(id: string, voter: string): Response {
    this.sql.exec('INSERT OR IGNORE INTO reports (idea, voter) VALUES (?, ?)', id, voter);
    const n = this.sql.exec('SELECT COUNT(*) AS n FROM reports WHERE idea = ?', id).one().n as number;
    if (n >= REPORTS_TO_HIDE) this.sql.exec('UPDATE ideas SET hidden = 1 WHERE id = ?', id);
    return json({ reported: true });
  }

  /** Set an idea's status, or hide or unhide it. Needs the admin key. */
  private async admin(request: Request, id: string): Promise<Response> {
    const key = request.headers.get('X-Admin-Key');
    if (!this.env.ADMIN_KEY || key !== this.env.ADMIN_KEY) return json({ error: 'Forbidden' }, 403);
    const body = (await request.json().catch(() => null)) as { status?: unknown; hidden?: unknown } | null;
    if (typeof body?.status === 'string' && STATUSES.includes(body.status as Status)) this.sql.exec('UPDATE ideas SET status = ? WHERE id = ?', body.status, id);
    if (typeof body?.hidden === 'boolean') {
      this.sql.exec('UPDATE ideas SET hidden = ? WHERE id = ?', body.hidden ? 1 : 0, id);
      if (!body.hidden) this.sql.exec('DELETE FROM reports WHERE idea = ?', id);
    }
    return json({ ok: true });
  }

  private exists(id: string) {
    return (this.sql.exec('SELECT COUNT(*) AS n FROM ideas WHERE id = ?', id).one().n as number) > 0;
  }

  private recent(voter: string, net: string, kind: string, ms: number): number {
    const since = Date.now() - ms;
    this.sql.exec('DELETE FROM activity WHERE t < ?', Date.now() - 3600_000);
    return this.sql.exec('SELECT COUNT(*) AS n FROM activity WHERE kind = ? AND t > ? AND (voter = ? OR net = ?)', kind, since, voter, net).one().n as number;
  }

  private note(voter: string, net: string, kind: string) {
    this.sql.exec('INSERT INTO activity (voter, net, kind, t) VALUES (?, ?, ?, ?)', voter, net, kind, Date.now());
  }
}
