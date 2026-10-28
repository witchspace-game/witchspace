// The money page's examples (/economy/): from Lave outward, the nearest real
// system for each kind of money, worked out from the galaxy's seed at build time,
// so the page reads complete without scripts (and to anything that reads it as
// text). src/site/economy.ts brings the rates up to date in the browser.

import { currencyOf, fairRate, POLICY_TEXT, type Policy } from '../src/economy/currencies';
import { distanceLy, galaxy, GOVERNMENTS, HOME } from '../src/galaxy/generate';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The order the page explains them in: safest first. */
const ORDER: Policy[] = ['reserve', 'feudal', 'scarce', 'basket', 'inflation', 'official', 'printing'];

/** One system per kind of money, the nearest to Lave, as a table. */
export function currencyExamplesHtml(now = Date.now()): string {
  const all = galaxy(HOME.galaxy);
  const lave = all[HOME.index];
  const near = [...all].sort((a, b) => distanceLy(lave, a) - distanceLy(lave, b));
  const rows = ORDER.map((policy) => {
    const s = near.find((x) => currencyOf(x)?.policy === policy);
    if (!s) return '';
    const c = currencyOf(s)!;
    const rate = fairRate(s, now);
    const ly = distanceLy(lave, s);
    return `<tr data-galaxy="${s.galaxy}" data-system="${s.index}">
      <td><b>${esc(s.name)}</b><small>${esc(GOVERNMENTS[s.government])}${ly ? ` · ${ly.toFixed(1)} LY from Lave` : ''}</small></td>
      <td><b>${esc(c.name)}</b> <code>${esc(c.ticker)}</code></td>
      <td>${esc(POLICY_TEXT[policy].name)}<small>${esc(POLICY_TEXT[policy].line)}</small></td>
      <td class="fx-rate" data-rate>${rate < 10 ? rate.toFixed(3) : Math.round(rate).toLocaleString('en-GB')}</td>
    </tr>`;
  }).join('');
  return `<div class="fx-table-wrap"><table class="fx-table">
    <thead><tr><th>System</th><th>Its money</th><th>How it’s run</th><th>Per credit</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`;
}
