// Company contracts (Modern rules; moved from main.ts): the board at each station, adverts that bring
// players straight to a company's job, plotting courses, and paying commissions.

import { sfx } from '../audio/sound';
import { cargoCapacity, cargoTonnes, loadCommander, saveCommander, type Commander } from '../game/commander';
import { fitCompartment } from '../game/compartment';
import { currentAccount } from '../net/account';
import { abandon, amendsCost, board, TICK, SIGNING_BONUS, welcome, cannotTake, cargoName, collect, DANGEROUS, destinationOf, jumpsBetween, safeRoute, makeAmends, nextHop, standing, surveyDone, take, type Contract } from '../game/contracts';
import { ADRIFT_HOLD, assignmentFor, offerFor, companyHere, decide, incidentChoices, type Choice, fileOn, RIVAL, rivalPrice, sellToRival, type Message } from '../game/assignments';
import { COMPANIES, COMPANY_IDS, standingName, type CompanyId } from '../game/companies';
import { isSurveyed, worldOf } from '../game/explore';
import { commissionsDue, payCommission } from '../game/commissions';
import { stationName } from '../galaxy/stationNames';
import { flash } from './hud';
import { isMapOpen, showSystem } from './galaxyMap';
import { distanceLy, GOVERNMENTS, systemAt, type StarSystem } from '../galaxy/generate';
import { commodityById } from '../economy/commodities';
import { setCausedEvents } from '../economy/events';
import { escapeHtml } from './escape';
import { $, cmdr, currentSystem, game, modern } from '../core';
import type { DockTab } from '../core';
import { player } from '../scene';

/** What main.ts still owns (it fills these in at start). */
const main = {} as {
  showNewGame(): void;
  enterDocked(newShip?: boolean): void;
  setDockTab(tab: DockTab): void;
  checkSiteSpec(announce: boolean): Promise<void>;
  checkSignedOver(): Promise<void>;
  updateDockHead(): void;
  renderDocked(): void;
  toggleGalaxyMap(): void;
};
export const initContracts = (hooks: typeof main) => Object.assign(main, hooks);

// --- Company contracts (Modern) -----------------------------------------------------

const companyMark = (id: CompanyId) => `<b class="company" style="--company:${COMPANIES[id].colour}">${escapeHtml(COMPANIES[id].name)}</b>`;
const riskTag = (s: StarSystem) => (s.government <= 1 ? ` <em class="risk high">${GOVERNMENTS[s.government]} · pirates</em>` : s.government <= 3 ? ` <em class="risk">${GOVERNMENTS[s.government]}</em>` : '');
let contractMessage = '';
let justTaken: string | null = null; // after taking a contract, show it at the top, highlighted

// Arriving from a company's advert (witchspace.org.uk/careers/, /play/?company=hexon):
// straight to the Contracts tab, with a starter job from that company at the top.
export let recruiter: CompanyId | null = null;
// Or from a live card on witchspace.org.uk/jobs/ (/play/?contract=<id>&company=hexon): that
// contract at the top, highlighted, if it's still on the board here; if not, the welcome.
export let wanted: string | null = null;

export function answerAdvert() {
  const url = new URL(location.href);
  const id = url.searchParams.get('company') as CompanyId | null;
  const contract = url.searchParams.get('contract');
  url.searchParams.delete('contract');
  if (!id || !COMPANY_IDS.includes(id)) return;
  if (contract && /^[a-z0-9:]{1,48}$/.test(contract)) wanted = contract;
  url.searchParams.delete('company');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  recruiter = id;
  const saved = loadCommander();
  if (saved && saved.difficulty !== 'modern') return; // Classic has no companies: just the title
  if (!saved) {
    main.showNewGame(); // pick a callsign; the welcome waits at the station
    return;
  }
  game.commander = saved;
  setCausedEvents(saved.caused);
  main.enterDocked();
  main.setDockTab('contracts');
  void main.checkSiteSpec(true);
  void main.checkSignedOver();
}

