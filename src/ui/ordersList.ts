// Your orders across every market (Mark, 11 November 2026: "how do I keep track of all my orders
// across systems?"), as an exchange shows them: open orders, goods waiting in storage, and your
// trades, each with its market. A market you aren't at is shown as your news of it stands, so an
// order there reads "Open, as of 14:12"; one still on its way reads "Arrives 15:31".

import { commodityById } from '../economy/commodities';
import { formatSats, ordersOf } from '../economy/bitcoin';
import type { LimitOrder, OrderState } from '../economy/orders';
import { distanceLy, systemAt, type StarSystem } from '../galaxy/generate';
import type { Commander } from '../game/commander';

export type OrdersTab = 'open' | 'storage' | 'history';

const fmt = (n: number, dp = 2) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
const unitOf = (id: string) => {
  const u = commodityById(id)?.unit ?? 't';
  return u === 't' ? 't' : u;
};

/** Short exchange tickers for the goods. */
export const TICKERS: Record<string, string> = {
  food: 'FOOD', textiles: 'TEXT', radioactives: 'RADS', slaves: 'SLAV', liquor: 'LIQR', luxuries: 'LUXR',
  narcotics: 'NARC', computers: 'COMP', machinery: 'MACH', alloys: 'ALOY', firearms: 'ARMS', furs: 'FURS',
  minerals: 'MINR', gold: 'GOLD', platinum: 'PLAT', gems: 'GEMS', alien: 'ALIN',
  water: 'WATR', hydrogen: 'HYDR', electronics: 'ELEC', medicine: 'MEDS', btc: 'BTC',
};
export const ticker = (id: string) => TICKERS[id] ?? id.slice(0, 4).toUpperCase();

export interface OpenRow {
  key: string; // "galaxy:index"
  system: StarSystem;
  here: boolean;
  order: LimitOrder;
  status: string;
  /** Still travelling there: it can't be changed, only cancelled. */
  travelling: boolean;
}

/** What an order is doing, as far as your news goes. */
export function orderStatus(o: LimitOrder, state: OrderState, here: boolean, now: number): { text: string; travelling: boolean } {
  if (o.cancel !== undefined) return { text: o.cancel > now ? `Cancelling, arrives ${clock(o.cancel)}` : 'Cancelling', travelling: false };
  if (o.sent !== undefined && o.placed > now) return { text: `Arrives ${clock(o.placed)}`, travelling: true };
  if (o.amend) return { text: `New price ${fmt(o.amend.limit)} arrives ${clock(o.amend.at)}`, travelling: false };
  return { text: here ? 'Open' : `Open, as of ${clock(state.updated)}`, travelling: false };
}

/** Every open goods order, nearest market first. */
export function openOrders(c: Commander, here: StarSystem, now: number): OpenRow[] {
  const rows: OpenRow[] = [];
  for (const [key, state] of Object.entries(c.markets ?? {}) as [string, OrderState][]) {
    if (!state.orders?.length) continue;
    const [g, i] = key.split(':').map(Number);
    const system = systemAt(g, i);
    const isHere = system.galaxy === here.galaxy && system.index === here.index;
    for (const order of state.orders) {
      const s = orderStatus(order, state, isHere, now);
      rows.push({ key, system, here: isHere, order, status: s.text, travelling: s.travelling });
    }
  }
  return rows.sort((a, b) => Number(b.here) - Number(a.here) || distanceLy(here, a.system) - distanceLy(here, b.system) || a.order.placed - b.order.placed);
}

/** How many orders you have open anywhere, Bitcoin's included. */
export const openCount = (c: Commander, here: StarSystem, now: number) => openOrders(c, here, now).length + ordersOf(c).length;

function where(system: StarSystem, here: StarSystem, isHere: boolean): string {
  return isHere ? `${system.name} · here` : `${system.name} · ${distanceLy(here, system).toFixed(1)} LY`;
}

