// Witchspace's price relay, in Tokyo (docs/design/system-currencies.md, 6b).
//
// Binance refuses requests from Cloudflare's servers, so the game's server
// can't ask it for the Bitcoin price directly. This tiny server runs on
// fly.io in Tokyo, where Binance answers, and does two things: GET /btc
// returns the live BTCUSDT price, and GET /btc/candles its history for the
// exchange's chart. It is not a general forwarder.
//
// The price is kept for 15 seconds and candles for a minute, so however often
// the relay is asked, Binance is asked only a few times a minute. No
// dependencies; Node 20 or later.
//
//   node server.js
//   curl localhost:3000/btc   →  {"symbol":"BTCUSDT","price":80251.27,"time":1793000000000,"source":"api.binance.com"}
//   curl 'localhost:3000/btc/candles?interval=1h&limit=48'   →  [{"t":…,"o":…,"h":…,"l":…,"c":…,"v":…}, …]

import { createServer } from 'node:http';

const PORT = Number(process.env.PORT) || 3000;
const KEEP_MS = 15_000;
// The main API first, then Binance's public market-data host.
const SOURCES = ['https://api.binance.com', 'https://data-api.binance.vision'];

let last = null; // { symbol, price, time, source }
let pending = null;

async function fetchPrice() {
  for (const host of SOURCES) {
    try {
      const r = await fetch(`${host}/api/v3/ticker/price?symbol=BTCUSDT`, { signal: AbortSignal.timeout(5_000) });
      if (!r.ok) continue;
      const price = Number((await r.json()).price);
      if (Number.isFinite(price) && price > 0) return { symbol: 'BTCUSDT', price, time: Date.now(), source: new URL(host).host };
    } catch {
      /* try the next */
    }
  }
  return null;
}

async function price() {
  if (last && Date.now() - last.time < KEEP_MS) return last;
  pending ??= fetchPrice().finally(() => (pending = null));
  const fresh = await pending;
  if (fresh) last = fresh;
  return fresh ?? last; // a stale price beats none; its time says how stale
}

// Candles: the time frames the exchange's chart offers, up to 500 at a time.
const INTERVALS = new Set(['1m', '5m', '15m', '1h', '4h', '1d', '1w']);
const CANDLES_MS = 60_000;
const candleCache = new Map(); // `${interval}:${limit}` → { time, candles }

async function fetchCandles(interval, limit) {
  for (const host of SOURCES) {
    try {
      const r = await fetch(`${host}/api/v3/klines?symbol=BTCUSDT&interval=${interval}&limit=${limit}`, { signal: AbortSignal.timeout(5_000) });
      if (!r.ok) continue;
      // Binance's rows: [open time, open, high, low, close, volume, …]
      return (await r.json()).map((k) => ({ t: k[0], o: Number(k[1]), h: Number(k[2]), l: Number(k[3]), c: Number(k[4]), v: Number(k[5]) }));
    } catch {
      /* try the next */
    }
  }
  return null;
}

async function candles(interval, limit) {
  const key = `${interval}:${limit}`;
  const kept = candleCache.get(key);
  if (kept && Date.now() - kept.time < CANDLES_MS) return kept.candles;
  const fresh = await fetchCandles(interval, limit);
  if (fresh) candleCache.set(key, { time: Date.now(), candles: fresh });
  return fresh ?? kept?.candles ?? null;
}

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://relay');
  const path = url.pathname;
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  if (path === '/btc') {
    const p = await price();
    return p ? send(res, 200, p) : send(res, 503, { error: 'no price from Binance' });
  }
  if (path === '/btc/candles') {
    const interval = url.searchParams.get('interval') ?? '1h';
    const limit = Math.min(500, Math.max(1, Math.round(Number(url.searchParams.get('limit') ?? 200)) || 200));
    if (!INTERVALS.has(interval)) return send(res, 400, { error: `interval must be one of ${[...INTERVALS].join(', ')}` });
    const c = await candles(interval, limit);
    return c ? send(res, 200, c) : send(res, 503, { error: 'no candles from Binance' });
  }
  if (path === '/health') {
    const p = await price();
    return send(res, p && Date.now() - p.time < 120_000 ? 200 : 503, { ok: Boolean(p), age: p ? Date.now() - p.time : null });
  }
  send(res, 404, { error: 'only /btc, /btc/candles and /health' });
}).listen(PORT, () => console.log(`Witchspace relay on :${PORT}`));
