import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  CrosshairMode,
  HistogramSeries,
  LineStyle,
  type CandlestickData,
  type IPriceLine,
  type MouseEventParams,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from 'lightweight-charts';
import { COMMODITIES, commodityById, UNITS_PER_TONNE, type Commodity } from '../economy/commodities';
import { fenceSell, freeSlaves, backRoomTrade, type BackRoomResult } from '../economy/blackmarket';
import { cleanQty, FUEL_CAPACITY, stolenQty } from '../game/commander';
import { activeEvent, eventsAt, EVENT_KINDS, newsAt, newsDelay, type NewsItem } from '../economy/events';
import { candles, drift, equilibriumPrice, orderBook, priceAt, stationOrder, tradeBalance } from '../economy/market';
import { amendOrder, BROKER_FEE, collect, describeFill, placeOrder, requestCancel, sendOrder, type OrderState } from '../economy/orders';
import { buy, freeTonnes, marketState, maxBuyable, quotes, sell, tradesHere, type TradeContext, type TradeResult } from '../economy/trade';
import { bestKnownElsewhere, bestOutlets, bestRoutes, checkSentOrders, knownAt, marketsForOrders, takeCancelled, type Route } from '../economy/routes';
import { distanceLy, GOVERNMENTS, systemAt, type StarSystem } from '../galaxy/generate';
import { btcValue, buyAt, buyBitcoin, cancelBtcOrder, formatBtc, formatSats, isFresh, ordersOf, placeBtcOrder, satsOf, sellAt, sellBitcoin, FEE } from '../economy/bitcoin';
import { btcCandles, btcQuote, checkBtcOrders, heardCandles, heardQuote } from '../net/bitcoin';
import { openCount, ordersPanel, ticker, type OrdersTab } from './ordersList';
import { mountChartOrders } from './chartOrders';
import { actionsHtml, bookHtml, btcHeadHtml, chartState, headHtml, whyLine, type WindowView } from './tradeWindow';
import { backRoomHtml, btcTradesHtml, feedHtml, tradesHtml } from './exchangeTables';

// The station market as a trading exchange, in the style of today's crypto
// exchanges: a list of pairs against the credit, a candlestick chart, the
// order book and a trade form. Everything shown comes from the living market
// itself: the book is the station's real pricing curve, the chart is the
// market's real price history (TradingView's open-source Lightweight
// Charts), and the trades feed is every trade, other traders' and yours.
//
// Bitcoin sits at the top of the list (docs/design/system-currencies.md, 6b):
// the same chart, but its candles are the real market's, and the station is a
// broker at the live price, not a market with a curve of its own.
//
// TradingView Lightweight Charts™ Copyright (c) TradingView, Inc. https://www.tradingview.com/
// Licensed under the Apache License 2.0; the chart shows TradingView's attribution logo.

export interface ExchangeDeps {
  context(): TradeContext;
  /** A trade went through: save, play a sound, refresh the rest of the screen. */
  traded(result: TradeResult): void;
  /** A back-room deal went through, or turned out to be a sting. */
  dealt(result: BackRoomResult): void;
  /** Set the hyperspace destination (the trade computer's "Set course"). */
  setCourse(system: StarSystem): void;
  /** A system's own money and how many units a credit buys there, for prices in local money; null in an anarchy. */
  localMoney?(system: StarSystem): { ticker: string; rate: number } | null;
}

const INTERVALS = { '5m': [5 * 60_000, 60], '15m': [15 * 60_000, 60], '1h': [3600_000, 48] } as const;
type Interval = keyof typeof INTERVALS;
const HOUR = 3600_000;
const ROW = 19; // px: one order-book level

const fmt = (n: number, dp = 1) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const pctFee = (n: number) => `${+(n * 100).toFixed(3)}%`;
const unitLabel = (c: Commodity) => (c.unit === 't' ? 't' : c.unit);
const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
/** How old a price is, briefly: "12 min", "1 h 20". */
const age = (ms: number) => {
  const m = Math.round(ms / 60_000);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60}` : ''}`;
};

