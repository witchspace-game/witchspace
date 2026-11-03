import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareTrack } from './clips';

afterEach(() => vi.unstubAllGlobals());

describe('sharing a track', () => {
  it('sends the bytes, not the stored file (an iPhone fails to send one straight from storage)', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ url: 'https://witchspace.org.uk/clip/abcd1234', title: 'T' }), { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    const r = await shareTrack('m1', new Blob([new Uint8Array([1, 2, 3])]), 12, 1);
    expect(r).toEqual({ url: 'https://witchspace.org.uk/clip/abcd1234', title: 'T' });
    const body = (fetch.mock.calls[0] as unknown as [string, RequestInit])[1].body;
    expect(body).toBeInstanceOf(ArrayBuffer);
    expect((body as ArrayBuffer).byteLength).toBe(3);
  });

  it('says when the moment itself can’t be read back', async () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    const broken = { arrayBuffer: () => Promise.reject(new Error('gone')) } as unknown as Blob;
    const r = await shareTrack('m1', broken, 12);
    expect('error' in r && r.error).toMatch(/couldn’t read that moment/);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('gives the device’s own reason when there’s no answer', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Load failed'))));
    const r = await shareTrack('m1', new Blob([new Uint8Array([1])]), 12);
    expect('error' in r && r.error).toBe("Couldn't reach witchspace.org.uk (Load failed). Check your connection and try again.");
  });

  it('says a wait that ran out timed out', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new DOMException('signal timed out', 'TimeoutError'))));
    const r = await shareTrack('m1', new Blob([new Uint8Array([1])]), 12);
    expect('error' in r && r.error).toMatch(/\(timed out\)/);
  });
});
