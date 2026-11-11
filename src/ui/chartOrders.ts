// Trading from the chart, as trading charts do (Mark, 11 November 2026: "does the chart allow a
// player to add buy and sell buttons?"): SELL and BUY at the live prices in the corner, a "+" on the
// price scale that follows your price and offers a limit order there (a long press on a phone), and
// each of your orders as a tag on its line that you can drag to a new price or cancel with ✕.
// Nothing here trades by itself: every one of these opens the trade window to confirm.

import type { IChartApi, ISeriesApi, MouseEventParams, SeriesType } from 'lightweight-charts';

export interface ChartOrder {
  /** "galaxy:index:oid" for goods, "btc:id" for Bitcoin. */
  ref: string;
  side: 'buy' | 'sell';
  limit: number;
  label: string;
  /** Still on its way to the market, or being cancelled: shown faint, and can't be dragged. */
  faint: boolean;
  draggable: boolean;
}

export interface ChartOrderHandlers {
  /** SELL or BUY in the corner: a market order. */
  quick(side: 'buy' | 'sell'): void;
  /** A limit order at a price picked on the chart. */
  limit(side: 'buy' | 'sell', price: number): void;
  /** An order's tag dragged to a new price. */
  move(ref: string, price: number): void;
  /** An order's ✕. */
  cancel(ref: string): void;
}

