// Money (moved from main.ts; docs/design/system-currencies.md, stage one): the system's currency,
// the station's pool and your wallet, and the Bitcoin price the money follows.

import { sfx } from '../audio/sound';
import { saveCommander, type Commander } from '../game/commander';
import { backing, BTC_REF, companyKey, companyValue, COLLATERAL, crisis, currencyOf, fairRate, feeYield, isCompanyKey, mintedToday, positionNow, reserveShare, OFFICIAL_LIMIT, POLICY_TEXT, POOL_FEE, poolRate, quoteBuy, quoteSell, stableValue, supplyOf, walletHome, walletKey } from '../economy/currencies';
import { addLiquidity, buyLocal, cashStable, mintCompany, officialLeft, poolHere, redeemCompany, sellLocal, valueOf, walletOf, withdrawLiquidity } from '../economy/money';
import { COMPANIES, COMPANY_IDS, type CompanyId } from '../game/companies';
import { type StarSystem } from '../galaxy/generate';
import { activeEvent, EVENT_KINDS, outputAt } from '../economy/events';
import { escapeHtml } from './escape';
import { btcQuote, heardQuote } from '../net/bitcoin';
import { isFresh } from '../economy/bitcoin';
import { $, cmdr, currentSystem, game } from '../core';

// --- Money: the system's currency, the station's pool and your wallet ----------------------
// (docs/design/system-currencies.md, stage one.)

/** When you docked: an official-rate station's limit is per visit. */
let dockedAt = 0;
/** Docking starts a visit. */
export function markDocked() {
  dockedAt = Date.now();
}
let moneySide: 'buy' | 'sell' = 'buy';
let moneyMessage = '';

/** The real Bitcoin price, where the money follows it; the reference price if we haven't heard. */
export const btcNow = () => {
  const q = heardQuote();
  return q && isFresh(q) ? q.price : BTC_REF;
};
let moneyAsked = 0;

