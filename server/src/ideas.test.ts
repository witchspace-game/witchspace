import { describe, expect, it } from 'vitest';
import { boardEmail } from './emails';

describe('the ideas board tells the maintainer', () => {
  it('a new idea or bug: what it is, the words, and a link straight to it; the player’s words escaped', () => {
    const e = boardEmail('bug', 'Hail menu <hard> to close', 'It stays up & covers the "Dock" button', 'https://witchspace.org.uk/ideas/#idea-abc12345');
    expect(e.subject).toBe('Bug reported on the board: Hail menu <hard> to close');
    expect(e.html).toContain('Hail menu &lt;hard&gt; to close');
    expect(e.html).toContain('covers the &quot;Dock&quot; button');
    expect(e.html).not.toContain('<hard>');
    expect(e.html).toContain('#idea-abc12345');
    expect(e.text).toContain('answer on the board');
    expect(boardEmail('idea', 'Rap sheet', '', 'x').subject).toBe('New idea on the board: Rap sheet');
    expect(boardEmail('hidden', 'Spam', 'buy now', 'x').subject).toBe('Hidden after reports: Spam');
    expect(boardEmail('more', '', '', 'x').subject).toBe('More ideas on the board today');
  });

});
