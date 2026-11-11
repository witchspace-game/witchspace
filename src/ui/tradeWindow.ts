// The trade window's pieces that are only drawing (docs/design/trading.md, "The trade window"):
// its head, the book beside the form, the Buy and Sell buttons where the form used to be, and
// your orders as tags on the chart. The window itself, its form and its buttons are in exchange.ts.

import { commodityById, COMMODITIES, type Commodity } from '../economy/commodities';
import { btcValue, FEE, formatBtc, formatSats, isFresh, ordersOf, satsOf } from '../economy/bitcoin';
import { EVENT_KINDS, type activeEvent } from '../economy/events';
import { isPlural } from '../economy/commodities';
import type { Commander } from '../game/commander';
import { candles, drift, equilibriumPrice, orderBook, priceAt, type stationOrder } from '../economy/market';
import type { OrderState } from '../economy/orders';
import { marketState, quotes, tradesHere, type TradeContext } from '../economy/trade';
import { heardCandles, heardQuote } from '../net/bitcoin';
import type { ChartOrder } from './chartOrders';
import { ticker } from './ordersList';

const HOUR = 3600_000;
const fmt = (n: number, dp = 1) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const pctFee = (n: number) => `${+(n * 100).toFixed(3)}%`;
const unitLabel = (c: Commodity) => (c.unit === 't' ? 't' : c.unit);
const marketKey = (ctx: TradeContext) => `${ctx.system.galaxy}:${ctx.system.index}`;
const age = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`;
};

export interface WindowView {
  /** The good on screen, or 'btc'. */
  id: string;
  /** Another market, as you know it. */
  remote: boolean;
  /** Your goods in storage at that market. */
  stored: number;
}

/** The window's head: the pair, its last price and the hour's change; on a computer, more. */
export function headHtml(ctx: TradeContext, v: WindowView, editing: boolean): string {
  let last = 0;
  let change = 0;
  let extra = '';
  let name = '';
  if (v.id === 'btc') {
    const q = heardQuote();
    const day = heardCandles('1h', 48)?.slice(-24);
    last = q?.price ?? 0;
    change = q && day?.[0] ? (q.price - day[0].o) / day[0].o : 0;
    name = 'Bitcoin · every station';
    extra = `<div class="ex-mstat"><b>${formatBtc(satsOf(ctx.commander))}</b>In your wallet</div>`;
  } else {
    const c = commodityById(v.id)!;
    const state = marketState(ctx);
    const q = quotes(ctx).find((x) => x.commodity.id === v.id)!;
    const hourAgo = priceAt(ctx.system, state, v.id, ctx.now - HOUR);
    const lastHour = candles(ctx.system, state, v.id, ctx.now, 5 * 60_000, 12);
    last = q.price;
    change = (q.price - hourAgo) / hourAgo;
    const u = unitLabel(c);
    name = `${c.name} · ${ctx.system.name}${v.remote ? ' (as you know it)' : ''}`;
    extra = `<div class="ex-mstat"><b>${fmt(Math.max(...lastHour.map((k) => k.high)))}</b>1h high</div><div class="ex-mstat"><b>${fmt(Math.min(...lastHour.map((k) => k.low)))}</b>1h low</div>
      <div class="ex-mstat"><b>${q.stock.toLocaleString()} ${u}</b>Station stock</div><div class="ex-mstat"><b>${(v.remote ? v.stored : (ctx.commander.cargo[v.id] ?? 0)).toLocaleString()} ${u}</b>${v.remote ? 'In storage there' : 'In your hold'}</div>`;
  }
  return `
    <div class="ex-mpair"><b>${editing ? 'Edit order · ' : ''}${ticker(v.id)}<span>/CR</span></b><small>${name}</small></div>
    <div class="ex-mlast ${change >= 0 ? 'up' : 'down'}"><b>${last ? fmt(last) : '…'}</b><small>${pct(change)}</small></div>
    <div class="ex-mstats">${extra}</div>
    <button class="ex-mclose" aria-label="Close">✕</button>`;
}

/** The book beside the form: asks above, the last price and fair value, bids below, your own orders in their place. */
export function bookHtml(ctx: TradeContext, id: string, levels: number): string {
  if (id === 'btc') {
    const q = heardQuote();
    return `<div class="ex-mbook-head"><span>Price (Cr)</span><span>Broker</span></div>
      <div class="ex-mmid"><b>${q ? fmt(q.price) : '…'}</b><small>live</small></div>
      <p class="ex-mbook-note">One price at every station: the broker fills at the real market, so your trades don't move it. Limit ${pctFee(FEE.limit)} · market ${pctFee(FEE.market)}.</p>`;
  }
  const state = marketState(ctx) as OrderState;
  const { asks, bids } = orderBook(ctx.system, state, id, levels);
  const mine = (state.orders ?? []).filter((o) => o.id === id);
  const max = Math.max(1, ...asks.map((l) => l.qty), ...bids.map((l) => l.qty));
  const row = (l: { price: number; qty: number }, kind: 'ask' | 'bid') =>
    `<button class="ex-mlevel ${kind}" data-mprice="${l.price.toFixed(2)}" style="--depth:${(l.qty / max) * 100}%"><span>${fmt(l.price, 2)}</span><span>${l.qty.toLocaleString()}</span></button>`;
  const yours = (o: (typeof mine)[number]) =>
    `<button class="ex-mlevel ${o.side === 'buy' ? 'bid' : 'ask'} yours" data-oedit="${marketKey(ctx)}:${o.oid}" title="Your order: tap to change it" style="--depth:0%"><span>${fmt(o.limit, 2)}</span><span>${o.qty.toLocaleString()} ●</span></button>`;
  // The book's levels and your own orders, in price order: asks high to low, bids high to low.
  const side = (list: typeof asks, kind: 'ask' | 'bid') =>
    [...list.map((l) => ({ p: l.price, html: row(l, kind) })), ...mine.filter((o) => (o.side === 'sell') === (kind === 'ask')).map((o) => ({ p: o.limit, html: yours(o) }))]
      .sort((a, b) => b.p - a.p)
      .map((x) => x.html)
      .join('');
  const live = quotes(ctx).find((x) => x.commodity.id === id)!.price;
  const was = priceAt(ctx.system, state, id, ctx.now - HOUR);
  const c = commodityById(id)!;
  const i = COMMODITIES.findIndex((x) => x.id === id);
  const fair = equilibriumPrice(ctx.system, c, i) * drift(ctx.system, c, i, ctx.now);
  const askQty = asks.reduce((n, l) => n + l.qty, 0);
  const bidQty = bids.reduce((n, l) => n + l.qty, 0);
  const buyShare = askQty + bidQty ? bidQty / (askQty + bidQty) : 0.5;
  return `<div class="ex-mbook-head"><span>Price (Cr)</span><span>Amount (${unitLabel(c)})</span></div>
    ${side(asks, 'ask') || '<p class="ex-empty">Sold out</p>'}
    <div class="ex-mmid ${live >= was ? 'up' : 'down'}"><b>${fmt(live)}</b><small>fair ${fmt(fair)}</small></div>
    ${side(bids, 'bid')}
    <div class="ex-mratio"><b style="width:${(buyShare * 100).toFixed(0)}%"></b><u></u></div>
    <div class="ex-mratio-l"><span class="up">B ${(buyShare * 100).toFixed(0)}%</span><span class="down">${(100 - buyShare * 100).toFixed(0)}% S</span></div>`;
}

