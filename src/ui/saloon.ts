// The Saloon (moved from main.ts; docs/design/trading.md, section 3; game/saloon.ts): two to four
// regulars, coming and going with the clock. Buy one a drink and they talk; the ones who know
// something early want paying properly, and so do the liars. Their record builds as their tips
// come true or don't.

import { sfx } from '../audio/sound';
import { saveCommander } from '../game/commander';
import { stationName } from '../galaxy/stationNames';
import { systemAt } from '../galaxy/generate';
import { escapeHtml } from './escape';
import { linkSystem } from './contracts';
import { record, regularsAt, slotOf, talk, venue } from '../game/saloon';
import { hasBackRoom } from '../economy/blackmarket';
import { $, cmdr, currentSystem, type DockTab } from '../core';

/** What main.ts still owns (it fills these in at start). */
const main = {} as { setDockTab(tab: DockTab): void };
export const initSaloon = (hooks: typeof main) => Object.assign(main, hooks);

export function renderSaloon() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  const v = venue(here);
  const slot = slotOf(now);
  const s = (c.saloon ??= { drinks: [], heard: [] });
  const sysName = (i: number) => systemAt(here.galaxy, i).name;
  const cards = regularsAt(here, now)
    .map((r) => {
      const drunk = s.drinks.includes(`${r.id}@${slot}`);
      const heard = s.heard.find((h) => h.who === r.id && h.slot === slot);
      const words = drunk ? talk(r, sysName, Boolean(heard?.paid)) : null;
      const rec = record(s.heard, r.id, now);
      const before = s.heard.some((h) => h.who === r.id && h.slot !== slot); // on an earlier visit
      const known = rec.right || rec.wrong ? `Their tips: ${rec.right} came true${rec.wrong ? ` · ${rec.wrong} didn't` : ''}` : before ? 'You have heard from them before: too soon to say' : '';
      const action = !drunk
        ? `<button data-drink="${r.id}" ${c.credits < r.drink ? 'disabled' : ''}>Buy a drink · ${r.drink} Cr</button>`
        : words?.more
          ? `<button data-pay="${r.id}" ${c.credits < r.price ? 'disabled' : ''}>Pay ${r.price} Cr for the rest</button>`
          : '';
      return `<li class="regular regular-${r.mood}">
        <strong>${escapeHtml(r.name)}</strong> <small>${escapeHtml(r.trade)}</small>
        <p class="regular-look">${escapeHtml(r.look)}</p>
        ${known ? `<p class="regular-record">${escapeHtml(known)}</p>` : ''}
        ${words ? `<p class="regular-says">“${r.tip && !words.more ? linkSystem(words.said, systemAt(here.galaxy, r.tip.system)) : escapeHtml(words.said)}”</p>` : ''}
        ${action ? `<p class="regular-actions">${action}</p>` : ''}
      </li>`;
    })
    .join('');
  const back = hasBackRoom(c, here) ? `<button type="button" class="saloon-back">A door at the back ›</button>` : '';
  $('#saloon').innerHTML = `
    <h3>${escapeHtml(v.name)} <small>the ${v.kind} at ${escapeHtml(stationName(here).name)}</small></h3>
    <p class="meta">Regulars come and go every couple of hours. What they tell you might be worth a fortune, or nothing at all: nobody here wears a label.</p>
    <ul class="regulars">${cards}</ul>
    ${back}`;
}

$('#saloon').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  const slot = slotOf(now);
  const s = (c.saloon ??= { drinks: [], heard: [] });
  if (b.classList.contains('saloon-back')) {
    // The back room: through the exchange's own door.
    main.setDockTab('market');
    document.querySelector<HTMLButtonElement>('#exchange .ex-backroom-toggle')?.click();
    return;
  }
  const r = regularsAt(here, now).find((x) => x.id === (b.dataset.drink ?? b.dataset.pay));
  if (!r) return;
  if (b.dataset.drink && c.credits >= r.drink) {
    c.credits = Math.round((c.credits - r.drink) * 10) / 10;
    s.drinks = [...s.drinks, `${r.id}@${slot}`].slice(-40);
    // Glad and mad tell all for a drink; sad and bad want paying for the rest.
    if (r.tip) s.heard = [...s.heard, { who: r.id, name: r.name, galaxy: here.galaxy, at: now, slot, tip: r.tip, paid: r.price === 0 }].slice(-60);
  } else if (b.dataset.pay && c.credits >= r.price) {
    const h = s.heard.find((x) => x.who === r.id && x.slot === slot);
    if (!h) return;
    c.credits = Math.round((c.credits - r.price) * 10) / 10;
    h.paid = true;
  } else return;
  saveCommander(c);
  sfx.beep();
  renderSaloon();
});
