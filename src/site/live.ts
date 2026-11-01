import * as THREE from 'three';
import { shipById } from '../content/ships';
import { COMMODITIES } from '../economy/commodities';
import { activeEvent, EVENT_KINDS, newsAt, type WorldEvent } from '../economy/events';
import { drift, equilibriumPrice, freshMarket, priceAt } from '../economy/market';
import { distanceLy, galaxy, type StarSystem } from '../galaxy/generate';
import { COMPANIES } from '../game/companies';
import { cargoName, destinationOf } from '../game/contracts';
import { cargoWords, voyages, type Voyage } from '../game/traffic';
import { stageInfo, STAGES, yardsNear } from '../game/yards';
import { MAX_PIXEL_RATIO } from '../render/look';
import { buildShip } from '../render/shipModel';
import { setLineResolution } from '../render/wire';
import { escapeHtml } from '../ui/escape';
import { boardAt, LAVE } from './board';
import { easer, inkable, lightUp, onPaper } from './ink';
import { systemUrl } from './systemNow';
import { clipModal } from './clipModal';
import { chartedWhat, clipTitle, commanderLines, EMPTY, featuredClip, flyingLine, parseFeed, type CommanderLine, type Feed } from './feed';
import { glow } from './glow';

// The home page's live galaxy: the news around Lave, the nearest shipyard, a
// market in crisis, the ticker under the hero, and the Falcon turning. All
// from the game's own seed and clock, so it's what every commander would find
// right now, and it's worked out again every minute while the page is open.
// Beside them, what real commanders did in the last two days, from GET /feed
// (docs/design/live-feed.md), labelled as theirs. If the feed can't be reached
// the galaxy carries the page alone. The page reads sensibly without any of it.

const $ = (id: string) => document.getElementById(id);
const lave = galaxy(0)[7];
const RANGE = 25; // light years: as far as news travels to Lave
const ly = (s: StarSystem) => `${distanceLy(lave, s).toFixed(1)} LY from Lave`;

const SPACE = import.meta.env.VITE_SPACE_HTTP ?? (import.meta.env.DEV ? 'http://127.0.0.1:8787' : 'https://space.witchspace.org.uk');
const FEED = `${SPACE}/feed`;
/** A shared clip's own card (1200×630), made when it was shared; the Witch-fire's if it has none. */
const clipCard = (id: string) => `${SPACE}/clip-card/${id}.jpg`;
const FALLBACK_CARD = '/share/clip.jpg';
/** "6 min ago", "13 h ago", "2 days ago": a feed needn't be exact to the minute. */
const ago = (now: number, t: number) => {
  const m = Math.max(1, Math.round((now - t) / 60000));
  return m < 60 ? `${m}\u00a0min ago` : m < 48 * 60 ? `${Math.round(m / 60)}\u00a0h ago` : `${Math.round(m / 1440)}\u00a0days ago`;
};
const where = (s: StarSystem) => (s.galaxy ? `galaxy ${s.galaxy + 1}` : ly(s));

let tickerItems: string[] = [];
let feed: Feed = EMPTY;
/** The feed lines already shown, so a new one can slide in. */
let seen: Set<string> | null = null;

interface Line {
  key: string;
  t: number;
  tag: string;
  title: string;
  note: string;
  href?: string;
  /** A clip's card, shown small beside its line. */
  pic?: string;
  cmdr?: boolean;
  over?: boolean;
}

function commanderLine(c: CommanderLine, now: number): Line {
  if (c.kind === 'clip')
    return { key: `clip:${c.id}`, t: c.t, tag: 'Commander', cmdr: true, title: c.title, note: `Clip shared ${ago(now, c.t)}${c.hearts ? ` · ♥ ${c.hearts}` : ''}`, href: `/clip/${c.id}`, pic: clipCard(c.id) };
  return { key: `first:${c.t}:${c.callsign}:${c.where.galaxy}:${c.where.index}`, t: c.t, tag: 'Commander', cmdr: true, ...(c.where.galaxy === 0 ? { href: systemUrl(c.where.name) } : {}), title: `CMDR ${c.callsign} charted ${c.where.name} first`, note: `${chartedWhat(c)} · ${where(c.where)} · ${ago(now, c.t)}` };
}