/** Providing liquidity to this station's pool: the offer, or your position and what it's done. */
function liquidity(c: Commander, here: StarSystem, ticker: string, btc: number, now: number, fmtN: (n: number, d?: number) => string): string {
  const p = c.fx?.lp?.[walletKey(here)];
  if (p) {
    const pos = positionNow(here, p, now, btc);
    const loss = pos.held > 0 ? ((pos.value - pos.fees) / pos.held - 1) * 100 : 0;
    return `<h3>Your liquidity here</h3><div class="money-form">
      <p class="money-quote">Worth ${fmtN(pos.value, 0)} Cr now: ${fmtN(pos.credits, 0)} Cr and ${fmtN(pos.local)} ${ticker}, with ${fmtN(pos.fees, 1)} Cr in fees.</p>
      <p class="yard-note">Had you simply held what you put in: ${fmtN(pos.held, 0)} Cr. ${Math.abs(loss) < 0.05 ? 'The rate hasn’t moved.' : `The rate's move has cost ${Math.abs(loss).toFixed(1)}% against holding (impermanent loss); the fees make up for it over time.`}</p>
      <button type="button" class="lp-out">Withdraw it all</button></div>`;
  }
  return `<h3>Provide liquidity</h3><div class="money-form">
    <p class="yard-note">Put credits and the same value of ${ticker} into the pool, and share its fees: about ${Math.round(feeYield(here) * 100)}% a year here. The risk is real: if the rate moves, you come out holding more of whichever side fell.</p>
    <label class="money-amount"><span>Credits to put in (with the matching ${ticker} from your wallet)</span><input id="lp-n" type="number" min="0" step="any" inputmode="decimal" /></label>
    <button type="button" class="lp-add">Add to the pool</button></div>`;
}

/** The companies' Bitcoin-backed coins: taken at any station, minted and redeemed here. */
function companyDesk(btc: number, live: boolean | null | undefined, fmtN: (n: number, d?: number) => string): string {
  const v = companyValue(btc);
  return `<h3>Company stablecoins</h3><div class="money-form">
    <p class="yard-note">Each big company issues a coin backed by Bitcoin locked up at ${Math.round(COLLATERAL * 100)}% of its value: no bank needed, taken at any station. ${live ? (v < 1 ? `Bitcoin has fallen so far the backing no longer covers them: a coin redeems for ${fmtN(v, 3)} Cr.` : `At today's Bitcoin price the backing is ${Math.round(COLLATERAL * (btc / BTC_REF) * 100)}%: a coin redeems for 1 Cr.`) : ''}</p>
    <div class="co-row"><select id="co-pick">${COMPANY_IDS.map((id) => `<option value="${id}">${escapeHtml(COMPANIES[id].name)}</option>`).join('')}</select><input id="co-n" type="number" min="0" step="any" inputmode="decimal" placeholder="Credits" /></div>
    <button type="button" class="co-mint">Mint coins (a credit each, 0.3% fee)</button></div>`;
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
  const live = heardQuote() && isFresh(heardQuote());
  const cur = currencyOf(here);
  const el = $('#money');
  const fmtN = (n: number, d = n < 10 ? 2 : 0) => n.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: n < 10 && n > 0 ? Math.min(d, 2) : 0 });
  const msg = moneyMessage ? `<p class="yard-message">${escapeHtml(moneyMessage)}</p>` : '';
  moneyMessage = '';
  const wallet = Object.entries(walletOf(c)).filter(([, u]) => u > 1e-6);
  const holdings = wallet.length
    ? `<ul class="money-wallet">${wallet
        .map(([key, units]) => {
          if (isCompanyKey(key)) {
            const co = COMPANIES[key.slice(3) as CompanyId];
            return `<li><strong>${fmtN(units)} ${escapeHtml(co?.name.split(' ')[0] ?? key)} coins</strong><span>${escapeHtml(co?.name ?? key)} · Bitcoin-backed · about ${fmtN(units * companyValue(btc), 0)} Cr</span><button type="button" data-redeem="${key.slice(3)}">Redeem</button></li>`;
          }
          const home = walletHome(key);
          const hc = currencyOf(home)!;
          const atHome = key === walletKey(here);
          const value = valueOf(key, units, now, btc);
          const action = atHome ? '<small>Change it above</small>' : hc.stable ? `<button type="button" data-cash="${key}">Cash it · ${fmtN(stableValue(home, units, now, btc), 0)} Cr</button>` : `<small>Change it at ${escapeHtml(home.name)}</small>`;
          return `<li><strong>${fmtN(units)} ${hc.ticker}</strong><span>${escapeHtml(hc.name)} · ${escapeHtml(home.name)} · about ${fmtN(value, 0)} Cr</span>${action}</li>`;
        })
        .join('')}</ul>`
    : '<p class="meta">Nothing yet. Money you change takes no hold space and survives your ship, like Bitcoin.</p>';
  if (!cur) {
    el.innerHTML = `${msg}<h3>No money is issued here</h3><p class="money-line">${escapeHtml(POLICY_TEXT.none.line)} Stablecoins from elsewhere are taken here at their rate.</p><h3>Your wallet</h3>${holdings}${companyDesk(btc, live, fmtN)}`;
  } else {
    const pol = POLICY_TEXT[cur.policy];
    const pool = poolHere(c, here, now, btc);
    const rate = poolRate(pool);
    const fair = fairRate(here, now, btc);
    const week = fairRate(here, now - 7 * 86_400_000, btc);
    const change = (week / fair - 1) * 100; // the money's value against the credit
    const trouble = cur.policy === 'feudal' ? crisis(here, now, 0.15) : cur.policy === 'printing' ? crisis(here, now, 0.12) : 0;
    const left = officialLeft(c, here, dockedAt);
    const have = walletOf(c)[walletKey(here)] ?? 0;
    const supply = supplyOf(here, now, btc);
    const minted = mintedToday(here, now, btc);
    const big = (n: number) => (n >= 1e9 ? `${fmtN(n / 1e9, 1)}bn` : n >= 1e6 ? `${fmtN(n / 1e6, 1)}m` : fmtN(n, 0));
    const output = outputAt(here, now);
    const shock = activeEvent(here, now);
    const floats = cur.policy === 'inflation' || cur.policy === 'printing' || cur.policy === 'scarce';
    const outputLine =
      Math.abs(output - 1) < 0.02
        ? ''
        : `<p class="money-line ${output < 1 ? 'short' : ''}">${shock ? `${escapeHtml(EVENT_KINDS[shock.type].name)}: o` : 'O'}utput here is ${output < 1 ? 'down' : 'up'} ${Math.round(Math.abs(output - 1) * 100)}%. ${
            floats
              ? output < 1
                ? `The same ${cur.ticker} chases fewer goods, so each buys less until it recovers.`
                : `More goods for the same ${cur.ticker}: each buys more while it lasts.`
              : cur.stable
                ? `The issuer ${output < 1 ? 'burns' : 'mints'} ${cur.ticker} to hold the peg.`
                : 'The state holds its rate regardless.'
          }</p>`;
    el.innerHTML = `${msg}
      <h3 class="money-title">${escapeHtml(cur.name)} <span>${cur.ticker}</span></h3>
      <p class="money-policy"><b>${escapeHtml(pol.name)}.</b> ${escapeHtml(pol.line)}</p>
      ${trouble > 0.05 ? `<p class="money-crisis">${cur.policy === 'feudal' ? `The peg has broken: a ${cur.ticker} is worth ${fmtN(1 / fair, 2)} Cr. The algorithm is minting to defend it, which only makes it worse.` : 'The presses are running day and night: prices here are climbing by the hour.'}</p>` : ''}
      ${cur.policy === 'reserve' ? `<p class="money-line ${backing(here, btc) < 1 ? 'short' : ''}">Reserves published: ${Math.round((1 - reserveShare(here)) * 100)}% in credits, ${Math.round(reserveShare(here) * 100)}% in Bitcoin. ${live ? `At today's Bitcoin price they cover ${Math.round(backing(here, btc) * 100)}% of the coins${backing(here, btc) < 1 ? ': short, and holders are running' : ''}.` : ''}</p>` : ''}
      ${cur.policy === 'scarce' && live ? `<p class="money-line">Bitcoin today: $${Math.round(btc).toLocaleString()} (1 Cr = $1). This money rises and falls with it.</p>` : ''}
      <dl class="money-rates">
        <div><dt>Here</dt><dd>1 Cr = ${fmtN(rate, 3)} ${cur.ticker}</dd></div>
        <div><dt>Fair rate</dt><dd>${fmtN(fair, 3)} ${cur.ticker}</dd></div>
        <div><dt>This week</dt><dd class="${change < -0.05 ? 'down' : change > 0.05 ? 'up' : ''}">${Math.abs(change) < 0.05 ? 'Steady against the credit' : `${change > 0 ? '+' : ''}${change.toFixed(1)}% against the credit`}</dd></div>
        <div><dt>The pool</dt><dd>${fmtN(pool.local, 0)} ${cur.ticker} · ${fmtN(pool.credits, 0)} Cr</dd></div>
        <div><dt>In circulation</dt><dd>${big(supply)} ${cur.ticker}</dd></div>
        <div><dt>Today</dt><dd>${Math.abs(minted) < supply * 0.0005 ? 'Nothing minted or burned' : `${big(Math.abs(minted))} ${minted > 0 ? 'minted' : 'burned'}`}</dd></div>
      </dl>
      ${outputLine}
      <div class="money-form">
        <div class="yard-lasers money-sides"><button type="button" data-side="buy" aria-pressed="${moneySide === 'buy'}">Buy ${cur.ticker}</button><button type="button" data-side="sell" aria-pressed="${moneySide === 'sell'}">Sell ${cur.ticker}</button></div>
        <label class="money-amount"><span>${moneySide === 'buy' ? 'Credits to change' : `${cur.ticker} to sell (you have ${fmtN(have)})`}</span><input id="money-n" type="number" min="0" step="any" inputmode="decimal" /></label>
        <p class="money-quote" id="money-quote">&nbsp;</p>
        <button type="button" class="primary money-go">${moneySide === 'buy' ? `Change for ${cur.ticker}` : 'Change for credits'}</button>
        ${Number.isFinite(left) ? `<p class="yard-note">The state lets each visitor change ${fmtN(OFFICIAL_LIMIT, 0)} Cr a visit: ${fmtN(left, 0)} Cr left.</p>` : ''}
        <p class="yard-note">The pool charges ${(POOL_FEE * 100).toFixed(1)}%, and a big swap moves the rate against you; it drifts back as other traders arbitrage.</p>
      </div>
      ${liquidity(c, here, cur.ticker, btc, now, fmtN)}
      <h3>Your wallet</h3>${holdings}
      ${companyDesk(btc, live, fmtN)}`;
    const input = el.querySelector<HTMLInputElement>('#money-n')!;
    const quote = el.querySelector<HTMLElement>('#money-quote')!;
    const update = () => {
      const n = Number(input.value);
      if (!(n > 0)) return (quote.innerHTML = '&nbsp;');
      quote.textContent = moneySide === 'buy' ? `You get about ${fmtN(quoteBuy(pool, Math.min(n, c.credits)))} ${cur.ticker}` : `You get about ${fmtN(quoteSell(pool, Math.min(n, have)), 1)} Cr`;
    };
    input.oninput = update;
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-side]'))
      b.onclick = () => {
        moneySide = b.dataset.side as 'buy' | 'sell';
        renderMoney();
      };
    el.querySelector<HTMLButtonElement>('.money-go')!.onclick = () => {
      const n = Number(input.value);
      const r = moneySide === 'buy' ? buyLocal(c, here, n, Date.now(), dockedAt, btc) : sellLocal(c, here, n, Date.now(), dockedAt, btc);
      moneyMessage = r.message;
      if (r.ok) {
        saveCommander(c);
        sfx.beep();
      }
      renderMoney();
    };
  }
  const done = (r: { ok: boolean; message: string }) => {
    moneyMessage = r.message;
    if (r.ok) {
      saveCommander(c);
      sfx.beep();
    }
    renderMoney();
  };
  el.querySelector<HTMLButtonElement>('.lp-add')?.addEventListener('click', () => done(addLiquidity(c, here, Number(el.querySelector<HTMLInputElement>('#lp-n')!.value), Date.now(), btc)));
  el.querySelector<HTMLButtonElement>('.lp-out')?.addEventListener('click', () => done(withdrawLiquidity(c, here, Date.now(), btc)));
  el.querySelector<HTMLButtonElement>('.co-mint')?.addEventListener('click', () =>
    done(mintCompany(c, el.querySelector<HTMLSelectElement>('#co-pick')!.value, Number(el.querySelector<HTMLInputElement>('#co-n')!.value), Date.now(), here)),
  );
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-redeem]')) b.onclick = () => done(redeemCompany(c, b.dataset.redeem!, walletOf(c)[companyKey(b.dataset.redeem!)] ?? 0, Date.now(), here, btc));
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-cash]'))
    b.onclick = () => {
      const key = b.dataset.cash!;
      const r = cashStable(c, here, key, walletOf(c)[key] ?? 0, Date.now(), btc);
      moneyMessage = r.message;
      if (r.ok) {
        saveCommander(c);
        sfx.beep();
      }
      renderMoney();
    };
}
