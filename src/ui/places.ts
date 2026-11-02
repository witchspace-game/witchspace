// The station's places (moved from main.ts): opening each one (Station, Contracts, Market, News,
// Saloon, Shipyard, Money), and the slim header that replaces the tabs on a phone held upright, with
// its places menu and the wallet.

import { sfx } from '../audio/sound';
import { currencyOf, walletHome, walletKey, weekChange } from '../economy/currencies';
import { valueOf, walletOf } from '../economy/money';
import { stationName } from '../galaxy/stationNames';
import { escapeHtml } from './escape';
import { btcValue, formatBtc, satsOf } from '../economy/bitcoin';
import { $, cmdr, currentSystem, game, type DockTab } from '../core';
import { renderContracts } from './contracts';
import { clearSpec, renderShipyard, showOwnShip } from './shipyard';
import { btcNow, renderMoney } from './money';
import { renderSaloon } from './saloon';
import { exchange, renderMarket, renderNews } from './market';
import { renderDocked } from './station';

// --- Docked tabs and the market ---------------------------------------------------


export function setDockTab(tab: DockTab) {
  game.dockTab = tab;
  document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  $('#tab-station').hidden = tab !== 'station';
  if (tab === 'station' && game.state === 'docked') renderDocked(); // credits, hold and wallet may have changed at the exchange
  $('#tab-market').hidden = tab !== 'market';
  $('#tab-news').hidden = tab !== 'news';
  $('#tab-saloon').hidden = tab !== 'saloon';
  if (tab === 'saloon') renderSaloon();
  $('#tab-shipyard').hidden = tab !== 'shipyard';
  $('#tab-money').hidden = tab !== 'money';
  if (tab === 'money') renderMoney();
  document.body.classList.toggle('yard-open', tab === 'shipyard');
  if (tab === 'shipyard') renderShipyard();
  else if (game.state === 'docked') {
    // Your own ship back in the berth, and the yard's hulls in their own glow.
    clearSpec();
    showOwnShip();
  }
  $('#tab-contracts').hidden = tab !== 'contracts';
  if (tab === 'news') renderNews();
  if (tab === 'contracts') renderContracts();
  if (tab === 'market') {
    exchange.selectHeld(cmdr().cargo);
    renderMarket();
  } else {
    $('.panel.docked').classList.remove('wide', 'exchange');
    document.body.classList.remove('exchange-open');
    exchange.stop();
  }
  if (tab === 'contracts') $('.panel.docked').classList.add('wide');
  closeDockSheets();
  updateDockHead();
}

// --- The slim header (phones held upright), the places and the wallet -------------
// Mark: "Having 6 or 8 tabs taking up so much space feels wasteful." On a phone held
// upright the tabs give way to one header, "Station name · Market ▾", that opens the places
// laid out like the flight view picker, with a dot when anything inside has news; and a wallet
// button with your credits replaces the Credits line and the Money tab (Mark: "Maybe we should
// have a wallet rather than Credits"). docs/design/flight-hud-and-touch.md.

/** A tab's name without its key or its badge ("Shipyard", not "Shipyard ready": Mark's screenshot). */
const tabName = (b: HTMLElement) => {
  const label = b.getAttribute('aria-label');
  if (label) return label.replace(/,.*$/, '').trim();
  const copy = b.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.tab-badge, .key').forEach((n) => n.remove());
  return (copy.textContent ?? '').trim();
};

export function updateDockHead() {
  const tabs = [...document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]')];
  const active = tabs.find((b) => b.dataset.tab === game.dockTab);
  $('.dock-where').textContent = game.commander ? `${stationName(currentSystem()).name}\u00a0·\u00a0` : '';
  $('.dock-which').textContent = game.dockTab === 'money' ? 'Money' : active ? tabName(active) : '';
  const news = tabs.some((b) => !b.hidden && b.dataset.tab !== game.dockTab && b.querySelector('.tab-badge'));
  $('.dock-dot').hidden = !news;
  $('.dock-place').setAttribute('aria-label', `${$('.dock-which').textContent}: choose a place${news ? ', something new' : ''}`);
  $('#dock-places').innerHTML = tabs
    .filter((b) => !b.hidden && b.dataset.tab !== 'money')
    .map((b) => {
      const badge = b.querySelector('.tab-badge')?.textContent?.trim();
      return `<button type="button" data-place="${b.dataset.tab}" aria-pressed="${b.dataset.tab === game.dockTab}">${escapeHtml(tabName(b))}${badge ? ` <b class="tab-badge">${escapeHtml(badge)}</b>` : ''}</button>`;
    })
    .join('');
  if (game.commander) {
    // The station's own money beside your credits, where you hold some (wide screens; a phone shows credits only).
    const c = cmdr();
    const cur = c.difficulty === 'modern' ? currencyOf(currentSystem()) : null;
    const local = cur ? (walletOf(c)[walletKey(currentSystem())] ?? 0) : 0;
    $('.wallet-button').innerHTML = `${Math.floor(c.credits).toLocaleString()} Cr${local >= 0.01 ? `<span class="wallet-local"> · ${local.toLocaleString(undefined, { maximumFractionDigits: local < 10 ? 2 : 0 })} ${cur!.ticker}</span>` : ''}`;
  }
  if (!$('#wallet-sheet').hidden) renderWallet();
}

