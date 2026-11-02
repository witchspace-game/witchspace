import { afterEach, describe, expect, it, vi } from 'vitest';
import { CLOCK_TOLERANCE, clockCorrection, clockOffset, syncClock } from './clock';

describe('one clock for everyone', () => {
  const realNow = Date.now;
  afterEach(() => {
    Date.now = realNow;
    vi.unstubAllGlobals();
  });

  it('works out how far out the device is, allowing for the trip', () => {
    // The server said 12:00:00 (so 12:00:00.5); the reply took 200 ms; the device read 11:00:00.6 on receipt.
    const server = Date.UTC(2026, 10, 2, 12);
    const received = server - 3_600_000 + 600;
    expect(clockOffset(server, received - 200, received)).toBe(3_600_000);
  });

  it('runs the game on the site’s time when the device is an hour out', async () => {
    const truth = Date.UTC(2026, 10, 2, 12);
    const device = truth - 3_600_000;
    Date.now = () => device;
    vi.stubGlobal('location', { origin: 'https://witchspace.org.uk' });
    vi.stubGlobal('fetch', async () => ({ headers: new Headers({ date: new Date(truth).toUTCString() }) }));
    await syncClock();
    expect(Math.abs(Date.now() - truth)).toBeLessThan(1_000);
    expect(clockCorrection()).toBeGreaterThan(3_599_000);
  });

  it('leaves a right clock alone, and copes offline', async () => {
    const before = Date.now;
    vi.stubGlobal('location', { origin: 'https://witchspace.org.uk' });
    vi.stubGlobal('fetch', async () => ({ headers: new Headers({ date: new Date(realNow() + CLOCK_TOLERANCE / 2).toUTCString() }) }));
    await syncClock();
    expect(Date.now).toBe(before);
    vi.stubGlobal('fetch', async () => {
      throw new Error('offline');
    });
    await expect(syncClock()).resolves.toBeUndefined();
  });
});
