// The jobs board (/jobs/) and the company pages (/companies/<id>/): the
// station's Contracts tab, on the website (docs/design/jobs-board.md). The
// words are in site/jobs.json; each company's story is cut from the canon in
// docs/companies.md, so an edit there reaches its page. The live board itself
// is filled in the browser by src/site/jobs.ts.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COMPANIES, COMPANY_IDS, STANDINGS, type CompanyId } from '../src/game/companies';
import { FILTER_KINDS, type Advert } from '../src/site/board';

export interface CompanyCopy {
  mark: string;
  short: string;
  image: string;
  imageAlt: string;
  pitch: string;
  speech?: string;
  speechCite?: string;
  cardLine: string;
  surveyLine?: string;
  ground: string;
  empty: string;
  card: { ship: string; sub: string };
  description: string;
}

export interface JobsCopy {
  companies: Record<CompanyId, CompanyCopy>;
  rushLine: string;
  noMatch: string;
  adverts: Advert[];
  howItWorks: string[];
  start: string;
  jobs: { description: string; card: { ship: string; sub: string } };
  build: { intro: string; note: string; how: string };
}

export const loadJobs = (root: string): JobsCopy => JSON.parse(readFileSync(join(root, 'site/jobs.json'), 'utf8'));

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Company names as the canon heads them, and as its "Between them" names them. */
const CANON: Record<CompanyId, { heading: string; named: string }> = {
  hexon: { heading: 'Hexon Holdings', named: 'Hexon' },
  vorg: { heading: 'Vorg Industries', named: 'Vorg' },
  mutual: { heading: "The Carriers' Mutual", named: 'Mutual' },
  wy: { heading: 'Wexley-Yorozu', named: 'Wexley-Yorozu' },
};

/** Sections of a company's canon that belong on its page; the rest (livery, prompts, story hooks, the yards) are for builders. */
const KEEP = /^(Where it came from|What it does|What people say|What it wants|Its ship)/;

/** The markdown of a company's page, from docs/companies.md. */
export function canonFor(companiesMd: string, id: CompanyId): { story: string; ship: { name: string; md: string } | null; between: string[] } {
  const top = companiesMd.split(/^## /m);
  const own = top.find((s) => s.startsWith(CANON[id].heading + '\n'));
  if (!own) throw new Error(`docs/companies.md has no section "## ${CANON[id].heading}"`);
  const subs = own.split(/^### /m).slice(1);
  // Concept-art prompts are a bullet followed by an indented quote.
  const unprompt = (md: string) => md.replace(/^- \*\*(Concept|Logo) prompt[^\n]*\n(?:\s+>[^\n]*\n?)+/gm, '');
  const story = subs
    .filter((s) => KEEP.test(s) && !s.startsWith('Its ship'))
    .map((s) => `### ${unprompt(s).trim()}`)
    .join('\n\n');
  const shipSection = subs.find((s) => s.startsWith('Its ship'));
  const ship = shipSection ? { name: shipSection.match(/^Its ship: the (\w+)/)?.[1] ?? '', md: unprompt(shipSection.split('\n').slice(1).join('\n')).trim() } : null;
  const betweenMd = top.find((s) => s.startsWith('Between them\n')) ?? '';
  const between = betweenMd
    .split('\n')
    .filter((l) => l.startsWith('- ') && l.includes(CANON[id].named))
    .map((l) => l.slice(2));
  return { story, ship, between };
}

const GAME_NOTE = '<p class="game-note">These are jobs in <a href="/">Witchspace</a>, a free game you play in your browser. Nobody will ask for your CV.</p>';

const firmIndex = (copy: JobsCopy, ids: CompanyId[] = COMPANY_IDS) =>
  `<ul class="firm-index${ids.length === 3 ? ' three' : ''}">${ids.map((id) => {
    const c = copy.companies[id];
    return `<li><a href="/companies/${id}/" style="--c: ${COMPANIES[id].colour}"><span class="firm-mark" aria-hidden="true">${c.mark}</span><span><b>${esc(COMPANIES[id].name)}</b><small>${esc(c.short)}</small></span></a></li>`;
  }).join('')}</ul>`;

function advertHtml(a: Advert) {
  return `<li class="job" data-company="${a.company}" data-kinds="${a.kinds.join(' ')}">
            <h3>${esc(a.title)}</h3>
            <p>${esc(a.text)}</p>
            ${a.note ? `<p class="note">${esc(a.note).replace(/\[([^\]]+)\]\(((?:\/|https:\/\/)[^)\s]*)\)/g, '<a href="$2">$1</a>')}</p>` : ''}
            <p class="meta">${esc(a.meta)}</p>
            <p class="on-board" data-on-board hidden></p>
            <a class="apply" href="${a.href ?? `/play/?company=${a.company}`}">Apply <span aria-hidden="true">→</span></a>
          </li>`;
}