/** The orders panel: tabs, then a table on a computer or cards on a phone. */
export function ordersPanel(c: Commander, here: StarSystem, now: number, tab: OrdersTab, phone: boolean): string {
  const open = openOrders(c, here, now);
  const btc = ordersOf(c);
  const storage: { key: string; system: StarSystem; id: string; qty: number }[] = [];
  const history: { t: number; system: StarSystem | null; id: string; side: 'buy' | 'sell'; qty: string; price: string; total: number }[] = [];
  for (const [key, state] of Object.entries(c.markets ?? {}) as [string, OrderState][]) {
    const [g, i] = key.split(':').map(Number);
    const system = systemAt(g, i);
    for (const [id, qty] of Object.entries(state.storage ?? {})) if (qty > 0) storage.push({ key, system, id, qty });
    for (const t of state.trades ?? []) history.push({ t: t.t, system, id: t.id, side: t.side, qty: `${t.qty.toLocaleString()} ${unitOf(t.id)}`, price: fmt(t.total / t.qty), total: t.total });
  }
  for (const t of c.btcTrades ?? []) history.push({ t: t.t, system: null, id: 'btc', side: t.side, qty: formatSats(t.sats), price: fmt(t.price, 0), total: t.total });
  history.sort((a, b) => b.t - a.t);

  const tabBtn = (t: OrdersTab, label: string) => `<button data-otab="${t}" class="${tab === t ? 'active' : ''}">${label}</button>`;
  const tabs = `<div class="ex-otabs" role="tablist">${tabBtn('open', `Open orders (${open.length + btc.length})`)}${tabBtn('storage', `Storage (${storage.length})`)}${tabBtn('history', 'History')}<span class="ex-otabs-all">All markets</span></div>`;
  const side = (s: 'buy' | 'sell') => `<span class="${s === 'buy' ? 'up' : 'down'}">${s === 'buy' ? 'Buy' : 'Sell'}</span>`;
  const ref = (r: OpenRow) => `${r.key}:${r.order.oid}`;
  let body = '';
  if (tab === 'open') {
    const goods = open.map((r) => {
      const o = r.order;
      const amount = `${o.qty.toLocaleString()} ${unitOf(o.id)}`;
      const actions = `${r.travelling || o.cancel !== undefined ? '' : `<button data-oedit="${ref(r)}">Edit</button>`}${o.cancel !== undefined ? '' : `<button data-ocancel="${ref(r)}">Cancel</button>`}`;
      return { place: where(r.system, here, r.here), pair: `${ticker(o.id)}/CR`, side: side(o.side), price: fmt(o.limit), amount, total: `${fmt(o.limit * o.qty, 1)} Cr`, status: r.status, faint: r.travelling, actions };
    });
    const coins = btc.map((o) => ({
      place: 'Every station',
      pair: 'BTC/CR',
      side: side(o.side),
      price: fmt(o.limit, 0),
      amount: o.side === 'buy' ? `${fmt(o.credits ?? 0, 0)} Cr` : formatSats(o.sats ?? 0),
      total: o.side === 'buy' ? `${fmt(o.credits ?? 0, 0)} Cr` : '-',
      status: 'Open',
      faint: false,
      actions: `<button data-btc-cancel="${o.id}">Cancel</button>`,
    }));
    const rows = [...goods, ...coins];
    if (!rows.length) body = '<p class="ex-empty">No open orders. A limit order waits at its market for your price, and fills while you\'re away.</p>';
    else if (phone)
      body = rows
        .map((r) => `<div class="ex-ocard${r.faint ? ' faint' : ''}"><span class="t">${r.pair} ${r.side} · ${r.place}</span><span class="a">${r.price} × ${r.amount}</span><span class="dim">${r.status}</span><span class="a dim">${r.total}</span><div class="ex-ocard-actions">${r.actions}</div></div>`)
        .join('');
    else
      body = `<table class="ex-otable"><thead><tr><th>Market</th><th>Pair</th><th>Side</th><th class="num">Price</th><th class="num">Amount</th><th class="num">Total</th><th class="num">Status</th><th></th></tr></thead><tbody>${rows
        .map((r) => `<tr class="${r.faint ? 'faint' : ''}"><td>${r.place}</td><td>${r.pair}</td><td>${r.side}</td><td class="num">${r.price}</td><td class="num">${r.amount}</td><td class="num">${r.total}</td><td class="num dim">${r.status}</td><td class="num ex-oacts">${r.actions}</td></tr>`)
        .join('')}</tbody></table>`;
  } else if (tab === 'storage') {
    if (!storage.length) body = '<p class="ex-empty">Nothing in storage. What a buy order buys waits at its station until you dock there, or sell it from here.</p>';
    else
      body = storage
        .map((s) => {
          const isHere = s.system.galaxy === here.galaxy && s.system.index === here.index;
          return `<div class="ex-ocard"><span class="t">${s.qty.toLocaleString()} ${unitOf(s.id)} ${commodityById(s.id)?.name ?? s.id}</span><span class="a dim">${where(s.system, here, isHere)}</span><div class="ex-ocard-actions">${isHere ? '<span class="dim">Collected when there\'s hold space</span>' : `<button data-ostore="${s.key}:${s.id}">Sell from storage</button>`}</div></div>`;
        })
        .join('');
  } else {
    const rows = history.slice(0, 40);
    if (!rows.length) body = '<p class="ex-empty">No trades yet.</p>';
    else if (phone)
      body = rows
        .map((h) => `<div class="ex-ocard"><span class="t">${ticker(h.id)}/CR ${side(h.side)} · ${h.system?.name ?? 'Bitcoin'}</span><span class="a">${h.price} × ${h.qty}</span><span class="dim">${clock(h.t)}</span><span class="a dim">${fmt(h.total, 1)} Cr</span></div>`)
        .join('');
    else
      body = `<table class="ex-otable"><thead><tr><th>Time</th><th>Market</th><th>Pair</th><th>Side</th><th class="num">Price</th><th class="num">Amount</th><th class="num">Total</th></tr></thead><tbody>${rows
        .map((h) => `<tr><td>${clock(h.t)}</td><td>${h.system?.name ?? 'Every station'}</td><td>${ticker(h.id)}/CR</td><td>${side(h.side)}</td><td class="num">${h.price}</td><td class="num">${h.qty}</td><td class="num">${fmt(h.total, 1)} Cr</td></tr>`)
        .join('')}</tbody></table>`;
  }
  return tabs + `<div class="ex-obody">${body}</div>`;
}
