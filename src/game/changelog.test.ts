import { describe, expect, it } from 'vitest';
import { checkUpdates, parseChangelog, UPDATES } from './changelog';
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

  it('reads the real CHANGELOG.md', () => {
    expect(UPDATES.length).toBeGreaterThan(0);
    expect(UPDATES[0].date).toMatch(/^\d{4}-\d\d-\d\d$/);
  });

  it('sends a returning commander the newest update once; a new commander starts up to date', () => {
    const updates = parseChangelog(md);
    const fresh = newCommander('modern');
    expect(checkUpdates(fresh, 1, updates)).toBeNull();
    expect(fresh.changesSeen).toBe('2026-11-09');

    const back = { ...newCommander('modern'), visits: 12 };
    const m = checkUpdates(back, 1, updates);
    expect(m?.subject).toBe("What's new, 9 November 2026");
    expect(m?.body).toBe('• One thing, wrapped.\n• Another.');
    expect(back.messages?.[0]).toBe(m);
    expect(checkUpdates(back, 2, updates)).toBeNull();

    const behind = { ...newCommander('classic'), visits: 3, changesSeen: '2026-11-06' };
    expect(checkUpdates(behind, 1, updates)?.id).toBe('update:2026-11-09');
  });
});