/** The shortage among these worlds that's pushed a price furthest over the usual, if any is over 5%. */
function worst(trouble: { s: StarSystem; e: WorldEvent }[], now: number) {
  let crisis: { where: StarSystem; good: string; pct: number; e: WorldEvent } | null = null;
  for (const { s, e } of trouble) {
    for (const [id, shift] of Object.entries(EVENT_KINDS[e.type].effects)) {
      const i = COMMODITIES.findIndex((c) => c.id === id);
      if (shift >= 0 || i < 0) continue;
      const c = COMMODITIES[i];
      const pct = priceAt(s, freshMarket(s, now), id, now) / (equilibriumPrice(s, c, i) * drift(s, c, i, now)) - 1;
      if (pct > 0.05 && (!crisis || pct > crisis.pct)) crisis = { where: s, good: c.name, pct, e };
    }
  }
  return crisis;
}

function render() {
  const now = Date.now();
  // Every world in trouble right now, nearest Lave first: the galaxy always has a dozen or more.
  const trouble = galaxy(0)
    .map((s) => ({ s, e: activeEvent(s, now) }))
    .filter((t): t is { s: StarSystem; e: WorldEvent } => t.e !== null)
    .sort((a, b) => distanceLy(lave, a.s) - distanceLy(lave, b.s));

  // The feed: the galaxy's news and the newest contract at Lave beside what real
  // commanders have done, newest first. The news is what Lave has heard that's
  // still going on, then trouble too far out for news to reach Lave, then what's
  // eased lately. Nothing within news range that Lave hasn't heard yet: that's
  // for a fast ship to bring.
  const heard = newsAt(lave, now).filter((n) => n.where !== lave);
  const ongoing = heard.filter((n) => now <= n.event.end);
  const news = (e: WorldEvent, at: StarSystem) => `news:${at.index}:${e.start}`;
  const posted = boardAt(LAVE, now).offers.filter((o) => o.posted <= now).sort((a, b) => b.posted - a.posted)[0];
  const cmdrs = commanderLines(feed);
  const lines: Line[] = [
    ...(posted
      ? [{ key: `job:${posted.id}`, t: posted.posted, tag: 'Contracts', title: `${COMPANIES[posted.company].name}: ${posted.survey ? `a moon survey at ${destinationOf(posted).name}` : `${posted.qty} t ${cargoName(posted).toLowerCase()} to ${destinationOf(posted).name}`}`, note: `Posted at Lave ${ago(now, posted.posted)} · ${posted.pay.toLocaleString('en-GB')} Cr`, href: '/jobs/' }]
      : []),
    ...cmdrs.slice(0, 2).map((c) => commanderLine(c, now)),
    ...ongoing.slice(0, 3).map((n) => ({ key: news(n.event, n.where), t: n.event.start, tag: 'News', href: systemUrl(n.where.name), title: EVENT_KINDS[n.event.type].headline(n.where.name), note: `${ly(n.where)} · began ${ago(now, n.event.start)} · wanted: ${EVENT_KINDS[n.event.type].wanted}` })),
  ].sort((a, b) => b.t - a.t);
  for (const t of trouble.filter((t) => distanceLy(lave, t.s) > RANGE)) {
    if (lines.length >= 5) break;
    lines.push({ key: news(t.e, t.s), t: t.e.start, tag: 'News', href: systemUrl(t.s.name), title: EVENT_KINDS[t.e.type].headline(t.s.name), note: `${ly(t.s)}, beyond the news at Lave · began ${ago(now, t.e.start)}` });
  }
  for (const n of heard.filter((n) => now > n.event.end)) {
    if (lines.length >= 5) break;
    lines.push({ key: news(n.event, n.where), t: n.event.end, tag: 'News', href: systemUrl(n.where.name), title: EVENT_KINDS[n.event.type].headline(n.where.name), note: `${ly(n.where)} · eased ${ago(now, n.event.end)}`, over: true });
  }
  $('now-news')!.innerHTML = lines
    .map((l) => {
      const title = escapeHtml(l.title);
      const cls = `headline${l.over ? ' over' : ''}${l.cmdr ? ' cmdr' : ''}${seen && !seen.has(l.key) ? ' new' : ''}`;
      const pic = l.pic ? `<a class="feed-pic" href="${l.href}" tabindex="-1" aria-hidden="true"><img src="${l.pic}" width="120" height="63" loading="lazy" decoding="async" alt=""></a>` : '';
      return `<div class="${cls}">${pic}<span class="feed-src">${l.tag}</span><b>${l.href ? `<a href="${l.href}">${title}</a>` : title}</b><small>${escapeHtml(l.note)}</small></div>`;
    })
    .join('');
  seen = new Set(lines.map((l) => l.key));
  const flying = flyingLine(feed.flying);
  $('now-flying')!.textContent = flying;
  $('now-flying')!.hidden = !flying;

  // Latest flight: the most hearted clip of the two days, or the newest, with its own card.
  const clip = featuredClip(feed);
  if (clip) {
    const { who, what } = clipTitle(clip.title);
    const img = $('now-clip-img') as HTMLImageElement;
    if (img.dataset.id !== clip.id) {
      img.dataset.id = clip.id;
      img.src = clipCard(clip.id);
    }
    $('now-clip-what')!.textContent = what;
    $('now-clip-line')!.textContent = [who ? `${who}${clip.system ? ` at ${clip.system}` : ''}` : clip.system, ago(now, clip.t), clip.hearts ? `♥ ${clip.hearts}` : ''].filter(Boolean).join(' · ');
    $('now-clip-cta')!.textContent = 'Watch it →';
    for (const a of [$('now-clip-cta'), $('now-clip-pic')] as HTMLAnchorElement[]) a.href = `/clip/${clip.id}`;
  }

  // First to get there: the latest commander to chart somewhere first, if anyone has in two days.
  const charted = cmdrs.find((c) => c.kind === 'charted');
  if (charted) {
    // The rest, counted honestly: systems, not claims, and by how many commanders (often just one, for now).
    const others = cmdrs.filter((c) => c.kind === 'charted' && c.where !== charted.where);
    const systems = new Set(others.map((c) => c.kind === 'charted' && c.where)).size;
    const names = new Set(others.map((c) => c.kind === 'charted' && c.callsign));
    const by = names.size === 1 && names.has(charted.callsign) ? `by CMDR ${charted.callsign}` : `by ${names.size} commanders`;
    $('now-first')!.textContent = `CMDR ${charted.callsign}`;
    $('now-first-line')!.textContent = `First to chart ${charted.where.name}: ${chartedWhat(charted)}, ${ago(now, charted.t)}.${systems ? ` ${systems} more system${systems === 1 ? '' : 's'} charted first ${by} in the last two days.` : ''}`;
  }

  // A market in crisis: the worst shortage within reach of Lave right now, or anywhere if there's none.
  const crisis = worst(trouble.filter((t) => distanceLy(lave, t.s) <= RANGE), now) ?? worst(trouble, now);
  if (crisis) {
    $('now-crisis')!.innerHTML = `${escapeHtml(crisis.good)} at ${place(crisis.where)}`;
    $('now-crisis-pct')!.textContent = `+${Math.round(crisis.pct * 100)}%`;
    $('now-crisis-note')!.textContent = 'on the usual price, while the trouble lasts';
    $('now-crisis-meta')!.textContent = `${EVENT_KINDS[crisis.e.type].name} · ${ly(crisis.where)}`;
    $('now-crisis-cta')!.textContent = `Fly ${crisis.good.toLowerCase()} to ${crisis.where.name} →`;
    ($('now-crisis-cta') as HTMLAnchorElement).href = `/play/?system=${crisis.where.name.toLowerCase()}`;
  }

  // The nearest shipyard, and how far along: in news range if there is one, or the nearest anywhere.
  const near = yardsNear(lave, now, RANGE);
  const yards = near.length ? near : yardsNear(lave, now, Infinity);
  if (yards.length) {
    const { yard, where } = yards[0];
    const done = Math.min(1, (now - yard.start) / (yard.end - yard.start));
    $('now-yard')!.innerHTML = place(where);
    $('now-yard-line')!.textContent = `Wexley-Yorozu's Titan: ${stageInfo(yard.stage).news}.`;
    $('now-yard-bar')!.style.width = `${Math.round(done * 100)}%`;
    $('now-yard-meta')!.textContent = `${ly(where)} · stage ${STAGES.findIndex((s) => s.stage === yard.stage) + 1} of ${STAGES.length} · opens in about ${Math.max(1, Math.ceil((yard.end - now) / 86400000))} days${near.length > 1 ? ` · ${near.length - 1} more within ${RANGE} LY` : ''}`;
  }

  // Arrivals at Lave: the market's own timetable made visible, the next ships due in, the same for everyone.
  const due = voyages(lave, now, now + 90 * 60_000).filter((v) => v.leg === 'in').slice(0, 4);
  if (due.length) $('now-arrivals')!.innerHTML = due.map((v) => arrival(v, now)).join('');
  // And the Titan's next supply run at the nearest yard, under guard.
  const titan = yards.length ? voyages(yards[0].where, now, now + 30 * 60_000).find((v) => v.to === 'titan') : undefined;
  const run = $('now-titan')!;
  run.hidden = !titan;
  if (titan) run.innerHTML = `Next for the Titan at ${place(yards[0].where)}: the Wexley-Yorozu ${escapeHtml(hullName(titan.hull))} <b>${escapeHtml(titan.name)}</b> with ${escapeHtml(cargoWords(titan.cargo))}, ${inMin(titan.at, now)}${titan.escorts ? `, ${titan.escorts} Viper${titan.escorts > 1 ? 's' : ''} alongside` : ''}.`;

  // The ticker under the hero: a line at a time from all of the above.
  const first = ongoing[0];
  const cmdr = cmdrs[0];
  tickerItems = [
    cmdr ? (cmdr.kind === 'clip' ? `New clip: <b>${escapeHtml(cmdr.title)}</b>` : `<b>CMDR ${escapeHtml(cmdr.callsign)}</b> charted ${escapeHtml(cmdr.where.name)} first, ${ago(now, cmdr.t)}`) : '',
    posted ? `<b>${escapeHtml(COMPANIES[posted.company].name)}</b> posted a contract at Lave, ${posted.pay.toLocaleString('en-GB')} Cr` : '',
    first ? `<b>${escapeHtml(EVENT_KINDS[first.event.type].name)}</b> at ${escapeHtml(first.where.name)}, ${distanceLy(lave, first.where).toFixed(1)} LY out` : '',
    crisis ? `${escapeHtml(crisis.good)} <b>+${Math.round(crisis.pct * 100)}%</b> at ${escapeHtml(crisis.where.name)}` : '',
    yards.length ? `<b>${escapeHtml(yards[0].where.name)}</b> station: ${escapeHtml(stageInfo(yards[0].yard.stage).name)}` : '',
    due[0] ? `<b>${escapeHtml(due[0].name)}</b> due at Lave from ${escapeHtml(galaxy(0)[due[0].other].name)}, ${inMin(due[0].at, now)}` : '',
    `<b>${trouble.length}</b> worlds in trouble right now`,
  ].filter(Boolean);
}

