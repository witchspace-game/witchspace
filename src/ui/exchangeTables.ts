// The exchange's tables that are only drawing: the market's trades, your trades and orders at the
// market on screen, Bitcoin's, and the back room. The exchange itself is in exchange.ts.

import { abolitionistPrice, backRoomQuotes, fenceQuotes, hasAbolitionists, hasBackRoom, stingChance } from '../economy/blackmarket';
import { formatSats, ordersOf } from '../economy/bitcoin';
import { commodityById, type Commodity } from '../economy/commodities';
import { recentTrades } from '../economy/market';
import type { OrderState } from '../economy/orders';
import { marketState, quotes, type TradeContext } from '../economy/trade';
import type { Commander } from '../game/commander';
import { ticker } from './ordersList';

const fmt = (n: number, dp = 1) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const unitLabel = (c: Commodity) => (c.unit === 't' ? 't' : c.unit);

/** Your Bitcoin orders and trades. */
export function btcTradesHtml(c: Commander): { title: string; html: string } {
  const trades = (c.btcTrades ?? []).slice().reverse();
  const orders = ordersOf(c);
  const open = orders.length
    ? `<h5>Open orders</h5><table class="ex-orders"><thead><tr><th>Side</th><th class="num">Amount</th><th class="num">Fills at</th><th class="num">Placed</th><th></th></tr></thead><tbody>${orders
        .map(
          (o) => `<tr><td class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Buy' : 'Sell'}</td><td class="num">${o.side === 'buy' ? `${fmt(o.credits!)} Cr` : formatSats(o.sats!)}</td>
          <td class="num">${fmt(o.limit, 0)}</td><td class="num">${clock(o.placed)}</td><td class="num"><button data-btc-cancel="${o.id}">Cancel</button></td></tr>`,
        )
        .join('')}</tbody></table>`
    : '';
  const html =
    open +
    (trades.length
      ? `<table><thead><tr><th>Time</th><th>Side</th><th class="num">Sats</th><th class="num">Price</th><th class="num">Fee</th><th class="num">Total</th></tr></thead><tbody>${trades
          .map(
            (t) => `<tr><td>${clock(t.t)}</td><td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? 'Buy' : 'Sell'}</td>
          <td class="num">${t.sats.toLocaleString()}</td><td class="num">${fmt(t.price)}</td><td class="num">${t.fee !== undefined ? fmt(t.fee, 2) : '-'}</td><td class="num">${fmt(t.total)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : orders.length
        ? ''
        : '<p class="ex-empty">No Bitcoin trades yet. They follow you to every station.</p>');
  return { title: orders.length ? 'Your Bitcoin orders and trades' : 'Your Bitcoin trades', html };
}

/** Every trade in this good at the market on screen, other traders' and yours. */
export function feedHtml(ctx: TradeContext, id: string): string {
  const u = unitLabel(commodityById(id)!);
  const events = recentTrades(ctx.system, marketState(ctx), id, ctx.now, 14);
  return events.length
    ? `<table><thead><tr><th>Price (Cr)</th><th class="num">Qty (${u})</th><th class="num">Time</th></tr></thead><tbody>${events
        .map((e) =>
          e.by === 'lost'
            ? `<tr class="lost" title="The trader carrying this delivery was destroyed"><td>Lost</td><td class="num">${e.qty.toLocaleString()} <em>destroyed</em></td><td class="num">${clock(e.t)}</td></tr>`
            : `<tr class="${e.by === 'you' ? 'you' : ''}"><td class="${e.side === 'buy' ? 'up' : 'down'}">${fmt(e.price, 2)}</td>
          <td class="num">${e.qty.toLocaleString()}${e.by === 'you' ? ' <em>you</em>' : ''}</td><td class="num">${clock(e.t)}</td></tr>`,
        )
        .join('')}</tbody></table>`
    : '<p class="ex-empty">No trades in the last few hours.</p>';
}