function closeDockSheets() {
  for (const [sheet, button] of [['#dock-places', '.dock-place'], ['#wallet-sheet', '.wallet-button']]) {
    $(sheet).hidden = true;
    $(button).setAttribute('aria-expanded', 'false');
  }
}

function toggleSheet(sheet: string, button: string) {
  const open = $(sheet).hidden;
  closeDockSheets();
  if (!open) return;
  if (sheet === '#wallet-sheet') renderWallet();
  $(sheet).hidden = false;
  $(button).setAttribute('aria-expanded', 'true');
}
$('.dock-place').addEventListener('click', () => toggleSheet('#dock-places', '.dock-place'));
$('.wallet-button').addEventListener('click', () => toggleSheet('#wallet-sheet', '.wallet-button'));
$('#dock-places').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-place]');
  if (!b) return;
  sfx.beep();
  setDockTab(b.dataset.place as DockTab);
});

/** The wallet: everything you hold, each in credits, and where to change it. */
function renderWallet() {
  const c = cmdr();
  const now = Date.now();
  const btc = btcNow();
  const fmtN = (n: number, d = n < 10 ? 2 : 0) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: n < 10 && n > 0 ? Math.min(d, 2) : 0 });
  const modern = c.difficulty === 'modern';
  const here = currentSystem();
  let total = c.credits;
  const row = (kind: string, amount: string, line: string) => `<li class="w-${kind}"><strong>${amount}</strong><span>${line}</span></li>`;
  const rows = [row('credits', `${fmtN(c.credits, 1)} Cr`, modern ? 'Credits: good at every station. Fines come out of these.' : 'Credits: good at every station.')];
  const sats = satsOf(c);
  if (sats) {
    total += btcValue(c);
    rows.push(row('btc', formatBtc(sats), `Bitcoin: ${btcValue(c) ? `about ${fmtN(btcValue(c), 0)} Cr now` : 'its price comes in with the news'}. Nobody can take it.`));
  }
  if (modern)
    for (const [key, units] of Object.entries(walletOf(c)).filter(([k, u]) => u > 1e-6 && !k.startsWith('co:'))) {
      const home = walletHome(key);
      const hc = currencyOf(home)!;
      const value = valueOf(key, units, now, btc);
      total += value;
      const atHome = key === walletKey(here);
      const change = atHome ? weekChange(home, now, btc) : 0;
      const move = atHome ? (Math.abs(change) < 0.05 ? ' Steady this week.' : ` ${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}% this week.`) : ` Change it here, or for less at ${escapeHtml(home.name)}.`;
      rows.push(row(atHome ? 'here' : 'local', `${fmtN(units)} ${hc.ticker}`, `${escapeHtml(hc.name)}, ${escapeHtml(home.name)}’s money: about ${fmtN(value, 0)} Cr.${move}`));
    }
  const actions = modern ? `<div class="wallet-actions"><button type="button" class="primary" data-wallet="money">Change money</button><button type="button" data-wallet="market">Bitcoin market</button></div>` : '';
  $('#wallet-sheet').innerHTML = `<p class="wallet-title">Your wallet${rows.length > 1 ? ` <span>about ${fmtN(total, 0)} Cr in all</span>` : ''}</p><ul class="wallet-list">${rows.join('')}</ul>${actions}`;
  $('#wallet-sheet').querySelectorAll<HTMLButtonElement>('[data-wallet]').forEach((b) =>
    b.addEventListener('click', () => {
      sfx.beep();
      setDockTab(b.dataset.wallet as DockTab);
    }),
  );
}
document.querySelectorAll<HTMLButtonElement>('.tabs [data-tab]').forEach((b) =>
  b.addEventListener('click', () => {
    b.blur();
    setDockTab(b.dataset.tab as DockTab);
  }),
);
