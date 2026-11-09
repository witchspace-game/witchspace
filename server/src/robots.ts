// space.witchspace.org.uk is machinery, not pages: kept out of search (Mark, 9 November 2026, after Search
// Console listed its 401s and 404s). Link previewers still need the pictures and videos the cards name
// (X's reads robots.txt), so those stay open to crawling. The two preview pages (/card/, /clip-card/) are
// served as witchspace.org.uk/card/… and /clip/… through the site's rewrites (vercel.json), so they carry
// no noindex: each names its witchspace.org.uk address as canonical.

export const ROBOTS_TXT = 'User-agent: *\nAllow: /card-image/\nAllow: /clip-card/\nAllow: /clip-video/\nDisallow: /\n';

const PREVIEW_PAGE = /^\/(card|clip-card)\/[a-z0-9]+$/;

/** Every answer but the preview pages says noindex; WebSocket upgrades pass untouched. */
export function noindex(pathname: string, res: Response): Response {
  if (res.status === 101 || res.webSocket || PREVIEW_PAGE.test(pathname)) return res;
  const out = new Response(res.body, res);
  out.headers.set('X-Robots-Tag', 'noindex, nofollow');
  return out;
}
