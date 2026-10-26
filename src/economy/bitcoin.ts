import type { Commander } from '../game/commander';
import type { TradeResult } from './trade';

// Bitcoin on the exchange, stage 1 (docs/design/system-currencies.md, 6b): the
// live price of the real coin, one network, so the same at every station.
// 1 Cr = 1 US dollar, so the number on screen is the real number. It's held in
// sats in your own wallet: no hold space, nothing for pirates to scoop, and it
// survives the ship. In-game only: it can't be bought or withdrawn for real
// money. Modern rules only; Classic stays credits only, as in 1984.

export const SATS = 100_000_000; // to the coin
/**
 * The broker's fee, on top of the spot price (Mark): every trade fills at the
 * real price, and the fee is shown on its own. Modelled on Binance's spot fees
 * for a regular account: 0.1% to make (a limit order) and 0.1% to take (a
 * market order). Kept apart, since on Binance the taker pays more as volume grows.
 */
export const FEE = { limit: 0.001, market: 0.001 };
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
  /** Credits per coin the trade filled at: the spot price (before the fee came in, the broker's spread was included). */
  price: number;
  /** Credits paid or received, fee included. */
  total: number;
  /** The broker's fee, in credits. */
  fee?: number;
}

// The latest price heard, for showing what your coins are worth (net/bitcoin.ts
// sets it). Credits are the Co-operative's money: fines and the insurers'
// excess are taken from them, with no say. Bitcoin is nobody's: nobody can
// fine it, seize it or write it off, so it's how a commander keeps their
// wealth out of reach (Mark). The law can still hold your kit.
let latest: BtcQuote | null = null;
export const setQuote = (q: BtcQuote | null) => (latest = q);
export const lastQuote = () => latest;

/** Spending `credits` at `price`: the sats you get, after the fee. */
export const buyAt = (credits: number, price: number, fee: number) => ({ sats: Math.floor((credits * (1 - fee) * SATS) / price), fee: credits * fee });
/** Selling `sats` at `price`: the credits you get, after the fee. */
export const sellAt = (sats: number, price: number, fee: number) => {
  const gross = (sats * price) / SATS;
  return { total: Math.floor(gross * (1 - fee) * 10) / 10, fee: gross * fee };
};
const cents = (n: number) => Math.round(n * 100) / 100;
export const isFresh = (q: BtcQuote | null, now = Date.now()): boolean => Boolean(q) && now - q!.time < STALE_MS;

const tenth = (n: number) => Math.round(n * 10) / 10;
export const satsOf = (c: Commander) => c.sats ?? 0;
/** What your Bitcoin is worth now, at the last price heard; nothing if none has been. */
export const btcValue = (c: Commander, q = latest) => (q && satsOf(c) ? Math.floor(((satsOf(c) * q.price) / SATS) * 10) / 10 : 0);

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
  const total = Math.floor(Math.min(credits, c.credits) * 10) / 10;
  const { sats, fee } = buyAt(total, q.price, FEE.market);
  if (sats < 1) return { ok: false, message: 'Not enough credits for a single sat' };
  c.credits = tenth(c.credits - total);
  c.sats = satsOf(c) + sats;
  record(c, { t: now, side: 'buy', sats, price: q.price, total, fee: cents(fee) });
  return { ok: true, message: `Bought ${formatSats(sats)} for ${total.toLocaleString()} Cr · fee ${cents(fee).toLocaleString()} Cr` };
}

/** Sell `sats` of your Bitcoin at the live price. */
export function sellBitcoin(c: Commander, q: BtcQuote | null, sats: number, now = Date.now()): TradeResult {
  if (!q || !isFresh(q, now)) return { ok: false, message: stale(q, now) };
  const n = Math.min(Math.floor(sats), satsOf(c));
  if (n < 1) return { ok: false, message: 'No Bitcoin to sell' };
  const { total, fee } = sellAt(n, q.price, FEE.market);
  c.sats = satsOf(c) - n;
  c.credits = tenth(c.credits + total);
  record(c, { t: now, side: 'sell', sats: n, price: q.price, total, fee: cents(fee) });
  return { ok: true, message: `Sold ${formatSats(n)} for ${total.toLocaleString()} Cr · fee ${cents(fee).toLocaleString()} Cr` };
}

// --- Limit orders (Mark) -------------------------------------------------------------
// Buy if the price falls to your limit, or sell if it rises to it. What you
// put up (credits to spend, or sats to sell) is held until the order fills or
// you cancel. Fills are judged against the real market's own price history
// since the order was placed, minute by minute (news crosses the galaxy no
// faster), so an order can fill while you're out flying, at your limit, with
// the broker's (smaller) limit-order fee. Bitcoin is the same everywhere: an order placed
// at one station fills wherever you are.

