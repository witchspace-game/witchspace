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
import { candles, drift, equilibriumPrice, orderBook, priceAt, recentTrades, stationOrder, tradeBalance } from '../economy/market';
import { buy, freeTonnes, marketState, maxBuyable, quotes, sell, tradesHere, type TradeContext, type TradeResult } from '../economy/trade';

// The station market as a trading exchange, in the style of today's crypto
// exchanges: a list of pairs against the credit, a candlestick chart, the
// order book and a trade form. Everything shown comes from the living market
// itself: the book is the station's real pricing curve, the chart is the
// market's real price history (TradingView's open-source Lightweight
// Charts), and the trades feed is every trade, other traders' and yours.
//
// TradingView Lightweight Charts™ Copyright (c) TradingView, Inc. https://www.tradingview.com/
// Licensed under the Apache License 2.0; the chart shows TradingView's attribution logo.

export interface ExchangeDeps {
  context(): TradeContext;
  /** A trade went through: save, play a sound, refresh the rest of the screen. */
  traded(result: TradeResult): void;
}

const TICKERS: Record<string, string> = {
  food: 'FOOD', textiles: 'TEXT', radioactives: 'RADS', slaves: 'SLAV', liquor: 'LIQR', luxuries: 'LUXR',
  narcotics: 'NARC', computers: 'COMP', machinery: 'MACH', alloys: 'ALOY', firearms: 'ARMS', furs: 'FURS',
  minerals: 'MINR', gold: 'GOLD', platinum: 'PLAT', gems: 'GEMS', alien: 'ALIN',
  water: 'WATR', hydrogen: 'HYDR', electronics: 'ELEC', medicine: 'MEDS',
};
const ticker = (id: string) => TICKERS[id] ?? id.slice(0, 4).toUpperCase();

const INTERVALS = { '5m': [5 * 60_000, 60], '15m': [15 * 60_000, 60], '1h': [3600_000, 48] } as const;
type Interval = keyof typeof INTERVALS;
const HOUR = 3600_000;
const BOOK_LEVELS = 8;

const fmt = (n: number, dp = 1) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
const pct = (n: number) => `${n >= 0 ? '+' : ''}${(n * 100).toFixed(2)}%`;
const unitLabel = (c: Commodity) => (c.unit === 't' ? 't' : c.unit);
const clock = (t: number) => new Date(t).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