/** Wexley-Yorozu's commissions for modules you designed, paid when you dock after one is first fitted. */
export function payCommissions() {
  const c = cmdr();
  const due = commissionsDue(c, currentAccount()?.callsign ?? null, Date.now());
  if (!due.length) return;
  const lines = due.map((x) => payCommission(c, x, Date.now()));
  saveCommander(c);
  markInbox(c);
  sfx.beep();
  setTimeout(() => flash(lines.join(' · '), 6), 1200);
}

/** The welcome job from the company whose advert brought you here, if it's still to be taken, and the card you came for isn't here. */
const welcomeHere = (c: Commander, here: StarSystem, now: number) =>
  recruiter && c.difficulty === 'modern' && !(wanted && board(c, here, now).some((o) => o.id === wanted)) ? welcome(c, here, recruiter, now) : null;

/** When you last looked at the board (or docked): offers posted since are new. */
let boardSeenAt = 0;
/** Docking: what's on the board as you dock isn't news; what's posted while you're here is. */
export function boardSeen() {
  boardSeenAt = Date.now();
}
/** The board as it was last drawn, so a new post can be noticed while you're docked. */
let boardKey = '';
const newOffers = (c: Commander, here: StarSystem, now: number) => board(c, here, now).filter((o) => (o.posted ?? 0) > boardSeenAt).length;

/**
 * Set a course to a system, however many jumps away: the first hop now, the
 * next after each jump (see hyperspace). Returns what to tell the commander.
 */
/** The computer's route: the safe way (Modern), or simply the fewest jumps (Classic). */
export function routeTo(from: StarSystem, end: StarSystem): StarSystem[] | null {
  if (modern()) return safeRoute(from, end);
  const route: StarSystem[] = [];
  for (let at: StarSystem | null = from; at && at !== end; ) {
    at = nextHop(at, end);
    if (!at) return null;
    route.push(at);
  }
  return route.length ? route : null;
}

export function plotCourse(c: Commander, system: number): string {
  const here = currentSystem();
  const end = systemAt(here.galaxy, system);
  const route = routeTo(here, end);
  if (!route) return `${end.name} is out of reach from here`;
  const hop = route[0];
  c.target = hop.index;
  c.courseTo = hop === end ? null : end.index;
  if (hop === end) return `Course set: ${end.name}`;
  // No safe way round: say where the danger is, before you go.
  const risky = route.slice(0, -1).filter(DANGEROUS);
  const warning = risky.length ? ` · no safe way: through ${risky.map((s) => `${s.name} (${GOVERNMENTS[s.government].toLowerCase()})`).join(', ')}` : '';
  const longer = modern() && !risky.length && route.length > jumpsBetween(here, end, 30) ? ' · the safe way round' : '';
  return `Course plotted to ${end.name}: ${route.length} jumps, first ${hop.name}${distanceLy(here, hop) > c.fuel ? ' (refuel first)' : ''}${longer}${warning}`;
}
let openFile: CompanyId | null = null;

/** Special assignments you could take at this station now. */
const specialsHere = (c: Commander, here: StarSystem, now: number) =>
  COMPANY_IDS.filter((id) => companyHere(id, here))
    .map((id) => assignmentFor(c, id, here, now))
    .filter((o): o is Contract & { expires: number } => o !== null);

/** Unread messages, on the Contracts tab's button. */
export function markInbox(c: Commander) {
  const unread = (c.messages ?? []).filter((m) => !m.read).length + (game.state === 'docked' && game.dockTab !== 'contracts' && c.difficulty === 'modern' ? newOffers(c, currentSystem(), Date.now()) : 0);
  // A small badge, not words: "Contracts · 2 new" spilled out of the tab on a phone (Mark).
  const tab = $('.tabs [data-tab="contracts"]');
  tab.innerHTML = unread ? `Contracts <b class="tab-badge">${unread}<span class="tab-badge-word"> new</span></b>` : 'Contracts'; // "2 new" where there's room, "2" on a phone
  tab.setAttribute('aria-label', unread ? `Contracts, ${unread} new` : 'Contracts');
  main.updateDockHead();
}