export interface BtcOrder {
  id: number;
  side: 'buy' | 'sell';
  /** The Bitcoin price, in credits a coin, that fills it. */
  limit: number;
  /** Held to spend (a buy) or to sell (a sell). */
  credits?: number;
  sats?: number;
  placed: number;
}

/** A stretch of the real price: when it began, and its high and low. */
export interface PriceSpan {
  t: number;
  h: number;
  l: number;
}

export const ordersOf = (c: Commander) => c.btcOrders ?? [];

/** Place a limit order: `amount` is credits to spend (buy) or sats to sell (sell). */
export function placeBtcOrder(c: Commander, side: 'buy' | 'sell', amount: number, limit: number, now = Date.now()): TradeResult {
  if (!(limit > 0) || !Number.isFinite(limit)) return { ok: false, message: 'Set the price it should fill at' };
  if (side === 'buy') {
    const credits = Math.floor(Math.min(amount, c.credits) * 10) / 10;
    if (credits < 1) return { ok: false, message: 'Not enough credits' };
    c.credits = tenth(c.credits - credits);
    c.btcOrders = [...ordersOf(c), { id: now, side, limit, credits, placed: now }];
    return { ok: true, message: `Buy order placed: ${credits.toLocaleString()} Cr if Bitcoin falls to ${Math.round(limit).toLocaleString()}` };
  }
  const sats = Math.min(Math.floor(amount), satsOf(c));
  if (sats < 1) return { ok: false, message: 'No Bitcoin to sell' };
  c.sats = satsOf(c) - sats;
  c.btcOrders = [...ordersOf(c), { id: now, side, limit, sats, placed: now }];
  return { ok: true, message: `Sell order placed: ${formatSats(sats)} if Bitcoin rises to ${Math.round(limit).toLocaleString()}` };
}

/** Cancel an order: what it held comes back. */
export function cancelBtcOrder(c: Commander, id: number): TradeResult {
  const o = ordersOf(c).find((x) => x.id === id);
  if (!o) return { ok: false, message: 'No such order' };
  if (o.credits) c.credits = tenth(c.credits + o.credits);
  if (o.sats) c.sats = satsOf(c) + o.sats;
  c.btcOrders = ordersOf(c).filter((x) => x.id !== id);
  return { ok: true, message: 'Order cancelled' };
}

/**
 * Fill the orders the real price has reached since they were placed. `spans`
 * are stretches of real price history (candles, and the live price as one of
 * its own); only those that began after an order was placed count. Each fills
 * at the first moment the price got there, at its limit, or better if the
 * price was better all through that stretch (a buy set above the market buys
 * at the market). Returns what filled.
 */
export function fillBtcOrders(c: Commander, spans: PriceSpan[] | ((o: BtcOrder) => PriceSpan[])): { order: BtcOrder; at: number; trade: BtcTrade }[] {
  const out: { order: BtcOrder; at: number; trade: BtcTrade }[] = [];
  const all = typeof spans === 'function' ? null : [...spans].sort((a, b) => a.t - b.t);
  for (const o of ordersOf(c)) {
    // Each order judged on its own history (btcSpans.ts), or all on one list.
    const sorted = all ?? [...(spans as (o: BtcOrder) => PriceSpan[])(o)].sort((a, b) => a.t - b.t);
    const hit = sorted.find((p) => p.t >= o.placed && (o.side === 'buy' ? p.l <= o.limit : p.h >= o.limit));
    if (!hit) continue;
    let trade: BtcTrade;
    // The worst price that stretch offered, but never worse than the limit.
    const at = o.side === 'buy' ? Math.min(o.limit, hit.h) : Math.max(o.limit, hit.l);
    if (o.side === 'buy') {
      const { sats, fee } = buyAt(o.credits!, at, FEE.limit);
      c.sats = satsOf(c) + sats;
      trade = { t: hit.t, side: 'buy', sats, price: at, total: o.credits!, fee: cents(fee) };
    } else {
      const { total, fee } = sellAt(o.sats!, at, FEE.limit);
      c.credits = tenth(c.credits + total);
      trade = { t: hit.t, side: 'sell', sats: o.sats!, price: at, total, fee: cents(fee) };
    }
    record(c, trade);
    out.push({ order: o, at: hit.t, trade });
  }
  if (out.length) c.btcOrders = ordersOf(c).filter((o) => !out.some((f) => f.order === o));
  return out;
}

/** "Your Bitcoin buy filled at 78,000 at 14:32: 64,000 sats for 50 Cr · fee 0.05 Cr". */
export const describeBtcFill = (f: { order: BtcOrder; at: number; trade: BtcTrade }) =>
  `Your Bitcoin ${f.order.side} filled at ${Math.round(f.trade.price).toLocaleString()} at ${new Date(f.at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}: ${formatSats(f.trade.sats)} for ${f.trade.total.toLocaleString()} Cr${f.trade.fee ? ` · fee ${f.trade.fee.toLocaleString()} Cr` : ''}`;