/** The live board's frame; src/site/jobs.ts fills it. `company` pins it to one company (its own page). */
function boardHtml(company?: CompanyId) {
  const chips = company
    ? ''
    : `<div class="chips" role="group" aria-label="Filter the board">
        ${COMPANY_IDS.map((id) => `<button type="button" class="chip" data-filter-company="${id}" aria-pressed="false" style="--c: ${COMPANIES[id].colour}">${esc(COMPANIES[id].name)}</button>`).join('')}
        <span class="chip-gap" aria-hidden="true"></span>
        ${FILTER_KINDS.map((k) => `<button type="button" class="chip" data-filter-kind="${k.id}" aria-pressed="false">${esc(k.label)}</button>`).join('')}
      </div>`;
  return `<div class="board" data-board${company ? ` data-company="${company}"` : ''}>
      <div class="board-head">
        <h2 data-board-title>On offer at Cambridge Orbital, Lave</h2>
        <p class="board-meta" data-board-meta>The same board a commander docked at Lave sees right now.</p>
      </div>
      ${chips}
      <ul class="offers" data-offers></ul>
      <p class="board-empty" data-board-empty hidden></p>
      <noscript><p class="board-empty">The live board needs JavaScript. The companies' adverts are below.</p></noscript>
    </div>`;
}

const isBuild = (a: Advert) => a.kinds.includes('build');

/** Wexley-Yorozu's design commissions (Mark): the Build path, apart from the contracts. */
const buildHtml = (copy: JobsCopy, heading = true) => `<section class="section build-ads" id="build" style="--c: ${COMPANIES.wy.colour}">
  ${heading ? `<p class="kicker">Build</p><h2>Design commissions</h2>` : '<h3>Design commissions</h3>'}
  <p class="lede">${esc(copy.build.intro)}</p>
  <ul class="jobs">${copy.adverts.filter(isBuild).map(advertHtml).join('')}</ul>
  <p class="build-note">${esc(copy.build.note)}</p>
  <p class="build-note">${copy.build.how}</p>
</section>`;

const howItWorks = (copy: JobsCopy) => `<div class="how">
      <h3>How contracts work</h3>
      <ul>${copy.howItWorks.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
      <p>${esc(copy.start)}</p>
    </div>`;

export function jobsPage(copy: JobsCopy): string {
  const groups = COMPANY_IDS.map((id) => {
    const c = copy.companies[id];
    return `<section class="firm-ads" id="${id}" style="--c: ${COMPANIES[id].colour}">
        <div class="firm-head"><span class="firm-mark" aria-hidden="true">${c.mark}</span><div><h3><a href="/companies/${id}/">${esc(COMPANIES[id].name)}</a></h3><p class="motto">${esc(COMPANIES[id].motto.replace(/\.$/, ''))}</p></div></div>
        <ul class="jobs">${copy.adverts.filter((a) => a.company === id && !isBuild(a)).map(advertHtml).join('')}</ul>
      </section>`;
  }).join('\n');
  return `<section class="section jobs-intro">
  <p class="kicker">Jobs</p>
  <h1>Work for the Big Four</h1>
  <p class="lede">Every commander starts at Lave in a Cobra, and every job is a contract from one of four companies. They supply the cargo, you fly it there, they pay on delivery. This is the board at Lave, live.</p>
  ${GAME_NOTE}
  ${firmIndex(copy)}
</section>

<section class="section board-section">
  ${boardHtml()}
  ${howItWorks(copy)}
</section>

<section class="section ads-section">
  <h2>What each company offers</h2>
  <p class="lede">The kinds of contract each company puts on the boards, from your first run to the ones that come by invitation.</p>
  ${groups}
</section>

${buildHtml(copy)}

<section class="section independent">
  <h2>Not one for employers?</h2>
  <p class="lede center">Fly independent: buy low, sell high on the exchange, and keep every credit (and every loss). <a href="/play/">Start playing</a>.</p>
</section>
<div class="notices" data-notices aria-live="polite"></div>`;
}