/** Earlier messages stays open while you archive from it. */
let earlierOpen = false;

export function renderContracts() {
  const c = cmdr();
  const here = currentSystem();
  const now = Date.now();
  const free = cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c);
  const hoursLeft = (t: number) => Math.max(1, Math.round((t - now) / 3600_000));
  const goodName = (id: string) => escapeHtml(commodityById(id)?.name ?? id);
  const place = (s: StarSystem) => `${escapeHtml(s.name)} <small>${distanceLy(here, s).toFixed(1)} LY</small>${riskTag(s)}`;
  // Messages: what's new in full; receipts (paid, handed in) in a line each; anything
  // already read folded away, so the tab opens on the work, not on old news.
  const sender = (m: Message) => (m.from ? `<b class="company">${escapeHtml(m.from)}</b>` : companyMark(m.company));
  const receipt = (m: Message) => /:delivered$/.test(m.id);
  const archive = (m: Message) => `<button type="button" class="message-archive" data-archive="${escapeHtml(m.id)}" aria-label="Archive this message" title="Archive">×</button>`;
  const line = (m: Message) => `<li class="message receipt${m.read ? '' : ' unread'}">${archive(m)}${sender(m)} · <small>${escapeHtml(m.body.replace(/^Your /, '').replace(/ was handed in: /, ' handed in · ').replace(/: ([\d,]+ Cr) paid\./, ' · $1').replace(/\.$/, ''))}</small></li>`;
  // A company's offer says what you can do about it: take it here, or where to go, or that it has gone (Mark).
  const answer = (m: Message) => {
    const o = offerFor(c, m, here, now);
    if (!o) return '';
    if (o.kind === 'taken') return `<br><small class="why">Taken: it's in your contracts</small>`;
    if (o.kind === 'closed') return `<br><small class="why">This offer has closed</small>`;
    const decline = `<button data-decline="${escapeHtml(m.id)}">Decline</button>`;
    if (o.kind === 'here') {
      const why = cannotTake(c, o.offer, free);
      return `<br><small>${o.offer.qty} t ${escapeHtml(cargoName(o.offer))} → ${place(destinationOf(o.offer))} · <b class="pay">${o.offer.pay.toLocaleString()} Cr</b> · closes in ${hoursLeft(o.offer.expires)} h</small>
        <span class="actions"><button data-take="${o.offer.id}" ${why ? `disabled title="${escapeHtml(why)}"` : ''}>Take</button>${decline}</span>${why ? `<small class="why">${escapeHtml(why)}</small>` : ''}`;
    }
    const name = escapeHtml(COMPANIES[m.company].name);
    const s = o.station;
    const where = s ? `Pick it up at any ${name} station: nearest ${escapeHtml(s.system.name)}, ${s.jumps} jump${s.jumps === 1 ? '' : 's'}` : `Pick it up at any ${name} station (none within reach)`;
    const course = !s ? '' : c.target === s.system.index ? '<span class="on-course">On course</span>' : `<button data-course="${s.system.index}">Set course</button>`;
    return `<br><small>${where} · closes in ${hoursLeft(o.offer.expires)} h</small><span class="actions">${course}${decline}</span>`;
  };
  const full = (m: Message) => `<li class="message${m.read ? '' : ' unread'}">${archive(m)}${sender(m)} · <b>${escapeHtml(m.subject)}</b><br><small>${escapeHtml(m.body)}</small>${answer(m)}</li>`;
  const shown = (c.messages ?? []).filter((m) => !m.archived);
  // An offer you can still take stays in view after you've read it.
  const live = (m: Message) => ['here', 'elsewhere'].includes(offerFor(c, m, here, now)?.kind ?? '');
  const unread = shown.filter((m) => !m.read || live(m));
  const earlier = shown.filter((m) => m.read && !live(m)).slice(0, 10);
  const messages =
    unread.map((m) => (receipt(m) ? line(m) : full(m))).join('') +
    (earlier.length ? `<li class="message-earlier"><button type="button" class="message-archive-all" data-archive="read">Archive all</button><details${earlierOpen ? ' open' : ''}><summary>Earlier messages (${earlier.length})</summary><ul class="contracts">${earlier.map((m) => (receipt(m) ? line(m) : full(m))).join('')}</ul></details></li>` : '');
  for (const m of c.messages ?? []) m.read = true;
  markInbox(c);
  const hello = welcomeHere(c, here, now);
  const welcomeCard = hello
    ? `<li class="special welcome" style="--company:${COMPANIES[hello.company].colour}">${companyMark(hello.company)} <em class="risk">Welcome aboard</em> · ${hello.qty} t ${escapeHtml(cargoName(hello))} → ${place(destinationOf(hello))}<br>
        <small>${escapeHtml(COMPANIES[hello.company].motto)} Your first job with us, within ${hello.jumps} jumps · <b class="pay">${hello.pay.toLocaleString()} Cr</b>, including a ${SIGNING_BONUS} Cr signing bonus</small>
        <span class="actions"><button data-take="${hello.id}" ${cannotTake(c, hello, free) ? 'disabled' : ''}>Take</button></span></li>`
    : '';
  const specials = specialsHere(c, here, now)
    .map((o) => {
      const to = destinationOf(o);
      const why = cannotTake(c, o, free);
      const compartment = o.company !== 'mutual' && !c.compartment ? ' <em class="risk" title="Hides up to 4 t from police scans. Yours to keep.">Shielded compartment fitted</em>' : '';
      return `<li class="special">${companyMark(o.company)} <em class="risk">Special assignment</em>${compartment} · ${o.qty} t ${escapeHtml(cargoName(o))} → ${place(to)}<br>
        <small>within ${o.jumps} jumps · <b class="pay">${o.pay.toLocaleString()} Cr</b> · offer closes in ${hoursLeft(o.expires)} h</small>
        <span class="actions"><button data-take="${o.id}" ${why ? `disabled title="${escapeHtml(why)}"` : ''}>Take</button></span>${why ? `<small class="why">${escapeHtml(why)}</small>` : ''}</li>`;
    })
    .join('');
  // Lost cases that put a choice to you: the police, a blackmailer, pirates.
  const incidents = (c.adrift ?? [])
    .filter((k) => k.fate && k.fate !== 'honest')
    .map((k) => {
      const a = c.contracts?.find((x) => x.id === k.contract);
      if (!a) return '';
      const there = k.galaxy === here.galaxy && k.system === here.index;
      const station = systemAt(k.galaxy, k.system).name;
      const title = { police: `${station} station police: a word about your ${k.label}`, blackmail: `Someone at ${station} station has your ${k.label}`, ransom: `Pirates have your ${k.label}` }[k.fate as 'police'];
      const needsStation = (ch: Choice) => (k.fate === 'police' || ch === 'find') && !there;
      const buttons = incidentChoices(k, a.pay)
        .map((o) => `<button data-incident="${k.contract}" data-choice="${o.choice}" ${needsStation(o.choice) || (o.cost && c.credits < o.cost) ? 'disabled' : ''} ${needsStation(o.choice) ? `title="At ${escapeHtml(station)} station"` : ''}>${escapeHtml(o.label)}</button>`)
        .join('');
      return `<li class="special">${companyMark(a.company)} · <b>${escapeHtml(title)}</b>${k.fate === 'police' && !there ? `<br><small>Report to ${escapeHtml(station)} station</small>` : ''}<span class="actions incident">${buttons}</span></li>`;
    })
    .join('');
  const file = openFile ? fileOn(c, openFile, here, now) : null;
  const fileHtml = file
    ? `<div class="file" style="--company:${COMPANIES[openFile!].colour}"><h4>${escapeHtml(file.title)}</h4>${file.lines
        .map((l) => (l.redacted ? `<p><span class="redacted" title="Redacted">${'█'.repeat(Math.min(40, l.text.length))}</span></p>` : `<p>${escapeHtml(l.text)}</p>`))
        .join('')}<button data-close-file>Close file</button></div>`
    : '';
  const fileButtons = COMPANY_IDS.filter((id) => standing(c, id) > 0)
    .map((id) => `<button data-file="${id}">${escapeHtml(COMPANIES[id].name)}: your file</button>`)
    .join('');
  const mine = (c.contracts ?? [])
    .map((a) => {
      const to = destinationOf(a);
      const k = c.adrift?.find((x) => x.contract === a.id);
      const falls = k ? Math.max(0, Math.round((k.lost + ADRIFT_HOLD - now) / 3600_000)) : 0;
      const where = k ? systemAt(k.galaxy, k.system) : null;
      const left =
        (k?.held
          ? `<span class="late">Held by the station crew at ${escapeHtml(where!.name)}: dock there to collect it</span> · `
          : k
            ? `<span class="late">Adrift near ${escapeHtml(where!.name)}, beaconing: ${falls ? `${falls} h before it starts to fall` : 'falling'}</span> · `
            : '') +
        (a.jumpsLeft >= 0 ? `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'} left` : `<span class="late">late: half pay</span>`);
      const rival = RIVAL[a.company];
      const sale = a.special && !k && rival && companyHere(rival, here) ? `<button data-rival="${a.id}" title="${escapeHtml(COMPANIES[a.company].name)} will find out">Offer to ${escapeHtml(COMPANIES[rival].name)} · ${rivalPrice(a).toLocaleString()} Cr</button>` : '';
      const course = c.target === to.index ? '<span class="on-course">On course</span>' : `<button data-course="${to.index}">Set course</button>`;
      // Accepted over the comms array: waiting at its station to be collected.
      if (a.reserved) {
        const from = systemAt(a.from.galaxy, a.from.system);
        const here_ = from === here;
        const wait = a.jumpsLeft === 0 ? 'collect it before your next jump' : `collect within ${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'}`;
        const fits = a.qty <= free + 1e-9;
        return `<li class="${a.id === justTaken ? 'fresh' : ''}">${companyMark(a.company)} · ${a.qty} t ${escapeHtml(cargoName(a))} → ${place(to)}<br>
        <small>Reserved over the comms array · waiting at ${escapeHtml(stationName(from).name)}, ${escapeHtml(from.name)} · ${wait} · ${a.pay.toLocaleString()} Cr on delivery, ${a.jumps} jumps from loading</small>
        <span class="actions">${here_ ? `<button data-collect="${a.id}" ${fits ? '' : `disabled title="Needs ${a.qty} t free"`}>Load · ${a.qty} t</button>` : c.target === from.index ? '<span class="on-course">On course</span>' : `<button data-course="${from.index}">Set course</button>`}<button data-abandon="${a.id}" title="The company gives it to someone else, and remembers">Abandon</button></span>${here_ && !fits ? `<small class="why">Make ${+(a.qty - free).toFixed(1)} t more room in the hold to load it</small>` : ''}</li>`;
      }
      const what = a.survey
        ? `Survey the moons of ${place(to)}<br><small>${left} · ${worldOf(to).moons.filter((_, i) => isSurveyed(c, to, `moon${i}`)).length} of ${worldOf(to).moons.length} surveyed${surveyDone(c, a) ? ' · hand in at any Wexley-Yorozu station' : ''} · ${a.pay.toLocaleString()} Cr</small>`
        : `${a.qty} t ${escapeHtml(cargoName(a))} → ${place(to)}<br><small>${left} · ${a.pay.toLocaleString()} Cr on delivery</small>`;
      return `<li class="${a.special ? 'special' : ''}${a.id === justTaken ? ' fresh' : ''}">${companyMark(a.company)} · ${what}
        <span class="actions">${k && where!.index !== here.index ? `<button data-course="${where!.index}">Set course</button>` : course}${sale}<button data-abandon="${a.id}" title="The company takes its cargo back, and remembers">Abandon</button></span></li>`;
    })
    .join('');
  const onBoard = board(c, here, now);
  const sought = wanted ? onBoard.find((o) => o.id === wanted) : undefined;
  boardSeenAt = now;
  boardKey = onBoard.map((o) => o.id).join();
  const offers = (sought ? [sought, ...onBoard.filter((o) => o !== sought)] : onBoard)
    .map((o) => {
      const to = destinationOf(o);
      const why = cannotTake(c, o, free);
      const fresh = o.posted !== undefined && now - o.posted < TICK;
      return `<li class="${o === sought ? 'fresh sought' : ''}">${companyMark(o.company)}${fresh ? ' <em class="posted">Just posted</em>' : ''}${o.rush ? ' <em class="risk">Rush</em>' : ''} · ${o.survey ? `Survey the moons of ${place(to)} <small>(${worldOf(to).moons.length}) · data to any Wexley-Yorozu station</small>` : `${o.qty} t ${goodName(o.good)} → ${place(to)}`}<br>
        <small>within ${o.jumps} jump${o.jumps === 1 ? '' : 's'} · <b class="pay">${o.pay.toLocaleString()} Cr</b>${o.danger ? ` (${o.danger} danger bonus)` : ''}${o.needs !== 'Casual' ? ` · needs ${o.needs}` : ''}</small>
        <span class="actions"><button data-take="${o.id}" ${why ? `disabled title="${escapeHtml(why)}"` : ''}>Take</button></span>${why ? `<small class="why">${escapeHtml(why)}</small>` : ''}</li>`;
    })
    .join('');
  const standings = COMPANY_IDS.filter((id) => (c.standing?.[id] ?? 0) !== 0)
    .map((id) => {
      const cost = amendsCost(standing(c, id));
      // Badly out of favour with a company that works here: you can pay to be taken back.
      const amends = cost && companyHere(id, here) ? ` <button data-amends="${id}" ${c.credits < cost ? 'disabled' : ''}>Make amends · ${cost.toLocaleString()} Cr</button>` : '';
      return `${companyMark(id)} ${standingName(standing(c, id))}${amends}`;
    })
    .join(' · ');
  $('#contracts').innerHTML = `
    ${incidents ? `<h3>Incidents</h3><ul class="contracts">${incidents}</ul>` : ''}
    ${messages ? `<h3>Messages</h3><ul class="contracts">${messages}</ul>` : ''}
    ${mine ? `<h3>Your contracts</h3><ul class="contracts">${mine}</ul>` : ''}
    <h3>On offer at ${escapeHtml(stationName(here).name)}</h3>
    ${welcomeCard || specials || offers ? `<ul class="contracts">${welcomeCard}${specials}${offers}</ul>` : '<p class="meta">Nothing on the board. New work is posted every few minutes.</p>'}
    ${fileHtml || (fileButtons ? `<p class="files">${fileButtons}</p>` : '')}
    <p class="meta">Hold: ${+(free).toFixed(1)} t free · new work posted every few minutes${standings ? `<br>Standing: ${standings}` : ''}</p>
    <p class="market-message" aria-live="polite">${escapeHtml(contractMessage)}</p>`;
  if (justTaken) {
    // Bring the contract you just took into view, with what happened.
    const fresh = $('#contracts').querySelector<HTMLElement>('li.fresh');
    const note = $('#contracts').querySelector<HTMLElement>('.market-message');
    if (fresh && note) fresh.after(Object.assign(document.createElement('p'), { className: 'market-message', textContent: contractMessage }));
    note?.remove();
    fresh?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    justTaken = null;
  } else if (sought) {
    $('#contracts').querySelector<HTMLElement>('li.sought')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }
  markInbox(c);
}