/** Your orders, storage and trades at the market on screen. */
export function tradesHtml(ctx: TradeContext, remote: boolean, now: number): { title: string; html: string } {
  const state = marketState(ctx) as OrderState;
  const trades = (state.trades ?? []).slice().reverse();
  const orders = state.orders ?? [];
  const stored = Object.entries(state.storage ?? {}).filter(([, q]) => q > 0);
  const openHtml = orders.length
    ? `<h5>Open orders</h5><table class="ex-orders"><thead><tr><th>Pair</th><th>Side</th><th class="num">Qty</th><th class="num">Limit</th><th class="num">Market</th><th></th></tr></thead><tbody>${orders
        .map((o) => {
          const market = quotes(ctx).find((x) => x.commodity.id === o.id)!.price;
          const onWay = o.sent !== undefined && o.placed > now;
          const status = o.cancel !== undefined ? `<small>cancelling</small>` : onWay ? `<small>arrives ${clock(o.placed)}</small>` : fmt(market, 2);
          return `<tr><td>${commodityById(o.id)?.name}</td><td class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Buy' : 'Sell'}</td><td class="num">${o.qty.toLocaleString()}</td>
            <td class="num">${fmt(o.limit, 2)}</td><td class="num">${status}</td><td class="num">${o.cancel !== undefined ? '' : `<button data-cancel="${o.oid}">Cancel</button>`}</td></tr>`;
        })
        .join('')}</tbody></table>`
    : '';
  const storageHtml = stored.length
    ? `<p class="ex-storage">In storage ${remote ? 'there' : 'here, waiting for hold space'}: ${stored.map(([id, q]) => `<b>${q.toLocaleString()} ${unitLabel(commodityById(id)!)} ${commodityById(id)?.name}</b>`).join(', ')}</p>`
    : '';
  const where = remote ? `at ${ctx.system.name}` : 'here';
  const html =
    openHtml +
    storageHtml +
    (trades.length
      ? `<table><thead><tr><th>Time</th><th>Pair</th><th>Side</th><th class="num">Qty</th><th class="num">Avg</th><th class="num">Total</th></tr></thead><tbody>${trades
          .map(
            (t) => `<tr><td>${clock(t.t)}</td><td>${commodityById(t.id)?.name}</td><td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? 'Buy' : 'Sell'}</td>
          <td class="num">${t.qty.toLocaleString()}</td><td class="num">${fmt(t.total / t.qty, 2)}</td><td class="num">${fmt(t.total)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="ex-empty">No trades at this station yet.</p>');
  return { title: orders.length ? `Your orders and trades ${where}` : `Your trades ${where}`, html };
}

/** The back room: whether there's one to show, and what's in it. */
export function backRoomHtml(ctx: TradeContext, message: string, caught: boolean): { there: boolean; html: string } {
  const c = ctx.commander;
  const room = hasBackRoom(c, ctx.system);
  const quotesHere = room ? backRoomQuotes(c, ctx.system, marketState(ctx), ctx.now) : [];
  const abolition = hasAbolitionists(c, ctx.system);
  const fence = fenceQuotes(c, ctx.system, marketState(ctx), ctx.now);
  const there = quotesHere.length > 0 || fence.length > 0 || (abolition && (c.cargo.slaves ?? 0) > 0);
  const risk = stingChance(ctx.system, 1);
  const rows = quotesHere
    .map((q) => {
      const good = commodityById(q.id)!;
      const u = unitLabel(good);
      const held = c.cargo[q.id] ?? 0;
      // Buy only what they have and you can pay for (Mark's 100 Cr could "buy" Narcotics at 255: it checked their stock alone).
      const can = (n: number) => q.stock >= n && c.credits >= q.ask * n;
      return `<tr><td><b>${good.name}</b><small>${ticker(q.id)}</small></td><td class="num" data-l="They sell">${fmt(q.ask)}</td><td class="num" data-l="They buy">${fmt(q.bid)}</td>
        <td class="num" data-l="Stock">${q.stock.toLocaleString()} ${u}</td><td class="num" data-l="Your hold">${held.toLocaleString()} ${u}</td>
        <td class="ex-back-actions">
          <button data-back="buy" data-good="${q.id}" data-n="1" ${can(1) ? '' : 'disabled'}>Buy 1</button>
          <button data-back="buy" data-good="${q.id}" data-n="5" ${can(5) ? '' : 'disabled'}>Buy 5</button>
          <button data-back="sell" data-good="${q.id}" data-n="1" ${held >= 1 ? '' : 'disabled'}>Sell 1</button>
          <button data-back="sell" data-good="${q.id}" data-n="${held}" ${held >= 1 ? '' : 'disabled'}>Sell all</button>
        </td></tr>`;
    })
    .join('');
  const slaves = c.cargo.slaves ?? 0;
  const abolitionists = abolition
    ? `<div class="ex-abolition"><h4>Abolitionist Society</h4>
        <p>They buy slaves to set them free: ${fmt(abolitionistPrice(ctx.system, ctx.now))} Cr each, about half what the back room pays. Legal, and no questions about where they came from.${c.freed ? ` You've freed ${c.freed.toLocaleString()} people.` : ''}</p>
        <button data-free="${slaves}" ${slaves ? '' : 'disabled'}>${slaves ? `Free ${slaves.toLocaleString()}` : 'No slaves aboard'}</button></div>`
    : '';
  const html = `
    <header><button class="ex-back-close">‹ Exchange</button><h3>Back room</h3><span>No questions asked</span>
      ${quotesHere.length ? `<span class="ex-heat" title="The chance any one deal is with undercover police. Bigger deals draw more attention.">Undercover risk ${(risk * 100).toFixed(0)}% a deal, more for big ones</span>` : ''}</header>
    ${quotesHere.length ? `<table><thead><tr><th>Goods</th><th class="num">They sell</th><th class="num">They buy</th><th class="num">Their stock</th><th class="num">Your hold</th><th></th></tr></thead><tbody>${rows}</tbody></table>` : '<p class="ex-empty">Nothing here is against the law.</p>'}
    ${
      fence.length
        ? `<div class="ex-fence"><h4>The fence</h4><p>Stolen goods, bought at about 60% of the open price. No questions asked, though the buyer could be police.</p><table><tbody>${fence
            .map((f) => {
              const good = commodityById(f.id)!;
              return `<tr><td><b>${good.name}</b><small>stolen</small></td><td class="num">${fmt(f.bid)} Cr each</td><td class="num">${f.qty.toLocaleString()} ${unitLabel(good)} aboard</td>
                <td class="ex-back-actions"><button data-fence="${f.id}" data-n="1">Sell 1</button><button data-fence="${f.id}" data-n="${f.qty}">Sell all</button></td></tr>`;
            })
            .join('')}</tbody></table></div>`
        : ''
    }
    <p class="ex-back-msg${caught ? ' caught' : ''}" aria-live="polite">${message}</p>
    ${abolitionists}`;
  return { there, html };
}