/** What each rung of standing opens, from docs/design/companies-and-contracts.md and the game. */
const RUNGS: Record<string, string> = {
  Partner: 'The top of the ladder. Partner perks are designed, not built yet.',
  Preferred: 'The most valuable cargoes.',
  Trusted: 'Valuable cargo.',
  Contractor: 'Bigger loads, and now and then a special assignment, by invitation.',
  Casual: 'Starter work: small loads, open to any pilot. Where everyone begins.',
  Unreliable: 'Starter work still. Deliver on time and they come round.',
  Distrusted: 'Starter work, grudgingly.',
  Blacklisted: 'No work at all, until you make amends or they forget.',
};

function standingHtml(id: CompanyId) {
  const rungs = [...STANDINGS].reverse();
  return `<ol class="standing-ladder">${rungs
    .map((r) => `<li${r.name === 'Casual' ? ' class="start"' : ''}><b>${r.name}</b><small>${Number.isFinite(r.at) ? `${r.at > 0 ? '+' : ''}${r.at}` : ''}</small><span>${esc(RUNGS[r.name] ?? '')}</span></li>`)
    .join('')}</ol>
    <p class="muted small">Standing rises with every contract delivered on time: one point, two for a rush job or danger pay, three for a special assignment. Abandoning a contract costs three, losing its cargo with your ship two. Below zero, ${esc(COMPANIES[id].name)} forgets a point a day, or takes compensation.</p>`;
}

