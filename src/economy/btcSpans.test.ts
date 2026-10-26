import { describe, expect, it } from 'vitest';
import { spansSince, type CandleFetch } from './btcSpans';

const MIN = 60_000;
/** A fake market: candles of any interval, from `start`, up to `now`. */
const market = (now: number, asked: string[]): CandleFetch => async (interval, limit, start) => {
  asked.push(`${interval}@${start}`);
  const ms = { '1m': MIN, '5m': 5 * MIN, '1h': 60 * MIN, '1d': 1440 * MIN }[interval]!;
  const first = Math.ceil(start / ms) * ms;
  const out = [];
  for (let t = first; t < now && out.length < limit; t += ms) out.push({ t, h: 1, l: 1 });
  return out;
};

describe('the real price since an order was placed', () => {
  it('uses minute candles from the moment it was placed, while that covers it', async () => {
    const placed = 1_000 * MIN + 20_000; // part way through a minute
    const asked: string[] = [];
    const spans = await spansSince(placed, placed + 90 * MIN, market(placed + 90 * MIN, asked));
    expect(asked).toEqual([`1m@${placed}`]);
    expect(spans[0].t).toBeGreaterThanOrEqual(placed); // the minute it was placed in isn't counted
    expect(spans.length).toBe(90);
  });

  it('goes on in coarser candles, without a gap, for an older order', async () => {
    const placed = 1_000 * MIN;
    const now = placed + 3 * 1440 * MIN; // three days
    const asked: string[] = [];
    const spans = await spansSince(placed, now, market(now, asked));
    expect(asked.map((a) => a.split('@')[0])).toEqual(['1m', '5m', '1h']);
    // Each segment starts no later than the last one ended.
    const ends = spans.map((s, i) => [s.t, spans[i + 1]?.t]).filter(([, next]) => next !== undefined);
    for (const [t, next] of ends) expect(next! - t).toBeLessThanOrEqual(60 * MIN);
    expect(spans[spans.length - 1].t).toBeGreaterThan(now - 60 * MIN);
  });
});