/** Where the form used to be: Buy and Sell, which open the trade window, and your orders. */
export function actionsHtml(ctx: TradeContext, v: WindowView, openOrders: number, message: string): string {
  const t = ticker(v.id);
  const u = v.id === 'btc' ? '' : unitLabel(commodityById(v.id)!);
  const avbl =
    v.id === 'btc'
      ? `Avbl <b>${fmt(ctx.commander.credits)} Cr</b> · <b>${formatBtc(satsOf(ctx.commander))}</b>`
      : `Avbl <b>${fmt(ctx.commander.credits)} Cr</b> · ${v.remote ? `in storage there <b>${v.stored.toLocaleString()} ${u}</b>` : `in your hold <b>${(ctx.commander.cargo[v.id] ?? 0).toLocaleString()} ${u}</b>`}`;
  return `
    <div class="ex-act-buttons"><button class="ex-act buy" data-open="buy">Buy ${t}</button><button class="ex-act sell" data-open="sell">Sell ${t}</button></div>
    <p class="ex-act-avail">${avbl}</p>
    <button class="ex-act-orders" data-open-orders="1">Your orders${openOrders ? ` (${openOrders})` : ''} ›</button>
    ${message ? `<p class="ex-msg">${message}</p>` : ''}`;
}

/** The chart's SELL and BUY prices, and your orders on this pair as tags. */
export function chartState(ctx: TradeContext, id: string, now: number): { bid: number | null; ask: number | null; orders: ChartOrder[] } {
  if (id === 'btc') {
    const q = heardQuote()?.price ?? null;
    const orders = ordersOf(ctx.commander).map((o) => ({ ref: `btc:${o.id}`, side: o.side, limit: o.limit, label: `${o.side === 'buy' ? 'BUY' : 'SELL'} @ ${fmt(o.limit, 0)}`, faint: false, draggable: false }));
    return { bid: q, ask: q, orders };
  }
  const state = marketState(ctx) as OrderState;
  const book = orderBook(ctx.system, state, id, 1);
  const u = unitLabel(commodityById(id)!);
  const orders = (state.orders ?? [])
    .filter((o) => o.id === id)
    .map((o) => {
      const travelling = (o.sent !== undefined && o.placed > now) || o.cancel !== undefined;
      return { ref: `${marketKey(ctx)}:${o.oid}`, side: o.side, limit: o.amend?.limit ?? o.limit, label: `${o.side === 'buy' ? 'BUY' : 'SELL'} ${o.qty.toLocaleString()} ${u} @ ${fmt(o.limit, 2)}`, faint: travelling, draggable: !travelling };
    });
  return { bid: book.bids[0]?.price ?? null, ask: book.asks[0]?.price ?? null, orders };
}

