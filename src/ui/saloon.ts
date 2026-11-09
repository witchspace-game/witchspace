// The Saloon (moved from main.ts; docs/design/trading.md, section 3; game/saloon.ts): two to four
// regulars, coming and going with the clock. Buy one a drink and they talk; the ones who know
// something early want paying properly, and so do the liars. Their record builds as their tips
// come true or don't.

import { sharedRecord } from '../net/renowned';
import { sfx } from '../audio/sound';
import { saveCommander } from '../game/commander';
import { stationName } from '../galaxy/stationNames';
import { systemAt, type StarSystem } from '../galaxy/generate';
import { VENN, freshMemory, vennAtStation, vennAway, vennPrices, vennRoute, vennSightings, vennStanding, vennVisits } from '../game/odile';
import { linkSystem, plotCourse } from './contracts';
import { flash } from './hud';
import { escapeHtml } from './escape';
import { record, regularsAt, slotOf, talk, venue } from '../game/saloon';
import { hasBackRoom } from '../economy/blackmarket';
import { $, cmdr, currentSystem, type DockTab } from '../core';
import { HIS_DRINK, inTheSaloon, renownedOf, saloonScene } from '../game/renowned';

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
  const venn = vennCard(here, now, s.drinks) + renownedCard(here, now, slot, s.drinks);
  const back = hasBackRoom(c, here) ? `<button type="button" class="saloon-back">A door at the back ›</button>` : '';
  $('#saloon').innerHTML = `
    <h3>${escapeHtml(v.name)} <small>the ${v.kind} at ${escapeHtml(stationName(here).name)}</small></h3>
    <p class="meta">Regulars come and go every couple of hours. What they tell you might be worth a fortune, or nothing at all: nobody here wears a label.</p>
    <ul class="regulars">${venn}${cards}</ul>
    ${back}`;
}

/** The system's renowned pirate, when he's in (game/renowned.ts): licking his wounds, gloating, or on his off hours (Mark). Modern only. */
function renownedCard(here: StarSystem, now: number, slot: number, drinks: string[]): string {
  const c = cmdr();
  const who = renownedOf(here);
  if (!who || c.difficulty !== 'modern') return '';
  const m = c.renowned?.[who.key];
  const shared = sharedRecord(here.galaxy, here.index);
  const scene = inTheSaloon(here, m, slot, now, shared);
  if (!scene) return '';
  const said = saloonScene(who, scene, m, c.name, shared, now);
  const drunk = drinks.includes(`renowned@${slot}`);
  const action = said.refuses
    ? `<button disabled>Buy him a drink · ${HIS_DRINK} Cr</button>`
    : drunk
      ? ''
      : said.buys
        ? '<button data-renowned>Sit down with him</button>'
        : `<button data-renowned ${c.credits < HIS_DRINK ? 'disabled' : ''}>Buy him a drink · ${HIS_DRINK} Cr</button>`;
  return `<li class="regular regular-renowned${said.refuses ? ' regular-crossed' : ''}"><strong>${escapeHtml(who.name)}</strong> <small>“${escapeHtml(who.by)}”, pirate, Cobra Mk III ${escapeHtml(who.ship)}</small>
    <p class="regular-look">${escapeHtml(said.look)}</p>
    ${said.refuses || drunk ? `<p class="regular-says">“${escapeHtml(said.says)}”</p>` : ''}
    ${action ? `<p class="regular-actions">${action}</p>` : ''}</li>`;
}

/** The drink you bought her on this visit of hers. */
const vennDrink = (n: number) => `venn@${n}`;
const VENN_DRINK = 5;

