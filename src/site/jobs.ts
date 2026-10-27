import { distanceLy, GOVERNMENTS, type StarSystem } from '../galaxy/generate';
import { COMPANIES, type CompanyId } from '../game/companies';
import { BOARD_SLOT, cargoName, destinationOf } from '../game/contracts';
import { worldOf } from '../game/explore';
import { escapeHtml } from '../ui/escape';
import copy from '../../site/jobs.json';
import { boardAt, COBRA_HOLD, govPhrase, homeGround, jumpsPhrase, kindsOf, LAVE, offersFor, span, station, type Advert, type Kind, type Offer } from './board';

// The live board on /jobs/ and the company pages (docs/design/jobs-board.md):
// the contracts on offer at Cambridge Orbital, Lave, now, as a new commander
// docked there sees them. Worked out again every few seconds; contracts that
// arrive slide in with a notice, and ones whose time is up fade out. Until the
// game's board rolls, the whole board changes on the half hour.

const CHECK = 5_000;

function start(root: HTMLElement, list: HTMLUListElement) {
  const pinned = (root.dataset.company as CompanyId | undefined) ?? null;
  const title = root.querySelector<HTMLElement>('[data-board-title]')!;
  const meta = root.querySelector<HTMLElement>('[data-board-meta]')!;
  const empty = root.querySelector<HTMLElement>('[data-board-empty]')!;
  const adverts = [...document.querySelectorAll<HTMLElement>('.job[data-company]')];

  // Filters live in the address, so a filtered board can be shared.
  const params = new URLSearchParams(location.search);
  const pick = (name: string) => new Set((params.get(name) ?? '').split(',').filter(Boolean));
  const companies = pick('company') as Set<CompanyId>;
  const kinds = pick('kind') as Set<Kind>;
  const chips = [...root.querySelectorAll<HTMLButtonElement>('.chip')];
  const syncChips = () => {
    for (const b of chips) b.setAttribute('aria-pressed', String(b.dataset.filterCompany ? companies.has(b.dataset.filterCompany as CompanyId) : kinds.has(b.dataset.filterKind as Kind)));
    const q = new URLSearchParams();
    if (companies.size) q.set('company', [...companies].join(','));
    if (kinds.size) q.set('kind', [...kinds].join(','));
    history.replaceState(null, '', location.pathname + (q.size ? `?${q}` : '') + location.hash);
  };
  for (const b of chips)
    b.addEventListener('click', () => {
      const set: Set<string> = b.dataset.filterCompany ? companies : kinds;
      const v = b.dataset.filterCompany ?? b.dataset.filterKind!;
      if (set.has(v)) set.delete(v);
      else set.add(v);
      syncChips();
      render();
    });

  const shows = (company: CompanyId, k: Kind[]) => (pinned ? company === pinned : !companies.size || companies.has(company)) && (!kinds.size || k.some((x) => kinds.has(x)));

  // An advert's "on the board now" filters to its kind of contract.
  for (const ad of adverts)
    ad.querySelector('[data-on-board]')?.addEventListener('click', () => {
      if (pinned) return root.scrollIntoView({ behavior: 'smooth' });
      companies.clear();
      kinds.clear();
      companies.add(ad.dataset.company as CompanyId);
      const k = (ad.dataset.kinds ?? '').split(' ') as Kind[];
      kinds.add(k.includes('survey') ? 'survey' : k.includes('rush') ? 'rush' : k.includes('starter') ? 'starter' : 'haulage');
      syncChips();
      render();
      root.scrollIntoView({ behavior: 'smooth' });
    });

  let shown = new Map<string, HTMLLIElement>();
  let first = true;

  function render() {
    const now = Date.now();
    const { offers: atLave, rolling } = boardAt(LAVE, now);
    const when = rolling ? 'right now' : 'this half hour';
    const nextBoard = `New board in ${span(Math.floor(now / BOARD_SLOT) * BOARD_SLOT + BOARD_SLOT - now)}.`;

    // A company page whose company has nothing at Lave shows its board on its home ground.
    let here: StarSystem = LAVE;
    let offers = atLave;
    if (pinned && !atLave.some((o) => o.company === pinned)) {
      const home = homeGround(pinned).s;
      if (home !== LAVE) {
        here = home;
        offers = boardAt(home, now).offers;
      }
    }
    title.textContent = `On offer at ${station(here)}, ${here.name}`;
    meta.textContent =
      (here === LAVE ? 'The same board a commander docked at Lave sees right now. ' : `Nothing from ${COMPANIES[pinned!].name} at Lave ${when}, so this is its ground, ${jumpsPhrase(homeGround(pinned!).n)} from Lave. `) +
      (rolling ? 'Contracts come and go as they’re posted.' : nextBoard);

    const visible = offers.filter((o) => shows(o.company, kindsOf(o)));
    // Arrivals and departures, by contract.
    const ids = new Set(visible.map((o) => o.id));
    for (const [id, li] of shown)
      if (!ids.has(id)) {
        li.classList.add('gone');
        li.querySelector('.offer-fit')!.textContent = 'Off the board';
        setTimeout(() => li.remove(), 1800);
        shown.delete(id);
      }
    const arrived = visible.filter((o) => !shown.has(o.id));
    const next = new Map<string, HTMLLIElement>();
    let before: Element | null = list.firstElementChild;
    for (const o of visible) {
      let li = shown.get(o.id);
      if (!li) {
        li = document.createElement('li');
        li.className = `offer${first ? '' : ' new'}`;
        li.dataset.id = o.id;
        li.style.setProperty('--c', COMPANIES[o.company].colour);
      }
      li.innerHTML = card(o, here, now, rolling);
      while (before && before.classList.contains('gone')) before = before.nextElementSibling;
      if (li !== before) list.insertBefore(li, before);
      else before = before.nextElementSibling;
      next.set(o.id, li);
    }
    shown = next;

    // Why the board is empty, plainly.
    const filterCompany = pinned ?? (companies.size === 1 ? [...companies][0] : null);
    if (visible.length) empty.hidden = true;
    else {
      empty.hidden = false;
      const c = filterCompany ? copy.companies[filterCompany] : null;
      if (c && !kinds.size && !atLave.some((o) => o.company === filterCompany)) {
        const home = homeGround(filterCompany!);
        empty.textContent = c.empty.replace('{when}', when).replace('{station}', home.s.name).replace('{gov}', govPhrase(home.s)).replace('{jumps}', jumpsPhrase(home.n));
      } else empty.textContent = `${copy.noMatch.replace('{when}', when)}${rolling ? '' : ` ${nextBoard}`}`;
    }

    // Adverts: filtered like the board, and saying when their kind is on it.
    for (const ad of adverts) {
      const a: Advert = { company: ad.dataset.company as CompanyId, kinds: (ad.dataset.kinds ?? '').split(' ') as Kind[], title: '', text: '', meta: '' };
      ad.hidden = !pinned && !shows(a.company, a.kinds);
      const n = here === LAVE ? offersFor(a, atLave).length : 0;
      const tag = ad.querySelector<HTMLElement>('[data-on-board]');
      if (!tag) continue;
      tag.hidden = !n;
      tag.innerHTML = `<button type="button">${n} on the board at Lave now</button>`;
    }

    if (!first) announce(arrived, here);
    first = false;
  }

  syncChips();
  render();
  setInterval(() => document.hidden || render(), CHECK);
  document.addEventListener('visibilitychange', () => document.hidden || render());
}

