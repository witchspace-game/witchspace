import { describe, expect, it } from 'vitest';
import { checkUpdates, parseChangelog, readWhatsNew, UPDATES, whatsNewOf } from './changelog';
import text from '../../CHANGELOG.md?raw';
import { newCommander } from './commander';

const md = `# What's new

Intro, not a change.

## 6 November 2026

- Older.

## 9 November 2026

- One thing,
  wrapped.
- Another.

## Notes

- Not an update.
`;

describe("what's new", () => {
  it('reads dated sections, newest first, and joins wrapped lines', () => {
    expect(parseChangelog(md)).toEqual([
      { date: '2026-11-09', title: '9 November 2026', lines: ['One thing, wrapped.', 'Another.'] },
      { date: '2026-11-06', title: '6 November 2026', lines: ['Older.'] },
    ]);
  });

  it('has only dated headings, "## 9 November 2026", so the site can read it too (Website builds /updates/ from it)', () => {
    const headings = text.split('\n').filter((l) => /^##\s/.test(l));
    expect(headings.length).toBeGreaterThan(0);
    for (const h of headings) expect(h, h).toMatch(/^## [1-9]\d? (January|February|March|April|May|June|July|August|September|October|November|December) \d{4}$/);
    expect(UPDATES).toHaveLength(headings.length);
  });

  it('reads the real CHANGELOG.md', () => {
    expect(UPDATES.length).toBeGreaterThan(0);
    expect(UPDATES[0].date).toMatch(/^\d{4}-\d\d-\d\d$/);
  });

  it('shows a returning commander the newest update once, as a line, not a message; a new commander starts up to date', () => {
    const updates = parseChangelog(md);
    const fresh = newCommander('modern');
    expect(checkUpdates(fresh, updates)).toBeNull();
    expect(fresh.changesSeen).toBe('2026-11-09#2');
    expect(fresh.whatsNew).toBeUndefined();

    const back = { ...newCommander('modern'), visits: 12 };
    const u = checkUpdates(back, updates);
    expect(u?.title).toBe('9 November 2026');
    expect(whatsNewOf(back, updates)?.lines).toEqual(['One thing, wrapped.', 'Another.']);
    expect(back.messages ?? []).toHaveLength(0);
    expect(checkUpdates(back, updates)).toBeNull();
    readWhatsNew(back);
    expect(whatsNewOf(back, updates)).toBeNull();

    // A line added later the same day: shown again.
    const more = parseChangelog(md.replace('- Another.', '- Another.\n- A third.'));
    expect(checkUpdates(back, more)?.lines).toContain('A third.');
    expect(whatsNewOf(back, more)?.lines).toHaveLength(3);

    const behind = { ...newCommander('classic'), visits: 3, changesSeen: '2026-11-06#1' };
    expect(checkUpdates(behind, updates)?.date).toBe('2026-11-09');
  });
});
