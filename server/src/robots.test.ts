import { describe, expect, it } from 'vitest';
import { noindex, ROBOTS_TXT } from './robots';

const tag = (path: string, res = new Response('x', { status: 404 })) => noindex(path, res).headers.get('X-Robots-Tag');

describe('keeping space.witchspace.org.uk out of search', () => {
  it('says noindex on the endpoints, errors and pictures', () => {
    for (const p of ['/', '/me', '/btc', '/feed', '/health', '/card-image/abcdefghij.jpg', '/clip-card/abcd1234.jpg', '/clip-video/abcd1234.mp4', '/robots.txt'])
      expect(tag(p)).toBe('noindex, nofollow');
  });

  it('leaves the preview pages the site serves as its own alone', () => {
    expect(tag('/card/abcdefghij', new Response('<html>'))).toBeNull();
    expect(tag('/clip-card/abcd1234', new Response('<html>'))).toBeNull();
  });

  it('keeps a redirect a redirect', () => {
    const r = noindex('/me', Response.redirect('https://witchspace.org.uk/callsign/', 302));
    expect(r.status).toBe(302);
    expect(r.headers.get('Location')).toBe('https://witchspace.org.uk/callsign/');
  });

  it('lets crawlers reach only what link previews need', () => {
    expect(ROBOTS_TXT).toContain('Disallow: /\n');
    for (const p of ['/card-image/', '/clip-card/', '/clip-video/']) expect(ROBOTS_TXT).toContain(`Allow: ${p}`);
  });
});
