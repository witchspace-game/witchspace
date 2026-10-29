import { describe, expect, it } from 'vitest';
import { destinations, forX, X_TEXT_MAX } from './shareLinks';

const xOf = (url: string, text: string) => new URL(destinations(url, text).find(([id]) => id === 'x')![2]);

describe('sharing to X', () => {
  it('ends every post "via @witchspace_game", and only on X', () => {
    const x = xOf('https://witchspace.org.uk/clip/3e66f8146b', 'CMDR Jameson: 3 kills in one fight at Xeaqu');
    expect(x.searchParams.get('via')).toBe('witchspace_game');
    expect(x.searchParams.get('text')).toBe('CMDR Jameson: 3 kills in one fight at Xeaqu');
    for (const [id, , href] of destinations('https://witchspace.org.uk', 'Hi')) if (id !== 'x') expect(href).not.toContain('witchspace_game');
  });

  it('fits 280 with the link (23, as t.co) and the via, however long the line', () => {
    const long = 'CMDR Jameson: '.padEnd(400, 'x');
    const text = forX(long);
    expect([...text].length).toBe(X_TEXT_MAX);
    expect(text.endsWith('…')).toBe(true);
    expect([...text].length + 1 + 23 + ' via @witchspace_game'.length).toBeLessThanOrEqual(280);
    expect(forX('Short line')).toBe('Short line');
  });
});