// Clips in the live section (the Latest flight card, and commanders' clips in the news) play over the page.
const nowSection = document.getElementById('now');
if (nowSection) clipModal(nowSection);

const hullName = (id: string) => shipById(id)?.name ?? id;
/** A system's name, linked to its page (the first galaxy has pages). */
const place = (s: StarSystem) => (s.galaxy === 0 ? `<a href="${systemUrl(s.name)}">${escapeHtml(s.name)}</a>` : escapeHtml(s.name));
const inMin = (t: number, now: number) => `in ${Math.max(1, Math.round((t - now) / 60_000))}\u00a0min`;

/** One line of the arrivals board: when, who and for whom, from where, with what. */
function arrival(v: Voyage, now: number): string {
  const firm = v.company ? COMPANIES[v.company].name : 'Independent';
  const why = v.relief ? ` · relief for the ${EVENT_KINDS[v.relief].name.toLowerCase()}` : '';
  return `<li><time>${inMin(v.at, now).slice(3)}</time><span><b>${escapeHtml(v.name)}</b> <small>${escapeHtml(firm)} ${escapeHtml(hullName(v.hull))}</small></span><small>from ${place(galaxy(0)[v.other])} with ${escapeHtml(cargoWords(v.cargo))}${why}${v.escorts ? ` · ${v.escorts} escort${v.escorts > 1 ? 's' : ''}` : ''}</small></li>`;
}