export function mountExchange(root: HTMLElement, deps: ExchangeDeps) {
  // Trading from the station (docs/design/trading.md, 5b): another market can
  // be put on screen, as you know it, and limit orders sent to it.
  let viewing: StarSystem | null = null;
  /** The market on screen: this station's, or another as you know it (its `now` is when your news of it dates from). */
  function view(): TradeContext {
    const ctx = deps.context();
    if (!viewing || viewing === ctx.system) return ctx;
    return { ...ctx, system: viewing, now: knownAt(ctx.commander, ctx.system, viewing, ctx.now) };
  }
  const remote = () => viewing !== null && viewing !== deps.context().system;
  /** Storage at the market on screen (remote sells come from there). */
  const storedThere = (ctx: TradeContext, id: string) => (marketState(ctx) as OrderState).storage?.[id] ?? 0;
  let selected = 'food';
  const BTC = 'btc';
  const isBtc = () => selected === BTC;
  let side: 'buy' | 'sell' = 'buy';
  let interval: Interval = '15m';
  let message = '';
  let timer = 0;
  /** The trade window: open or not, which tab of your orders, and an order being changed. */
  let modalOpen = false;
  let otab: OrdersTab = 'open';
  let editing: { key: string; oid: number } | null = null;
  /** A limit buy here may buy more than the hold takes, the rest waiting in storage (Mark: off unless asked). */
  let fillStorage = false;

  root.innerHTML = `
    <section class="ex-back" hidden></section>
    <section class="ex-routes" hidden></section>
    <div class="ex">
      <aside class="ex-pairs" aria-label="Markets">
        <label class="ex-market"><span>Market</span><select aria-label="Market on screen"></select></label>
        <p class="ex-remote-note" hidden></p>
        <button class="ex-routes-toggle" title="Every market within a tank of fuel, as you know it, and the best runs from here">Trade computer ›</button>
        <button class="ex-backroom-toggle" hidden>Back room ›</button>
        <div class="ex-pairs-list"></div>
        <button class="ex-more-toggle" aria-expanded="false">Order book and trades <span>Show ▾</span></button>
      </aside>
      <header class="ex-head"></header>
      <section class="ex-chart">
        <div class="ex-chart-bar">
          <div class="ex-intervals" role="group" aria-label="Candle interval">
            ${Object.keys(INTERVALS).map((k) => `<button data-interval="${k}">${k}</button>`).join('')}
          </div>
          <span class="ex-ohlc"></span>
        </div>
        <div class="ex-canvas"></div>
      </section>
      <section class="ex-book" aria-label="Order book">
        <div class="ex-panes" role="tablist"><button data-pane="runs" role="tab">Trade computer</button><button data-pane="book" role="tab" class="active">Order book</button></div>
        <div class="ex-book-head"><span>Price (Cr)</span><span class="ex-book-unit">Size</span><span>Total</span></div>
        <div class="ex-asks"></div>
        <div class="ex-mid"></div>
        <div class="ex-bids"></div>
      </section>
      <section class="ex-actions" aria-label="Trade"></section>
      <section class="ex-trades">
        <div class="ex-feed" aria-label="Market trades">
          <h4>Market trades</h4>
          <div class="ex-feed-list"></div>
        </div>
        <div class="ex-mine" aria-label="Your trades">
          <h4>Your trades here</h4>
          <div class="ex-trades-list"></div>
        </div>
      </section>
    </div>
    <div class="ex-modal" hidden>
      <div class="ex-sheet" role="dialog" aria-modal="true" aria-label="Trade">
        <header class="ex-mhead"></header>
        <div class="ex-mbody">
          <section class="ex-mbook" aria-label="Order book"></section>
          <section class="ex-form" aria-label="Order">
            <div class="ex-sides" role="tablist">
              <button data-side="buy" role="tab">Buy</button>
              <button data-side="sell" role="tab">Sell</button>
            </div>
            <div class="ex-types" role="group" aria-label="Order type">
              <button data-type="limit">Limit</button><button data-type="market">Market</button>
            </div>
            <p class="ex-ordertype" hidden></p>
            <label class="ex-price ex-field" hidden><button type="button" data-step="price:-1" aria-label="Lower">−</button><span class="ex-in"><span>Price (<b class="ex-price-unit">Cr</b>)</span><input type="number" min="0" step="0.01" inputmode="decimal" /></span><button type="button" data-step="price:1" aria-label="Higher">+</button></label>
            <label class="ex-qty ex-field"><button type="button" data-step="qty:-1" aria-label="Less">−</button><span class="ex-in"><span><span class="ex-qty-name">Amount</span> (<b class="ex-qty-unit"></b>)</span><input type="number" min="0" step="1" inputmode="numeric" /></span><button type="button" data-step="qty:1" aria-label="More">+</button></label>
            <div class="ex-stops">
              <input class="ex-slider" type="range" min="0" max="100" step="1" value="0" aria-label="Amount as a share of the most you can trade" />
              <div class="ex-ticks">${[0, 25, 50, 75, 100].map((p) => `<button type="button" data-pct="${p}"><i></i><span>${p ? `${p}%` : '0'}</span></button>`).join('')}</div>
            </div>
            <button type="button" class="ex-storage-toggle" data-storage="1" aria-pressed="false" hidden title="Buy more than your hold takes: the rest waits in storage at this station until you collect it"><i></i>Fill to storage</button>
            <dl class="ex-est"></dl>
            <p class="ex-avail"></p>
            <button class="ex-submit cut"></button>
            <button class="ex-cancel-order" hidden>Cancel order</button>
            <p class="ex-fnote"></p>
            <p class="ex-msg" aria-live="polite"></p>
          </section>
        </div>
        <section class="ex-orders-all" aria-label="Your orders"></section>
      </div>
    </div>`;

  // The trade window lives on the page itself, so a phone's scrolling panel can't trap it.
  const modalEl = root.querySelector<HTMLElement>('.ex-modal')!;
  document.body.append(modalEl);
  const $ = <T extends HTMLElement>(sel: string) => (root.querySelector<T>(sel) ?? modalEl.querySelector<T>(sel))!;
  const modalAll = <T extends HTMLElement>(sel: string) => modalEl.querySelectorAll<T>(sel);
  const qtyInput = $<HTMLInputElement>('.ex-qty input');
  const priceInput = $<HTMLInputElement>('.ex-price input');
  let orderType: 'market' | 'limit' = 'market';
  const slider = $<HTMLInputElement>('.ex-slider');

  // The chart: candles, volume underneath, a fair-value line and your trades as markers.
  const chart = createChart($('.ex-canvas'), {
    autoSize: true,
    layout: {
      background: { type: ColorType.Solid, color: 'transparent' },
      textColor: '#848e9c',
      fontFamily: 'system-ui, -apple-system, "Segoe UI", sans-serif',
      fontSize: 11,
      attributionLogo: true,
    },
    grid: { vertLines: { color: 'rgba(255,255,255,0.04)' }, horzLines: { color: 'rgba(255,255,255,0.05)' } },
    rightPriceScale: { borderColor: '#1e242c' },
    timeScale: { borderColor: '#1e242c', timeVisible: true, secondsVisible: false, rightOffset: 3 },
    crosshair: { mode: CrosshairMode.Normal },
  });
  const candleSeries = chart.addSeries(CandlestickSeries, {
    upColor: UP,
    downColor: DOWN,
    borderVisible: false,
    wickUpColor: UP,
    wickDownColor: DOWN,
  });
  candleSeries.priceScale().applyOptions({ scaleMargins: { top: 0.08, bottom: 0.24 } });
  const volumeSeries = chart.addSeries(HistogramSeries, { priceScaleId: 'volume', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
  chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
  const markers = createSeriesMarkers(candleSeries, []);
  let fairLine: IPriceLine | null = null;
  let orderLines: IPriceLine[] = [];
  let chartKey = '';
  chart.subscribeCrosshairMove((param: MouseEventParams) => legend(param.seriesData.get(candleSeries) as CandlestickData | undefined, param.time));
  // Trading from the chart: every one of these opens the trade window to confirm.
  const overlay = mountChartOrders($('.ex-canvas'), chart, candleSeries, {
    quick: (s) => openModal({ side: s, type: 'market' }),
    limit: (s, price) => openModal({ side: s, type: 'limit', price }),
    move: (ref, price) => (ref.startsWith('btc:') ? render() : openEdit(ref, price)),
    cancel: (ref) => {
      if (ref.startsWith('btc:')) {
        const result = cancelBtcOrder(view().commander, Number(ref.slice(4)));
        message = result.message;
        deps.traded(result);
      } else openEdit(ref);
    },
  });

  const commodity = () => commodityById(selected)!;
  /** How many units of the good on screen fit in the hold's free space. */
  const holdRoom = (ctx: TradeContext) => Math.floor(freeTonnes(ctx) * UNITS_PER_TONNE[commodity().unit] + 1e-9);
  const index = () => COMMODITIES.findIndex((c) => c.id === selected);
  const limitPrice = () => Number(priceInput.value) || 0;
  const maxQty = (ctx: TradeContext) => {
    // Bitcoin: credits to spend, or sats to sell.
    if (isBtc()) return side === 'buy' ? Math.floor(ctx.commander.credits) : satsOf(ctx.commander);
    if (remote()) {
      if (side === 'sell') return storedThere(ctx, selected);
      return limitPrice() > 0 ? Math.floor(ctx.commander.credits / (limitPrice() * (1 + BROKER_FEE))) : 0;
    }
    // Where there's a law, only clean goods can be sold openly.
    if (side === 'sell') return ctx.system.government > 0 ? cleanQty(ctx.commander, selected) : (ctx.commander.cargo[selected] ?? 0);
    // A limit buy waits for the price: what fits in the hold (Mark), or with Fill to storage on,
    // as much as your credits cover, the rest waiting in storage here.
    if (orderType === 'limit') {
      const byCredits = limitPrice() > 0 ? Math.floor(ctx.commander.credits / limitPrice()) : 0;
      return fillStorage ? byCredits : Math.min(byCredits, holdRoom(ctx));
    }
    return maxBuyable(ctx, selected);
  };
  /** Start the limit price a little better than the market: below it to buy, above it to sell. */
  const suggestPrice = (ctx: TradeContext) => {
    if (isBtc()) {
      // A Bitcoin limit starts 2% better than now: below it to buy, above it to sell.
      const q = heardQuote();
      if (q) priceInput.value = String(Math.round(q.price * (side === 'buy' ? 0.98 : 1.02)));
      return;
    }
    const p = quotes(ctx).find((x) => x.commodity.id === selected)!.price;
    priceInput.value = (p * (side === 'buy' ? 0.98 : 1.02)).toFixed(2);
  };
  const qty = () => Math.max(0, Math.floor(Number(qtyInput.value) || 0));

  function setQty(n: number, ctx = view()) {
    const max = maxQty(ctx);
    const q = Math.max(0, Math.min(max, Math.floor(n)));
    qtyInput.value = q ? String(q) : '';
    slider.value = String(max ? Math.round((q / max) * 100) : 0);
  }

  // --- Pairs ------------------------------------------------------------------

  // --- The market on screen ----------------------------------------------------------

  let chooserFor = '';
  function renderChooser() {
    const docked = deps.context();
    const select = $<HTMLSelectElement>('.ex-market select');
    const k = `${docked.system.galaxy}:${docked.system.index}`;
    if (chooserFor !== k) {
      chooserFor = k;
      viewing = null;
      select.innerHTML =
        `<option value="">${docked.system.name} · here</option>` +
        marketsForOrders(docked.system)
          .map((s) => `<option value="${s.index}">${s.name} · ${distanceLy(docked.system, s).toFixed(1)} LY</option>`)
          .join('');
    }
    select.value = viewing && remote() ? String(viewing.index) : '';
    const note = $('.ex-remote-note');
    note.hidden = !remote();
    if (remote()) {
      const delay = newsDelay(viewing!, docked.system);
      note.innerHTML = `As you know it: ${age(docked.now - knownAt(docked.commander, docked.system, viewing!, docked.now))} old. Orders you send arrive in ${age(delay)}; you'll hear of fills as long again after. Broker ${(BROKER_FEE * 100).toFixed(0)}%.`;
    }
    $('.ex-routes-toggle').hidden = remote();
    if (remote()) $('.ex-backroom-toggle').hidden = true;
  }

  // The goods as a trader thinks of them: what you're carrying, what's cheap
  // here, what sells well here, then everything else (docs/design/trading.md).
  let restOpen = false;

  /** Every profitable run from here for a full load, best first: the trade computer's, and each good's
   *  "best place to sell" (Mark, 1 November 2026: the computer should read as answers, beside the goods).
   *  Worked out again every ten seconds, or when your credits, hold or the station change. */
  let runsCache = { key: '', list: [] as Route[] };
  function runs(ctx: TradeContext): Route[] {
    const c = ctx.commander;
    const key = `${ctx.system.galaxy}:${ctx.system.index}:${Math.floor(ctx.now / 10_000)}:${c.credits}:${JSON.stringify(c.cargo)}`;
    if (runsCache.key !== key) runsCache = { key, list: bestRoutes(ctx, Infinity) };
    return runsCache.list;
  }
  const runFor = (ctx: TradeContext, id: string) => runs(ctx).find((r) => r.id === id);

  /** A price in credits, in the local money too: "≈ 2,350 LVR". Credits are what's paid. */
  function inLocal(ctx: TradeContext, credits: number): string {
    const m = deps.localMoney?.(ctx.system);
    if (!m) return '';
    const n = credits * m.rate;
    return `≈ ${fmt(n, n >= 100 ? 0 : 2)} ${m.ticker}`;
  }

  function renderPairs(ctx: TradeContext) {
    const state = marketState(ctx);
    const now = ctx.now;
    const away = remote();
    const elsewhere = away ? new Map() : bestKnownElsewhere(ctx);
    const rows = quotes(ctx).map((q) => {
      const id = q.commodity.id;
      const off = !tradesHere(ctx, id);
      return {
        q,
        id,
        off,
        held: away ? storedThere(ctx, id) : (ctx.commander.cargo[id] ?? 0),
        order: off ? null : stationOrder(ctx.system, state, id),
        balance: tradeBalance(ctx.system, id),
        best: elsewhere.get(id),
      };
    });
    type Row = (typeof rows)[number];
    const spark = (id: string) => {
      const pts = [6, 5, 4, 3, 2, 1, 0].map((k) => priceAt(ctx.system, state, id, now - k * 10 * 60_000));
      const lo = Math.min(...pts);
      const span = Math.max(...pts) - lo || 1;
      const up = pts[6] >= pts[0];
      return `<svg class="ex-spark" viewBox="0 0 36 14" aria-hidden="true"><polyline points="${pts.map((p, k) => `${k * 6},${(13 - ((p - lo) / span) * 12).toFixed(1)}`).join(' ')}" class="${up ? 'up' : 'down'}"/></svg>`;
    };
    const there = (r: Row) => (r.best && r.best.price > r.q.price * 1.05 ? `<span class="up">${fmt(r.best.price)}</span> at ${r.best.dest.name} · ${age(r.best.age)} old` : '');
    /** Its best run, as the trade computer has it: "Riedquat +475 a load". */
    const run = (r: Row) => {
      const best = away ? undefined : runFor(ctx, r.id);
      return best ? `${best.dest.name} <span class="up">+${fmt(best.profit, 0)}</span> a load` : '';
    };
    const row = (r: Row, quick: 'buy' | 'sell' | '', sub: string) => {
      const illegal = r.q.commodity.legality === 'illegal' ? '<em title="Illegal goods">Illegal</em>' : '';
      const hot = r.held && stolenQty(ctx.commander, r.id) ? ' hot' : '';
      return `<button class="ex-pair${r.id === selected ? ' active' : ''}${r.off ? ' off' : ''}${hot}" data-id="${r.id}"${quick ? ` data-quick="${quick}"` : ''} title="${r.q.commodity.name}${r.off ? ' · not traded at this lawful station' : ''}">
        <span class="ex-sym"><b>${r.q.commodity.name}</b>${illegal}</span>${spark(r.id)}<span class="num">${fmt(r.q.price)}</span>
        ${sub ? `<small class="ex-sub">${sub}</small>` : ''}</button>`;
    };
    const used = new Set<string>();
    const take = (list: Row[]) => (list.forEach((r) => used.add(r.id)), list);
    const hold = take(rows.filter((r) => r.held > 0));
    const cheap = take(
      rows
        .filter((r) => !used.has(r.id) && !r.off && r.q.stock > 0 && ((r.best?.price ?? 0) > r.q.price * 1.12 || r.balance > 0.25 || r.order?.side === 'sell'))
        .sort((a, b) => (b.best?.price ?? 0) / b.q.price - (a.best?.price ?? 0) / a.q.price)
        .slice(0, 5),
    );
    const wanted = take(
      rows
        .filter((r) => !used.has(r.id) && !r.off && (r.balance < -0.25 || r.order?.side === 'buy'))
        .sort((a, b) => b.q.price / priceAt(ctx.system, state, b.id, now - HOUR) - a.q.price / priceAt(ctx.system, state, a.id, now - HOUR))
        .slice(0, 5),
    );
    const rest = rows.filter((r) => !used.has(r.id));
    const u = (r: Row) => unitLabel(r.q.commodity);
    const section = (title: string, list: string) => (list ? `<h5 class="ex-list-head">${title}</h5>${list}` : '');
    $('.ex-pairs-list').innerHTML =
      (away ? '' : section('Bitcoin', btcPair(ctx))) +
      section(
        away ? `In storage at ${ctx.system.name}` : 'Your hold',
        hold.map((r) => row(r, r.off ? '' : 'sell', [`${r.held.toLocaleString()} ${u(r)} ${away ? 'in storage' : 'aboard'}`, there(r)].filter(Boolean).join(' · '))).join(''),
      ) +
      section(away ? `Cheap at ${ctx.system.name}` : 'Cheap here', cheap.map((r) => row(r, 'buy', run(r) || there(r) || (r.order?.side === 'sell' ? `in a glut ${away ? 'there' : 'here'}` : `made ${away ? 'there' : 'here'}`))).join('')) +
      section(away ? `Sells well at ${ctx.system.name}` : 'Sells well here', wanted.map((r) => row(r, '', r.order?.side === 'buy' ? `short · station buying ${r.order.qty.toLocaleString()} ${u(r)}` : `wanted ${away ? 'there' : 'here'}`)).join('')) +
      `<button class="ex-rest-toggle" aria-expanded="${restOpen}">${restOpen ? '▾' : '▸'} All other goods (${rest.length})</button>` +
      (restOpen ? rest.map((r) => row(r, '', r.off ? `not traded ${away ? 'there' : 'here'}` : '')).join('') : '');
  }

  /** Bitcoin's row: the live price, and your wallet if you hold any. */
  function btcPair(ctx: TradeContext) {
    const q = heardQuote();
    const sats = satsOf(ctx.commander);
    const cs = heardCandles('5m', 60)?.slice(-7);
    let spark = '';
    if (cs && cs.length > 1) {
      const pts = cs.map((k) => k.c);
      const lo = Math.min(...pts);
      const span = Math.max(...pts) - lo || 1;
      spark = `<svg class="ex-spark" viewBox="0 0 36 14" aria-hidden="true"><polyline points="${pts.map((p, k) => `${k * 6},${(13 - ((p - lo) / span) * 12).toFixed(1)}`).join(' ')}" class="${pts[pts.length - 1] >= pts[0] ? 'up' : 'down'}"/></svg>`;
    }
    const sub = sats ? `${formatBtc(sats)} · ${fmt(btcValue(ctx.commander, q))} Cr · 0 t` : 'The same price at every station';
    return `<button class="ex-pair btc${isBtc() ? ' active' : ''}" data-id="${BTC}" title="Bitcoin: the live price of the real coin, the same at every station">
      <span class="ex-sym"><b>Bitcoin</b><i class="ex-live">Live</i></span>${spark}<span class="num">${q ? fmt(q.price) : '…'}</span><small class="ex-sub">${sub}</small></button>`;
  }

  // --- Header -----------------------------------------------------------------

  function renderHead(ctx: TradeContext) {
    const c = commodity();
    const state = marketState(ctx);
    const q = quotes(ctx).find((x) => x.commodity.id === selected)!;
    const hourAgo = priceAt(ctx.system, state, selected, ctx.now - HOUR);
    const change = (q.price - hourAgo) / hourAgo;
    const lastHour = candles(ctx.system, state, selected, ctx.now, 5 * 60_000, 12);
    const high = Math.max(...lastHour.map((k) => k.high));
    const low = Math.min(...lastHour.map((k) => k.low));
    const fair = equilibriumPrice(ctx.system, c, index()) * drift(ctx.system, c, index(), ctx.now);
    const held = ctx.commander.cargo[selected] ?? 0;
    const u = unitLabel(c);
    const balance = tradeBalance(ctx.system, selected);
    const role = balance > 0.25 ? 'Made here · exported' : balance < -0.25 ? 'Imported' : 'Made and used locally';
    const order = stationOrder(ctx.system, state, selected);
    const demand = order
      ? `<div><dt>Station ${order.side === 'buy' ? 'wants' : 'selling'}</dt><dd class="${order.side === 'buy' ? 'up' : 'down'}">${order.qty.toLocaleString()} ${u}</dd></div>`
      : '';
    const event = activeEvent(ctx.system, ctx.now);
    const touched = event && ((EVENT_KINDS[event.type].effects[selected] ?? 0) !== 0 || (balance < -0.2 && EVENT_KINDS[event.type].effects.imports));
    const eventPill = event
      ? `<div class="ex-event${touched ? ' hit' : ''}" title="${EVENT_KINDS[event.type].headline(ctx.system.name)}">${EVENT_KINDS[event.type].name}${touched ? ` · ${c.name} affected` : ''}</div>`
      : '';
    $('.ex-head').innerHTML = `
      ${eventPill}
      <div class="ex-title"><b>${c.name}</b><span>/CR</span><small>per ${u}${c.legality === 'illegal' ? ' · <em>Illegal</em>' : ''}</small></div>
      <div class="ex-last ${change >= 0 ? 'up' : 'down'}">${fmt(q.price)}<small>Cr</small>${inLocal(ctx, q.price) ? `<span class="ex-local" title="In the money here, at the station's rate. You pay in credits.">${inLocal(ctx, q.price)}</span>` : ''}</div>
      <dl>
        <div><dt>1h change</dt><dd class="${change >= 0 ? 'up' : 'down'}">${pct(change)}</dd></div>
        <div><dt>1h high</dt><dd>${fmt(high)}</dd></div>
        <div><dt>1h low</dt><dd>${fmt(low)}</dd></div>
        <div><dt>Fair value</dt><dd title="The price if the station's stock were at its usual level">${fmt(fair)}</dd></div>
        <div><dt>Station stock</dt><dd>${q.stock.toLocaleString()} ${u}</dd></div>
        <div><dt>Trade</dt><dd>${role}</dd></div>
        ${demand}
        <div><dt>${remote() ? 'In storage there' : 'In your hold'}</dt><dd>${(remote() ? storedThere(ctx, selected) : held).toLocaleString()} ${u}${stolenQty(ctx.commander, selected) ? ` <em class="ex-hot">${stolenQty(ctx.commander, selected).toLocaleString()} stolen</em>` : ''}</dd></div>
      </dl>
      <p class="ex-why">${why(ctx, c, balance, order, touched ? event : null)}</p>`;
    bestSlot.innerHTML = remote() ? '' : bestPlace(ctx, c);
    if (!phone.matches) $('.ex-head').append(bestSlot); // on a phone it sits under the candles (placeForPhone)
  }

  /** Where this good is worth most, as you know the markets: for what you carry, or for a full load bought here. */
  function bestPlace(ctx: TradeContext, c: Commodity): string {
    if (!tradesHere(ctx, c.id)) return '';
    const held = ctx.commander.cargo[c.id] ?? 0;
    const outlet = held ? bestOutlets(ctx).find((o) => o.id === c.id && o.dest && o.proceeds > o.here) : undefined;
    const run = held ? undefined : runFor(ctx, c.id);
    const go = outlet ?? run;
    if (!go?.dest) return `<p class="ex-best none">Nowhere within ${FUEL_CAPACITY} LY pays more for ${c.name.toLowerCase()}, as far as you know.</p>`;
    const dest = go.dest;
    const each = outlet ? outlet.proceeds / held : run!.proceeds / run!.qty;
    const gain = outlet ? `+${fmt(outlet.proceeds - outlet.here, 0)} Cr on selling here` : `+${fmt(run!.profit, 0)} Cr a load`;
    const course = ctx.commander.target === dest.index ? '<span class="ex-on-course">On course</span>' : `<button data-course="${dest.index}">Set course</button>`;
    return `<div class="ex-best">
      <span class="ex-best-label">${outlet ? `Best place to sell your ${held.toLocaleString()} ${unitLabel(c)}` : 'Best place to sell'}</span>
      <span class="ex-best-where"><button type="button" class="sys-link" data-system="${dest.index}" title="Show ${dest.name} on the chart">${dest.name}</button> about ${fmt(each)} · ${go.ly.toFixed(1)} LY${go.ly > ctx.commander.fuel ? ' · refuel first' : ''}${risk(dest)}</span>
      <b class="ex-best-gain up">${gain}</b>
      <span class="ex-best-age">As of the news ${age(go.age)} old: prices will have moved.</span>
      <span class="ex-best-actions">${course}<button class="ex-runs-open">Other runs ›</button></span>
    </div>`;
  }

  function renderBtcHead(ctx: TradeContext) {
    bestSlot.innerHTML = '';
    $('.ex-head').innerHTML = btcHeadHtml(ctx.commander);
  }

  /** Why the price is what it is, in a sentence. */
  const why = (ctx: TradeContext, c: Commodity, balance: number, order: ReturnType<typeof stationOrder>, event: ReturnType<typeof activeEvent>) =>
    whyLine(ctx, c, balance, order, event, remote());

  // --- Chart ------------------------------------------------------------------

  function legend(k: CandlestickData | undefined, time?: Time) {
    if (!k) {
      const data = candleSeries.data();
      k = data[data.length - 1] as CandlestickData | undefined;
      time = k?.time;
    }
    if (!k) return;
    $('.ex-ohlc').innerHTML = `<span>${clock(fromChartTime(time as UTCTimestamp))}</span> O <b>${fmt(k.open)}</b> H <b>${fmt(k.high)}</b> L <b>${fmt(k.low)}</b> C <b class="${k.close >= k.open ? 'up' : 'down'}">${fmt(k.close)}</b>`;
  }

  function renderBtcChart(ctx: TradeContext) {
    const [ms, count] = INTERVALS[interval];
    root.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((b) => b.classList.toggle('active', b.dataset.interval === interval));
    for (const l of orderLines) candleSeries.removePriceLine(l);
    orderLines = [];
    if (fairLine) candleSeries.removePriceLine(fairLine);
    fairLine = null;
    const cs = heardCandles(interval, count)?.map((k) => ({ ...k }));
    const key = `${BTC}:${interval}`;
    if (!cs) {
      candleSeries.setData([]);
      volumeSeries.setData([]);
      markers.setMarkers([]);
      chartKey = '';
      $('.ex-ohlc').textContent = 'Asking the network…';
      void btcCandles(interval, count).then((got) => got && isBtc() && renderBtcChart(view()));
      return;
    }
    const q = heardQuote();
    const last = cs[cs.length - 1];
    if (q && q.time >= last.t) {
      last.c = q.price;
      last.h = Math.max(last.h, q.price);
      last.l = Math.min(last.l, q.price);
    }
    const range = key === chartKey ? chart.timeScale().getVisibleLogicalRange() : null;
    orderLines = ordersOf(ctx.commander).map((o) => candleSeries.createPriceLine({ price: o.limit, color: o.side === 'buy' ? UP : DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' }));
    candleSeries.applyOptions({ priceFormat: { type: 'price', precision: 1, minMove: 0.1 } });
    candleSeries.setData(cs.map((k) => ({ time: toChartTime(k.t), open: k.o, high: k.h, low: k.l, close: k.c })));
    volumeSeries.setData(cs.map((k) => ({ time: toChartTime(k.t), value: k.v, color: k.c >= k.o ? 'rgba(46,189,133,0.35)' : 'rgba(246,70,93,0.35)' })));
    if (range) chart.timeScale().setVisibleLogicalRange(range);
    else requestAnimationFrame(() => chart.timeScale().fitContent());
    chartKey = key;
    const start = cs[0].t;
    markers.setMarkers(
      (ctx.commander.btcTrades ?? [])
        .filter((t) => t.t >= start)
        .map((t) => ({
          time: toChartTime(start + Math.min(Math.floor((t.t - start) / ms), cs.length - 1) * ms),
          position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
          shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
          color: t.side === 'buy' ? UP : DOWN,
          text: `${t.side === 'buy' ? 'B' : 'S'} ${fmt(t.total, 0)} Cr`,
        })),
    );
    legend(undefined);
  }

  function renderChart(ctx: TradeContext) {
    const state = marketState(ctx);
    const [ms, count] = INTERVALS[interval];
    const cs = candles(ctx.system, state, selected, ctx.now, ms, count);
    const live = quotes(ctx).find((x) => x.commodity.id === selected)!.price;
    cs[cs.length - 1].close = live;
    cs[cs.length - 1].high = Math.max(cs[cs.length - 1].high, live);
    cs[cs.length - 1].low = Math.min(cs[cs.length - 1].low, live);
    const c = commodity();
    const fair = equilibriumPrice(ctx.system, c, index()) * drift(ctx.system, c, index(), ctx.now);
    const precision = live < 10 ? 2 : 1;
    root.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((b) => b.classList.toggle('active', b.dataset.interval === interval));

    // Keep the reader's zoom and scroll when only the prices have moved.
    const key = `${selected}:${interval}`;
    const range = key === chartKey ? chart.timeScale().getVisibleLogicalRange() : null;
    candleSeries.applyOptions({ priceFormat: { type: 'price', precision, minMove: 1 / 10 ** precision } });
    candleSeries.setData(cs.map((k) => ({ time: toChartTime(k.t), open: k.open, high: k.high, low: k.low, close: k.close })));
    volumeSeries.setData(cs.map((k) => ({ time: toChartTime(k.t), value: k.volume, color: k.close >= k.open ? 'rgba(46,189,133,0.35)' : 'rgba(246,70,93,0.35)' })));
    if (range) chart.timeScale().setVisibleLogicalRange(range);
    else requestAnimationFrame(() => chart.timeScale().fitContent()); // once the chart has its size
    chartKey = key;

    // Your open orders on this pair, as lines at their limits.
    for (const l of orderLines) candleSeries.removePriceLine(l);
    orderLines = ((state as OrderState).orders ?? [])
      .filter((o) => o.id === selected)
      .map((o) => candleSeries.createPriceLine({ price: o.amend?.limit ?? o.limit, color: o.side === 'buy' ? UP : DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: '' }));
    if (fairLine) fairLine.applyOptions({ price: fair });
    else fairLine = candleSeries.createPriceLine({ price: fair, color: 'rgba(247,166,0,0.6)', lineStyle: LineStyle.Dotted, lineWidth: 1, axisLabelVisible: true, title: 'Fair' });

    const start = cs[0].t;
    const mine: SeriesMarker<Time>[] = (state.trades ?? [])
      .filter((t) => t.id === selected && t.t >= start)
      .map((t) => ({
        time: toChartTime(start + Math.floor((t.t - start) / ms) * ms),
        position: t.side === 'buy' ? 'belowBar' : 'aboveBar',
        shape: t.side === 'buy' ? 'arrowUp' : 'arrowDown',
        color: t.side === 'buy' ? UP : DOWN,
        text: `${t.side === 'buy' ? 'B' : 'S'} ${t.qty}`,
      }));
    // World events here, where they start and end on the chart.
    const lastStart = cs[cs.length - 1].t;
    const at = (t: number) => toChartTime(start + Math.min(Math.floor((t - start) / ms), cs.length - 1) * ms);
    const events: SeriesMarker<Time>[] = [];
    for (const e of eventsAt(ctx.system, start, ctx.now)) {
      const name = EVENT_KINDS[e.type].name;
      if (e.start >= start) events.push({ time: at(e.start), position: 'aboveBar', shape: 'square', color: '#f7a600', text: name });
      if (e.end >= start && e.end <= lastStart + ms) events.push({ time: at(e.end), position: 'aboveBar', shape: 'circle', color: '#848e9c', text: `${name} ends` });
    }
    // News of trouble elsewhere, where it reached this station: traders here act on it, so watch the candles.
    for (const n of news(ctx)) {
      if (n.where === ctx.system || n.heard < start) continue;
      const kind = EVENT_KINDS[n.event.type];
      const touches = (kind.effects[selected] ?? 0) !== 0 || (kind.effects.imports !== undefined && tradeBalance(n.where, selected) < -0.2);
      if (touches) events.push({ time: at(n.heard), position: 'belowBar', shape: 'circle', color: '#7fb2ff', text: `${kind.name} news · ${n.where.name}` });
    }
    // Words only where there's room (Mark: "Police crackdown ends", "Famine news · Riredi" and "Drought news ·
    // Zaalela" sat on one another): a marker within a sixth of the chart of the last worded one, above or
    // below alike, keeps its mark and drops its words.
    const all = [...mine, ...events].sort((a, b) => (a.time as number) - (b.time as number));
    const room = Math.max(1, Math.ceil(cs.length / 6)) * (ms / 1000);
    const lastWords: Record<string, number> = {};
    for (const m of all) {
      const t = m.time as number;
      if (m.text && t - (lastWords[m.position] ?? -Infinity) < room) m.text = '';
      else if (m.text) lastWords[m.position] = t;
    }
    markers.setMarkers(all);
    legend(undefined);
  }

  /** The news that has reached the market on screen (worked out once a minute: it's the whole region). */
  let newsCache = { key: '', items: [] as NewsItem[] };
  function news(ctx: TradeContext): NewsItem[] {
    const key = `${ctx.system.galaxy}:${ctx.system.index}:${Math.floor(ctx.now / 60_000)}`;
    if (newsCache.key !== key) newsCache = { key, items: newsAt(ctx.system, ctx.now) };
    return newsCache.items;
  }

  // --- Order book --------------------------------------------------------------

  function renderBtcBook() {
    const q = heardQuote();
    $('.ex-book [data-pane="book"]').textContent = 'The broker';
    $('.ex-book-head').hidden = true;
    $('.ex-asks').innerHTML = `<div class="ex-quote"><span>Limit order fee</span><b class="num">${pctFee(FEE.limit)}</b></div>`;
    $('.ex-mid').innerHTML = `<b>${q ? fmt(q.price) : '…'}</b><span>Live · you trade at this price</span>`;
    $('.ex-bids').innerHTML = `<div class="ex-quote"><span>Market order fee</span><b class="num">${pctFee(FEE.market)}</b></div>
      <p class="ex-note">The station is a broker for a market far bigger than any station: your trades don't move the price.</p>`;
  }

  function renderBook(ctx: TradeContext) {
    $('.ex-book [data-pane="book"]').textContent = 'Order book';
    $('.ex-book-head').hidden = false;
    const state = marketState(ctx);
    // As many levels as fit: the book grows with the screen.
    const room = $('.ex-book').clientHeight - 130;
    const levels = Math.max(4, Math.min(16, Math.floor(room / 2 / ROW)));
    const { asks, bids } = orderBook(ctx.system, state, selected, levels);
    const u = unitLabel(commodity());
    $('.ex-book-unit').textContent = `Size (${u})`;
    const rows = (levels: typeof asks, kind: 'ask' | 'bid') => {
      let total = 0;
      const withTotals = levels.map((l) => ({ ...l, total: (total += l.qty) }));
      const max = Math.max(1, total);
      const html = withTotals.map(
        (l) => `<button class="ex-level ${kind}" data-total="${l.total}" data-kind="${kind}" style="--depth:${(l.total / max) * 100}%">
          <span class="num">${fmt(l.price)}</span><span class="num">${l.qty.toLocaleString()}</span><span class="num">${l.total.toLocaleString()}</span></button>`,
      );
      return kind === 'ask' ? html.reverse().join('') : html.join('');
    };
    // The station's own order, if it's short or overstocked, sits at the top of its side.
    const order = tradesHere(ctx, selected) ? stationOrder(ctx.system, state, selected) : null;
    const orderRow = (o: NonNullable<typeof order>) =>
      `<button class="ex-order ${o.side}" data-order="${o.side}" data-total="${o.qty}" title="${o.side === 'buy' ? 'The station is short and buying to restock: deliveries fill this order' : 'The station is overstocked and selling its surplus'}">
        <span>${o.side === 'buy' ? 'Station buying' : 'Station selling'}</span><span class="num">${o.qty.toLocaleString()} ${u}</span><span class="num">avg ${fmt(o.price)}</span></button>`;
    $('.ex-asks').innerHTML = (asks.length ? rows(asks, 'ask') : '<p class="ex-empty">Sold out</p>') + (order?.side === 'sell' ? orderRow(order) : '');
    $('.ex-bids').innerHTML = (order?.side === 'buy' ? orderRow(order) : '') + rows(bids, 'bid');
    const live = quotes(ctx).find((x) => x.commodity.id === selected)!.price;
    const spread = asks.length ? asks[0].price - bids[0].price : 0;
    const was = priceAt(ctx.system, state, selected, ctx.now - HOUR);
    $('.ex-mid').innerHTML = `<b class="${live >= was ? 'up' : 'down'}">${fmt(live)}</b><span>Spread ${fmt(spread, 2)}</span>`;
  }

  // --- Trade form ---------------------------------------------------------------

  // --- Trade form (in the trade window) ------------------------------------------------------
  // As an exchange's order panel (Mark, 11 November 2026: "it should feel like a real exchange"):
  // Buy | Sell, Limit | Market, Price and Amount with steppers, a slider with stops, Total, Avbl,
  // the fee, one button, and one line under it.

  /** The slider's stops: lit up to where the slider is, the last named for what it fills. */
  function renderStops(last: string) {
    const v = Number(slider.value);
    modalAll<HTMLButtonElement>('.ex-ticks [data-pct]').forEach((b) => {
      const p = Number(b.dataset.pct);
      b.classList.toggle('on', v >= p && (p > 0 || v > 0));
      b.querySelector('span')!.textContent = p === 100 ? last : p ? `${p}%` : '0';
    });
    slider.style.setProperty('--fill', `${v}%`);
  }

  /** Side, order type and the colours of the form, all at once. */
  function formFrame() {
    modalAll<HTMLButtonElement>('[data-side]').forEach((b) => b.classList.toggle('active', b.dataset.side === side));
    modalAll<HTMLButtonElement>('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === orderType));
    $('.ex-form').classList.toggle('selling', side === 'sell');
    $('.ex-form').classList.toggle('editing', editing !== null);
    $('.ex-price').hidden = orderType !== 'limit';
  }
  const kv = (k: string, v: string, cls = '') => `<div><dt>${k}</dt><dd class="${cls}">${v}</dd></div>`;

  function renderBtcForm(ctx: TradeContext) {
    const limit = orderType === 'limit';
    $('.ex-types').hidden = false;
    formFrame();
    $('.ex-cancel-order').hidden = true;
    const max = maxQty(ctx);
    if (qty() > max) setQty(max, ctx);
    const buying = side === 'buy';
    $('.ex-qty-unit').textContent = buying ? 'Cr' : 'sats';
    $('.ex-qty-name').textContent = buying ? 'Spend' : 'Amount';
    $('.ex-qty input').removeAttribute('disabled');
    renderStops(buying ? 'Max' : 'All');
    const sats = satsOf(ctx.commander);
    $('.ex-avail').innerHTML = '';
    const q = heardQuote();
    const n = qty();
    const fresh = isFresh(q);
    const at = limitPrice();
    // What you'd get at a price, after the fee: sats for credits, or credits for sats.
    const estimate = (price: number, fee: number) =>
      !price || !n ? null : buying ? { get: formatSats(buyAt(n, price, fee).sats), fee: buyAt(n, price, fee).fee } : { get: `${fmt(sellAt(n, price, fee).total)} Cr`, fee: sellAt(n, price, fee).fee };
    const est = limit ? estimate(at, FEE.limit) : estimate(q?.price ?? 0, FEE.market);
    $('.ex-est').innerHTML = [
      kv('Total', `<b>${est ? est.get : '-'}</b>`),
      kv('Avbl', buying ? `${fmt(ctx.commander.credits)} Cr` : `${formatBtc(sats)}`),
      kv(`Fee ${pctFee(limit ? FEE.limit : FEE.market)}`, est ? `${fmt(est.fee, 2)} Cr` : '-'),
    ].join('');
    let reason = '';
    if (limit && !at) reason = 'Set a price';
    else if (!q && !limit) reason = 'Waiting for the price';
    else if (!fresh && !limit) reason = 'Trading paused: the network is quiet';
    else if (buying && max === 0) reason = 'Not enough credits';
    else if (!buying && sats === 0) reason = 'No Bitcoin in your wallet';
    const submit = $<HTMLButtonElement>('.ex-submit');
    submit.disabled = Boolean(reason) || n === 0 || submitting;
    submit.textContent = submitting ? 'Checking the price…' : reason || `${buying ? 'Buy' : 'Sell'} BTC`;
    $('.ex-fnote').textContent = limit
      ? `Fills when the real price ${buying ? 'falls' : 'rises'} to ${at ? fmt(at, 0) : 'yours'}, while you're away too. ${buying ? 'Credits' : 'Bitcoin'} held until then.`
      : 'Fills now, at the live price. Takes no hold space.';
    $('.ex-msg').textContent = message;
  }

  /** The order being changed, if any, and where it is. */
  function editTarget() {
    if (!editing) return null;
    const state = view().commander.markets[editing.key] as OrderState | undefined;
    const order = state?.orders?.find((o) => o.oid === editing!.oid);
    if (!state || !order) return null;
    const [g, i] = editing.key.split(':').map(Number);
    return { state, order, system: systemAt(g, i) };
  }

  /** Delay for a message to a market: nothing at the station you're at. */
  const delayTo = (system: StarSystem) => {
    const docked = deps.context();
    return system.galaxy === docked.system.galaxy && system.index === docked.system.index ? 0 : newsDelay(system, docked.system);
  };

  function renderForm(ctx: TradeContext) {
    if (isBtc()) return renderBtcForm(ctx);
    const c = commodity();
    const u = unitLabel(c);
    const edit = editTarget();
    if (editing && !edit) editing = null; // filled or gone meanwhile
    if (remote() && orderType !== 'limit') {
      orderType = 'limit';
      suggestPrice(ctx);
    }
    $('.ex-types').hidden = remote() || editing !== null;
    formFrame();
    const limit = orderType === 'limit';
    const max = maxQty(ctx);
    if (!editing && qty() > max) setQty(max, ctx);
    $('.ex-qty-unit').textContent = u;
    $('.ex-qty-name').textContent = 'Amount';
    $('.ex-qty input').toggleAttribute('disabled', editing !== null);
    $('.ex-stops').hidden = editing !== null;
    renderStops(side === 'sell' ? 'All' : limit && (fillStorage || remote()) ? 'Max' : 'Hold');
    // Fill to storage: a limit buy here, only. Remote buys always go to storage there.
    const toggle = $<HTMLButtonElement>('.ex-storage-toggle');
    toggle.hidden = !(limit && side === 'buy' && !remote());
    toggle.classList.toggle('on', fillStorage);
    toggle.setAttribute('aria-pressed', String(fillStorage));
    $('.ex-avail').innerHTML = '';
    const cancelBtn = $<HTMLButtonElement>('.ex-cancel-order');
    cancelBtn.hidden = !edit;
    const submit = $<HTMLButtonElement>('.ex-submit');
    const t = ticker(selected);

    if (edit) {
      // Changing an order's price, or cancelling it: at once here, at the speed of news elsewhere.
      const o = edit.order;
      qtyInput.value = String(o.qty);
      const delay = delayTo(edit.system);
      const at = limitPrice();
      const held = o.side === 'buy' ? Math.max(o.held ?? o.limit, o.limit) : 0;
      const extra = o.side === 'buy' ? Math.max(0, (at - held) * o.qty) : 0;
      $('.ex-est').innerHTML = [
        kv('Now', `${fmt(o.limit, 2)} Cr × ${o.qty.toLocaleString()} ${u}`),
        kv('New total', `<b>${at ? `${fmt(at * o.qty)} Cr` : '-'}</b>`),
        o.side === 'buy' ? kv('Avbl', `${fmt(ctx.commander.credits)} Cr`) : '',
        delay ? kv('Arrives', `in ${age(delay)}`) : '',
      ].join('');
      let why = '';
      if (o.sent !== undefined && o.placed > deps.context().now) why = 'Still on its way: it can only be cancelled';
      else if (o.cancel !== undefined) why = 'Being cancelled';
      else if (!at) why = 'Set a price';
      else if (Math.abs(at - o.limit) < 0.005) why = 'Same price';
      else if (extra > ctx.commander.credits) why = 'Not enough credits';
      submit.disabled = Boolean(why);
      submit.textContent = why || `Change price · ${t}`;
      cancelBtn.disabled = o.cancel !== undefined;
      $('.ex-fnote').textContent = delay
        ? `${edit.system.name} is ${distanceLy(deps.context().system, edit.system).toFixed(1)} LY away: a change or a cancel arrives in ${age(delay)}, and the order can fill at its old price until then.`
        : 'At this station: a change or a cancel is at once.';
      $('.ex-msg').textContent = message;
      return;
    }

    const held = ctx.commander.cargo[selected] ?? 0;
    const n = qty();
    const state = marketState(ctx);
    const avbl = remote()
      ? side === 'buy'
        ? `${fmt(ctx.commander.credits)} Cr`
        : `${storedThere(ctx, selected).toLocaleString()} ${u} in storage`
      : side === 'buy'
        ? `${fmt(ctx.commander.credits)} Cr`
        : `${held.toLocaleString()} ${u}`;
    if (limit) {
      const value = n * limitPrice();
      const fee = remote() ? Math.round(value * BROKER_FEE * 10) / 10 : 0;
      $('.ex-est').innerHTML = [
        kv('Total', `<b>${value ? `${fmt(value)} Cr` : '-'}</b>`),
        kv('Avbl', avbl),
        side === 'buy' && !remote() ? kv('Hold space', `${fmt(freeTonnes(ctx))} t`) : '',
        kv(remote() ? `Broker ${(BROKER_FEE * 100).toFixed(0)}%` : 'Fee', remote() ? (fee ? `${fmt(fee)} Cr` : '-') : 'None'),
      ].join('');
      let why = '';
      if (!tradesHere(ctx, selected)) why = 'Not traded openly there';
      else if (side === 'sell' && (remote() ? storedThere(ctx, selected) : held) === 0) why = remote() ? `No ${c.name} in storage there` : `No ${c.name} in your hold`;
      else if (side === 'buy' && value + fee > ctx.commander.credits) why = 'Not enough credits';
      else if (!limitPrice()) why = 'Set a price';
      submit.disabled = Boolean(why) || n === 0;
      submit.textContent = why || `${side === 'buy' ? 'Buy' : 'Sell'} ${t}`;
      $('.ex-fnote').textContent = remote()
        ? `Sent to ${ctx.system.name}: arrives in ${age(newsDelay(ctx.system, deps.context().system))}, then waits for your price. ${side === 'buy' ? `→ storage at ${ctx.system.name}.` : 'Sells from your storage there.'}`
        : `Fills when the price ${side === 'buy' ? 'falls' : 'rises'} to ${limitPrice() ? fmt(limitPrice(), 2) : 'yours'}, while you're away too. ${side === 'buy' ? 'Credits' : 'Goods'} held until then.${
            side === 'buy' && n > holdRoom(ctx) ? ` ${(n - holdRoom(ctx)).toLocaleString()} ${u} won't fit your hold: ${n - holdRoom(ctx) === 1 ? 'it waits' : 'they wait'} in storage at ${ctx.system.name}.` : ''
          }`;
      $('.ex-msg').textContent = message;
      return;
    }
    const best = side === 'buy' ? orderBook(ctx.system, state, selected, 1).asks[0]?.price : orderBook(ctx.system, state, selected, 1).bids[0]?.price;
    let total = 0;
    if (n > 0) {
      // A dry run on a copy of the commander shows exactly what the trade would cost.
      const copy = JSON.parse(JSON.stringify(ctx.commander)) as typeof ctx.commander; // not structuredClone: Safari before 15.4 hasn't it (a player at Lave couldn't buy food)
      const trial = { ...ctx, commander: copy };
      const before = copy.credits;
      const r = side === 'buy' ? buy(trial, selected, n) : sell(trial, selected, n);
      if (r.ok) total = Math.abs(copy.credits - before);
    }
    const avg = n > 0 && total ? total / n : 0;
    const impact = avg && best ? (side === 'buy' ? avg / best - 1 : 1 - avg / best) : 0;
    $('.ex-est').innerHTML = [
      kv('Total', `<b>${total ? `${fmt(total)} Cr` : '-'}</b>${total && inLocal(ctx, total) ? `<small class="ex-local">${inLocal(ctx, total)}</small>` : ''}`),
      kv('Avg price', avg ? `${fmt(avg, 2)} Cr` : '-'),
      `<div><dt title="How far your own trade walks the station's price: it's dearer for each tonne you buy, and cheaper for each you sell">Price impact</dt><dd class="${impact > 0.02 ? 'warn' : ''}">${avg ? `${side === 'buy' ? '+' : '−'}${(impact * 100).toFixed(impact < 0.1 ? 1 : 0)}%` : '-'}</dd></div>`,
      kv('Avbl', avbl),
      side === 'buy' ? kv('Hold space', `${fmt(freeTonnes(ctx))} t`) : '',
    ].join('');
    let reason = '';
    if (!tradesHere(ctx, selected)) reason = 'Not traded at this lawful station';
    else if (side === 'buy' && max === 0) reason = quotes(ctx).find((x) => x.commodity.id === selected)!.stock <= 0 ? 'Out of stock' : freeTonnes(ctx) < 1 / UNITS_PER_TONNE[c.unit] ? 'Hold full' : 'Not enough credits';
    else if (side === 'sell' && held === 0) reason = `No ${c.name} in your hold`;
    else if (side === 'sell' && max === 0) reason = 'Stolen: try a fence in the back room';
    submit.disabled = Boolean(reason) || n === 0;
    submit.textContent = reason || `${side === 'buy' ? 'Buy' : 'Sell'} ${t}`;
    $('.ex-fnote').textContent = `Fills now, at the station's prices: the more you ${side}, the further the price moves.`;
    $('.ex-msg').textContent = message;
  }

  // --- The trade window ----------------------------------------------------------------------

  /** Open the trade window on the good on screen, set up as asked. You still confirm. */
  function openModal(o: { side?: 'buy' | 'sell'; type?: 'market' | 'limit'; price?: number; qty?: number } = {}) {
    editing = null;
    if (o.side) side = o.side;
    if (o.type) orderType = o.type;
    message = '';
    qtyInput.value = '';
    slider.value = '0';
    showModal();
    if (orderType === 'limit') {
      if (o.price) priceInput.value = isBtc() ? String(Math.round(o.price)) : o.price.toFixed(2);
      else suggestPrice(view());
    }
    if (o.qty) setQty(o.qty);
    renderForm(view());
  }

  /** Change or cancel an order ("galaxy:index:oid"), optionally at a new price picked on the chart. */
  function openEdit(ref: string, price?: number) {
    const [g, i, oid] = ref.split(':').map(Number);
    const key = `${g}:${i}`;
    const state = deps.context().commander.markets[key] as OrderState | undefined;
    const order = state?.orders?.find((x) => x.oid === oid);
    if (!order) return render();
    const docked = deps.context();
    const sys = systemAt(g, i);
    viewing = sys.index === docked.system.index && sys.galaxy === docked.system.galaxy ? null : sys;
    selected = order.id;
    side = order.side;
    orderType = 'limit';
    editing = { key, oid };
    message = '';
    priceInput.value = (price ?? order.amend?.limit ?? order.limit).toFixed(2);
    showModal();
  }

  function closeModal() {
    closeQuietly();
    render();
  }

  /** The good on screen, as the trade window's drawing needs it. */
  const windowView = (ctx: TradeContext): WindowView => ({ id: selected, remote: remote(), stored: isBtc() ? 0 : storedThere(ctx, selected) });

  function renderModal(ctx: TradeContext) {
    if (!modalOpen) return;
    $('.ex-mhead').innerHTML = headHtml(ctx, windowView(ctx), editing !== null);
    $('.ex-mbook').innerHTML = bookHtml(ctx, selected, phone.matches ? 5 : 7);
    const docked = deps.context();
    $('.ex-orders-all').innerHTML = ordersPanel(docked.commander, docked.system, docked.now, otab, phone.matches);
  }

  /** How many orders you have open, every market. */
  const ordersOpen = () => openCount(deps.context().commander, deps.context().system, deps.context().now);
  const renderActions = (ctx: TradeContext) => ($('.ex-actions').innerHTML = actionsHtml(ctx, windowView(ctx), ordersOpen(), modalOpen ? '' : message));

  function updateOverlay(ctx: TradeContext) {
    overlay.update({ ...chartState(ctx, selected, deps.context().now), decimals: isBtc() ? 0 : 2, enabled: !backOpen });
  }

  // --- Your trades ----------------------------------------------------------------

  function renderBtcTrades(ctx: TradeContext) {
    const t = btcTradesHtml(ctx.commander, ordersOpen());
    $('.ex-mine h4').textContent = t.title;
    $('.ex-trades-list').innerHTML = t.html;
  }

  const renderFeed = (ctx: TradeContext) => ($('.ex-feed-list').innerHTML = feedHtml(ctx, selected));

  function renderTrades(ctx: TradeContext) {
    const t = tradesHtml(ctx, remote(), ordersOpen());
    $('.ex-mine h4').textContent = t.title;
    $('.ex-trades-list').innerHTML = t.html;
  }

  // --- The back room -------------------------------------------------------------------

  let backOpen = false;
  let backMessage = '';
  let backCaught = false;

  function renderBackRoom(ctx: TradeContext) {
    const room = backRoomHtml(ctx, backMessage, backCaught);
    $<HTMLButtonElement>('.ex-backroom-toggle').hidden = remote() || !room.there;
    if (backOpen) $('.ex-back').innerHTML = room.html;
  }

  function setBackOpen(open: boolean) {
    backOpen = open;
    $('.ex-back').hidden = !open;
    applyPanes();
  }

  // --- Trade computer ----------------------------------------------------------------

  // Answers, not a spreadsheet (Mark, 1 November 2026: "The trading computer feels awkward"): each run is
  // a card with its profit first and its two buttons on it. On a computer it sits beside the chart,
  // sharing the column with the order book, so you see the candles of the run you pick; on a phone it
  // has the screen to itself.
  let routesOpen = false; // on a phone: the trade computer has the screen
  let pane: 'runs' | 'book' = 'runs'; // on a computer: what the column beside the chart shows
  let safeOnly = false;
  const safe = (s: StarSystem) => s.government > 1;

  /** On a computer, the column beside the chart shows the runs (not for Bitcoin, or a market you're only viewing). */
  const runsShown = () => (phone.matches ? routesOpen : pane === 'runs' && !isBtc() && !remote());

  function renderRoutes(ctx: TradeContext) {
    if (!runsShown()) return;
    const c = ctx.commander;
    const courseButton = (s: StarSystem) =>
      s.index === c.target ? '<span class="ex-on-course">On course</span>' : `<button data-course="${s.index}">Set course</button>`;
    const where = (s: StarSystem) => `<button type="button" class="sys-link" data-system="${s.index}" title="Show ${s.name} on the chart">${s.name}</button>`;
    const meta = (s: StarSystem, ly: number, ago: number) =>
      `${ly.toFixed(1)} LY${ly > c.fuel ? ' · refuel first' : ''}${risk(s)} · news ${age(ago)} old`;
    const list = runs(ctx).filter((r) => !safeOnly || safe(r.dest)).slice(0, 12);
    const outlets = bestOutlets(ctx).filter((o) => o.dest && o.proceeds > o.here && (!safeOnly || safe(o.dest)));
    const cards = list
      .map((r) => {
        const good = commodityById(r.id)!;
        const u = unitLabel(good);
        return `<div class="ex-run-card${r.id === selected ? ' active' : ''}">
          <div class="ex-run-top"><span><button class="ex-run-good" data-route-open="${r.id}" title="Open ${good.name}: its chart and the trade form">${good.name}</button> → ${where(r.dest)}</span><b class="up">+${fmt(r.profit, 0)} Cr</b></div>
          <div class="ex-run-line">Buy ${r.qty.toLocaleString()} ${u} here at ${fmt(r.cost / r.qty)} · sell about ${fmt(r.proceeds / r.qty)}</div>
          <div class="ex-run-meta">${meta(r.dest, r.ly, r.age)}</div>
          <div class="ex-run-actions"><button class="ex-run-buy" data-route-buy="${r.id}" data-n="${r.qty}">Buy ${r.qty.toLocaleString()} ${u}</button>${courseButton(r.dest)}</div>
        </div>`;
      })
      .join('');
    const held = outlets
      .map((o) => {
        const good = commodityById(o.id)!;
        return `<div class="ex-run-card">
          <div class="ex-run-top"><span><button class="ex-run-good" data-route-open="${o.id}">${good.name}</button> <small>${o.held.toLocaleString()} ${unitLabel(good)} aboard</small> → ${where(o.dest!)}</span><b class="up">+${fmt(o.proceeds - o.here, 0)} Cr</b></div>
          <div class="ex-run-line">About ${fmt(o.proceeds, 0)} Cr there, ${fmt(o.here, 0)} Cr here</div>
          <div class="ex-run-meta">${meta(o.dest!, o.ly, o.age)}</div>
          <div class="ex-run-actions">${courseButton(o.dest!)}</div>
        </div>`;
      })
      .join('');
    const tab = (p: typeof pane, label: string) => `<button data-pane="${p}" role="tab" class="${pane === p ? 'active' : ''}">${label}</button>`;
    $('.ex-routes').innerHTML = `
      <div class="ex-panes" role="tablist">${tab('runs', 'Trade computer')}${tab('book', 'Order book')}</div>
      <header class="ex-routes-head"><button class="ex-routes-close">‹ Exchange</button><h3>Trade computer</h3></header>
      <p class="ex-routes-intro">The best runs from ${ctx.system.name} for a full load, as you know the markets within ${FUEL_CAPACITY} LY. Prices may have moved since the news.</p>
      <div class="ex-filter" role="group" aria-label="Which runs"><button data-safe="0" class="${safeOnly ? '' : 'active'}">All</button><button data-safe="1" class="${safeOnly ? 'active' : ''}" title="Leave out anarchies and feudal worlds, where pirates rule">Safe systems only</button></div>
      ${cards ? `<div class="ex-runs">${cards}</div>` : `<p class="ex-empty">${safeOnly ? 'No run to a safe system pays from here. Try All.' : 'Nothing here sells for more within range. Try the news, or another station.'}</p>`}
      ${held ? `<h4>Your hold: better markets</h4><div class="ex-runs">${held}</div>` : ''}
      <p class="ex-note">A full load is as much as your credits, hold and the stock here allow. Profits include how much your own buying and selling moves the price. The further away, the older the news.</p>`;
  }

  /** Which of the exchange's screens are on show. */
  function applyPanes() {
    const shown = runsShown();
    const ex = root.querySelector<HTMLElement>('.ex')!;
    ex.classList.toggle('runs', shown && !phone.matches);
    $('.ex-routes').hidden = !shown;
    $('.ex-book').hidden = shown && !phone.matches;
    ex.hidden = backOpen || (phone.matches && routesOpen);
    root.querySelectorAll<HTMLButtonElement>('.ex-book [data-pane]').forEach((b) => b.classList.toggle('active', b.dataset.pane === (shown ? 'runs' : 'book')));
    $('.ex-book [data-pane="runs"]').hidden = isBtc() || remote();
  }

  function setRoutesOpen(open: boolean) {
    if (phone.matches) routesOpen = open;
    else pane = open ? 'runs' : 'book';
    applyPanes();
    if (open) renderRoutes(view());
  }

  function render(newMessage?: string) {
    if (newMessage !== undefined) message = newMessage;
    const docked = deps.context();
    // Orders that filled since we last looked, and goods waiting in storage.
    const state = marketState(docked) as OrderState;
    const notes = (state.fills ?? []).map(describeFill);
    state.fills = [];
    const moved = collect(docked.commander, state, docked.capacity);
    for (const [id, q] of Object.entries(moved)) notes.push(`Collected ${q.toLocaleString()} ${unitLabel(commodityById(id)!)} of ${commodityById(id)?.name} from storage`);
    // Orders sent elsewhere, as far as news of them has come back.
    for (const { system, fill } of checkSentOrders(docked.commander, docked.system, docked.now)) notes.push(`News from ${system.name}: ${describeFill(fill)}`);
    for (const { system, order } of takeCancelled(docked.commander)) notes.push(`News from ${system.name}: order cancelled, ${order.qty.toLocaleString()} ${unitLabel(commodityById(order.id)!)} of ${commodityById(order.id)?.name}${order.side === 'buy' ? ': credits back' : ': goods back in storage there'}`);
    renderChooser();
    const ctx = view();
    if (notes.length) {
      deps.traded({ ok: true, message: notes.join(' · ') });
      return;
    }
    if (isBtc() && remote()) selected = 'food'; // one price everywhere: Bitcoin is traded where you are
    renderBackRoom(ctx);
    renderPairs(ctx);
    placeForPhone();
    applyPanes();
    renderRoutes(ctx);
    root.querySelector('.ex')!.classList.toggle('btc', isBtc());
    $('.ex-feed').hidden = isBtc();
    if (isBtc()) {
      renderBtcHead(ctx);
      renderBtcChart(ctx);
      renderBtcBook();
      renderForm(ctx);
      renderBtcTrades(ctx);
      renderActions(ctx);
      renderModal(ctx);
      updateOverlay(ctx);
      return;
    }
    renderHead(ctx);
    renderChart(ctx);
    renderBook(ctx);
    renderForm(ctx);
    renderFeed(ctx);
    renderTrades(ctx);
    renderActions(ctx);
    renderModal(ctx);
    updateOverlay(ctx);
  }

  // A phone (docs/design/flight-hud-and-touch.md, "The Market on a phone"): the list first, and the
  // good you tap opens as a screen of its own, with "‹ All goods" to go back (Mark, 1 November 2026: the
  // candles were folded away and nobody saw them). From the top: its price, its candles, the best place to
  // sell it, the trade form; only the order book and trades fold away. A computer keeps the full exchange.
  const phone = window.matchMedia('(max-width: 700px) and (orientation: portrait), (max-height: 500px)'); // a phone either way up
  let phoneOpen = false; // a good has the screen, not the list
  let openedAt = ''; // the station the exchange last opened at
  const inline = document.createElement('div');
  inline.className = 'ex-inline';
  const bestSlot = document.createElement('div');
  bestSlot.className = 'ex-best-slot';
  const backToList = document.createElement('button');
  backToList.className = 'ex-phone-back';
  backToList.textContent = '‹ All goods';
  const head = $('.ex-head');
  const form = $('.ex-actions');
  const more = [$('.ex-more-toggle'), $('.ex-book'), $('.ex-trades')];
  function placeForPhone() {
    const ex = root.querySelector<HTMLElement>('.ex')!;
    root.classList.toggle('ex-phone', phone.matches);
    if (phone.matches) {
      if (!inline.firstChild) inline.append(backToList, head, $('.ex-chart'), bestSlot, form, ...more);
      if (inline.parentNode !== ex) ex.append(inline);
      if ($('.ex-routes').parentNode !== root) root.insertBefore($('.ex-routes'), $('.ex-back'));
      ex.classList.toggle('good-open', phoneOpen);
    } else {
      if (inline.firstChild) {
        $('.ex-pairs').append(more[0]);
        ex.append(...[...inline.childNodes].filter((n) => n !== backToList && n !== bestSlot));
        inline.replaceChildren();
        inline.remove();
      }
      if ($('.ex-routes').parentNode !== ex) ex.append($('.ex-routes'));
      ex.classList.remove('good-open');
    }
  }
  /** On a phone: open a good's own screen, or go back to the list. */
  function openOnPhone(open: boolean) {
    phoneOpen = open;
    chartKey = ''; // it had no width while the list was on show: fit it now it has
    render();
    if (open) root.closest('.panel')?.scrollTo({ top: 0 });
    else root.querySelector('.ex-pairs-list .ex-pair.active')?.scrollIntoView({ block: 'center' });
  }
  phone.addEventListener('change', placeForPhone);

  /** The price and candles, asked again as they age (each is kept a while, so this is cheap). */
  let refreshing = false;
  function refreshBtc() {
    if (refreshing) return;
    refreshing = true;
    const [, count] = INTERVALS[interval];
    void Promise.all([btcQuote(), btcCandles('5m', 60), btcCandles('1h', 48), isBtc() ? btcCandles(interval, count) : null])
      .then(() => checkBtcOrders(deps.context().commander))
      .then((fills) => fills.length && deps.traded({ ok: true, message: fills.join(' · ') }))
      .finally(() => (refreshing = false));
  }
  let submitting = false;
  function showModal() {
    modalOpen = true;
    modalEl.hidden = false;
    document.body.classList.add('ex-modal-open');
    render();
  }
  /** Done: the window closes, and the page shows what happened. */
  function closeQuietly() {
    modalOpen = false;
    editing = null;
    modalEl.hidden = true;
    document.body.classList.remove('ex-modal-open');
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modalOpen) closeModal();
  });

  // --- Events ------------------------------------------------------------------------

  const onClick = (e: MouseEvent) => {
    // A tap on the dimmed page behind the trade window closes it.
    if ((e.target as HTMLElement).classList.contains('ex-modal')) return closeModal();
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    el.blur();
    if (el.classList.contains('ex-mclose')) return closeModal();
    if (el.dataset.open) return openModal({ side: el.dataset.open as 'buy' | 'sell', type: remote() ? 'limit' : orderType });
    if (el.dataset.openOrders) {
      otab = 'open';
      openModal({});
      $('.ex-orders-all').scrollIntoView({ block: 'start' });
      return;
    }
    if (el.dataset.otab) {
      otab = el.dataset.otab as OrdersTab;
      return render();
    }
    if (el.dataset.mprice) {
      // A level in the book: its price, as a limit order.
      orderType = 'limit';
      priceInput.value = el.dataset.mprice;
      return render();
    }
    if (el.dataset.oedit) return openEdit(el.dataset.oedit);
    if (el.dataset.ocancel) {
      const [g, i, oid] = el.dataset.ocancel.split(':').map(Number);
      const sys = systemAt(g, i);
      const docked = deps.context();
      const result = requestCancel(docked.commander, docked.commander.markets[`${g}:${i}`] as OrderState, oid, docked.capacity, docked.now, delayTo(sys), sys.name);
      message = result.message;
      deps.traded(result);
      return;
    }
    if (el.dataset.ostore) {
      // Sell what's waiting in storage at another market: a sell order sent there.
      const [g, i, id] = el.dataset.ostore.split(':');
      const docked = deps.context();
      const sys = systemAt(Number(g), Number(i));
      viewing = sys.galaxy === docked.system.galaxy && sys.index === docked.system.index ? null : sys;
      selected = id;
      openModal({ side: 'sell', type: 'limit' });
      setQty(storedThere(view(), id));
      renderForm(view());
      return;
    }
    if (el.dataset.step) {
      const [what, dir] = el.dataset.step.split(':');
      const d = Number(dir);
      if (what === 'price') {
        const step = isBtc() ? 10 : limitPrice() >= 100 ? 0.5 : 0.1;
        const base = limitPrice() || (isBtc() ? (heardQuote()?.price ?? 0) : quotes(view()).find((x) => x.commodity.id === selected)!.price);
        priceInput.value = isBtc() ? String(Math.max(0, Math.round(base + d * step))) : Math.max(0.01, base + d * step).toFixed(2);
      } else {
        const step = isBtc() ? (side === 'buy' ? 100 : 100_000) : 1;
        setQty(qty() + d * step);
      }
      return renderForm(view());
    }
    if (el.classList.contains('ex-cancel-order')) {
      const t = editTarget();
      if (!t) return closeModal();
      const docked = deps.context();
      const result = requestCancel(docked.commander, t.state, t.order.oid, docked.capacity, docked.now, delayTo(t.system), t.system.name);
      message = result.message;
      if (result.ok) closeQuietly();
      deps.traded(result);
      return;
    }
    if (el.classList.contains('ex-submit') && editing) {
      const t = editTarget();
      if (!t) return closeModal();
      const docked = deps.context();
      const result = amendOrder(docked.commander, t.system, t.state, t.order.oid, limitPrice(), docked.now, delayTo(t.system));
      message = result.message;
      if (result.ok) closeQuietly();
      deps.traded(result);
      return;
    }
    if (el.classList.contains('ex-routes-toggle') || el.classList.contains('ex-runs-open')) {
      setRoutesOpen(true);
      return;
    } else if (el.classList.contains('ex-routes-close')) {
      setRoutesOpen(false);
      return;
    } else if (el.classList.contains('ex-phone-back')) {
      openOnPhone(false);
      return;
    } else if (el.dataset.pane) {
      setRoutesOpen(el.dataset.pane === 'runs');
      return;
    } else if (el.dataset.safe) {
      safeOnly = el.dataset.safe === '1';
      renderRoutes(view());
      return;
    } else if (el.dataset.course) {
      const ctx = view();
      deps.setCourse(systemAt(ctx.system.galaxy, Number(el.dataset.course)));
      render();
      return;
    } else if (el.dataset.routeBuy || el.dataset.routeOpen) {
      // A run: its good on screen, with its candles. "Buy" also fills the form with the full load; you still confirm.
      selected = (el.dataset.routeBuy ?? el.dataset.routeOpen)!;
      side = el.dataset.routeBuy || !(view().commander.cargo[selected] ?? 0) ? 'buy' : 'sell';
      orderType = 'market';
      message = '';
      qtyInput.value = '';
      slider.value = '0';
      if (phone.matches) {
        routesOpen = false;
        openOnPhone(true);
      } else render();
      if (el.dataset.routeBuy) openModal({ side: 'buy', type: 'market', qty: Number(el.dataset.n) });
      return;
    } else if (el.classList.contains('ex-backroom-toggle')) {
      backMessage = '';
      setBackOpen(true);
    } else if (el.classList.contains('ex-back-close')) {
      setBackOpen(false);
    } else if (el.dataset.back) {
      const ctx = view();
      const result = backRoomTrade(ctx.commander, ctx.system, marketState(ctx), el.dataset.good!, el.dataset.back as 'buy' | 'sell', Number(el.dataset.n), ctx.capacity, ctx.now);
      backMessage = result.message;
      backCaught = result.caught;
      deps.dealt(result);
      return;
    } else if (el.dataset.fence) {
      const ctx = view();
      const result = fenceSell(ctx.commander, ctx.system, marketState(ctx), el.dataset.fence, Number(el.dataset.n), ctx.now);
      backMessage = result.message;
      backCaught = result.caught;
      deps.dealt(result);
      return;
    } else if (el.dataset.free) {
      const ctx = view();
      const result = freeSlaves(ctx.commander, ctx.system, Number(el.dataset.free), ctx.now);
      backMessage = result.message;
      backCaught = false;
      deps.dealt(result);
      return;
    } else if (el.classList.contains('ex-rest-toggle')) {
      restOpen = !restOpen;
    } else if (el.classList.contains('ex-more-toggle')) {
      const open = root.querySelector('.ex')!.classList.toggle('more-open');
      el.setAttribute('aria-expanded', String(open));
      el.querySelector('span')!.textContent = open ? 'Hide ▴' : 'Show ▾';
      if (open) render(); // the book was drawn folded away: draw it again now it has room
      return;
    } else if (el.dataset.id) {
      selected = el.dataset.id;
      if (phone.matches && !phoneOpen) {
        phoneOpen = true;
        chartKey = '';
        requestAnimationFrame(() => root.closest('.panel')?.scrollTo({ top: 0 }));
      }
      if (isBtc()) refreshBtc();
      if (orderType === 'limit') queueMicrotask(() => suggestPrice(view()));
      message = '';
      qtyInput.value = '';
      slider.value = '0';
      // From the lists: Buy or Sell is ready for it.
      if (el.dataset.quick) side = el.dataset.quick as 'buy' | 'sell';
    } else if (el.dataset.side) {
      side = el.dataset.side as 'buy' | 'sell';
      qtyInput.value = '';
      slider.value = '0';
      message = '';
      if (orderType === 'limit') suggestPrice(view());
    } else if (el.dataset.type) {
      orderType = el.dataset.type as 'market' | 'limit';
      qtyInput.value = '';
      slider.value = '0';
      message = '';
      if (orderType === 'limit') suggestPrice(view());
    } else if (el.dataset.storage) {
      fillStorage = !fillStorage;
      const ctx = view();
      if (qty() > maxQty(ctx)) setQty(maxQty(ctx), ctx);
      else setQty(qty(), ctx); // the slider's share of the new maximum
    } else if (el.dataset.interval) {
      interval = el.dataset.interval as Interval;
    } else if (el.dataset.pct) {
      setQty((maxQty(view()) * Number(el.dataset.pct)) / 100);
    } else if (el.dataset.order) {
      // Fill the station's order: sell into a buy order, buy from a sell order.
      return openModal({ side: el.dataset.order === 'buy' ? 'sell' : 'buy', type: 'market', qty: Number(el.dataset.total) });
    } else if (el.dataset.kind) {
      // Clicking a level opens the trade window: asks to buy, bids to sell, down to that level.
      return openModal({ side: el.dataset.kind === 'ask' ? 'buy' : 'sell', type: 'market', qty: Number(el.dataset.total) });
    } else if (el.classList.contains('ex-submit') && isBtc() && orderType === 'limit') {
      const ctx = view();
      const result = placeBtcOrder(ctx.commander, side, qty(), limitPrice());
      if (result.ok) {
        qtyInput.value = '';
        slider.value = '0';
        closeQuietly();
      }
      message = result.message;
      deps.traded(result);
      return;
    } else if (el.dataset.btcCancel) {
      const result = cancelBtcOrder(view().commander, Number(el.dataset.btcCancel));
      message = result.message;
      deps.traded(result);
      return;
    } else if (el.classList.contains('ex-submit') && isBtc()) {
      // Fair fills: the trade goes through at the price as it is now, asked fresh.
      const n = qty();
      const buying = side === 'buy';
      submitting = true;
      renderBtcForm(view());
      void btcQuote(0).then((q) => {
        submitting = false;
        const ctx = view();
        const result = buying ? buyBitcoin(ctx.commander, q, n) : sellBitcoin(ctx.commander, q, n);
        if (result.ok) {
          qtyInput.value = '';
          slider.value = '0';
          closeQuietly();
        }
        message = result.message;
        deps.traded(result);
      });
      return;
    } else if (el.classList.contains('ex-submit')) {
      const ctx = view();
      const n = qty();
      const docked = deps.context();
      const result = remote()
        ? sendOrder(ctx.commander, ctx.system, marketState(ctx) as OrderState, selected, side, n, limitPrice(), docked.now, newsDelay(ctx.system, docked.system))
        : orderType === 'limit'
          ? placeOrder(ctx.commander, ctx.system, marketState(ctx) as OrderState, selected, side, n, limitPrice(), ctx.now)
          : side === 'buy'
            ? buy(ctx, selected, n)
            : sell(ctx, selected, n);
      if (result.ok) {
        qtyInput.value = '';
        slider.value = '0';
        closeQuietly();
      }
      message = result.message;
      deps.traded(result);
      return;
    } else return;
    render();
  };
  root.addEventListener('click', onClick);
  modalEl.addEventListener('click', onClick);
  $<HTMLSelectElement>('.ex-market select').addEventListener('change', (e) => {
    const v = (e.target as HTMLSelectElement).value;
    const docked = deps.context();
    viewing = v === '' ? null : systemAt(docked.system.galaxy, Number(v));
    message = '';
    qtyInput.value = '';
    slider.value = '0';
    if (!viewing) orderType = 'market';
    render();
  });
  qtyInput.addEventListener('input', () => {
    const ctx = view();
    const max = maxQty(ctx);
    if (qty() > max) qtyInput.value = String(max);
    slider.value = String(max ? Math.round((qty() / max) * 100) : 0);
    renderForm(ctx);
  });
  priceInput.addEventListener('input', () => renderForm(view()));
  slider.addEventListener('input', () => {
    const ctx = view();
    const v = Number(slider.value);
    setQty((maxQty(ctx) * v) / 100, ctx);
    slider.value = String(v); // keep the thumb where the finger is
    renderForm(ctx);
  });
  return {
    render,
    /** Prices move while you watch: refresh every couple of seconds while open. */
    start() {
      if (timer) return;
      refreshBtc();
      timer = window.setInterval(() => {
        // Everything, including orders that have filled and goods to collect. Not while you're typing a
        // price or a quantity: on a phone, redrawing moves the form, which closed the keyboard every two
        // seconds (Mark: "doesnt let me enter the price!"). It catches up as soon as you're done.
        if (root.offsetParent && !document.hidden && document.activeElement !== priceInput && document.activeElement !== qtyInput) {
          refreshBtc();
          render();
        }
      }, 2000);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    /** Open on something you're carrying, if anything; at a new station with an empty hold, on the good with
     *  the best run from here (Mark: it opened on whatever came first, worth buying or not). */
    selectHeld(cargo: Record<string, number>) {
      const held = Object.keys(cargo).find((id) => cargo[id] > 0);
      const ctx = deps.context();
      const here = `${ctx.system.galaxy}:${ctx.system.index}`;
      const arrived = here !== openedAt;
      openedAt = here;
      if (arrived) phoneOpen = false; // a new station: its list first
      if (held && !cargo[selected]) selected = held;
      else if (!held && arrived) selected = runs(ctx)[0]?.id ?? selected;
    },
  };
}

// --- Chart time ------------------------------------------------------------------------

// Lightweight Charts shows times as UTC, so shift them to read as local time.
const offset = (t: number) => new Date(t).getTimezoneOffset() * 60;
const toChartTime = (t: number) => (Math.floor(t / 1000) - offset(t)) as UTCTimestamp;
const fromChartTime = (t: UTCTimestamp) => (t + offset(t * 1000)) * 1000;

/** Lawless worlds pay a danger premium; say so, so the best runs are a real choice. */
const risk = (s: StarSystem) =>
  s.government <= 1 ? ` <em class="ex-risk high">${GOVERNMENTS[s.government]} · pirates</em>` : s.government <= 3 ? ` <em class="ex-risk">${GOVERNMENTS[s.government]}</em>` : '';


const UP = '#2ebd85';
const DOWN = '#f6465d';
