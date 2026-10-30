// The news and the market (moved from main.ts): the station's news board, the exchange (Modern) or
// 1984's price list (Classic), and the trade context every trading screen works from.

import { sfx } from '../audio/sound';
import { cargoCapacity, saveCommander } from '../game/commander';
import { recordCrime } from '../game/law';
import { mountExchange } from './exchange';
import { currencyOf, fairRate, moneyNews, poolRate } from '../economy/currencies';
import { poolHere } from '../economy/money';
import { stageInfo, stageLabel, yardsNear } from '../game/yards';
import { firstFittingsAt } from '../game/commissions';
import { isRetro } from '../render/renderer';
import { flash } from './hud';
import { distanceLy } from '../galaxy/generate';
import { buy, freeTonnes, maxBuyable, quotes, sell, type TradeContext } from '../economy/trade';
import { EVENT_KINDS, newsAt, newsDelay } from '../economy/events';
import { escapeHtml } from './escape';
import { $, cmdr, currentSystem } from '../core';
import { player } from '../scene';
import { ago, attackNews } from '../game/newsLines';
import { linkSystem } from './contracts';
import { btcNow } from './money';

/** What main.ts still owns (it fills these in at start). */
const main = {} as { exploring(): boolean; noticeTrades(): boolean; updateDockHead(): void };
export const initMarket = (hooks: typeof main) => Object.assign(main, hooks);

export function tradeContext(): TradeContext {
  return { commander: cmdr(), system: currentSystem(), capacity: cargoCapacity(cmdr(), player.def.stats.cargo), now: Date.now() };
}

// --- News and the market ---------------------------------------------------------

export function renderNews() {
  const here = currentSystem();
  const now = Date.now();
  // Ongoing news first, then what's probably over; the latest eight.
  const items = newsAt(here, now)
    .sort((a, b) => Number(now > a.event.end) - Number(now > b.event.end) || b.heard - a.heard)
    .slice(0, 8);
  const attacks = attackNews(here, now)
    .map(
      (n) => `<li class="${n.where === here ? 'here' : ''}"><b>${linkSystem(`Traders attacked near ${n.where.name}: ${n.lost} shipments lost`, n.where)}</b>
        <small>${escapeHtml(n.where === here ? 'Here' : `${n.distance.toFixed(1)} LY away`)} · heard ${ago(now - n.heard)} ago · Wanted: whatever it imports</small></li>`,
    )
    .join('');
  // Money in trouble in the region: a peg breaking, the presses running (Modern).
  const money =
    cmdr().difficulty === 'modern'
      ? moneyNews(here, now, (w) => newsDelay(w, here), btcNow())
          .slice(0, 3)
          .map((n) => `<li class="${n.where === here ? 'here' : ''}"><b>${linkSystem(n.text, n.where)}</b><small>${escapeHtml(n.where === here ? 'Here' : `${n.distance.toFixed(1)} LY away`)} · stablecoins and Bitcoin are the ways out</small></li>`)
          .join('')
      : '';
  // Wexley-Yorozu yards in the region: news, not a market event (Modern).
  const yards = main.exploring()
    ? yardsNear(here, now)
        .slice(0, 3)
        .map(
          (n) => `<li class="${n.where === here ? 'here' : ''}"><b>${linkSystem(`Wexley-Yorozu yard at ${n.where.name}: ${stageInfo(n.yard.stage).news}`, n.where)}</b>
        <small>${escapeHtml(n.where === here ? 'Here, by the moon' : `${n.distance.toFixed(1)} LY away`)} · ${escapeHtml(stageLabel(n.yard))}</small></li>${firstFittingsAt(n.yard)
          .map((x) => `<li class="${n.where === here ? 'here' : ''}"><b>${linkSystem(x.kind === 'design' ? `Wexley-Yorozu fits CMDR ${x.to}'s new ${x.module.name.toLowerCase()} at ${n.where.name}` : `Wexley-Yorozu fits CMDR ${x.to}'s improved ${x.module.name.toLowerCase()} at ${n.where.name}`, n.where)}</b>
        <small>${x.kind === 'design' ? 'The first Titanoboa to carry it' : `Designed by CMDR ${escapeHtml(x.module.designer)}, revised by CMDR ${escapeHtml(x.to)}`}</small></li>`)
          .join('')}`,
        )
        .join('')
    : '';
  $('#news-list').innerHTML = (attacks || money || yards || items.length)
    ? attacks + money + yards + items
        .map((n) => {
          const kind = EVENT_KINDS[n.event.type];
          const local = n.where === here;
          const over = now > n.event.end;
          const status = local ? (over ? 'Over' : 'Here, now') : over ? 'May be over by now' : `${n.distance.toFixed(1)} LY away · news ${ago(n.heard - n.event.start)} old when it arrived`;
          return `<li class="${local ? 'here' : ''}${over ? ' over' : ''}"><b>${linkSystem(kind.headline(n.where.name), n.where)}</b>
            <small>${escapeHtml(status)} · heard ${ago(now - n.heard)} ago · Wanted: ${escapeHtml(kind.wanted)}</small></li>`;
        })
        .join('')
    : '<li class="quiet">No news. All quiet within 25 light years.</li>';
}

