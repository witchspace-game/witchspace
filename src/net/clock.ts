// One clock for everyone (Mark, 2 November 2026). The galaxy runs on the clock: the markets, the
// traffic, the yards and Odile Venn are all worked out from the seed and the time, as universal
// time (milliseconds since 1970), so time zones never matter. A device whose clock is simply set
// wrong would see a world of its own, though, an hour off from everyone else's. So at start the
// game asks the site what time it is (every reply carries a Date header, and the site is our own
// origin, so the page may read it) and, if the device is out by more than a few seconds, runs the
// world on the corrected time.
//
// It corrects Date.now itself, so every one of the game's clock reads agrees without each having
// to know. Displayed times are still shown in the player's own time zone.

/** The device's own clock, and the corrected one once we've set it. */
let deviceNow: () => number = Date.now.bind(Date);
let corrected: (() => number) | null = null;

/** Closer than this and the device's own clock is good enough (the Date header is to the second). */
export const CLOCK_TOLERANCE = 5_000;

/**
 * How far to move the device's clock: the server's time when it answered (its Date header, taken
 * as the middle of its second), plus half the round trip, minus the device's time on receipt.
 */
export function clockOffset(serverDate: number, sentAt: number, receivedAt: number): number {
  return serverDate + 500 + (receivedAt - sentAt) / 2 - receivedAt;
}

let offset = 0;

/** How far the game's clock is from the device's, in ms (0 when the device is right). */
export const clockCorrection = () => offset;

/** Ask the site for the time, once; correct the game's clock if the device is out. Offline, nothing changes. */
export async function syncClock(): Promise<void> {
  try {
    if (Date.now !== corrected) deviceNow = Date.now.bind(Date);
    const sentAt = deviceNow();
    const r = await fetch(`${location.origin}/`, { method: 'HEAD', cache: 'no-store' });
    const receivedAt = deviceNow();
    const date = Date.parse(r.headers.get('date') ?? '');
    if (Number.isNaN(date)) return;
    const off = clockOffset(date, sentAt, receivedAt);
    if (Math.abs(off) < CLOCK_TOLERANCE) return;
    offset = Math.round(off);
    const device = deviceNow;
    corrected = () => device() + offset;
    Date.now = corrected;
  } catch {
    // Offline, or the site didn't answer: the device's clock it is.
  }
}
