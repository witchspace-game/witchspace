// The real price since a Bitcoin limit order was placed, for judging it
// (economy/bitcoin.ts fillBtcOrders): the game and the server both use this,
// so a "your order filled" notification and the game always agree. Minute
// candles from the moment it was placed, for its first 500 minutes; then
// five-minute, hourly and daily candles, each segment starting where the last
// one's coverage ended.

import type { PriceSpan } from './bitcoin';

/** Fetch up to `limit` candles of `interval` starting at `start` (ms). */
export type CandleFetch = (interval: string, limit: number, start: number) => Promise<PriceSpan[] | null>;

const SEGMENTS: [string, number][] = [
  ['1m', 60_000],
  ['5m', 5 * 60_000],
  ['1h', 3600_000],
  ['1d', 86_400_000],
];
const LIMIT = 500;

export async function spansSince(placed: number, now: number, fetch: CandleFetch): Promise<PriceSpan[]> {
  const out: PriceSpan[] = [];
  let from = placed;
  for (const [interval, ms] of SEGMENTS) {
    if (from >= now) break;
    // Start at the coarser candle that overlaps where the finer ones ended: no gap, and overlap is harmless.
    const spans = (await fetch(interval, LIMIT, from === placed ? placed : Math.floor(from / ms) * ms)) ?? [];
    out.push(...spans);
    from = spans.length ? spans[spans.length - 1].t + ms : from + LIMIT * ms;
    if (spans.length < LIMIT) break; // reached the present
  }
  return out;
}
