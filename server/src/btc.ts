// The live Bitcoin price for the game's exchange (docs/design/system-currencies.md, 6b).
// Binance refuses Cloudflare's servers, so the price comes through our relay in
// Tokyo (relay/ in the repository). Each answer is kept at the edge for a few
// seconds, so however many commanders are trading, the relay is asked at most
// a few times a minute, and not at all when nobody is.

const RELAY = 'https://witchspace-relay.fly.dev';
const KEEP = { '/btc': 15, '/btc/candles': 60 } as const; // seconds

export const isBtc = (path: string): path is keyof typeof KEEP => path in KEEP;

export async function btc(request: Request, path: keyof typeof KEEP, headers: Record<string, string>, ctx: ExecutionContext): Promise<Response> {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'GET') return new Response('GET only', { status: 405, headers });
  const url = new URL(request.url);
  // Only the parameters the relay takes, so the cache can't be filled with junk.
  const start = Math.max(0, Math.round(Number(url.searchParams.get('start')) || 0)); // from a moment: judging a limit order
  const query = path === '/btc/candles' ? `?interval=${encodeURIComponent(url.searchParams.get('interval') ?? '1h')}&limit=${Math.min(500, Math.max(1, Number(url.searchParams.get('limit')) || 200))}${start ? `&start=${start}` : ''}` : '';
  const key = new Request(`https://btc.cache${path}${query}`);
  const cache = caches.default;
  let res = await cache.match(key);
  if (!res) {
    const upstream = await fetch(`${RELAY}${path}${query}`, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
    if (!upstream || !upstream.ok) return new Response(JSON.stringify({ error: 'No price from the network' }), { status: 503, headers: { ...headers, 'Content-Type': 'application/json' } });
    res = new Response(upstream.body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${KEEP[path]}` } });
    ctx.waitUntil(cache.put(key, res.clone()));
  }
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  out.headers.set('Cache-Control', 'no-store'); // the browser asks us; we keep it
  return out;
}
