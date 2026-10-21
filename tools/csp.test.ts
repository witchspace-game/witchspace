// The site's Content Security Policy (vercel.json) must allow everything the
// pages load from elsewhere. The dev server doesn't send it, so a missing
// entry only shows on the live site: the press kit's Cloudinary images were
// blocked that way once. This catches it before it ships.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '..');
const vercel = JSON.parse(readFileSync(join(root, 'vercel.json'), 'utf8')) as { headers: { headers: { key: string; value: string }[] }[] };
const csp = vercel.headers[0].headers.find((h) => h.key === 'Content-Security-Policy')!.value;
const directive = (name: string) => csp.split(';').map((d) => d.trim()).find((d) => d.startsWith(name + ' ')) ?? '';

describe('the security policy allows what the site uses', () => {
  it('lets the press kit load its images and videos from Cloudinary', () => {
    const media = JSON.parse(readFileSync(join(root, 'site/media.json'), 'utf8')) as { cloud: string };
    expect(media.cloud).toBeTruthy();
    expect(directive('img-src')).toContain('https://res.cloudinary.com');
    expect(directive('media-src')).toContain('https://res.cloudinary.com');
  });

  it('lets the ideas board reach its server and run the human check', () => {
    const api = readFileSync(join(root, 'src/site/ideas.ts'), 'utf8').match(/'(https:\/\/[^']+)\/ideas'/)![1];
    expect(directive('connect-src')).toContain(api);
    expect(directive('script-src')).toContain('https://challenges.cloudflare.com');
    expect(directive('frame-src')).toContain('https://challenges.cloudflare.com');
  });

  it('lets the game connect to the shared space server', () => {
    const space = readFileSync(join(root, 'src/net/space.ts'), 'utf8').match(/'(wss:\/\/[^']+)'/)![1];
    expect(directive('connect-src')).toContain(space);
  });
});
