import type { ShipDef } from '../content/types';

// The submit page's logic, with no DOM, so it can be tested: reading a file
// someone pasted or uploaded, drawing it before it's checked, and pinning the
// server's problems to the fields they name. The contract is
// docs/design/submissions.md.

export type Kind = 'ship' | 'module';
export type Status = 'submitted' | 'changes' | 'accepted' | 'withdrawn';

export interface Submission {
  id: string;
  kind: Kind;
  itemId: string;
  title: string;
  revises: boolean;
  status: Status;
  note: string;
  ai: boolean;
  via: 'site' | 'connector';
  review: string | null;
  pr: string | null;
  version: number;
  created: number;
  updated: number;
  warnings: string[];
  file?: Record<string, unknown>;
}

export interface Limits {
  today: number;
  perDay: number;
  waiting: number;
  maxWaiting: number;
}

export interface Check {
  problems: string[];
  warnings: string[];
  title: string | null;
  itemId: string | null;
  revises: boolean | null;
}

/** The fields the form lets you fill in; a problem about one is shown under it. */
export const FIELDS = ['id', 'name', 'description', 'zone'] as const;
export type Field = (typeof FIELDS)[number];

/** Pasted or uploaded text as a file, or why it isn't one, in words a non-programmer can act on. */
export function readFile(text: string): { file: Record<string, unknown> } | { error: string } {
  const t = text.trim();
  if (!t) return { error: 'Paste a file, upload one, or start from a module.' };
  let v: unknown;
  try {
    v = JSON.parse(t);
  } catch (e) {
    // "Unexpected token } in JSON at position 812": turn the position into a line.
    const at = /position (\d+)/.exec(String((e as Error).message));
    const line = at ? t.slice(0, Number(at[1])).split('\n').length : null;
    return { error: `That isn't valid JSON${line ? ` (look near line ${line})` : ''}. A missing comma or quote is the usual reason.` };
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'The file should be one JSON object, starting with { and ending with }.' };
  return { file: v as Record<string, unknown> };
}

/** Which kind a file looks like: a module couples, a ship has stats. */
export function kindOf(file: Record<string, unknown>): Kind | null {
  if ('couples' in file || 'zone' in file) return 'module';
  if ('stats' in file || 'role' in file) return 'ship';
  return null;
}

const isVec = (v: unknown) => Array.isArray(v) && v.length === 3 && v.every((n) => typeof n === 'number' && Number.isFinite(n));

/**
 * Something the viewer can draw, as soon as the geometry makes sense, before
 * the server's checks: a module in the Titanoboa's yellow, a ship in its own
 * colour. Null if there's nothing drawable yet.
 */
export function previewOf(kind: Kind, file: Record<string, unknown>): ShipDef | null {
  const g = file.geometry as { vertices?: unknown; faces?: unknown; details?: unknown } | undefined;
  const vertices = g?.vertices;
  const faces = g?.faces;
  if (!Array.isArray(vertices) || !vertices.length || vertices.length > 512 || !vertices.every(isVec)) return null;
  if (!Array.isArray(faces) || !faces.every((f) => Array.isArray(f) && f.length >= 3 && f.every((i) => Number.isInteger(i) && i >= 0 && i < vertices.length))) return null;
  const style = file.style as { lineColor?: unknown; glow?: unknown } | undefined;
  const colour = kind === 'ship' && typeof style?.lineColor === 'string' && /^#[0-9a-f]{6}$/i.test(style.lineColor) ? style.lineColor : '#ffd23d';
  const geometry: ShipDef['geometry'] = { vertices: vertices as ShipDef['geometry']['vertices'], faces: faces as number[][] };
  const d = g?.details as { vertices?: unknown; lines?: unknown } | undefined;
  if (Array.isArray(d?.vertices) && d.vertices.every(isVec) && Array.isArray(d?.lines) && d.lines.every((l) => Array.isArray(l) && l.length === 2 && l.every((i) => Number.isInteger(i) && i >= 0 && i < (d.vertices as unknown[]).length)))
    geometry.details = { vertices: d.vertices as ShipDef['geometry']['vertices'], lines: d.lines as [number, number][] };
  return {
    id: String(file.id ?? 'draft'),
    name: String(file.name ?? 'Draft'),
    role: 'trader',
    description: '',
    credits: { authors: [], license: 'CC-BY-SA-4.0' },
    geometry,
    stats: { maxSpeed: 0, hull: 1, shields: 0, cargo: 0, price: 0, ratingValue: 0 },
    style: { lineColor: colour, glow: 1 },
  } as ShipDef;
}