const gov = (s: StarSystem) =>
  s.government <= 1 ? ` <em class="risk high">${GOVERNMENTS[s.government]} · pirates</em>` : s.government <= 3 ? ` <em class="risk">${GOVERNMENTS[s.government]}</em>` : '';

/** One contract, as the game's Contracts tab shows it, plus what a newcomer needs to know. */
function card(o: Offer, here: StarSystem, now: number, rolling: boolean): string {
  const to = destinationOf(o);
  const co = COMPANIES[o.company];
  const c = copy.companies[o.company];
  const place = `<b>${escapeHtml(to.name)}</b> <small>${distanceLy(here, to).toFixed(1)} LY</small>${gov(to)}`;
  const moons = worldOf(to).moons.length;
  const what = o.survey ? `Survey the moons of ${place} <small>(${moons} moon${moons === 1 ? "" : "s"}) · data to any Wexley-Yorozu station</small>` : `${o.qty} t ${escapeHtml(cargoName(o))} → ${place}`;
  const line = o.survey ? (c as { surveyLine?: string }).surveyLine ?? c.cardLine : c.cardLine;
  const fit = [
    o.survey ? 'No cargo: fly out to the moons and look' : `${o.qty} t of your Cobra’s ${COBRA_HOLD}`,
    o.needs === 'Casual' ? 'Open to new pilots' : `Needs ${o.needs} standing`,
    ...(rolling ? [now - o.posted < 5 * 60_000 ? 'Just posted' : `Posted ${span(now - o.posted)} ago`, `Up for ${span(o.until - now)} more`] : []),
  ].join(' · ');
  // The game opens on this very contract once it can (?contract=); until then, on the company's welcome job.
  const go = rolling && here === LAVE ? 'Take this job' : `Fly for ${o.company === 'wy' ? 'W-Y' : o.company === 'mutual' ? 'the Mutual' : co.name.split(' ')[0]}`;
  const href = `/play/?contract=${encodeURIComponent(o.id)}&company=${o.company}`;
  return `<div class="offer-main">
      <p class="offer-what"><a class="co" href="/companies/${o.company}/">${escapeHtml(co.name)}</a>${o.rush ? ' <em class="risk">Rush</em>' : ''} · ${what}</p>
      <p class="offer-terms">within ${o.jumps} jump${o.jumps === 1 ? '' : 's'} · <b class="pay">${o.pay.toLocaleString('en-GB')} Cr</b>${o.danger ? ` (${o.danger} danger bonus)` : ''}${o.needs !== 'Casual' ? ` · needs ${o.needs}` : ''}</p>
      <p class="offer-line">${escapeHtml(line)}${o.rush ? ` ${escapeHtml(copy.rushLine)}` : ''}</p>
      <p class="offer-fit">${fit}</p>
    </div>
    <a class="button small offer-go" href="${href}">${go} <span aria-hidden="true">→</span></a>`;
}

