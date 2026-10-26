// Witchspace's price relay, in Tokyo (docs/design/system-currencies.md, 6b).
//
// Binance refuses requests from Cloudflare's servers, so the game's server
// can't ask it for the Bitcoin price directly. This tiny server runs on
// fly.io in Tokyo, where Binance answers, and does one thing: GET /btc
// returns the live BTCUSDT price. It is not a general forwarder.
//
// The price is kept for 15 seconds, so however often /btc is asked, Binance
// is asked at most four times a minute. No dependencies; Node 20 or later.
//
//   node server.js
//   curl localhost:3000/btc   →  {"symbol":"BTCUSDT","price":80251.27,"time":1793000000000,"source":"api.binance.com"}

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

const send = (res, status, body) => {
  res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
};

createServer(async (req, res) => {
  const path = new URL(req.url ?? '/', 'http://relay').pathname;
  if (req.method !== 'GET') return send(res, 405, { error: 'GET only' });
  if (path === '/btc') {
    const p = await price();
    return p ? send(res, 200, p) : send(res, 503, { error: 'no price from Binance' });
  }
  if (path === '/health') {
    const p = await price();
    return send(res, p && Date.now() - p.time < 120_000 ? 200 : 503, { ok: Boolean(p), age: p ? Date.now() - p.time : null });
  }
  send(res, 404, { error: 'only /btc and /health' });
}).listen(PORT, () => console.log(`Witchspace relay on :${PORT}`));
