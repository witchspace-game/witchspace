// What's new: CHANGELOG.md at the repo root, read at build time, and the line a
// returning commander sees on the Station screen when they dock after an update
// (Mark: "it would be nice to notify CMDRs").
import text from '../../CHANGELOG.md?raw';
import type { Commander } from './commander';

export interface Update {
  /** 2026-11-09: sorts and compares as text. */
  date: string;
  /** As written: "9 November 2026". */
  title: string;
  lines: string[];
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

/** The changelog's sections, newest first. A heading that isn't a date is skipped. */
export function parseChangelog(md: string): Update[] {
  const out: Update[] = [];
  let cur: Update | null = null;
  for (const raw of md.split('\n')) {
    const line = raw.trim();
    const h = /^##\s+(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/.exec(line);
    if (h) {
      const m = MONTHS.indexOf(h[2].toLowerCase());
      cur = m < 0 ? null : { date: `${h[3]}-${String(m + 1).padStart(2, '0')}-${h[1].padStart(2, '0')}`, title: `${Number(h[1])} ${MONTHS[m][0].toUpperCase()}${MONTHS[m].slice(1)} ${h[3]}`, lines: [] };
      if (cur) out.push(cur);
    } else if (line.startsWith('#')) cur = null;
    else if (cur && line.startsWith('- ')) cur.lines.push(line.slice(2));
    else if (cur && line && cur.lines.length) cur.lines[cur.lines.length - 1] += ` ${line}`; // a wrapped line
  }
  return out.filter((u) => u.lines.length).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export const UPDATES = parseChangelog(text);

/**
 * The newest update, if this commander hasn't had it. A brand-new commander starts up to date: patch
 * notes are for players coming back. It waits as one line on the Station screen (`c.whatsNew`), not
 * in the messages, where a wall of text sat on top of the work (Mark, 13 November 2026).
 */
export function checkUpdates(c: Commander, updates = UPDATES): Update | null {
  const latest = updates[0];
  if (!latest) return null;
  // "2026-11-09#9": the date and how many lines it had, so a line added later the same day still reaches you.
  const seen = c.changesSeen;
  const mark = `${latest.date}#${latest.lines.length}`;
  c.changesSeen = mark;
  if (!seen && c.visits === 0) return null;
  const [day, count] = (seen ?? '#').split('#');
  if (day > latest.date || (day === latest.date && Number(count || latest.lines.length) >= latest.lines.length)) return null;
  c.whatsNew = latest.date;
  return latest;
}

/** The update waiting on the Station screen, if there is one. */
export const whatsNewOf = (c: Commander, updates = UPDATES): Update | null => (c.whatsNew ? (updates.find((u) => u.date === c.whatsNew) ?? null) : null);

/** Read: the line goes. */
export function readWhatsNew(c: Commander) {
  delete c.whatsNew;
}