// Modern markets in neo-vector mode get the full exchange; Classic and 1984
// mode keep the plain price list.
export const exchange = mountExchange($('#exchange'), {
  context: tradeContext,
  localMoney(sys) {
    const cur = currencyOf(sys);
    if (!cur) return null;
    const here = currentSystem();
    const now = Date.now();
    // Here, the pool's rate (what changing would give); another market on screen, its fair rate.
    const rate = sys.galaxy === here.galaxy && sys.index === here.index ? poolRate(poolHere(cmdr(), sys, now, btcNow())) : fairRate(sys, now, btcNow());
    return { ticker: cur.ticker, rate };
  },
  setCourse(dest) {
    cmdr().target = dest.index;
    saveCommander(cmdr());
    sfx.beep();
    flash(`Course set: ${dest.name} · ${distanceLy(currentSystem(), dest).toFixed(1)} LY`, 2);
  },
  traded(result) {
    if (result.ok) {
      main.noticeTrades();
      saveCommander(cmdr());
      sfx.beep();
    }
    renderMarket(result.message);
  },
  dealt(result) {
    if (result.ok) saveCommander(cmdr());
    if (result.caught) {
      recordCrime(cmdr(), 'offender');
      saveCommander(cmdr());
      sfx.explosion();
    } else if (result.ok) sfx.beep();
    renderMarket();
  },
});
const useExchange = () => cmdr().difficulty === 'modern' && !isRetro();

export function renderMarket(message = '') {
  const ex = useExchange();
  $('.panel.docked').classList.toggle('exchange', ex);
  $('.panel.docked').classList.toggle('wide', !ex);
  document.body.classList.toggle('exchange-open', ex);
  if (ex) {
    const ctx = tradeContext();
    const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    main.updateDockHead();
    $('#dock-funds').innerHTML = `Hold <b>${fmt(ctx.capacity - freeTonnes(ctx))} / ${ctx.capacity} t</b>`;
  }
  $('#exchange').hidden = !ex;
  for (const id of ['#market-summary', '#market-table', '#market-message']) $(id).hidden = ex;
  if (ex) {
    exchange.render(message || undefined);
    exchange.start();
    return;
  }
  exchange.stop();
  const ctx = tradeContext();
  const c = ctx.commander;
  const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  $('#market-summary').innerHTML =
    `Credits <b>${fmt(c.credits)} Cr</b> · Hold <b>${fmt(ctx.capacity - freeTonnes(ctx))} / ${ctx.capacity} t</b>` +
    (c.difficulty === 'classic' ? ' · 1984 prices' : '');
  const rows = quotes(ctx)
    .map((q) => {
      const id = q.commodity.id;
      const held = c.cargo[id] ?? 0;
      const canBuy = maxBuyable(ctx, id);
      const illegal = q.commodity.legality === 'illegal' ? '<span class="illegal">Illegal</span>' : '';
      return `<tr class="${held ? 'held' : ''}">
        <td>${q.commodity.name}${illegal}</td>
        <td class="num">${fmt(q.price)} Cr/${q.commodity.unit}</td>
        <td class="num">${q.stock}${q.commodity.unit === 't' ? 't' : q.commodity.unit}</td>
        <td class="num">${held || '-'}</td>
        <td class="actions">
          <button data-buy="${id}" data-qty="1" ${canBuy >= 1 ? '' : 'disabled'} title="Buy one">+1</button>
          <button data-buy="${id}" data-qty="${canBuy}" ${canBuy >= 1 ? '' : 'disabled'} title="Buy as much as you can">Max</button>
          <button data-sell="${id}" data-qty="1" ${held >= 1 ? '' : 'disabled'} title="Sell one">-1</button>
          <button data-sell="${id}" data-qty="${held}" ${held >= 1 ? '' : 'disabled'} title="Sell all">All</button>
        </td>
      </tr>`;
    })
    .join('');
  $('#market-table').innerHTML = `<thead><tr><th>Goods</th><th>Price</th><th>Stock</th><th>Hold</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  $('#market-message').textContent = message;
}

$('#market-table').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest('button');
  if (!b || b.disabled) return;
  b.blur();
  const ctx = tradeContext();
  const qty = Number(b.dataset.qty);
  const result = b.dataset.buy ? buy(ctx, b.dataset.buy, qty) : sell(ctx, b.dataset.sell!, qty);
  if (result.ok) {
    saveCommander(ctx.commander);
    sfx.beep();
  }
  renderMarket(result.message);
});