export function mountChartOrders(host: HTMLElement, chart: IChartApi, series: ISeriesApi<SeriesType>, on: ChartOrderHandlers) {
  host.classList.add('ex-chart-host');
  const layer = document.createElement('div');
  layer.className = 'ex-overlay';
  layer.innerHTML = `
    <div class="ex-quick"><button data-quick-side="sell" class="sell"><small>SELL</small><b></b></button><button data-quick-side="buy" class="buy"><small>BUY</small><b></b></button></div>
    <button class="ex-plus" hidden title="Place a limit order at this price">+</button>
    <div class="ex-plus-menu" hidden></div>
    <div class="ex-otags"></div>`;
  host.append(layer);
  const plus = layer.querySelector<HTMLButtonElement>('.ex-plus')!;
  const menu = layer.querySelector<HTMLElement>('.ex-plus-menu')!;
  const tags = layer.querySelector<HTMLElement>('.ex-otags')!;
  let dp = 2;
  let plusY = -1;
  let orders: ChartOrder[] = [];
  let enabled = true;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: dp, maximumFractionDigits: dp });
  const scaleWidth = () => chart.priceScale('right').width();
  const priceAtY = (y: number) => {
    const p = series.coordinateToPrice(y);
    return p === null ? null : Math.round(p * 10 ** dp) / 10 ** dp;
  };

  // The "+" rides the price scale at the crosshair's height. It stays put when the pointer leaves
  // the plot for the scale itself, so it can be clicked.
  chart.subscribeCrosshairMove((param: MouseEventParams) => {
    if (!enabled || !param.point || dragging) return;
    plusY = param.point.y;
    placePlus();
  });
  function placePlus() {
    if (plusY < 0) return void (plus.hidden = true);
    plus.hidden = false;
    plus.style.top = `${plusY - 9}px`;
    plus.style.right = `${Math.max(0, scaleWidth() - 22)}px`;
  }
  host.addEventListener('pointerleave', (e) => {
    if ((e as PointerEvent).pointerType === 'mouse' && !menu.contains(e.relatedTarget as Node)) {
      plusY = -1;
      plus.hidden = true;
    }
  });

  function openMenu(y: number) {
    const price = priceAtY(y);
    if (price === null || price <= 0) return;
    menu.innerHTML = `<button data-limit-side="buy" data-price="${price}" class="buy">Buy limit ${fmt(price)}</button><button data-limit-side="sell" data-price="${price}" class="sell">Sell limit ${fmt(price)}</button>`;
    menu.hidden = false;
    menu.style.top = `${Math.max(4, y - 30)}px`;
    menu.style.right = `${scaleWidth() + 6}px`;
  }
  const closeMenu = () => (menu.hidden = true);

  // A long press on a phone: the menu at the price under your finger.
  let pressTimer = 0;
  let pressAt: { x: number; y: number } | null = null;
  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || !enabled || (e.target as HTMLElement).closest('.ex-overlay button, .ex-otag')) return;
    const r = host.getBoundingClientRect();
    pressAt = { x: e.clientX, y: e.clientY };
    const y = e.clientY - r.top;
    pressTimer = window.setTimeout(() => {
      pressAt = null;
      openMenu(y);
    }, 500);
  });
  const cancelPress = () => {
    clearTimeout(pressTimer);
    pressAt = null;
  };
  host.addEventListener('pointermove', (e) => {
    if (pressAt && Math.hypot(e.clientX - pressAt.x, e.clientY - pressAt.y) > 10) cancelPress();
  });
  host.addEventListener('pointerup', cancelPress);
  host.addEventListener('pointercancel', cancelPress);

  // Dragging an order's tag: the tag follows, showing the new price; let go to confirm it in the trade window.
  let dragging: { ref: string; el: HTMLElement; startY: number; from: number; moved: boolean } | null = null;
  tags.addEventListener('pointerdown', (e) => {
    const el = (e.target as HTMLElement).closest<HTMLElement>('.ex-otag');
    if (!el || (e.target as HTMLElement).closest('button') || el.dataset.drag !== '1') return;
    e.preventDefault();
    el.setPointerCapture(e.pointerId);
    dragging = { ref: el.dataset.ref!, el, startY: e.clientY, from: Number(el.style.top.replace('px', '')), moved: false };
    el.classList.add('dragging');
  });
  tags.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dy = e.clientY - dragging.startY;
    if (Math.abs(dy) > 3) dragging.moved = true;
    const top = dragging.from + dy;
    dragging.el.style.top = `${top}px`;
    const p = priceAtY(top + 10);
    const shown = dragging.el.querySelector('.to');
    if (shown && p !== null) shown.textContent = ` → ${fmt(p)}`;
  });
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    const d = dragging;
    dragging = null;
    d.el.classList.remove('dragging');
    const p = priceAtY(d.from + (e.clientY - d.startY) + 10);
    if (d.moved && p !== null && p > 0) on.move(d.ref, p);
    else draw();
  };
  tags.addEventListener('pointerup', endDrag);
  tags.addEventListener('pointercancel', () => {
    dragging = null;
    draw();
  });

  layer.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
    if (!b) return;
    e.stopPropagation();
    if (b === plus) return openMenu(plusY);
    if (b.dataset.quickSide) return on.quick(b.dataset.quickSide as 'buy' | 'sell');
    if (b.dataset.limitSide) {
      closeMenu();
      return on.limit(b.dataset.limitSide as 'buy' | 'sell', Number(b.dataset.price));
    }
    if (b.dataset.ocancelRef) return on.cancel(b.dataset.ocancelRef);
  });
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target as Node) && e.target !== plus) closeMenu();
  });

  function draw() {
    if (dragging) return;
    const right = scaleWidth() + 4;
    tags.innerHTML = orders
      .map((o) => {
        const y = series.priceToCoordinate(o.limit);
        if (y === null) return '';
        return `<div class="ex-otag ${o.side}${o.faint ? ' faint' : ''}${o.draggable ? ' drag' : ''}" data-ref="${o.ref}" data-drag="${o.draggable ? 1 : 0}" style="top:${Math.round(y - 10)}px;right:${right}px" title="${o.draggable ? 'Drag to change the price' : ''}"><span>${o.label}</span><span class="to"></span><button data-ocancel-ref="${o.ref}" aria-label="Cancel this order">✕</button></div>`;
      })
      .join('');
    placePlus();
  }
  chart.timeScale().subscribeVisibleLogicalRangeChange(() => draw());
  new ResizeObserver(() => draw()).observe(host);

  return {
    /** The live prices, your orders on this pair, and how many decimals its prices take. */
    update(state: { bid: number | null; ask: number | null; orders: ChartOrder[]; decimals: number; enabled: boolean }) {
      dp = state.decimals;
      enabled = state.enabled;
      layer.hidden = !enabled;
      const [sell, buy] = layer.querySelectorAll<HTMLElement>('.ex-quick b');
      sell.textContent = state.bid ? fmt(state.bid) : '-';
      buy.textContent = state.ask ? fmt(state.ask) : '-';
      orders = state.orders;
      // After the chart has drawn its new prices.
      requestAnimationFrame(draw);
    },
  };
}