/** A company's page. `render` turns markdown into HTML (with the site's link rules); `shipIds` are the ships that exist. */
export function companyPage(copy: JobsCopy, id: CompanyId, companiesMd: string, render: (md: string) => string, shipIds: Set<string>): string {
  const c = copy.companies[id];
  const co = COMPANIES[id];
  const canon = canonFor(companiesMd, id);
  const shipId = canon.ship?.name.toLowerCase() ?? '';
  const shipLink = canon.ship ? (shipIds.has(shipId) ? `<p><a class="button ghost small" href="/ships/${shipId}/">See the ${esc(canon.ship.name)} →</a></p>` : `<p class="muted small">Not built yet. <a href="/get-involved/">Design it</a>.</p>`) : '';
  const others = COMPANY_IDS.filter((x) => x !== id);
  const terms =
    id === 'wy'
      ? `<div class="terms" tabindex="0" aria-label="Terms and conditions">
          <p>TERMS OF ENGAGEMENT (EXTRACT). 1. The Contractor agrees to carry the Cargo with due care. 2. The Company will pay on delivery. 3. Deadlines are counted in hyperspace jumps. 4. The Company’s cargo remains the Company’s property at all times, including after the Contractor’s ship does not.</p>
          <p>5–37. Fuel, docking, insurance, the colonies, colony debt, the repayment of colony debt by the heirs of the colonists, and the colonies that stopped answering, which the Company is not obliged to discuss.</p>
          <p>38–109. Specimens. The Company’s Science Division. The meaning of the word “intact”. Situations in which the Contractor shall remain where they are.</p>
          <p>110–213. Intentionally left long.</p>
          <p class="last">214. The Contractor accepts liability for</p>
        </div>`
      : '';
  return `<article class="company" style="--c: ${co.colour}">
<section class="section company-intro">
  <p class="kicker"><a href="/jobs/">Jobs</a> · A company in Witchspace</p>
  <div class="company-head">
    <span class="firm-mark big" aria-hidden="true">${c.mark}</span>
    <div><h1>${esc(co.name)}</h1><p class="motto">${esc(co.motto.replace(/\.$/, ''))}</p></div>
  </div>
  <div class="company-top">
    <div>
      <p class="lede">${esc(c.pitch)}</p>
      ${c.speech ? `<blockquote class="speech">${c.speech}<cite>${esc(c.speechCite ?? '')}</cite></blockquote>` : ''}
      ${GAME_NOTE}
      <p class="ground"><b>Where it works:</b> ${esc(c.ground)}</p>
    </div>
    <img src="${c.image}" alt="${esc(c.imageAlt)}" width="640" height="480" />
  </div>
</section>

<section class="section board-section">
  ${boardHtml(id)}
</section>

<section class="section company-ads">
  <h2>Working for ${esc(co.name)}</h2>
  <ul class="jobs">${copy.adverts.filter((a) => a.company === id && !isBuild(a)).map(advertHtml).join('')}</ul>
  ${terms}
</section>
${copy.adverts.some((a) => a.company === id && isBuild(a)) ? buildHtml(copy) : ''}

<section class="section company-story">
  <h2>Who they are</h2>
  ${render(canon.story)}
  ${canon.ship ? `<h3>Its ship: the ${esc(canon.ship.name)}</h3>${render(canon.ship.md)}${shipLink}` : ''}
  <p class="muted small">From <a href="/design/companies/">the trading companies</a>, the canon. Their liveries, story hooks and concept-art prompts are there.</p>
</section>

<section class="section company-standing">
  <h2>Standing</h2>
  <p class="lede">${esc(co.name)} keeps a record of every contract you fly for it. Your standing decides what it offers you.</p>
  ${standingHtml(id)}
  ${howItWorks(copy)}
</section>

${
  canon.between.length
    ? `<section class="section company-between">
  <h2>Between them</h2>
  <ul>${canon.between.map((l) => `<li>${render(l).replace(/^<p>|<\/p>\s*$/g, '')}</li>`).join('')}</ul>
</section>`
    : ''
}

<section class="section company-others">
  <h2>The other three</h2>
  ${firmIndex(copy, others)}
</section>
</article>
<div class="notices" data-notices aria-live="polite"></div>`;
}

/** /companies/: the four companies, what each wants, its ship and its jobs; the hub its pages' breadcrumbs point to. */
export function companiesHub(copy: JobsCopy, companiesMd: string, shipIds: Set<string>): string {
  return `<section class="section">
  <div class="section-head">
    <p class="kicker">A galaxy at work</p>
    <h1>The companies of Witchspace</h1>
    <p class="lede">Four companies post the work on every station’s board: freight, escorts, surveys and salvage. Who you work for decides who trusts you, and who doesn’t.</p>
    ${GAME_NOTE}
  </div>
  <div class="company-hub">
${COMPANY_IDS.map((id) => {
  const c = copy.companies[id];
  const co = COMPANIES[id];
  const ship = canonFor(companiesMd, id).ship;
  const shipId = ship?.name.toLowerCase() ?? '';
  return `    <article class="card company-card" style="--c: ${co.colour}">
      <div class="firm-head"><span class="firm-mark" aria-hidden="true">${c.mark}</span><div><h2><a href="/companies/${id}/">${esc(co.name)}</a></h2><p class="motto">${esc(co.motto.replace(/\.$/, ''))}</p></div></div>
      <p>${esc(c.pitch)}</p>
      <p class="ground"><b>Where it works:</b> ${esc(c.ground)}</p>
      <p class="company-links"><a href="/companies/${id}/">About ${esc(co.name)} →</a> <a href="/jobs/#${id}">Its jobs →</a>${ship && shipIds.has(shipId) ? ` <a href="/ships/${shipId}/">Its ship, the ${esc(ship.name)} →</a>` : ''}</p>
    </article>`;
}).join('\n')}
  </div>
</section>`;
}
