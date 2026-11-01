// Money (docs/design/system-currencies.md): the system's own money, why it's moving,
// changing it, and the other money you hold. Three monies (Mark, 31 October 2026):
// company stablecoins and providing liquidity are hidden, and paid back on docking.

import { sfx } from '../audio/sound';
import { saveCommander } from '../game/commander';
import { BTC_REF, currencyOf, fairRate, moneyReasons, AWAY_FEE, OFFICIAL_LIMIT, POLICY_TEXT, POOL_FEE, poolRate, quoteBuy, quoteSell, awayValue, walletHome, walletKey, weekChange } from '../economy/currencies';
import { buyLocal, changeAway, officialLeft, poolHere, sellLocal, settleHidden, valueOf, walletOf } from '../economy/money';
import { GOVERNMENTS, type StarSystem } from '../galaxy/generate';
import { escapeHtml } from './escape';
import { btcQuote, heardQuote } from '../net/bitcoin';
import { isFresh } from '../economy/bitcoin';
import { $, cmdr, currentSystem, game } from '../core';

// --- Money ---------------------------------------------------------------------------------

/** When you docked: an official-rate station's limit is per visit. */
let dockedAt = 0;
let moneySide: 'buy' | 'sell' = 'buy';
let moneyMessage = '';
/** Told when your money changes, so the wallet button keeps up (main.ts passes the dock header's). */
let moneyChanged = () => {};
export const initMoney = (fn: () => void) => (moneyChanged = fn);

/** The real Bitcoin price, where the money follows it; the reference price if we haven't heard. */
export const btcNow = () => {
  const q = heardQuote();
  return q && isFresh(q) ? q.price : BTC_REF;
};
let moneyAsked = 0;

/** Docking starts a visit, and pays back anything still held in what's hidden (company coins, liquidity). */
export function markDocked() {
  dockedAt = Date.now();
  const c = game.commander;
  if (!c || c.difficulty !== 'modern') return;
  const paid = settleHidden(c, currentSystem(), dockedAt, btcNow());
  if (paid) {
    moneyMessage = `Company coins and pool shares are no longer kept: ${paid.toLocaleString(undefined, { maximumFractionDigits: 1 })} Cr paid back to you.`;
    saveCommander(c);
  }
}

const fmtN = (n: number, d = n < 10 ? 2 : 0) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: n < 10 && n > 0 ? Math.min(d, 2) : 0 });

/** The money's value against the credit over the last week, as a little line. */
function spark(here: StarSystem, now: number, btc: number, change: number): string {
  const pts = [7, 6, 5, 4, 3, 2, 1, 0].map((d) => 1 / fairRate(here, now - d * 86_400_000, btc));
  const lo = Math.min(...pts);
  const hi = Math.max(...pts);
  const y = (v: number) => (hi - lo < 1e-9 ? 20 : 38 - ((v - lo) / (hi - lo)) * 34);
  const line = pts.map((v, i) => `${i * 17},${y(v).toFixed(1)}`).join(' ');
  return `<svg class="money-spark ${change < -0.05 ? 'down' : change > 0.05 ? 'up' : ''}" viewBox="0 0 120 42" aria-hidden="true"><polyline points="${line}" /></svg>`;
}

/** Other systems' money you hold: changed here at its fair rate, less the fee for changing it away from home. */
function others(here: StarSystem, now: number, btc: number): string {
  const rows = Object.entries(walletOf(cmdr()))
    .filter(([key, u]) => u > 1e-6 && key !== walletKey(here) && !key.startsWith('co:'))
    .map(([key, units]) => {
      const home = walletHome(key);
      const hc = currencyOf(home)!;
      return `<li><strong>${fmtN(units)} ${hc.ticker}</strong><span>${escapeHtml(hc.name)}, ${escapeHtml(home.name)}’s money · about ${fmtN(valueOf(key, units, now, btc), 0)} Cr</span><button type="button" data-away="${key}">Change · ${fmtN(awayValue(home, units, now, btc), 0)} Cr</button></li>`;
    });
  if (!rows.length) return '';
  return `<h3>Other money you hold</h3><ul class="money-wallet">${rows.join('')}</ul><p class="yard-note">Changed here at its fair rate, less ${Math.round(AWAY_FEE * 100)}%; cheaper at its own station.</p>`;
}