// --- Notices: a small line for each contract that arrives -----------------------

const queue: string[] = [];
let showing = false;

function announce(arrived: Offer[], here: StarSystem) {
  if (!arrived.length) return;
  const at = here.name;
  // A whole new board at once (the half-hourly board) is one notice, not six.
  if (arrived.length > 2) queue.push(`New board at ${at} · ${arrived.length} contracts`);
  else
    for (const o of arrived)
      queue.push(`Just posted at ${at} · ${COMPANIES[o.company].name}${o.rush ? ' · Rush' : ''} · ${o.survey ? `Moon survey → ${destinationOf(o).name}` : `${o.qty} t ${cargoName(o)} → ${destinationOf(o).name}`} · ${o.pay.toLocaleString('en-GB')} Cr|${o.id}`);
  if (!showing) next();
}

function next() {
  const box = document.querySelector<HTMLElement>('[data-notices]');
  const item = queue.shift();
  if (!box || !item) {
    showing = false;
    return;
  }
  showing = true;
  const [text, id] = item.split('|');
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'notice';
  b.textContent = text;
  b.addEventListener('click', () => {
    const li = id ? document.querySelector<HTMLElement>(`.offer[data-id="${CSS.escape(id)}"]`) : document.querySelector<HTMLElement>('[data-board]');
    li?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li?.classList.remove('new');
    void li?.offsetWidth;
    li?.classList.add('new');
  });
  box.append(b);
  setTimeout(() => {
    b.classList.add('out');
    setTimeout(() => {
      b.remove();
      next();
    }, 400);
  }, 5000);
}

const root = document.querySelector<HTMLElement>('[data-board]');
const list = root?.querySelector<HTMLUListElement>('[data-offers]');
if (root && list) start(root, list);