/** Fetch what commanders have done; on any failure keep what we had (nothing, at first). */
async function load() {
  try {
    // no-cache: the edge refreshes every minute, so always ask it rather than the browser's copy.
    const r = await fetch(FEED, { cache: 'no-cache' });
    if (r.ok) feed = parseFeed(await r.json());
  } catch {
    // offline, or the server's down: the galaxy carries the page
  }
  render();
}

// A clip shared without a card of its own shows the Witch-fire's.
document.addEventListener('error', (e) => {
  const img = e.target as HTMLImageElement;
  if (img.tagName === 'IMG' && img.src.includes('/clip-card/')) img.src = FALLBACK_CARD;
}, true);

render();
void load();
setInterval(() => document.hidden || void load(), 60_000);

const ticker = $('ticker-item');
if (ticker) {
  let at = 0;
  let paused = false;
  const show = () => (ticker.innerHTML = tickerItems[at % tickerItems.length]);
  show();
  // Turn over every few seconds, with a fade; held still while pointed at or for reduced motion.
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const link = ticker.closest('a')!;
    for (const [on, hold] of [['mouseenter', true], ['mouseleave', false], ['focus', true], ['blur', false]] as const) link.addEventListener(on, () => (paused = hold));
    setInterval(() => {
      if (paused || document.hidden) return;
      ticker.classList.add('out');
      setTimeout(() => {
        at++;
        show();
        ticker.classList.remove('out');
      }, 400);
    }, 5000);
  }
}

