import { COMMODITIES, commodityById, UNITS_PER_TONNE, type Commodity } from '../economy/commodities';
import { candles, drift, equilibriumPrice, orderBook, priceAt, type Candle } from '../economy/market';
import { buy, freeTonnes, marketState, maxBuyable, quotes, sell, tradesHere, type TradeContext, type TradeResult } from '../economy/trade';

// The station market as a trading exchange, in the style of today's crypto
// exchanges: a list of pairs against the credit, a candlestick chart, the
// order book and a trade form. Everything shown comes from the living market
// itself: the book is the station's real pricing curve, the chart is the
// market's real price history, and the trades are yours.

export interface ExchangeDeps {
  context(): TradeContext;
  /** A trade went through: save, play a sound, refresh the rest of the screen. */
  traded(result: TradeResult): void;
}

const TICKERS: Record<string, string> = {
  food: 'FOOD', textiles: 'TEXT', radioactives: 'RADS', slaves: 'SLAV', liquor: 'LIQR', luxuries: 'LUXR',
  narcotics: 'NARC', computers: 'COMP', machinery: 'MACH', alloys: 'ALOY', firearms: 'ARMS', furs: 'FURS',
  minerals: 'MINR', gold: 'GOLD', platinum: 'PLAT', gems: 'GEMS', alien: 'ALIN',
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
  let hover: number | null = null;
  let message = '';
  let shown: Candle[] = [];
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
        <div class="ex-canvas"><canvas></canvas></div>
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
      <section class="ex-trades" aria-label="Your trades">
        <h4>Your trades here</h4>
        <div class="ex-trades-list"></div>
      </section>
    </div>`;

  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const qtyInput = $<HTMLInputElement>('.ex-qty input');
  const slider = $<HTMLInputElement>('.ex-slider');
  const canvas = $<HTMLCanvasElement>('.ex-chart canvas');

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
        return `<button class="ex-pair${id === selected ? ' active' : ''}${off ? ' off' : ''}" data-id="${id}" title="${q.commodity.name}${off ? ' · not traded at this lawful station' : ''}">
          <span class="ex-sym"><b>${ticker(id)}</b>/CR${held ? '<i class="ex-held" title="In your hold"></i>' : ''}${q.commodity.legality === 'illegal' ? '<em title="Illegal goods">Illegal</em>' : ''}</span>
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
    $('.ex-head').innerHTML = `
      <div class="ex-title"><b>${ticker(selected)}</b><span>/CR</span><small>${c.name} · per ${u}${c.legality === 'illegal' ? ' · <em>Illegal</em>' : ''}</small></div>
      <div class="ex-last ${change >= 0 ? 'up' : 'down'}">${fmt(q.price)}<small>Cr</small></div>
      <dl>
        <div><dt>1h change</dt><dd class="${change >= 0 ? 'up' : 'down'}">${pct(change)}</dd></div>
        <div><dt>1h high</dt><dd>${fmt(high)}</dd></div>
        <div><dt>1h low</dt><dd>${fmt(low)}</dd></div>
        <div><dt>Fair value</dt><dd title="The price if the station's stock were at its usual level">${fmt(fair)}</dd></div>
        <div><dt>Station stock</dt><dd>${q.stock.toLocaleString()} ${u}</dd></div>
        <div><dt>In your hold</dt><dd>${held.toLocaleString()} ${u}</dd></div>
      </dl>`;
  }

  // --- Chart ------------------------------------------------------------------

  function renderChart(ctx: TradeContext) {
    const state = marketState(ctx);
    const [ms, count] = INTERVALS[interval];
    shown = candles(ctx.system, state, selected, ctx.now, ms, count);
    const live = quotes(ctx).find((x) => x.commodity.id === selected)!.price;
    shown[shown.length - 1].close = live;
    const c = commodity();
    const fair = equilibriumPrice(ctx.system, c, index()) * drift(ctx.system, c, index(), ctx.now);
    root.querySelectorAll<HTMLButtonElement>('[data-interval]').forEach((b) => b.classList.toggle('active', b.dataset.interval === interval));
    drawChart(canvas, shown, live, fair, (state.trades ?? []).filter((t) => t.id === selected && t.t >= shown[0].t), ms, hover);
    const k = shown[hover ?? shown.length - 1];
    $('.ex-ohlc').innerHTML = `<span>${clock(k.t)}</span> O <b>${fmt(k.open)}</b> H <b>${fmt(k.high)}</b> L <b>${fmt(k.low)}</b> C <b class="${k.close >= k.open ? 'up' : 'down'}">${fmt(k.close)}</b>`;
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
    $('.ex-asks').innerHTML = asks.length ? rows(asks, 'ask') : '<p class="ex-empty">Sold out</p>';
    $('.ex-bids').innerHTML = rows(bids, 'bid');
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
    else if (side === 'buy' && max === 0) reason = (state.stock[selected] ?? 0) <= 0 ? 'Out of stock' : freeTonnes(ctx) < 1 / UNITS_PER_TONNE[c.unit] ? 'Hold full' : 'Not enough credits';
    else if (side === 'sell' && held === 0) reason = `No ${c.name} in your hold`;
    submit.disabled = Boolean(reason) || n === 0;
    submit.textContent = reason || `${side === 'buy' ? 'Buy' : 'Sell'} ${n ? n.toLocaleString() + ' ' + u + ' ' : ''}${ticker(selected)}`;
    $('.ex-msg').textContent = message;
  }

  // --- Your trades ----------------------------------------------------------------

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
    renderTrades(ctx);
  }

  // --- Events ------------------------------------------------------------------------

  root.addEventListener('click', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('button');
    if (!el) return;
    el.blur();
    if (el.dataset.id) {
      selected = el.dataset.id;
      hover = null;
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
      hover = null;
    } else if (el.dataset.pct) {
      setQty((maxQty(deps.context()) * Number(el.dataset.pct)) / 100);
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
  canvas.addEventListener('mousemove', (e) => {
    const r = canvas.getBoundingClientRect();
    const k = Math.floor(((e.clientX - r.left) / (r.width - AXIS_W)) * shown.length);
    const next = k >= 0 && k < shown.length ? k : null;
    if (next !== hover) {
      hover = next;
      renderChart(deps.context());
    }
  });
  canvas.addEventListener('mouseleave', () => {
    hover = null;
    renderChart(deps.context());
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

// --- Drawing the candlestick chart ------------------------------------------------------

const AXIS_W = 52; // right-hand price axis
const TIME_H = 18; // time labels along the bottom
const TOP_PAD = 10; // room for the top price label
const UP = '#2ebd85';
const DOWN = '#f6465d';

function drawChart(
  canvas: HTMLCanvasElement,
  cs: Candle[],
  live: number,
  fair: number,
  trades: { t: number; side: 'buy' | 'sell'; total: number; qty: number }[],
  interval: number,
  hover: number | null,
) {
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);

  const plotW = w - AXIS_W;
  const plotH = h - TIME_H;
  const top = TOP_PAD;
  let lo = Math.min(...cs.map((c) => c.low), fair);
  let hi = Math.max(...cs.map((c) => c.high), fair);
  const pad = Math.max((hi - lo) * 0.12, hi * 0.002);
  lo -= pad;
  hi += pad;
  const y = (p: number) => plotH - ((p - lo) / (hi - lo)) * (plotH - top);
  const step = plotW / cs.length;

  g.font = '11px system-ui, -apple-system, "Segoe UI", sans-serif';
  g.textBaseline = 'middle';

  // Grid and price axis.
  g.strokeStyle = 'rgba(255,255,255,0.06)';
  g.fillStyle = '#848e9c';
  g.lineWidth = 1;
  for (let k = 0; k <= 4; k++) {
    const p = lo + ((hi - lo) * k) / 4;
    const yy = Math.round(y(p)) + 0.5;
    g.beginPath();
    g.moveTo(0, yy);
    g.lineTo(plotW, yy);
    g.stroke();
    g.fillText(fmt(p, p < 10 ? 2 : 1), plotW + 6, yy);
  }
  // Time labels.
  g.textAlign = 'center';
  const every = Math.ceil(cs.length / 6);
  for (let k = Math.floor(every / 2); k < cs.length; k += every) g.fillText(clock(cs[k].t), k * step + step / 2, plotH + TIME_H / 2 + 2);
  g.textAlign = 'left';

  // Fair value.
  g.setLineDash([2, 4]);
  g.strokeStyle = 'rgba(247,166,0,0.55)';
  g.beginPath();
  g.moveTo(0, Math.round(y(fair)) + 0.5);
  g.lineTo(plotW, Math.round(y(fair)) + 0.5);
  g.stroke();
  g.setLineDash([]);

  // Hover column.
  if (hover !== null) {
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(hover * step, 0, step, plotH);
  }

  // Candles.
  const bodyW = Math.max(1, Math.min(10, step * 0.62));
  cs.forEach((c, k) => {
    const x = k * step + step / 2;
    const up = c.close >= c.open;
    g.strokeStyle = g.fillStyle = up ? UP : DOWN;
    g.beginPath();
    g.moveTo(Math.round(x) + 0.5, y(c.high));
    g.lineTo(Math.round(x) + 0.5, y(c.low));
    g.stroke();
    const body = y(Math.max(c.open, c.close));
    g.fillRect(Math.round(x - bodyW / 2), body, Math.round(bodyW), Math.max(1, y(Math.min(c.open, c.close)) - body));
  });

  // Your trades, as markers: buys below the candle, sells above.
  const start = cs[0].t;
  for (const t of trades) {
    const k = Math.floor((t.t - start) / interval);
    if (k < 0 || k >= cs.length) continue;
    const x = k * step + step / 2;
    const p = t.total / t.qty;
    const yy = t.side === 'buy' ? Math.min(plotH - 4, y(p) + 10) : Math.max(4, y(p) - 10);
    g.fillStyle = t.side === 'buy' ? UP : DOWN;
    g.beginPath();
    if (t.side === 'buy') {
      g.moveTo(x, yy - 5);
      g.lineTo(x - 4, yy + 2);
      g.lineTo(x + 4, yy + 2);
    } else {
      g.moveTo(x, yy + 5);
      g.lineTo(x - 4, yy - 2);
      g.lineTo(x + 4, yy - 2);
    }
    g.fill();
  }

  // Last price line and tag.
  const ly = Math.round(y(live)) + 0.5;
  const last = cs[cs.length - 1];
  const colour = last.close >= last.open ? UP : DOWN;
  g.setLineDash([3, 3]);
  g.strokeStyle = colour;
  g.beginPath();
  g.moveTo(0, ly);
  g.lineTo(plotW, ly);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = colour;
  g.fillRect(plotW, ly - 9, AXIS_W, 18);
  g.fillStyle = '#fff';
  g.fillText(fmt(live, live < 10 ? 2 : 1), plotW + 6, ly);
}
