import { describe, expect, it } from 'vitest';
import { awake, btcItems, heartItems, logMessage } from './shipsLog';

const MIN = 60_000;
const NOON_UTC = Date.UTC(2026, 9, 26, 12);

describe("the ship's log", () => {
  it('keeps quiet at night where the commander is', () => {
    expect(awake(NOON_UTC, 0)).toBe(true);
    expect(awake(Date.UTC(2026, 9, 26, 23), 0)).toBe(false); // 11 pm in London
    expect(awake(Date.UTC(2026, 9, 26, 12), 11 * 60)).toBe(false); // 11 pm in Sydney
    expect(awake(Date.UTC(2026, 9, 26, 7, 59), 0)).toBe(false);
    expect(awake(Date.UTC(2026, 9, 26, 8), 0)).toBe(true);
  });

  it('notes the highest hearts milestone a clip has passed', () => {
    expect(heartItems([{ id: 'a', title: 'CMDR Kestrel: fighting a Mamba at Lave', hearts: 27 }])).toEqual([{ key: 'hearts:a:25', text: '25 hearts on "fighting a Mamba at Lave"' }]);
    expect(heartItems([{ id: 'b', title: 'x', hearts: 4 }])).toEqual([]);
  });

  it('says an order filled exactly when the game would fill it', async () => {
    const placed = NOON_UTC;
    const fetch = async (_i: string, _l: number, start: number) => [0, 1, 2].map((k) => ({ t: start + 30_000 + k * MIN, h: 80_100, l: k === 2 ? 77_900 : 79_500 }));
    const items = await btcItems([{ id: 7, side: 'buy', limit: 78_000, credits: 100, placed }], placed + 10 * MIN, fetch, null);
    expect(items).toEqual([{ key: 'btc:7', text: 'your Bitcoin buy filled at 78,000' }]);
    const none = await btcItems([{ id: 8, side: 'buy', limit: 70_000, credits: 100, placed }], placed + 10 * MIN, fetch, null);
    expect(none).toEqual([]);
  });

  it('gathers everything into one quiet message', () => {
    expect(logMessage([{ key: 'a', text: 'your Bitcoin buy filled at 78,000' }])).toEqual({ title: "Ship's log · 1 message", body: 'Your Bitcoin buy filled at 78,000' });
    const many = logMessage([1, 2, 3, 4, 5].map((n) => ({ key: String(n), text: `thing ${n}` })));
    expect(many.title).toBe("Ship's log · 5 messages");
    expect(many.body).toBe('Thing 1 · thing 2 · thing 3 · and 2 more');
  });
});
