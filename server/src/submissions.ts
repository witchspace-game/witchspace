// Submissions (docs/design/submissions.md): handing in a ship or a Titanoboa
// module with no GitHub. These are the rules, kept pure so they can be tested:
// what may be sent, the checks on the way in, and what the server fills in so
// the credit and the commission can't go astray. The table and the routes are
// in accounts.ts; the pull request is opened by github.ts.

import { moduleCheck } from '../../src/content/modules';
import type { ModuleDef, ShipDef } from '../../src/content/types';

export const KINDS = ['ship', 'module'] as const;
export type Kind = (typeof KINDS)[number];
export type Status = 'submitted' | 'changes' | 'accepted' | 'withdrawn';
export type Via = 'site' | 'connector';

export const MAX_FILE = 64 * 1024; // bytes of JSON
export const PER_DAY = 5;
export const OPEN_AT_ONCE = 10;
export const MAX_NOTE = 2000;
/** Checks without storing (POST /submissions/check), per network per minute: loose, since nothing is kept. */
export const CHECKS_PER_MINUTE = 30;
/** While it's waiting or sent back, the author may revise or withdraw it. */
export const OPEN: readonly Status[] = ['submitted', 'changes'];

const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The checks each kind runs: the game's own, passed in (the Worker's are compiled; tests bring their own). */
export interface Checks {
  ship: (ship: ShipDef) => { errors: string[]; warnings: string[] };
  module: (m: ModuleDef) => { errors: string[]; warnings: string[] };
  ships: ReadonlyMap<string, ShipDef>;
  modules: ReadonlyMap<string, ModuleDef>;
}

/** A module's checks, shared with the MCP server's validate_module (src/content/modules.ts). */
export { moduleCheck };

export interface Prepared {
  file: ShipDef | ModuleDef;
  itemId: string;
  title: string;
  revises: boolean;
  warnings: string[];
}

/** A file passed as an object or as JSON text. */
export function parseFile(v: unknown): { file?: Record<string, unknown>; error?: string } {
  if (typeof v === 'string') {
    if (v.length > MAX_FILE) return { error: `That file is ${Math.round(v.length / 1024)} KB: the most is ${MAX_FILE / 1024} KB` };
    try {
      v = JSON.parse(v);
    } catch (e) {
      return { error: `That isn't valid JSON: ${(e as Error).message}` };
    }
  }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return { error: 'Send the file as a JSON object' };
  if (JSON.stringify(v).length > MAX_FILE) return { error: `That file is over ${MAX_FILE / 1024} KB` };
  return { file: v as Record<string, unknown> };
}

/**
 * Check a file and fill in what the server decides: the credit, and for a module
 * its designer and service. `problems` stops it; `warnings` go to the reviewer.
 */
export function prepare(kind: Kind, raw: Record<string, unknown>, callsign: string, ai: boolean, checks: Checks): { prepared?: Prepared; problems?: string[] } {
  const { $schema: _, ...file } = raw;
  const id = file.id;
  if (typeof id !== 'string' || !ID.test(id) || id.length > 40) return { problems: ['id: a short kebab-case id, like "ice-hold" (letters, digits and hyphens)'] };
  const looksLike: Kind = 'zone' in file || 'couples' in file ? 'module' : 'ship';
  if (looksLike !== kind) return { problems: [`kind: that looks like a ${looksLike} file, not a ${kind}`] };

  const given = file.credits && typeof file.credits === 'object' ? (file.credits as Record<string, unknown>) : {};
  const others = Array.isArray(given.authors) ? given.authors.filter((a): a is string => typeof a === 'string' && a.trim() !== '' && a.trim().toLowerCase() !== callsign.toLowerCase()) : [];
  file.credits = {
    authors: [callsign, ...others.slice(0, 4)],
    license: 'CC-BY-SA-4.0',
    aiAssisted: ai,
    ...(typeof given.notes === 'string' && given.notes ? { notes: given.notes } : {}),
  };

  if (kind === 'module') {
    const old = checks.modules.get(id);
    // The company mark is Wexley-Yorozu's, on the habitat alone: a submission keeps whatever the original had.
    for (const k of ['inService', 'revisions', 'insignia']) delete file[k];
    if (old) {
      file.designer = old.designer;
      if (old.inService) file.inService = old.inService;
      if (old.revisions) file.revisions = old.revisions;
      if (old.insignia) file.insignia = old.insignia;
    } else file.designer = callsign;
    const m = file as unknown as ModuleDef;
    const { errors, warnings } = checks.module(m);
    if (errors.length) return { problems: errors.map(tidy) };
    return { prepared: { file: m, itemId: id, title: titleOf(m.name, id), revises: Boolean(old), warnings: warnings.map(tidy) } };
  }
  const ship = file as unknown as ShipDef;
  const { errors, warnings } = checks.ship(ship);
  if (errors.length) return { problems: errors.map(tidy) };
  // validate_ship warns when the id is taken; here that just means it's a revision.
  return { prepared: { file: ship, itemId: id, title: titleOf(ship.name, id), revises: checks.ships.has(id), warnings: warnings.filter((w) => !w.startsWith('id:')).map(tidy) } };
}