// The Falcon, turning: opaque, in the card's colour (over a see-through canvas the glow pools into a wash).
const canvas = $('now-falcon') as HTMLCanvasElement | null;
if (canvas) {
  try {
    // On paper she's an ink drawing until you reach for her card (or, on a phone, she's in view): then she lights.
    const paper = onPaper();
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: paper });
    renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
    const scene = new THREE.Scene();
    if (!paper) scene.background = new THREE.Color('#0c0f15');
    const camera = new THREE.PerspectiveCamera(30, 1, 1, 5000);
    const model = buildShip(shipById('falcon')!);
    scene.add(model.root);
    const inked = paper ? inkable(model) : null;
    const lit = easer(0.8);
    let litTarget = 0;
    const card = canvas.closest<HTMLElement>('.now-card');
    if (paper && card) {
      card.addEventListener('pointerenter', () => (litTarget = 1));
      card.addEventListener('pointerleave', () => (litTarget = 0));
      if (matchMedia('(pointer: coarse)').matches)
        new IntersectionObserver(([e]) => (litTarget = e.isIntersecting ? 1 : 0), { threshold: 0.9 }).observe(card);
    }
    const paint = (dt: number) => {
      if (inked) {
        const t = lit.step(litTarget, dt);
        lightUp(renderer, bloom, inked, t);
        card?.classList.toggle('lit', t > 0.5);
      }
      composer.render();
    };
    const { composer, bloom } = glow(renderer, scene, camera);
    const size = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h, false);
      composer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
      camera.position.set(0, model.radius * 0.35, (model.radius * 0.7) / Math.tan(THREE.MathUtils.degToRad(15)) / Math.min(1, camera.aspect));
      camera.lookAt(0, 0, 0);
    };
    new ResizeObserver(size).observe(canvas);
    size();
    model.root.rotation.set(0.25, -0.8, 0);
    paint(0); // one frame now, so she's there before the card scrolls into view
    let visible = false;
    new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let last = performance.now();
    const frame = (t: number) => {
      requestAnimationFrame(frame);
      const dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!visible || document.hidden) return;
      model.root.rotation.set(0.25, still ? -0.8 : t / 3000, 0);
      paint(dt);
    };
    requestAnimationFrame(frame);
  } catch {
    canvas.remove(); // no WebGL: the card stands without her
  }
}