export function renderMoney() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  // Ask for the price now and then while the tab is open; draw again when it comes.
  if (now - moneyAsked > 60_000) {
    moneyAsked = now;
    void btcQuote().then((q) => q && game.state === 'docked' && game.dockTab === 'money' && renderMoney());
  }
  const btc = btcNow();
  const cur = currencyOf(here);
  const el = $('#money');
  const msg = moneyMessage ? `<p class="yard-message">${escapeHtml(moneyMessage)}</p>` : '';
  moneyMessage = '';
  if (!cur) {
    el.innerHTML = `${msg}<h3>No money is issued here</h3><p class="money-policy">${escapeHtml(POLICY_TEXT.none.line)} Bitcoin trades on the Market.</p>${others(here, now, btc)}`;
  } else {
    const pol = POLICY_TEXT[cur.policy];
    const pool = poolHere(c, here, now, btc);
    const rate = poolRate(pool);
    const change = weekChange(here, now, btc);
    const left = officialLeft(c, here, dockedAt);
    const have = walletOf(c)[walletKey(here)] ?? 0;
    const reasons = moneyReasons(here, now, btc).slice(0, 3);
    const side = (k: 'buy' | 'sell', label: string) => `<button type="button" data-side="${k}" aria-pressed="${moneySide === k}">${label}</button>`;
    el.innerHTML = `${msg}
      <div class="money-head"><h3 class="money-title">${escapeHtml(cur.name)} <span>${cur.ticker}</span></h3><span class="money-gov">${GOVERNMENTS[here.government]}</span></div>
      <p class="money-policy"><b>${escapeHtml(pol.name)}.</b> ${escapeHtml(pol.line)}</p>
      <div class="money-rate">
        <div><strong>1 Cr = ${fmtN(rate, 3)} ${cur.ticker}</strong>
        <span class="${change < -0.05 ? 'down' : change > 0.05 ? 'up' : ''}">${Math.abs(change) < 0.05 ? 'Steady this week' : `${change > 0 ? '▲' : '▼'} ${Math.abs(change).toFixed(1)}% this week`}</span></div>
        ${spark(here, now, btc, change)}
      </div>
      <h4 class="money-why">Why it’s moving</h4>
      <ul class="money-reasons">${reasons.map((r) => `<li class="${r.dir < 0 ? 'down' : r.dir > 0 ? 'up' : ''}"><i aria-hidden="true">${r.dir < 0 ? '▼' : r.dir > 0 ? '▲' : '='}</i>${escapeHtml(r.text)}</li>`).join('')}</ul>
      <div class="money-form">
        <div class="yard-lasers money-sides">${side('buy', `Credits → ${cur.ticker}`)}${side('sell', `${cur.ticker} → credits`)}</div>
        <label class="money-amount"><span>${moneySide === 'buy' ? 'Credits to change' : `${cur.ticker} to change (you have ${fmtN(have)})`}</span><input id="money-n" type="number" min="0" step="any" inputmode="decimal" /></label>
        <p class="money-quote" id="money-quote">&nbsp;</p>
        <button type="button" class="primary money-go">Change</button>
        ${Number.isFinite(left) ? `<p class="yard-note">The state lets each visitor change ${fmtN(OFFICIAL_LIMIT, 0)} Cr a visit: ${fmtN(left, 0)} Cr left.</p>` : ''}
      </div>
      <p class="money-held">You hold <b>${fmtN(have)} ${cur.ticker}</b>${have > 1e-6 ? ` · about ${fmtN(valueOf(walletKey(here), have, now, btc), 0)} Cr` : ''}</p>
      ${others(here, now, btc)}`;
    const input = el.querySelector<HTMLInputElement>('#money-n')!;
    const quote = el.querySelector<HTMLElement>('#money-quote')!;
    const fee = ` <span class="dim">· ${(POOL_FEE * 100).toFixed(1)}% fee</span>`;
    input.oninput = () => {
      const n = Number(input.value);
      if (!(n > 0)) return (quote.innerHTML = '&nbsp;');
      quote.innerHTML = moneySide === 'buy' ? `You get about <b>${fmtN(quoteBuy(pool, Math.min(n, c.credits)))} ${cur.ticker}</b>${fee}` : `You get about <b>${fmtN(quoteSell(pool, Math.min(n, have)), 1)} Cr</b>${fee}`;
    };
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-side]'))
      b.onclick = () => {
        moneySide = b.dataset.side as 'buy' | 'sell';
        renderMoney();
      };
    el.querySelector<HTMLButtonElement>('.money-go')!.onclick = () => {
      const n = Number(input.value);
      done(moneySide === 'buy' ? buyLocal(c, here, n, Date.now(), dockedAt, btc) : sellLocal(c, here, n, Date.now(), dockedAt, btc));
    };
  }
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-away]')) b.onclick = () => done(changeAway(c, here, b.dataset.away!, walletOf(c)[b.dataset.away!] ?? 0, Date.now(), btc));
}

function done(r: { ok: boolean; message: string }) {
  moneyMessage = r.message;
  if (r.ok) {
    saveCommander(cmdr());
    sfx.beep();
  }
  renderMoney();
  moneyChanged();
}
