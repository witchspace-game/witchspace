import type { Commander } from '../game/commander';
import type { TradeResult } from './trade';

// Bitcoin on the exchange, stage 1 (docs/design/system-currencies.md, 6b): the
// live price of the real coin, one network, so the same at every station.
// 1 Cr = 1 US dollar, so the number on screen is the real number. It's held in
// sats in your own wallet: no hold space, nothing for pirates to scoop, and it
// survives the ship. In-game only: it can't be bought or withdrawn for real
// money. Modern rules only; Classic stays credits only, as in 1984.

export const SATS = 100_000_000; // to the coin
/** The station is a broker, not a market: you pay the live price plus half a percent, and sell for half a percent under it. */
export const SPREAD = 0.005;
/** A price older than this isn't traded on: the network is quiet. */
export const STALE_MS = 5 * 60_000;
/** Trades kept on the commander, for the exchange's "Your trades" and the chart's markers. */
const KEEP_TRADES = 50;

export interface BtcQuote {
  /** US dollars, and so credits, per coin. */
  price: number;
  /** When the relay had it from Binance (epoch ms). */
  time: number;
}

export interface BtcTrade {
  t: number;
  side: 'buy' | 'sell';
  sats: number;
  /** Credits per coin the trade filled at, spread included. */
  price: number;
  /** Credits paid or received. */
  total: number;
}

// The latest price heard, kept here so debts can be settled without asking the
// network (net/bitcoin.ts sets it). Nobody can seize your coins, but if you owe
// a fine or the insurers' excess and your credits fall short, enough of them is
// sold for you at the market price to pay it, and you're told (onSold). Sell
// some yourself first if you'd rather choose the moment.
let latest: BtcQuote | null = null;
export const setQuote = (q: BtcQuote | null) => (latest = q);
export const lastQuote = () => latest;

export const askPrice = (q: BtcQuote) => q.price * (1 + SPREAD);
export const bidPrice = (q: BtcQuote) => q.price * (1 - SPREAD);
export const isFresh = (q: BtcQuote | null, now = Date.now()): boolean => Boolean(q) && now - q!.time < STALE_MS;

const tenth = (n: number) => Math.round(n * 10) / 10;
export const satsOf = (c: Commander) => c.sats ?? 0;
/** What your Bitcoin would sell for now, at the last price heard; nothing if none has been. */
export const btcValue = (c: Commander, q = latest) => (q && satsOf(c) ? Math.floor(((satsOf(c) * bidPrice(q)) / SATS) * 10) / 10 : 0);

/** ₿ 0.00125000 */
export const formatBtc = (sats: number) => `₿ ${(sats / SATS).toFixed(8)}`;
/** 125,000 sats */
export const formatSats = (sats: number) => `${Math.round(sats).toLocaleString()} sats`;

function record(c: Commander, trade: BtcTrade) {
  c.btcTrades = [...(c.btcTrades ?? []), trade].slice(-KEEP_TRADES);
}

const stale = (q: BtcQuote | null, now: number) =>
  q ? `The network is quiet: the price is ${Math.round((now - q.time) / 60_000)} minutes old, so trading is paused` : 'No price from the network yet: trading is paused';

/** Spend up to `credits` on Bitcoin at the live price. */
export function buyBitcoin(c: Commander, q: BtcQuote | null, credits: number, now = Date.now()): TradeResult {
  if (!q || !isFresh(q, now)) return { ok: false, message: stale(q, now) };
  const spend = Math.min(credits, c.credits);
  const ask = askPrice(q);
  const sats = Math.floor((spend * SATS) / ask);
  if (sats < 1) return { ok: false, message: 'Not enough credits for a single sat' };
  const total = Math.min(c.credits, Math.ceil(((sats * ask) / SATS) * 10) / 10);
  c.credits = tenth(c.credits - total);
  c.sats = satsOf(c) + sats;
  record(c, { t: now, side: 'buy', sats, price: ask, total });
  return { ok: true, message: `Bought ${formatSats(sats)} for ${total.toLocaleString()} Cr` };
}

/** Sell `sats` of your Bitcoin at the live price. */
export function sellBitcoin(c: Commander, q: BtcQuote | null, sats: number, now = Date.now()): TradeResult {
  if (!q || !isFresh(q, now)) return { ok: false, message: stale(q, now) };
  const n = Math.min(Math.floor(sats), satsOf(c));
  if (n < 1) return { ok: false, message: 'No Bitcoin to sell' };
  const bid = bidPrice(q);
  const total = Math.floor(((n * bid) / SATS) * 10) / 10;
  c.sats = satsOf(c) - n;
  c.credits = tenth(c.credits + total);
  record(c, { t: now, side: 'sell', sats: n, price: bid, total });
  return { ok: true, message: `Sold ${formatSats(n)} for ${total.toLocaleString()} Cr` };
}

export interface Sold {
  sats: number;
  total: number;
  /** What it paid for: "your fine", "the insurers' excess". */
  reason: string;
}
const soldListeners: ((sold: Sold) => void)[] = [];
/** Be told when Bitcoin is sold to pay a debt (the game says so on screen). */
export const onSold = (fn: (sold: Sold) => void) => soldListeners.push(fn);

/**
 * Before a debt of `amount` is taken from your credits: if they fall short,
 * enough of your Bitcoin is sold at the market price (the last price heard,
 * less the spread) to make it up, and you're told. Without a price heard,
 * nothing is sold. Returns the sats sold.
 */
export function cover(c: Commander, amount: number, reason: string, q = latest, now = Date.now()): number {
  const short = amount - c.credits;
  if (short <= 0 || !q || !satsOf(c)) return 0;
  const bid = bidPrice(q);
  const sats = Math.min(satsOf(c), Math.ceil((short * SATS) / bid));
  const total = Math.floor(((sats * bid) / SATS) * 10) / 10;
  c.sats = satsOf(c) - sats;
  c.credits = tenth(c.credits + total);
  record(c, { t: now, side: 'sell', sats, price: bid, total });
  for (const fn of soldListeners) fn({ sats, total, reason });
  return sats;
}
