import { setQuote, type BtcQuote } from '../economy/bitcoin';
import { API } from './account';

// The live Bitcoin price and its candles, from the game's server
// (server/src/btc.ts), which has them from our relay in Tokyo. Asked only
// while the exchange is open, and kept a little while here too.

export interface BtcCandle {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

let quote: BtcQuote | null = null;
let askedAt = 0;
let asking: Promise<BtcQuote | null> | null = null;

/** The price, asked again if it's more than `maxAge` ms old. */
export function btcQuote(maxAge = 15_000): Promise<BtcQuote | null> {
  if (quote && Date.now() - askedAt < maxAge) return Promise.resolve(quote);
  asking ??= fetch(`${API}/btc`)
    .then((r) => (r.ok ? r.json() : null))
    .then((j: { price?: number; time?: number } | null) => {
      if (j && Number.isFinite(j.price) && Number.isFinite(j.time)) {
        quote = { price: j.price!, time: j.time! };
        setQuote(quote);
      }
      askedAt = Date.now();
      return quote;
    })
    .catch(() => quote)
    .finally(() => (asking = null));
  return asking;
}

/** The price as last heard, without asking. */
export const heardQuote = () => quote;

const candleCache = new Map<string, { at: number; candles: BtcCandle[] }>();
const candleAsks = new Map<string, Promise<BtcCandle[] | null>>();

/** Real candles for the chart: interval 5m, 15m or 1h. Kept a minute. */
export function btcCandles(interval: string, limit: number): Promise<BtcCandle[] | null> {
  const key = `${interval}:${limit}`;
  const kept = candleCache.get(key);
  if (kept && Date.now() - kept.at < 60_000) return Promise.resolve(kept.candles);
  const pending = candleAsks.get(key);
  if (pending) return pending;
  const p = fetch(`${API}/btc/candles?interval=${interval}&limit=${limit}`)
    .then((r) => (r.ok ? r.json() : null))
    .then((list: BtcCandle[] | null) => {
      if (Array.isArray(list) && list.length) candleCache.set(key, { at: Date.now(), candles: list });
      return candleCache.get(key)?.candles ?? null;
    })
    .catch(() => kept?.candles ?? null)
    .finally(() => candleAsks.delete(key));
  candleAsks.set(key, p);
  return p;
}

/** Candles already to hand, without asking. */
export const heardCandles = (interval: string, limit: number) => candleCache.get(`${interval}:${limit}`)?.candles ?? null;
