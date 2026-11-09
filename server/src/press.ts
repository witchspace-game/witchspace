// The press kit's pictures and videos, served from the clips bucket under press/ (moved off Cloudinary,
// Mark, 9 November 2026). Read-only: the website session puts files up with wrangler, after Mark's OK.
// The names are versioned (a changed file gets a new name), so they are cached for good.

export const PRESS_NAME = /^\/press-media\/([a-z0-9-]+(?:\.[a-z0-9]+)?\.(jpg|webp|mp4))$/;

const TYPES: Record<string, string> = { jpg: 'image/jpeg', webp: 'image/webp', mp4: 'video/mp4' };

/** A name fit for Content-Disposition: lower case letters, digits, dots and hyphens only. */
export const downloadName = (s: string) => s.toLowerCase().replace(/[^a-z0-9.-]/g, '').replace(/^\.+/, '').slice(0, 100);

/** An R2 object as an HTTP answer, whole or the range asked for (206). Shared with the clips' videos. */
export function objectResponse(request: Request, obj: R2Object | R2ObjectBody, headers: Headers): Response {
  headers.set('Accept-Ranges', 'bytes');
  headers.set('ETag', obj.httpEtag);
  const body = request.method === 'HEAD' || !('body' in obj) ? null : obj.body;
  const range = obj.range as { offset?: number; length?: number; suffix?: number } | undefined;
  if (range && request.headers.has('Range')) {
    const start = range.suffix !== undefined ? Math.max(0, obj.size - range.suffix) : (range.offset ?? 0);
    const end = range.suffix !== undefined ? obj.size - 1 : start + (range.length ?? obj.size - start) - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${obj.size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body, { status: 206, headers });
  }
  headers.set('Content-Length', String(obj.size));
  return new Response(body, { headers });
}

/** GET or HEAD /press-media/<name>[?dl=<filename>]. */
export async function pressMedia(request: Request, bucket: R2Bucket | undefined, name: string, ext: string): Promise<Response> {
  if (request.method !== 'GET' && request.method !== 'HEAD') return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
  const key = `press/${name}`;
  const obj = !bucket ? null : request.method === 'HEAD' ? await bucket.head(key) : await bucket.get(key, { range: request.headers });
  if (!obj) return new Response('Not found', { status: 404, headers: { 'Access-Control-Allow-Origin': '*' } });
  const headers = new Headers({ 'Content-Type': TYPES[ext], 'Cache-Control': 'public, max-age=31536000, immutable', 'Access-Control-Allow-Origin': '*' });
  const dl = downloadName(new URL(request.url).searchParams.get('dl') ?? '');
  if (dl) headers.set('Content-Disposition', `attachment; filename="${dl}"`);
  return objectResponse(request, obj, headers);
}