export function mountExchange(root: HTMLElement, deps: ExchangeDeps) {
  let selected = 'food';
  let side: 'buy' | 'sell' = 'buy';
  let interval: Interval = '15m';
  let message = '';
  let timer = 0;

  root.innerHTML = `
    <div class="ex">
      <aside class="ex-pairs" aria-label="Markets">
        <div class="ex-pairs-head"><span>Pair</span><span>Price</span><span>1h</span></div>
        <div class="ex-pairs-list"></div>
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
        <h4>Order book</h4>
        <div class="ex-book-head"><span>Price (Cr)</span><span class="ex-book-unit">Size</span><span>Total</span></div>
        <div class="ex-asks"></div>
        <div class="ex-mid"></div>
        <div class="ex-bids"></div>
      </section>
      <section class="ex-form" aria-label="Trade">
        <div class="ex-sides" role="tablist">
          <button data-side="buy" role="tab">Buy</button>
          <button data-side="sell" role="tab">Sell</button>
        </div>
        <p class="ex-ordertype">Market order <span>fills now, at the station's prices</span></p>
        <p class="ex-avail"></p>
        <label class="ex-qty"><span>Quantity</span><input type="number" min="0" step="1" inputmode="numeric" /><b class="ex-qty-unit"></b></label>
        <input class="ex-slider" type="range" min="0" max="100" step="1" value="0" aria-label="Quantity as a share of the most you can trade" />
        <div class="ex-ticks">${[25, 50, 75, 100].map((p) => `<button data-pct="${p}">${p}%</button>`).join('')}</div>
        <dl class="ex-est"></dl>
        <button class="ex-submit"></button>
        <p class="ex-msg" aria-live="polite"></p>
      </section>
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
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const qtyInput = $<HTMLInputElement>('.ex-qty input');
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
  let chartKey = '';
  chart.subscribeCrosshairMove((param: MouseEventParams) => legend(param.seriesData.get(candleSeries) as CandlestickData | undefined, param.time));

  const commodity = () => commodityById(selected)!;
  const index = () => COMMODITIES.findIndex((c) => c.id === selected);
  const maxQty = (ctx: TradeContext) => (side === 'buy' ? maxBuyable(ctx, selected) : (ctx.commander.cargo[selected] ?? 0));
  const qty = () => Math.max(0, Math.floor(Number(qtyInput.value) || 0));

  function setQty(n: number, ctx = deps.context()) {
    const max = maxQty(ctx);
    const q = Math.max(0, Math.min(max, Math.floor(n)));
    qtyInput.value = q ? String(q) : '';
    slider.value = String(max ? Math.round((q / max) * 100) : 0);
  }

  // --- Pairs ------------------------------------------------------------------

  function renderPairs(ctx: TradeContext) {
    const state = marketState(ctx);
    const now = ctx.now;
    $('.ex-pairs-list').innerHTML = quotes(ctx)
      .map((q) => {
        const id = q.commodity.id;
        const was = priceAt(ctx.system, state, id, now - HOUR);
        const change = (q.price - was) / was;
        const held = ctx.commander.cargo[id] ?? 0;
        const off = !tradesHere(ctx, id);
        const order = off ? null : stationOrder(ctx.system, state, id);
        const tag = order ? `<i class="ex-tag ${order.side === 'buy' ? 'short' : 'glut'}">${order.side === 'buy' ? 'Short' : 'Surplus'}</i>` : '';
        return `<button class="ex-pair${id === selected ? ' active' : ''}${off ? ' off' : ''}" data-id="${id}" title="${q.commodity.name}${off ? ' · not traded at this lawful station' : ''}">
          <span class="ex-sym"><b>${ticker(id)}</b>/CR${held ? '<i class="ex-held" title="In your hold"></i>' : ''}${q.commodity.legality === 'illegal' ? '<em title="Illegal goods">Illegal</em>' : ''}${tag}</span>
          <span class="num">${fmt(q.price)}</span>
          <span class="num ${change >= 0 ? 'up' : 'down'}">${pct(change)}</span>
        </button>`;
      })
      .join('');
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
    $('.ex-head').innerHTML = `
      <div class="ex-title"><b>${ticker(selected)}</b><span>/CR</span><small>${c.name} · per ${u}${c.legality === 'illegal' ? ' · <em>Illegal</em>' : ''}</small></div>
      <div class="ex-last ${change >= 0 ? 'up' : 'down'}">${fmt(q.price)}<small>Cr</small></div>
      <dl>
        <div><dt>1h change</dt><dd class="${change >= 0 ? 'up' : 'down'}">${pct(change)}</dd></div>
        <div><dt>1h high</dt><dd>${fmt(high)}</dd></div>
        <div><dt>1h low</dt><dd>${fmt(low)}</dd></div>
        <div><dt>Fair value</dt><dd title="The price if the station's stock were at its usual level">${fmt(fair)}</dd></div>
        <div><dt>Station stock</dt><dd>${q.stock.toLocaleString()} ${u}</dd></div>
        <div><dt>Trade</dt><dd>${role}</dd></div>
        ${demand}
        <div><dt>In your hold</dt><dd>${held.toLocaleString()} ${u}</dd></div>
      </dl>`;
  }

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
    markers.setMarkers(mine);
    legend(undefined);
  }

  // --- Order book --------------------------------------------------------------

  function renderBook(ctx: TradeContext) {
    const state = marketState(ctx);
    const { asks, bids } = orderBook(ctx.system, state, selected, BOOK_LEVELS);
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

  function renderForm(ctx: TradeContext) {
    const c = commodity();
    const u = unitLabel(c);
    root.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.classList.toggle('active', b.dataset.side === side));
    $('.ex-form').classList.toggle('selling', side === 'sell');
    const max = maxQty(ctx);
    if (qty() > max) setQty(max, ctx);
    $('.ex-qty-unit').textContent = u;
    const held = ctx.commander.cargo[selected] ?? 0;
    $('.ex-avail').innerHTML =
      side === 'buy'
        ? `Available <b>${fmt(ctx.commander.credits)} Cr</b> · Hold space <b>${fmt(freeTonnes(ctx))} t</b>`
        : `Available <b>${held.toLocaleString()} ${u}</b> ${ticker(selected)}`;

    const n = qty();
    const state = marketState(ctx);
    const best = side === 'buy' ? orderBook(ctx.system, state, selected, 1).asks[0]?.price : orderBook(ctx.system, state, selected, 1).bids[0]?.price;
    let total = 0;
    if (n > 0) {
      // A dry run on a copy of the commander shows exactly what the trade would cost.
      const copy = structuredClone(ctx.commander);
      const trial = { ...ctx, commander: copy };
      const before = copy.credits;
      const r = side === 'buy' ? buy(trial, selected, n) : sell(trial, selected, n);
      if (r.ok) total = Math.abs(copy.credits - before);
    }
    const avg = n > 0 && total ? total / n : 0;
    const impact = avg && best ? (side === 'buy' ? avg / best - 1 : 1 - avg / best) : 0;
    $('.ex-est').innerHTML = `
      <div><dt>Average price</dt><dd>${avg ? `${fmt(avg, 2)} Cr` : '-'}</dd></div>
      <div><dt>Price impact</dt><dd class="${impact > 0.02 ? 'warn' : ''}">${avg ? pct(impact).replace('+', '') : '-'}</dd></div>
      <div><dt>${side === 'buy' ? 'Total cost' : 'You receive'}</dt><dd><b>${total ? `${fmt(total)} Cr` : '-'}</b></dd></div>`;

    const submit = $<HTMLButtonElement>('.ex-submit');
    let reason = '';
    if (!tradesHere(ctx, selected)) reason = 'Not traded at this lawful station';
    else if (side === 'buy' && max === 0) reason = quotes(ctx).find((x) => x.commodity.id === selected)!.stock <= 0 ? 'Out of stock' : freeTonnes(ctx) < 1 / UNITS_PER_TONNE[c.unit] ? 'Hold full' : 'Not enough credits';
    else if (side === 'sell' && held === 0) reason = `No ${c.name} in your hold`;
    submit.disabled = Boolean(reason) || n === 0;
    submit.textContent = reason || `${side === 'buy' ? 'Buy' : 'Sell'} ${n ? n.toLocaleString() + ' ' + u + ' ' : ''}${ticker(selected)}`;
    $('.ex-msg').textContent = message;
  }

  // --- Your trades ----------------------------------------------------------------

  function renderFeed(ctx: TradeContext) {
    const u = unitLabel(commodity());
    const events = recentTrades(ctx.system, marketState(ctx), selected, ctx.now, 14);
    $('.ex-feed-list').innerHTML = events.length
      ? `<table><thead><tr><th>Price (Cr)</th><th class="num">Qty (${u})</th><th class="num">Time</th></tr></thead><tbody>${events
          .map(
            (e) => `<tr class="${e.by === 'you' ? 'you' : ''}"><td class="${e.side === 'buy' ? 'up' : 'down'}">${fmt(e.price, 2)}</td>
            <td class="num">${e.qty.toLocaleString()}${e.by === 'you' ? ' <em>you</em>' : ''}</td><td class="num">${clock(e.t)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="ex-empty">No trades in the last few hours.</p>';
  }

  function renderTrades(ctx: TradeContext) {
    const trades = (marketState(ctx).trades ?? []).slice().reverse();
    $('.ex-trades-list').innerHTML = trades.length
      ? `<table><thead><tr><th>Time</th><th>Pair</th><th>Side</th><th class="num">Qty</th><th class="num">Avg</th><th class="num">Total</th></tr></thead><tbody>${trades
          .map(
            (t) => `<tr><td>${clock(t.t)}</td><td>${ticker(t.id)}/CR</td><td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? 'Buy' : 'Sell'}</td>
            <td class="num">${t.qty.toLocaleString()}</td><td class="num">${fmt(t.total / t.qty, 2)}</td><td class="num">${fmt(t.total)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="ex-empty">No trades at this station yet.</p>';
  }

  function render(newMessage?: string) {
    if (newMessage !== undefined) message = newMessage;
    const ctx = deps.context();
    renderPairs(ctx);
    renderHead(ctx);
    renderChart(ctx);
    renderBook(ctx);
    renderForm(ctx);
    renderFeed(ctx);
    renderTrades(ctx);
  }

  // --- Events ------------------------------------------------------------------------

  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    el.blur();
    if (el.dataset.id) {
      selected = el.dataset.id;
      message = '';
      qtyInput.value = '';
      slider.value = '0';
    } else if (el.dataset.side) {
      side = el.dataset.side as 'buy' | 'sell';
      qtyInput.value = '';
      slider.value = '0';
      message = '';
    } else if (el.dataset.interval) {
      interval = el.dataset.interval as Interval;
    } else if (el.dataset.pct) {
      setQty((maxQty(deps.context()) * Number(el.dataset.pct)) / 100);
    } else if (el.dataset.order) {
      // Fill the station's order: sell into a buy order, buy from a sell order.
      side = el.dataset.order === 'buy' ? 'sell' : 'buy';
      setQty(Number(el.dataset.total));
    } else if (el.dataset.kind) {
      // Clicking a level fills the form: asks to buy, bids to sell, down to that level.
      side = el.dataset.kind === 'ask' ? 'buy' : 'sell';
      setQty(Number(el.dataset.total));
    } else if (el.classList.contains('ex-submit')) {
      const ctx = deps.context();
      const n = qty();
      const result = side === 'buy' ? buy(ctx, selected, n) : sell(ctx, selected, n);
      if (result.ok) {
        qtyInput.value = '';
        slider.value = '0';
      }
      message = result.message;
      deps.traded(result);
      return;
    } else return;
    render();
  });
  qtyInput.addEventListener('input', () => {
    const ctx = deps.context();
    const max = maxQty(ctx);
    if (qty() > max) qtyInput.value = String(max);
    slider.value = String(max ? Math.round((qty() / max) * 100) : 0);
    renderForm(ctx);
  });
  slider.addEventListener('input', () => {
    const ctx = deps.context();
    setQty((maxQty(ctx) * Number(slider.value)) / 100, ctx);
    renderForm(ctx);
  });
  return {
    render,
    /** Prices move while you watch: refresh every couple of seconds while open. */
    start() {
      if (timer) return;
      timer = window.setInterval(() => {
        if (root.offsetParent && !document.hidden) {
          const ctx = deps.context();
          renderPairs(ctx);
          renderHead(ctx);
          renderChart(ctx);
          renderBook(ctx);
          renderForm(ctx);
          renderFeed(ctx);
        }
      }, 2000);
    },
    stop() {
      clearInterval(timer);
      timer = 0;
    },
    /** Open on something you're carrying, if anything. */
    selectHeld(cargo: Record<string, number>) {
      const held = Object.keys(cargo).find((id) => cargo[id] > 0);
      if (held && !cargo[selected]) selected = held;
    },
  };
}

// --- Chart time ------------------------------------------------------------------------

// Lightweight Charts shows times as UTC, so shift them to read as local time.
const offset = (t: number) => new Date(t).getTimezoneOffset() * 60;
const toChartTime = (t: number) => (Math.floor(t / 1000) - offset(t)) as UTCTimestamp;
const fromChartTime = (t: UTCTimestamp) => (t + offset(t * 1000)) * 1000;

const UP = '#2ebd85';
const DOWN = '#f6465d';
