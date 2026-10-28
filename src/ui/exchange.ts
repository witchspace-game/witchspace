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
import { abolitionistPrice, backRoomQuotes, fenceQuotes, fenceSell, freeSlaves, hasAbolitionists, hasBackRoom, stingChance, backRoomTrade, type BackRoomResult } from '../economy/blackmarket';
import { cleanQty, FUEL_CAPACITY, stolenQty } from '../game/commander';
import { activeEvent, eventsAt, EVENT_KINDS, newsAt, newsDelay, type NewsItem } from '../economy/events';
import { candles, drift, equilibriumPrice, orderBook, priceAt, recentTrades, stationOrder, tradeBalance } from '../economy/market';
import { BROKER_FEE, cancelOrder, collect, describeFill, placeOrder, sendOrder, type OrderState } from '../economy/orders';
import { buy, freeTonnes, marketState, maxBuyable, quotes, sell, tradesHere, type TradeContext, type TradeResult } from '../economy/trade';
import { bestKnownElsewhere, bestOutlets, bestRoutes, checkSentOrders, knownAt, marketsForOrders } from '../economy/routes';
import { distanceLy, GOVERNMENTS, systemAt, type StarSystem } from '../galaxy/generate';
import { btcValue, buyAt, buyBitcoin, cancelBtcOrder, formatBtc, formatSats, isFresh, ordersOf, placeBtcOrder, satsOf, sellAt, sellBitcoin, FEE } from '../economy/bitcoin';
import { btcCandles, btcQuote, checkBtcOrders, heardCandles, heardQuote } from '../net/bitcoin';

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
        <div class="ex-types" role="group" aria-label="Order type">
          <button data-type="market">Market</button><button data-type="limit">Limit</button>
        </div>
        <p class="ex-ordertype"></p>
        <label class="ex-price" hidden><span>Limit price</span><input type="number" min="0" step="0.01" inputmode="decimal" /><b>Cr</b></label>
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

  const commodity = () => commodityById(selected)!;
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
    // A limit buy waits for the price, so it's limited by credits, not stock or hold.
    if (orderType === 'limit') return limitPrice() > 0 ? Math.floor(ctx.commander.credits / limitPrice()) : 0;
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
      section(away ? `Cheap at ${ctx.system.name}` : 'Cheap here', cheap.map((r) => row(r, 'buy', there(r) || (r.order?.side === 'sell' ? `in a glut ${away ? 'there' : 'here'}` : `made ${away ? 'there' : 'here'}`))).join('')) +
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
  }

  function renderBtcHead(ctx: TradeContext) {
    const q = heardQuote();
    const day = heardCandles('1h', 48)?.slice(-24);
    const open = day?.[0]?.o;
    const change = q && open ? (q.price - open) / open : 0;
    const sats = satsOf(ctx.commander);
    const now = Date.now();
    const quiet = q && !isFresh(q, now);
    $('.ex-head').innerHTML = `
      ${quiet ? `<div class="ex-event hit">Network quiet · price ${age(now - q!.time)} old · trading paused</div>` : ''}
      <div class="ex-title"><b>Bitcoin</b><span>/CR</span><small>per coin · live · the same at every station</small></div>
      <div class="ex-last ${change >= 0 ? 'up' : 'down'}">${q ? fmt(q.price) : '…'}<small>Cr</small></div>
      <dl>
        <div><dt>24h change</dt><dd class="${change >= 0 ? 'up' : 'down'}">${day ? pct(change) : '-'}</dd></div>
        <div><dt>24h high</dt><dd>${day ? fmt(Math.max(...day.map((k) => k.h))) : '-'}</dd></div>
        <div><dt>24h low</dt><dd>${day ? fmt(Math.min(...day.map((k) => k.l))) : '-'}</dd></div>
        <div><dt>Broker's fee</dt><dd>${FEE.limit === FEE.market ? `${pctFee(FEE.limit)} a trade` : `${pctFee(FEE.limit)} limit · ${pctFee(FEE.market)} market`}</dd></div>
        <div><dt>In your wallet</dt><dd>${formatBtc(sats)}${sats ? ` <small>${formatSats(sats)} · ${fmt(btcValue(ctx.commander, q))} Cr</small>` : ''}</dd></div>
        <div><dt>Hold space</dt><dd>None</dd></div>
      </dl>
      <p class="ex-why">One network, so one price at every station: you can't profit by carrying it, only by choosing when to hold it. It takes no hold space, pirates can't scoop it, and nobody can take it: fines and the insurers come out of your credits, never your Bitcoin. <span class="ex-honest">Witchspace Bitcoin stays in Witchspace: it can't be bought or cashed out for real money.</span></p>`;
  }

  /** Why the price is what it is, in a sentence. */
  function why(ctx: TradeContext, c: Commodity, balance: number, order: ReturnType<typeof stationOrder>, event: ReturnType<typeof activeEvent>): string {
    const here = ctx.system.name;
    const at = remote() ? 'there' : 'here';
    if (!tradesHere(ctx, c.id)) return `${c.name} isn't traded openly at ${here}: it's against the law ${at}.`;
    if (event) return `${EVENT_KINDS[event.type].headline(here)}. That's moving ${c.name.toLowerCase()} prices ${at}.`;
    if (order?.side === 'buy') return `${here} is short of ${c.name.toLowerCase()} and the station is buying to restock: a good place to sell.`;
    if (order?.side === 'sell') return `${here} has more ${c.name.toLowerCase()} than it can use: cheap while the glut lasts.`;
    if (balance > 0.25) return `${c.name} is cheap ${at}: ${here} makes it. Sell it where it's wanted.`;
    if (balance < -0.25) return `${c.name} sells well ${at}: ${here} doesn't make it, so it has to be brought in.`;
    return `${here} makes and uses its own ${c.name.toLowerCase()}, so the price stays close to fair.`;
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
    orderLines = ordersOf(ctx.commander).map((o) => candleSeries.createPriceLine({ price: o.limit, color: o.side === 'buy' ? UP : DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: o.side === 'buy' ? 'Buy' : 'Sell' }));
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
      .map((o) => candleSeries.createPriceLine({ price: o.limit, color: o.side === 'buy' ? UP : DOWN, lineStyle: LineStyle.Dashed, lineWidth: 1, axisLabelVisible: true, title: `${o.side === 'buy' ? 'Buy' : 'Sell'} ${o.qty}` }));
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
    markers.setMarkers([...mine, ...events].sort((a, b) => (a.time as number) - (b.time as number)));
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
    $('.ex-book h4').textContent = 'The broker';
    $('.ex-book-head').hidden = true;
    $('.ex-asks').innerHTML = `<div class="ex-quote"><span>Limit order fee</span><b class="num">${pctFee(FEE.limit)}</b></div>`;
    $('.ex-mid').innerHTML = `<b>${q ? fmt(q.price) : '…'}</b><span>Live · you trade at this price</span>`;
    $('.ex-bids').innerHTML = `<div class="ex-quote"><span>Market order fee</span><b class="num">${pctFee(FEE.market)}</b></div>
      <p class="ex-note">The station is a broker for a market far bigger than any station: your trades don't move the price.</p>`;
  }

  function renderBook(ctx: TradeContext) {
    $('.ex-book h4').textContent = 'Order book';
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

  function renderBtcForm(ctx: TradeContext) {
    const limit = orderType === 'limit';
    $('.ex-types').hidden = false;
    $('.ex-price').hidden = !limit;
    root.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.classList.toggle('active', b.dataset.side === side));
    root.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === orderType));
    $('.ex-form').classList.toggle('selling', side === 'sell');
    $('.ex-ordertype').innerHTML = limit
      ? `Limit order <span>fills when the real price ${side === 'buy' ? 'falls' : 'rises'} to yours, wherever you are; your ${side === 'buy' ? 'credits are' : 'Bitcoin is'} held until then</span>`
      : `Market order <span>fills now, at the live price</span>`;
    const max = maxQty(ctx);
    if (qty() > max) setQty(max, ctx);
    const buying = side === 'buy';
    $('.ex-qty-unit').textContent = buying ? 'Cr' : 'sats';
    $('.ex-qty span').textContent = buying ? 'Spend' : 'Sell';
    const sats = satsOf(ctx.commander);
    $('.ex-avail').innerHTML = buying
      ? `Available <b>${fmt(ctx.commander.credits)} Cr</b> · takes no hold space`
      : `In your wallet <b>${formatBtc(sats)}</b> ${formatSats(sats)}`;
    const q = heardQuote();
    const n = qty();
    const fresh = isFresh(q);
    const at = limitPrice();
    // What you'd get at a price, after the fee: sats for credits, or credits for sats.
    const estimate = (price: number, fee: number) =>
      !price || !n ? null : buying ? { get: formatSats(buyAt(n, price, fee).sats), fee: buyAt(n, price, fee).fee } : { get: `${fmt(sellAt(n, price, fee).total)} Cr`, fee: sellAt(n, price, fee).fee };
    const est = limit ? estimate(at, FEE.limit) : estimate(q?.price ?? 0, FEE.market);
    const feeLine = `<div><dt>Fee · ${pctFee(limit ? FEE.limit : FEE.market)}</dt><dd>${est ? `${fmt(est.fee, 2)} Cr` : '-'}</dd></div>`;
    const getLine = `<div><dt>${buying ? 'You get, about' : 'You receive, about'}</dt><dd><b>${est ? est.get : '-'}</b></dd></div>`;
    if (limit)
      $('.ex-est').innerHTML = `
        <div><dt>Fills at</dt><dd>${at ? `${fmt(at)} Cr` : '-'}</dd></div>
        <div><dt>Bitcoin now</dt><dd>${q ? `${fmt(q.price)} Cr` : '-'}</dd></div>
        ${feeLine}${getLine}`;
    else
      $('.ex-est').innerHTML = `
      <div><dt>${buying ? 'You buy at' : 'You sell at'}</dt><dd>${q ? `${fmt(q.price)} Cr` : '-'}</dd></div>
      ${feeLine}${getLine}`;
    let reason = '';
    if (limit && !at) reason = 'Set the price it should fill at';
    else if (!q && !limit) reason = 'Waiting for the price';
    else if (!fresh && !limit) reason = 'Trading paused: the network is quiet';
    else if (buying && max === 0) reason = 'Not enough credits';
    else if (!buying && sats === 0) reason = 'No Bitcoin in your wallet';
    const submit = $<HTMLButtonElement>('.ex-submit');
    submit.disabled = Boolean(reason) || n === 0 || submitting;
    submit.textContent = submitting
      ? 'Checking the price…'
      : reason ||
        (limit
          ? `Place ${side} order${n ? ` · ${buying ? `${n.toLocaleString()} Cr` : formatSats(n)} at ${fmt(at, 0)}` : ''}`
          : buying
            ? `Buy Bitcoin${n ? ` · ${n.toLocaleString()} Cr` : ''}`
            : `Sell ${n ? formatSats(n) : 'Bitcoin'}`);
    $('.ex-msg').textContent = message;
  }

  function renderForm(ctx: TradeContext) {
    if (isBtc()) return renderBtcForm(ctx);
    $('.ex-qty span').textContent = 'Quantity';
    const c = commodity();
    const u = unitLabel(c);
    if (remote() && orderType !== 'limit') {
      orderType = 'limit';
      suggestPrice(ctx);
    }
    $('.ex-types').hidden = remote();
    root.querySelectorAll<HTMLButtonElement>('[data-side]').forEach((b) => b.classList.toggle('active', b.dataset.side === side));
    root.querySelectorAll<HTMLButtonElement>('[data-type]').forEach((b) => b.classList.toggle('active', b.dataset.type === orderType));
    $('.ex-form').classList.toggle('selling', side === 'sell');
    const limit = orderType === 'limit';
    $('.ex-price').hidden = !limit;
    $('.ex-ordertype').innerHTML = remote()
      ? `Order to ${ctx.system.name} <span>arrives in ${age(newsDelay(ctx.system, deps.context().system))}, then waits for your price; ${side === 'buy' ? 'what it buys waits in storage there' : 'sells from your storage there'}. Remote orders always wait for a price: the market you see there is old news.</span>`
      : limit
      ? `Limit order <span>waits until the price reaches yours; ${side === 'buy' ? 'your credits are held' : 'your goods are held'} until then</span>`
      : `Market order <span>fills now, at the station's prices</span>`;
    const max = maxQty(ctx);
    if (qty() > max) setQty(max, ctx);
    $('.ex-qty-unit').textContent = u;
    const held = ctx.commander.cargo[selected] ?? 0;
    $('.ex-avail').innerHTML =
      remote()
        ? side === 'buy'
          ? `Available <b>${fmt(ctx.commander.credits)} Cr</b>`
          : `In storage there <b>${storedThere(ctx, selected).toLocaleString()} ${u}</b> ${c.name}`
        : side === 'buy'
        ? `Available <b>${fmt(ctx.commander.credits)} Cr</b> · Hold space <b>${fmt(freeTonnes(ctx))} t</b>`
        : `Available <b>${held.toLocaleString()} ${u}</b> ${c.name}`;

    const n = qty();
    const state = marketState(ctx);
    if (limit) {
      const value = n * limitPrice();
      const fee = remote() ? Math.round(value * BROKER_FEE * 10) / 10 : 0;
      $('.ex-est').innerHTML = `
        <div><dt>Limit price</dt><dd>${limitPrice() ? `${fmt(limitPrice(), 2)} Cr` : '-'}</dd></div>
        <div><dt>${remote() ? 'Market, as known' : 'Market now'}</dt><dd>${fmt(quotes(ctx).find((x) => x.commodity.id === selected)!.price, 2)} Cr</dd></div>
        ${remote() ? `<div><dt>Broker</dt><dd>${fee ? `${fmt(fee)} Cr` : '-'}</dd></div>` : ''}
        <div><dt>${side === 'buy' ? 'Credits held' : 'You receive when filled'}</dt><dd><b>${value ? `${fmt(value)} Cr` : '-'}</b></dd></div>`;
      const submit = $<HTMLButtonElement>('.ex-submit');
      let why = '';
      if (!tradesHere(ctx, selected)) why = 'Not traded openly there';
      else if (side === 'sell' && (remote() ? storedThere(ctx, selected) : held) === 0) why = remote() ? `No ${c.name} in storage there` : `No ${c.name} in your hold`;
      else if (side === 'buy' && value + fee > ctx.commander.credits) why = 'Not enough credits';
      submit.disabled = Boolean(why) || n === 0 || !limitPrice();
      submit.textContent = why || `${remote() ? `Send ${side} order` : `Place ${side} order`}${n ? ` · ${n.toLocaleString()} ${u} at ${fmt(limitPrice(), 2)}` : ''}`;
      $('.ex-msg').textContent = message;
      return;
    }
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
      <div><dt>${side === 'buy' ? 'Total cost' : 'You receive'}</dt><dd><b>${total ? `${fmt(total)} Cr` : '-'}</b>${total && inLocal(ctx, total) ? `<small class="ex-local">${inLocal(ctx, total)}</small>` : ''}</dd></div>`;

    const submit = $<HTMLButtonElement>('.ex-submit');
    let reason = '';
    if (!tradesHere(ctx, selected)) reason = 'Not traded at this lawful station';
    else if (side === 'buy' && max === 0) reason = quotes(ctx).find((x) => x.commodity.id === selected)!.stock <= 0 ? 'Out of stock' : freeTonnes(ctx) < 1 / UNITS_PER_TONNE[c.unit] ? 'Hold full' : 'Not enough credits';
    else if (side === 'sell' && held === 0) reason = `No ${c.name} in your hold`;
    else if (side === 'sell' && max === 0) reason = 'Stolen: try a fence in the back room';
    submit.disabled = Boolean(reason) || n === 0;
    submit.textContent = reason || `${side === 'buy' ? 'Buy' : 'Sell'} ${n ? n.toLocaleString() + ' ' + u + ' ' : ''}${c.name}`;
    $('.ex-msg').textContent = message;
  }

  // --- Your trades ----------------------------------------------------------------

  function renderBtcTrades(ctx: TradeContext) {
    const trades = (ctx.commander.btcTrades ?? []).slice().reverse();
    const orders = ordersOf(ctx.commander);
    $('.ex-mine h4').textContent = orders.length ? 'Your Bitcoin orders and trades' : 'Your Bitcoin trades';
    const open = orders.length
      ? `<h5>Open orders</h5><table class="ex-orders"><thead><tr><th>Side</th><th class="num">Amount</th><th class="num">Fills at</th><th class="num">Placed</th><th></th></tr></thead><tbody>${orders
          .map(
            (o) => `<tr><td class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Buy' : 'Sell'}</td><td class="num">${o.side === 'buy' ? `${fmt(o.credits!)} Cr` : formatSats(o.sats!)}</td>
            <td class="num">${fmt(o.limit, 0)}</td><td class="num">${clock(o.placed)}</td><td class="num"><button data-btc-cancel="${o.id}">Cancel</button></td></tr>`,
          )
          .join('')}</tbody></table>`
      : '';
    $('.ex-trades-list').innerHTML = open + (trades.length
      ? `<table><thead><tr><th>Time</th><th>Side</th><th class="num">Sats</th><th class="num">Price</th><th class="num">Fee</th><th class="num">Total</th></tr></thead><tbody>${trades
          .map(
            (t) => `<tr><td>${clock(t.t)}</td><td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? 'Buy' : 'Sell'}</td>
            <td class="num">${t.sats.toLocaleString()}</td><td class="num">${fmt(t.price)}</td><td class="num">${t.fee !== undefined ? fmt(t.fee, 2) : '-'}</td><td class="num">${fmt(t.total)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : orders.length ? '' : '<p class="ex-empty">No Bitcoin trades yet. They follow you to every station.</p>');
  }

  function renderFeed(ctx: TradeContext) {
    const u = unitLabel(commodity());
    const events = recentTrades(ctx.system, marketState(ctx), selected, ctx.now, 14);
    $('.ex-feed-list').innerHTML = events.length
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

  function renderTrades(ctx: TradeContext) {
    const state = marketState(ctx) as OrderState;
    const trades = (state.trades ?? []).slice().reverse();
    const orders = state.orders ?? [];
    const stored = Object.entries(state.storage ?? {}).filter(([, q]) => q > 0);
    const openHtml = orders.length
      ? `<h5>Open orders</h5><table class="ex-orders"><thead><tr><th>Pair</th><th>Side</th><th class="num">Qty</th><th class="num">Limit</th><th class="num">Market</th><th></th></tr></thead><tbody>${orders
          .map((o) => {
            const now = quotes(ctx).find((x) => x.commodity.id === o.id)!.price;
            const onWay = o.sent !== undefined && o.placed > deps.context().now;
            return `<tr><td>${commodityById(o.id)?.name}</td><td class="${o.side === 'buy' ? 'up' : 'down'}">${o.side === 'buy' ? 'Buy' : 'Sell'}</td><td class="num">${o.qty.toLocaleString()}</td>
              <td class="num">${fmt(o.limit, 2)}</td><td class="num">${onWay ? `<small>arrives ${clock(o.placed)}</small>` : fmt(now, 2)}</td><td class="num"><button data-cancel="${o.oid}">Cancel</button></td></tr>`;
          })
          .join('')}</tbody></table>`
      : '';
    const storageHtml = stored.length
      ? `<p class="ex-storage">In storage here, waiting for hold space: ${stored.map(([id, q]) => `<b>${q.toLocaleString()} ${unitLabel(commodityById(id)!)} ${commodityById(id)?.name}</b>`).join(', ')}</p>`
      : '';
    const where = remote() ? `at ${ctx.system.name}` : 'here';
    $('.ex-mine h4').textContent = orders.length ? `Your orders and trades ${where}` : `Your trades ${where}`;
    $('.ex-trades-list').innerHTML = openHtml + storageHtml + (trades.length
      ? `<table><thead><tr><th>Time</th><th>Pair</th><th>Side</th><th class="num">Qty</th><th class="num">Avg</th><th class="num">Total</th></tr></thead><tbody>${trades
          .map(
            (t) => `<tr><td>${clock(t.t)}</td><td>${commodityById(t.id)?.name}</td><td class="${t.side === 'buy' ? 'up' : 'down'}">${t.side === 'buy' ? 'Buy' : 'Sell'}</td>
            <td class="num">${t.qty.toLocaleString()}</td><td class="num">${fmt(t.total / t.qty, 2)}</td><td class="num">${fmt(t.total)}</td></tr>`,
          )
          .join('')}</tbody></table>`
      : '<p class="ex-empty">No trades at this station yet.</p>');
  }

  // --- The back room -------------------------------------------------------------------

  let backOpen = false;
  let backMessage = '';
  let backCaught = false;

  function renderBackRoom(ctx: TradeContext) {
    const c = ctx.commander;
    const room = hasBackRoom(c, ctx.system);
    const quotesHere = room ? backRoomQuotes(c, ctx.system, marketState(ctx), ctx.now) : [];
    const abolition = hasAbolitionists(c, ctx.system);
    const fence = fenceQuotes(c, ctx.system, marketState(ctx), ctx.now);
    const toggle = $<HTMLButtonElement>('.ex-backroom-toggle');
    toggle.hidden = remote() || (!quotesHere.length && !fence.length && !(abolition && (c.cargo.slaves ?? 0) > 0));
    if (!backOpen) return;
    const risk = stingChance(ctx.system, 1);
    const rows = quotesHere
      .map((q) => {
        const good = commodityById(q.id)!;
        const u = unitLabel(good);
        const held = c.cargo[q.id] ?? 0;
        return `<tr><td><b>${good.name}</b><small>${ticker(q.id)}</small></td><td class="num">${fmt(q.ask)}</td><td class="num">${fmt(q.bid)}</td>
          <td class="num">${q.stock.toLocaleString()} ${u}</td><td class="num">${held.toLocaleString()} ${u}</td>
          <td class="ex-back-actions">
            <button data-back="buy" data-good="${q.id}" data-n="1" ${q.stock >= 1 ? '' : 'disabled'}>Buy 1</button>
            <button data-back="buy" data-good="${q.id}" data-n="5" ${q.stock >= 5 ? '' : 'disabled'}>Buy 5</button>
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
    $('.ex-back').innerHTML = `
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
      <p class="ex-back-msg${backCaught ? ' caught' : ''}" aria-live="polite">${backMessage}</p>
      ${abolitionists}`;
  }

  function setBackOpen(open: boolean) {
    backOpen = open;
    $('.ex-back').hidden = !open;
    $('.ex').hidden = open || routesOpen;
  }

  // --- Trade computer ----------------------------------------------------------------

  let routesOpen = false;

  function renderRoutes(ctx: TradeContext) {
    if (!routesOpen) return;
    const c = ctx.commander;
    const course = c.target;
    // Lawless worlds pay a danger premium; say so, so the best runs are a real choice.
    const risk = (s: StarSystem) =>
      s.government <= 1 ? `<em class="ex-risk high">${GOVERNMENTS[s.government]} · pirates</em>` : s.government <= 3 ? `<em class="ex-risk">${GOVERNMENTS[s.government]}</em>` : '';
    const place = (s: StarSystem, ly: number, reachable = true) =>
      `<b>${s.name}</b><small>${ly.toFixed(1)} LY${reachable ? '' : ' · refuel first'}</small>${risk(s)}`;
    const courseButton = (s: StarSystem) =>
      s.index === course ? '<span class="ex-on-course">On course</span>' : `<button data-course="${s.index}">Set course</button>`;
    const routes = bestRoutes(ctx);
    const outlets = bestOutlets(ctx).filter((o) => o.dest && o.proceeds > o.here);
    const rows = routes
      .map((r) => {
        const good = commodityById(r.id)!;
        const u = unitLabel(good);
        return `<tr><td><b>${good.name}</b><small>${ticker(r.id)}</small></td>
          <td class="num">${fmt(r.cost / r.qty)}</td><td>${place(r.dest, r.ly, r.reachable)}</td><td class="num">${fmt(r.proceeds / r.qty)}<small class="ex-age">${age(r.age)} old</small></td>
          <td class="num">${r.qty.toLocaleString()} ${u}</td><td class="num up">+${fmt(r.profit)}</td>
          <td class="ex-back-actions"><button data-route-buy="${r.id}">Buy</button>${courseButton(r.dest)}</td></tr>`;
      })
      .join('');
    const held = outlets
      .map((o) => {
        const good = commodityById(o.id)!;
        return `<tr><td><b>${good.name}</b><small>${o.held.toLocaleString()} ${unitLabel(good)}</small></td>
          <td>${place(o.dest!, o.ly, o.ly <= c.fuel)}</td><td class="num">${fmt(o.proceeds)}<small class="ex-age">${age(o.age)} old</small></td><td class="num">${fmt(o.here)}</td><td class="num up">+${fmt(o.proceeds - o.here)}</td>
          <td class="ex-back-actions">${courseButton(o.dest!)}</td></tr>`;
      })
      .join('');
    $('.ex-routes').innerHTML = `
      <header><button class="ex-routes-close">‹ Exchange</button><h3>Trade computer</h3>
        <span>Every market within ${FUEL_CAPACITY} LY, as you know it: what you saw there yourself, or the latest report, which travels at the speed of news. Prices may have moved since, and will while you travel.</span></header>
      <h4>Best runs from ${ctx.system.name}</h4>
      ${
        routes.length
          ? `<table><thead><tr><th>Goods</th><th class="num">Buy here</th><th>Sell at</th><th class="num">Price there (as known)</th><th class="num">A full load</th><th class="num">Profit</th><th></th></tr></thead><tbody>${rows}</tbody></table>
             <p class="ex-note">A full load is as much as your credits, hold and the stock here allow. Prices include how much your own buying and selling moves them. The further away, the older the news.</p>`
          : '<p class="ex-empty">Nothing here sells for more within range. Try the news, or another station.</p>'
      }
      ${
        held
          ? `<h4>Your hold: better markets</h4><table><thead><tr><th>Goods</th><th>Best market</th><th class="num">It fetches there</th><th class="num">Here</th><th class="num">Gain</th><th></th></tr></thead><tbody>${held}</tbody></table>`
          : ''
      }`;
  }

  function setRoutesOpen(open: boolean) {
    routesOpen = open;
    $('.ex-routes').hidden = !open;
    $('.ex').hidden = open || backOpen;
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
    renderChooser();
    const ctx = view();
    if (notes.length) {
      deps.traded({ ok: true, message: notes.join(' · ') });
      return;
    }
    if (isBtc() && remote()) selected = 'food'; // one price everywhere: Bitcoin is traded where you are
    renderBackRoom(ctx);
    renderRoutes(ctx);
    renderPairs(ctx);
    root.querySelector('.ex')!.classList.toggle('btc', isBtc());
    $('.ex-feed').hidden = isBtc();
    if (isBtc()) {
      renderBtcHead(ctx);
      renderBtcChart(ctx);
      renderBtcBook();
      renderForm(ctx);
      renderBtcTrades(ctx);
      return;
    }
    renderHead(ctx);
    renderChart(ctx);
    renderBook(ctx);
    renderForm(ctx);
    renderFeed(ctx);
    renderTrades(ctx);
  }

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

  // --- Events ------------------------------------------------------------------------

  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    el.blur();
    if (el.classList.contains('ex-routes-toggle')) {
      setRoutesOpen(true);
      return;
    } else if (el.classList.contains('ex-routes-close')) {
      setRoutesOpen(false);
      return;
    } else if (el.dataset.course) {
      const ctx = view();
      deps.setCourse(systemAt(ctx.system.galaxy, Number(el.dataset.course)));
      renderRoutes(view());
      return;
    } else if (el.dataset.routeBuy) {
      selected = el.dataset.routeBuy;
      side = 'buy';
      setRoutesOpen(false);
      message = '';
      qtyInput.value = '';
      render();
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
    } else if (el.dataset.id) {
      selected = el.dataset.id;
      if (isBtc()) refreshBtc();
      if (orderType === 'limit') queueMicrotask(() => suggestPrice(view()));
      message = '';
      qtyInput.value = '';
      slider.value = '0';
      // From the lists: ready to buy as much as you can, or sell the lot. You still confirm.
      if (el.dataset.quick) {
        side = el.dataset.quick as 'buy' | 'sell';
        orderType = 'market';
        render();
        setQty(maxQty(view()));
        renderForm(view());
        return;
      }
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
    } else if (el.dataset.cancel) {
      const ctx = view();
      const result = cancelOrder(ctx.commander, marketState(ctx) as OrderState, Number(el.dataset.cancel), ctx.capacity, !remote());
      message = result.message;
      deps.traded(result);
      return;
    } else if (el.dataset.interval) {
      interval = el.dataset.interval as Interval;
    } else if (el.dataset.pct) {
      setQty((maxQty(view()) * Number(el.dataset.pct)) / 100);
    } else if (el.dataset.order) {
      // Fill the station's order: sell into a buy order, buy from a sell order.
      side = el.dataset.order === 'buy' ? 'sell' : 'buy';
      setQty(Number(el.dataset.total));
    } else if (el.dataset.kind) {
      // Clicking a level fills the form: asks to buy, bids to sell, down to that level.
      side = el.dataset.kind === 'ask' ? 'buy' : 'sell';
      setQty(Number(el.dataset.total));
    } else if (el.classList.contains('ex-submit') && isBtc() && orderType === 'limit') {
      const ctx = view();
      const result = placeBtcOrder(ctx.commander, side, qty(), limitPrice());
      if (result.ok) {
        qtyInput.value = '';
        slider.value = '0';
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
      }
      message = result.message;
      deps.traded(result);
      return;
    } else return;
    render();
  });
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
    setQty((maxQty(ctx) * Number(slider.value)) / 100, ctx);
    renderForm(ctx);
  });
  return {
    render,
    /** Prices move while you watch: refresh every couple of seconds while open. */
    start() {
      if (timer) return;
      refreshBtc();
      timer = window.setInterval(() => {
        // Everything, including orders that have filled and goods to collect.
        if (root.offsetParent && !document.hidden) {
          refreshBtc();
          render();
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