/**
 * Problems sorted for the form: "<where>: <what>" (the contract's rule), so
 * one whose where is a field the form shows goes under that field, without
 * its prefix; the rest are listed as they come.
 */
export function pinProblems(problems: string[]): { byField: Partial<Record<Field, string[]>>; rest: string[] } {
  const byField: Partial<Record<Field, string[]>> = {};
  const rest: string[] = [];
  for (const p of problems) {
    const m = /^([\w.[\]]+): (.+)$/s.exec(p);
    const field = m ? (FIELDS as readonly string[]).find((f) => m[1] === f) : undefined;
    if (field) (byField[field as Field] ??= []).push(plainly(m![2]));
    else rest.push(m ? `${m[1]}: ${plainly(m[2])}` : p);
  }
  return { byField, rest };
}

/** The schema's wording, said plainly: "must NOT have fewer than 10 characters" → "at least 10 characters". */
export function plainly(what: string): string {
  return what
    .replace(/^must NOT have fewer than (\d+) characters$/, 'at least $1 characters, please')
    .replace(/^must NOT have more than (\d+) characters$/, 'at most $1 characters')
    .replace(/^must NOT have fewer than (\d+) items$/, 'needs at least $1')
    .replace(/^must NOT have more than (\d+) items$/, 'at most $1')
    .replace(/^must have required property '(\w+)'$/, 'needs "$1"')
    .replace(/^must be >= (\S+)$/, 'at least $1')
    .replace(/^must be <= (\S+)$/, 'at most $1')
    .replace(/^must be equal to one of the allowed values$/, 'not one of the allowed values')
    .replace(/^must match pattern .*$/, 'not in the right form');
}

/** How a submission stands, in words. */
export const STATUS: Record<Status, string> = {
  submitted: 'Waiting for review',
  changes: 'Sent back with notes',
  accepted: 'Accepted',
  withdrawn: 'Withdrawn',
};

/** Whether it can still be revised or withdrawn. */
export const open = (s: Submission) => s.status === 'submitted' || s.status === 'changes';

/** "2 of 5 left today · 1 waiting of 10", or why you can't hand in more now. */
export function limitsLine(l: Limits): string {
  const left = Math.max(0, l.perDay - l.today);
  if (l.waiting >= l.maxWaiting) return `You have ${l.waiting} waiting for review, the most at once. One needs reviewing or withdrawing before you hand in another.`;
  if (!left) return `That's all ${l.perDay} for today. You can hand in more tomorrow (UTC).`;
  return `${left} of ${l.perDay} left today · ${l.waiting} waiting for review (up to ${l.maxWaiting})`;
}

/**
 * A core module as a starting point: "improve" keeps its id, so it's handed in
 * as a revision; "new" gives it a new id and name to make your own. The server
 * sets the credits and designer either way.
 */
export function fromModule(m: Record<string, unknown>, as: 'improve' | 'new'): Record<string, unknown> {
  const copy = structuredClone(m);
  delete copy.$schema;
  delete copy.inService;
  delete copy.revisions;
  if (as === 'new') {
    copy.id = `my-${String(m.id)}`;
    copy.name = `My ${String(m.name)}`;
    copy.description = '';
    delete copy.designer;
    delete copy.insignia;
    // Yours: the server puts your callsign first and keeps any other names, so start with none.
    copy.credits = { authors: [], license: 'CC-BY-SA-4.0' };
  }
  return copy;
}