/**
 * Every problem and warning reads "<where>: <what>". `where` is a field path as the file
 * writes it ("length", "geometry.vertices[3]", "credits.authors") when the check names
 * one, or else an area: "file", "id", "kind", "geometry", "size", "maker", and so on.
 * The site pins the ones with a field path to that field.
 */
export function tidy(line: string): string {
  const schema = /^(?:schema: )?(\/\S*|\(the \w+\)) (.*)$/.exec(line);
  if (schema) {
    const [, at, what] = schema;
    const path = at.startsWith('(') || at === '/' ? 'file' : at.slice(1).split('/').map((k, i) => (/^\d+$/.test(k) ? `[${k}]` : `${i ? '.' : ''}${k}`)).join('');
    return `${path}: ${what}`;
  }
  return /^[A-Za-z][\w.[\]-]*: /.test(line) ? line : `file: ${line}`;
}

const titleOf = (name: unknown, id: string) => (typeof name === 'string' && name.trim() ? name.trim().slice(0, 80) : id);

/** Where an accepted file goes in the repository, with the `$schema` the content files carry. */
export function repoFile(kind: Kind, itemId: string, file: object): { path: string; text: string } {
  const dir = kind === 'ship' ? 'ships' : 'modules';
  return { path: `content/${dir}/${itemId}.json`, text: `${JSON.stringify({ $schema: `../../schemas/${kind}.schema.json`, ...file }, null, 2)}\n` };
}

export interface PullRequestText {
  branch: string;
  title: string;
  commit: string;
  body: string;
}

/** What the pull request says: who made it, how, and what to do before merging. */
export function pullRequestText(s: { id: string; kind: Kind; itemId: string; title: string; revises: boolean; callsign: string; ai: boolean; via: Via; note: string; review: string | null; version: number }): PullRequestText {
  const what = s.revises ? `an improved ${s.title}` : `a new ${s.kind === 'ship' ? 'ship' : 'Titanoboa module'}, the ${s.title}`;
  const title = `${s.title}: ${s.revises ? 'improved' : 'a new ' + s.kind} by CMDR ${s.callsign}`;
  const body = [
    `Submission \`${s.id}\` (version ${s.version}): ${what}, by CMDR ${s.callsign}, sent from ${s.via === 'site' ? 'the site' : 'an AI assistant through the Build connector'}.`,
    '',
    `- **AI-assisted:** ${s.ai ? 'yes' : 'no'}`,
    `- **File:** \`${repoFile(s.kind, s.itemId, {}).path}\``,
    ...(s.note ? ['', '**Their note:**', '', ...s.note.split('\n').map((l) => `> ${l}`)] : []),
    ...(s.review ? ['', '**Review notes:**', '', s.review] : []),
    '',
    s.kind === 'module'
      ? s.revises
        ? `Before merging: add \`{ "by": "${s.callsign}", "from": "<the date>" }\` to \`revisions\`, so the revision fee reaches them when it's first fitted.`
        : 'Before merging: add `inService` (the date, and what it replaces or that it is added), so it goes into the line-up and the commission is paid when it is first fitted.'
      : 'Before merging: fly it, and check it against docs/design/ships-and-classes.md.',
    '',
    'Opened by the Witchspace GitHub App when a maintainer accepted it (docs/design/submissions.md).',
  ].join('\n');
  const commit = `${title} (submission ${s.id})\n\n${s.ai ? 'AI-assisted: yes' : 'AI-assisted: no'}\nSubmitted-by: CMDR ${s.callsign}`;
  return { branch: `submission/${s.id}`, title, commit, body };
}
