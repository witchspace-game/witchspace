// The ship's log (docs/design/radio-and-comms.md, "While you're away: the array
// listens"): what reaches a commander between sessions, gathered into one
// quiet message a day. Worked out from their cloud save, the real Bitcoin
// price and their clips' hearts; nothing is simulated while they're away.
// Pure where it can be: the hourly check in accounts.ts sends it.

import { fillBtcOrders, type BtcOrder, type PriceSpan } from '../../src/economy/bitcoin';
import { spansSince, type CandleFetch } from '../../src/economy/btcSpans';

export interface LogKinds {
  /** Bitcoin limit orders filling. */
  exchange?: boolean;
  /** Hearts on your shared clips. */
  hearts?: boolean;
}

export const HEART_MILESTONES = [5, 10, 25, 50, 100, 250, 500, 1000];
const QUIET = { from: 22, to: 8 }; // local hours: nothing arrives between
export const LOG_EVERY = 20 * 3600_000; // one log a day, give or take

/** Is it a sensible hour where they are? `tz` is minutes ahead of UTC. */
export function awake(now: number, tz: number): boolean {
  const hour = new Date(now + tz * 60_000).getUTCHours();
  return hour >= QUIET.to && hour < QUIET.from;
}

export interface LogItem {
  /** So the same thing is never logged twice. */
  key: string;
  text: string;
}

/**
 * Bitcoin orders the real price has reached since they were placed, judged
 * exactly as the game judges them (btcSpans.ts), so the log and the game agree.
 */
export async function btcItems(orders: BtcOrder[], now: number, fetch: CandleFetch, live: PriceSpan | null): Promise<LogItem[]> {
  const out: LogItem[] = [];
  for (const o of orders) {
    const spans = [...(await spansSince(o.placed, now, fetch)), ...(live ? [live] : [])];
    // Judge it on a copy: the save is the game's, and the game fills it when it opens.
    const copy = { btcOrders: [{ ...o }], credits: 0, sats: 0, btcTrades: [] } as unknown as Parameters<typeof fillBtcOrders>[0];
    const [fill] = fillBtcOrders(copy, spans);
    if (!fill) continue;
    const at = Math.round(fill.trade.price / (o.side === 'buy' ? 1.005 : 0.995));
    out.push({ key: `btc:${o.id}`, text: `your Bitcoin ${o.side} filled at ${at.toLocaleString('en-GB')}` });
  }
  return out;
}

/** Clips that have passed a hearts milestone. */
export function heartItems(clips: { id: string; title: string; hearts: number }[]): LogItem[] {
  const out: LogItem[] = [];
  for (const c of clips) {
    const m = [...HEART_MILESTONES].reverse().find((x) => c.hearts >= x);
    if (m) out.push({ key: `hearts:${c.id}:${m}`, text: `${m} hearts on "${c.title.replace(/^(CMDR [^:]+|A commander): /, '')}"` });
  }
  return out;
}

/** The message: "Ship's log · 2 messages", and what they are. */
export function logMessage(items: LogItem[]): { title: string; body: string } {
  const shown = items.slice(0, 3).map((i) => i.text);
  const more = items.length - shown.length;
  const body = shown.join(' · ') + (more > 0 ? ` · and ${more} more` : '');
  return { title: `Ship's log · ${items.length} ${items.length === 1 ? 'message' : 'messages'}`, body: body.charAt(0).toUpperCase() + body.slice(1) };
}
