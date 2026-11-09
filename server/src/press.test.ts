import { describe, expect, it } from 'vitest';
import { downloadName, PRESS_NAME, pressMedia } from './press';

const BYTES = new TextEncoder().encode('0123456789');

/** Just enough of an R2 bucket: one file, with ranges as R2 reports them. */
function bucket(files: Record<string, Uint8Array>): R2Bucket {
  const object = (key: string, range?: { offset?: number; length?: number; suffix?: number }) => {
    const data = files[key];
    if (!data) return null;
    let part = data;
    if (range?.suffix !== undefined) part = data.slice(data.length - range.suffix);
    else if (range) part = data.slice(range.offset ?? 0, range.length === undefined ? undefined : (range.offset ?? 0) + range.length);
    return { key, size: data.length, httpEtag: '"e1"', range, body: new Response(part).body } as unknown as R2ObjectBody;
  };
  return {
    head: async (key: string) => object(key),
    get: async (key: string, o?: { range?: Headers }) => {
      const m = o?.range?.get('Range')?.match(/^bytes=(\d*)-(\d*)$/);
      const range = !m ? undefined : m[1] === '' ? { suffix: Number(m[2]) } : { offset: Number(m[1]), ...(m[2] ? { length: Number(m[2]) - Number(m[1]) + 1 } : {}) };
      return object(key, range);
    },
  } as unknown as R2Bucket;
}

const files = bucket({ 'press/trailer-v2.mp4': BYTES, 'press/hero-v1.jpg': BYTES });
const ask = (path: string, init?: RequestInit) => {
  const req = new Request(`https://space.witchspace.org.uk${path}`, init);
  const m = new URL(req.url).pathname.match(PRESS_NAME);
  return m ? pressMedia(req, files, m[1], m[2]) : null;
};

describe('the press kit from the bucket', () => {
  it('takes only plain versioned names', () => {
    for (const ok of ['/press-media/trailer-v2.mp4', '/press-media/hero.v1.webp', '/press-media/shot-3.jpg']) expect(ok).toMatch(PRESS_NAME);
    for (const bad of ['/press-media/../x.jpg', '/press-media/Hero.jpg', '/press-media/a.png', '/press-media/a/b.jpg', '/press-media/a.b.c.jpg']) expect(bad).not.toMatch(PRESS_NAME);
  });

  it('serves the whole file, cached for good, to anyone', async () => {
    const r = (await ask('/press-media/hero-v1.jpg'))!;
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Type')).toBe('image/jpeg');
    expect(r.headers.get('Cache-Control')).toBe('public, max-age=31536000, immutable');
    expect(r.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(r.headers.get('ETag')).toBe('"e1"');
    expect(r.headers.get('Content-Length')).toBe('10');
    expect(r.headers.get('Content-Disposition')).toBeNull();
    expect(await r.text()).toBe('0123456789');
  });

  it('serves ranges, as iPhones ask for video', async () => {
    const r = (await ask('/press-media/trailer-v2.mp4', { headers: { Range: 'bytes=2-5' } }))!;
    expect(r.status).toBe(206);
    expect(r.headers.get('Content-Range')).toBe('bytes 2-5/10');
    expect(await r.text()).toBe('2345');
    const tail = (await ask('/press-media/trailer-v2.mp4', { headers: { Range: 'bytes=-3' } }))!;
    expect(tail.headers.get('Content-Range')).toBe('bytes 7-9/10');
    expect(await tail.text()).toBe('789');
  });

  it('answers HEAD without the file', async () => {
    const r = (await ask('/press-media/trailer-v2.mp4', { method: 'HEAD' }))!;
    expect(r.status).toBe(200);
    expect(r.headers.get('Content-Length')).toBe('10');
    expect(r.body).toBeNull();
  });

  it('downloads under a clean name for the Download buttons', async () => {
    const r = (await ask('/press-media/trailer-v2.mp4?dl=Witchspace%20Trailer"%0d.mp4'))!;
    expect(r.headers.get('Content-Disposition')).toBe('attachment; filename="witchspacetrailer.mp4"');
    expect(downloadName('../../etc')).toBe('etc');
  });

  it('is read-only, and missing files are 404', async () => {
    expect((await ask('/press-media/nope.jpg'))!.status).toBe(404);
    expect((await ask('/press-media/hero-v1.jpg', { method: 'PUT', body: 'x' }))!.status).toBe(405);
  });
});