// While you're docked the board rolls on: a new post slides in if you're looking, or counts on the tab if not.
setInterval(() => {
  if (game.state !== 'docked' || !game.commander || game.commander.difficulty !== 'modern') return;
  const c = cmdr();
  const key = board(c, currentSystem(), Date.now()).map((o) => o.id).join();
  if (key === boardKey) return;
  if (game.dockTab === 'contracts') renderContracts();
  else {
    boardKey = key;
    markInbox(c);
  }
}, 15_000);

$('#contracts').addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  b.blur();
  const c = cmdr();
  // Archive a message, or every one already read: out of the list, remembered so it isn't sent again.
  if (b.dataset.archive) {
    earlierOpen = Boolean(b.closest('details')?.open);
    for (const m of c.messages ?? []) if (b.dataset.archive === 'read' ? m.read : m.id === b.dataset.archive) m.archived = true;
    saveCommander(c);
    renderContracts();
    return;
  }
  if (b.dataset.decline) {
    const m = c.messages?.find((x) => x.id === b.dataset.decline);
    if (m) {
      m.archived = true;
      contractMessage = `Declined. ${COMPANIES[m.company].name} will be in touch with other work.`;
    }
  } else if (b.dataset.take) {
    const now = Date.now();
    const hello = welcomeHere(c, currentSystem(), now);
    const offer = [...(hello ? [hello] : []), ...specialsHere(c, currentSystem(), now), ...board(c, currentSystem(), now)].find((o) => o.id === b.dataset.take);
    if (offer && offer.id === hello?.id) recruiter = null; // welcomed
    if (offer && offer.id === wanted) recruiter = wanted = null; // the card you came for
    if (!offer) return;
    const why = take(c, offer, cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
    contractMessage = why ?? (offer.survey ? `Survey contract taken: the moons of ${destinationOf(offer).name}, data to any Wexley-Yorozu station` : `Contract taken: ${offer.qty} t ${cargoName(offer)} for ${destinationOf(offer).name}, loaded`);
    if (!why) {
      const fitted = fitCompartment(c, offer);
      if (fitted) contractMessage += ` · ${fitted}`;
      contractMessage += ` · ${plotCourse(c, offer.to.system)}`;
      justTaken = offer.id;
      sfx.beep();
    }
  } else if (b.dataset.collect) {
    const notes = collect(c, currentSystem(), cargoCapacity(c, player.def.stats.cargo) - cargoTonnes(c));
    contractMessage = notes.join(' · ');
    const loaded = c.contracts?.find((a) => a.id === b.dataset.collect);
    if (loaded && !loaded.reserved) {
      contractMessage += ` · ${plotCourse(c, loaded.to.system)}`;
      justTaken = loaded.id;
      sfx.beep();
    }
  } else if (b.dataset.abandon) {
    contractMessage = abandon(c, b.dataset.abandon);
  } else if (b.dataset.incident) {
    contractMessage = decide(c, b.dataset.incident, b.dataset.choice as Choice, currentSystem()) ?? '';
    sfx.beep();
  } else if (b.dataset.amends) {
    contractMessage = makeAmends(c, b.dataset.amends as CompanyId);
    sfx.beep();
  } else if (b.dataset.rival) {
    contractMessage = sellToRival(c, b.dataset.rival, currentSystem()) ?? '';
    sfx.beep();
  } else if (b.dataset.file) {
    openFile = b.dataset.file as CompanyId;
  } else if (b.dataset.closeFile !== undefined) {
    openFile = null;
  } else if (b.dataset.course) {
    contractMessage = plotCourse(c, Number(b.dataset.course));
    sfx.beep();
  }
  saveCommander(c);
  main.renderDocked(); // the hold, credits and standing all change with a contract
});

/** A line of news with the system's name made a link: tap it to see the system on the chart. */
export function linkSystem(text: string, s: StarSystem): string {
  const name = escapeHtml(s.name);
  return escapeHtml(text).replace(name, `<button type="button" class="sys-link" data-system="${s.index}" title="Show ${name} on the chart">${name}</button>`);
}

// Any system name made a link (the news, a regular's tip in the saloon, the trade computer):
// tap it to see the system on the chart, without having to search for it (Mark).
document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('.sys-link[data-system]');
  if (!b) return;
  b.blur(); // or Enter on the chart would press it again
  if (!isMapOpen()) main.toggleGalaxyMap();
  showSystem(systemAt(currentSystem().galaxy, Number(b.dataset.system)));
});