/** Bitcoin's head on the page: the live price, the day's range, the broker and your wallet. */
export function btcHeadHtml(c: Commander): string {
  const q = heardQuote();
  const day = heardCandles('1h', 48)?.slice(-24);
  const open = day?.[0]?.o;
  const change = q && open ? (q.price - open) / open : 0;
  const sats = satsOf(c);
  const now = Date.now();
  const quiet = q && !isFresh(q, now);
  return `
    ${quiet ? `<div class="ex-event hit">Network quiet · price ${age(now - q!.time)} old · trading paused</div>` : ''}
    <div class="ex-title"><b>Bitcoin</b><span>/CR</span><small>per coin · live · the same at every station</small></div>
    <div class="ex-last ${change >= 0 ? 'up' : 'down'}">${q ? fmt(q.price) : '…'}<small>Cr</small></div>
    <dl>
      <div><dt>24h change</dt><dd class="${change >= 0 ? 'up' : 'down'}">${day ? pct(change) : '-'}</dd></div>
      <div><dt>24h high</dt><dd>${day ? fmt(Math.max(...day.map((k) => k.h))) : '-'}</dd></div>
      <div><dt>24h low</dt><dd>${day ? fmt(Math.min(...day.map((k) => k.l))) : '-'}</dd></div>
      <div><dt>Broker's fee</dt><dd>${FEE.limit === FEE.market ? `${pctFee(FEE.limit)} a trade` : `${pctFee(FEE.limit)} limit · ${pctFee(FEE.market)} market`}</dd></div>
      <div><dt>In your wallet</dt><dd>${formatBtc(sats)}${sats ? ` <small>${formatSats(sats)} · ${fmt(btcValue(c, q))} Cr</small>` : ''}</dd></div>
      <div><dt>Hold space</dt><dd>None</dd></div>
    </dl>
    <p class="ex-why">One network, so one price at every station: you can't profit by carrying it, only by choosing when to hold it. It takes no hold space, pirates can't scoop it, and nobody can take it: fines and the insurers come out of your credits, never your Bitcoin. <span class="ex-honest">Witchspace Bitcoin stays in Witchspace: it can't be bought or cashed out for real money.</span></p>`;
}

/** Why the price is what it is, in a sentence. */
export function whyLine(ctx: TradeContext, c: Commodity, balance: number, order: ReturnType<typeof stationOrder>, event: ReturnType<typeof activeEvent>, remote: boolean): string {
  const here = ctx.system.name;
  const at = remote ? 'there' : 'here';
  const [is, isnt, it, sells, itHas, itsWanted] = isPlural(c) ? ['are', "aren't", 'them', 'sell', 'they have', "they're wanted"] : ['is', "isn't", 'it', 'sells', 'it has', "it's wanted"];
  if (!tradesHere(ctx, c.id)) return `${c.name} ${isnt} traded openly at ${here}: it's against the law ${at}.`;
  if (event) return `${EVENT_KINDS[event.type].headline(here)}. That's moving ${c.name.toLowerCase()} prices ${at}.`;
  if (order?.side === 'buy') return `${here} is short of ${c.name.toLowerCase()} and the station is buying to restock: a good place to sell.`;
  if (order?.side === 'sell') return `${here} has more ${c.name.toLowerCase()} than it can use: cheap while the glut lasts.`;
  if (balance > 0.25) return `${c.name} ${is} cheap ${at}: ${here} makes ${it}. Sell ${it} where ${itsWanted}.`;
  if (balance < -0.25) return `${c.name} ${sells} well ${at}: ${here} doesn't make ${it}, so ${itHas} to be brought in.`;
  return `${here} makes and uses its own ${c.name.toLowerCase()}, so the price stays close to fair.`;
}