/** Odile Venn, on her port days: always at the same table (game/odile.ts). What she says depends on what she remembers of you. */
function vennCard(here: StarSystem, now: number, drinks: string[]): string {
  const c = cmdr();
  const due = vennAtStation(here, now);
  if (!due?.inPort || vennAway(c.venn, now)) return '';
  const m = c.venn ?? freshMemory();
  const standing = vennStanding(m, now);
  const from = systemAt(here.galaxy, due.visit.from);
  const head = `<strong>${escapeHtml(VENN.name)}</strong> <small>Carriers' Mutual captain, ${escapeHtml(VENN.ship)}</small>`;
  const card = (look: string, said: string, actions = '', cls = '') =>
    `<li class="regular regular-venn ${cls}">${head}<p class="regular-look">${escapeHtml(look)}</p>${said ? `<p class="regular-says">${said}</p>` : ''}${actions ? `<p class="regular-actions">${actions}</p>` : ''}</li>`;
  const quote = (text: string, where: StarSystem) => `“${linkSystem(text, where)}”`;
  const were = (good: string) => (good.endsWith('s') ? 'were' : 'was');

  if (standing === 'crossed') return card("doesn't look up", '“No.”', `<button disabled>Buy her a drink · ${VENN_DRINK} Cr</button>`, 'regular-crossed');

  // Meridian, after the Riedquat run: why she bothers, and what the compartment holds.
  if (here.galaxy === 0 && here.index === MERIDIAN && standing === 'trusted') {
    const story =
      '“Twenty-eight captains met in this bar, when Riedquat still grew wheat. Hale &amp; Ostrander had pulled out and left them with nothing. They agreed three things: share the risk, share the work, come when called. My father was one of them. The Mutual went where the law was. I never did.”';
    const route = vennRoute(here, now);
    const answers = [
      asked.has('founder') ? '<p class="regular-says">“Another time.” She changes the subject.</p>' : '',
      asked.has('ledger')
        ? `<p class="regular-says">“My ledgers. Thirty years of every price I've seen, and where it went next. Hexon would give more for them than for Second Wind.”${route ? ` Then, quieter: ${quote(`You've earned one. ${route.good} here at ${route.buy}, sold at ${systemAt(0, route.to).name} for ${route.sell}. Tonight.`, systemAt(0, route.to))}` : ''}</p>`
        : '',
    ].join('');
    const ask = [!asked.has('founder') ? '<button data-venn-ask="founder">Who was the twenty-eighth?</button>' : '', !asked.has('ledger') ? `<button data-venn-ask="ledger">What's in the compartment?</button>` : ''].join('');
    return `<li class="regular regular-venn">${head}<p class="regular-look">beside an empty chair nobody sits in</p><p class="regular-says">${story}</p>${answers}${ask ? `<p class="regular-actions">${ask}</p>` : ''}</li>`;
  }

  if (standing === 'trusted') {
    // The ledgers' route, once she's told you about them; otherwise the invitation, if Riedquat's tonight.
    const route = m.riedquat ? vennRoute(here, now) : null;
    if (route) return card('already has a drink waiting for you', quote(`From the ledgers: ${route.good}, ${route.buy} here, ${route.sell} at ${systemAt(0, route.to).name}. Go before Hexon notices.`, systemAt(0, route.to)));
    const riedquat = vennVisits(now, now + 12 * 3600_000).find((v) => v.system === MERIDIAN);
    if (riedquat && !declined.has(riedquat.n))
      return card(
        'already has a drink waiting for you',
        `“I go out to Riedquat ${riedquat.from === here.index ? 'from here' : `after ${escapeHtml(systemAt(0, riedquat.from).name)}`} tonight. Food, at cost. The crew out there's new and doesn't know me. The company would be nice.”`,
        `<button data-venn-fly="${riedquat.n}">Fly it with her</button><button data-venn-decline="${riedquat.n}">Not tonight</button>`,
      );
    const two = vennSightings(here, due.visit, now).slice(0, 2);
    return card('already has a drink waiting for you', two.length ? quote(`${c.name}. ${two.map((p) => `${p.good} ${were(p.good)} ${p.there} at ${from.name}, ${p.here} here`).join('; ')}.`, from) : '');
  }

  const drunk = drinks.includes(vennDrink(due.visit.n));
  const buy = `<button data-venn ${c.credits < VENN_DRINK ? 'disabled' : ''}>Buy her a drink · ${VENN_DRINK} Cr</button>`;
  if (standing === 'known') {
    const two = drunk ? vennSightings(here, due.visit, now).slice(0, 2) : [];
    const said = !drunk ? '' : two.length ? quote(`${c.name}. ${two.map((p) => `${p.good} ${were(p.good)} ${p.there} at ${from.name} when I left, ${p.here} here`).join('. ')}.`, from) : '“Nothing worth your while today. That happens.”';
    return card('pushes the other chair out with her foot', said, drunk ? '' : buy);
  }
  const p = drunk ? vennPrices(here, due.visit, now) : null;
  const said = p ? quote(`${p.good} ${were(p.good)} ${p.there} at ${from.name} when I left. ${p.here} here. Do with that what you like.`, from) : drunk ? '“Nothing worth your while today. That happens.”' : '';
  return card('at the table by the empty chair, counting something', said, drunk ? '' : buy);
}

/** Meridian Station, Riedquat: where the Mutual began. */
const MERIDIAN = 46;
/** What you've asked her at Meridian, and the Riedquat runs you've said no to, this session. */
const asked = new Set<string>();
const declined = new Set<number>();

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
  if (b.dataset.vennAsk) {
    asked.add(b.dataset.vennAsk);
    if (b.dataset.vennAsk === 'ledger') (c.venn ??= freshMemory()).riedquat = true;
    saveCommander(c);
    renderSaloon();
    return;
  }
  if (b.dataset.vennFly || b.dataset.vennDecline) {
    if (b.dataset.vennFly) flash(plotCourse(c, MERIDIAN), 3);
    declined.add(Number(b.dataset.vennFly ?? b.dataset.vennDecline));
    saveCommander(c);
    renderSaloon();
    return;
  }
  if (b.dataset.renowned !== undefined) {
    const who = renownedOf(here);
    const m = who ? c.renowned?.[who.key] : undefined;
    const shared = sharedRecord(here.galaxy, here.index);
    const scene = who && inTheSaloon(here, m, slot, now, shared);
    if (!who || !scene) return;
    const said = saloonScene(who, scene, m, c.name, shared, now);
    if (said.refuses || (!said.buys && c.credits < HIS_DRINK)) return;
    if (!said.buys) c.credits = Math.round((c.credits - HIS_DRINK) * 10) / 10;
    s.drinks = [...s.drinks, `renowned@${slot}`].slice(-40);
    saveCommander(c);
    sfx.beep();
    renderSaloon();
    return;
  }
  if (b.dataset.venn !== undefined) {
    const due = vennAtStation(here, now);
    if (!due?.inPort || c.credits < VENN_DRINK) return;
    c.credits = Math.round((c.credits - VENN_DRINK) * 10) / 10;
    s.drinks = [...s.drinks, vennDrink(due.visit.n)].slice(-40);
    (c.venn ??= freshMemory()).drinks++;
    saveCommander(c);
    sfx.beep();
    renderSaloon();
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
