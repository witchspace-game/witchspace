import type { ShipDef } from '../content/types';
import { cleanName, defaultSpec, depositFor, fitScale, GLOWS, LUXURIES, ORDERABLE, PALETTE, priceLines, productionHours, quote, TRIM_PRICE, UPGRADES, type GlowId, type Spec } from '../game/shipyard';
import { PLAYER_LASERS, type LaserId } from '../game/weapons';
import { escapeHtml } from '../ui/escape';
import { viewer, type Viewer } from './viewer';

// The configurator (docs/design/ship-configurator.md; Mark: "similar to the
// way Tesla configurator"): spec a ship as you would a new car, with her
// turning in your paint and the price adding up as you go. The choices and
// the prices are the game's own (src/game/shipyard.ts), so the site and the
// yard can't disagree. Ordering puts the spec where the game finds it; the
// game takes the deposit at the next shipyard you dock at.

/** Where the game looks for a spec from the site (docs/design/ship-configurator.md). */
const SPEC_KEY = 'witchspace.spec.v1';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const def = JSON.parse($('#ship-def').textContent!) as ShipDef;
const LASERS = Object.keys(PLAYER_LASERS) as LaserId[];
const cr = (n: number) => `${n.toLocaleString('en-GB')} Cr`;
const cost = (n: number) => (n ? cr(n) : 'Included');
const colourOf = (c: string | null) => PALETTE.find((p) => p.colour === c);

// --- The spec, and the link that carries it -------------------------------------------------

const toB64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s: string) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

/** A spec for this ship from anywhere (a link, a save), kept to what the yard offers. */
function sane(x: unknown): Spec | null {
  const s = x as Partial<Spec> | null;
  if (!s || s.ship !== def.id) return null;
  const base = defaultSpec(def);
  const offered = (c: unknown) => typeof c === 'string' && ORDERABLE.some((p) => p.colour === c);
  return {
    ship: def.id,
    colour: offered(s.colour) || s.colour === base.colour ? s.colour! : base.colour,
    name: typeof s.name === 'string' ? cleanName(s.name) : '',
    laser: LASERS.includes(s.laser as LaserId) ? s.laser! : base.laser,
    ...(LASERS.includes(s.rear as LaserId) ? { rear: s.rear } : {}),
    upgrades: Array.isArray(s.upgrades) ? [...new Set(s.upgrades.filter((u) => UPGRADES.some((e) => e.id === u)))] : [],
    glow: (s.glow as GlowId) in GLOWS ? s.glow! : 'standard',
    trim: offered(s.trim) ? s.trim! : null,
    luxuries: Array.isArray(s.luxuries) ? [...new Set(s.luxuries.filter((l) => LUXURIES.some((x) => x.id === l)))] : [],
  };
}

function fromLink(): Spec | null {
  const m = /^#spec=([\w-]+)$/.exec(location.hash);
  try {
    return m ? sane(JSON.parse(fromB64(m[1]))) : null;
  } catch {
    return null;
  }
}

function saved(): { spec: Spec; at: number } | null {
  try {
    const s = JSON.parse(localStorage.getItem(SPEC_KEY) ?? 'null') as { spec: unknown; at: number } | null;
    const spec = s && sane(s.spec);
    return spec ? { spec, at: s!.at } : null;
  } catch {
    return null;
  }
}

let spec: Spec = fromLink() ?? saved()?.spec ?? defaultSpec(def);
const link = () => `${location.origin}${location.pathname}#spec=${toB64(JSON.stringify(spec))}`;

// --- The steps ------------------------------------------------------------------------------

const STEPS = [
  ['paint', 'Paint'],
  ['glow', 'Glow'],
  ['trim', 'Trim'],
  ['aboard', 'Aboard'],
  ['fit', 'Fit-out'],
  ['order', 'Order'],
] as const;
type Step = (typeof STEPS)[number][0];
let step: Step = 'paint';

const swatches = (attr: string, chosen: string | null) =>
  `<div class="build-swatches">${ORDERABLE.map((p) => `<button type="button" ${attr}="${p.colour}" aria-pressed="${chosen === p.colour}" style="--sw:${p.colour}"><i></i><span>${escapeHtml(p.name)}</span><small>${cost(p.price)}</small></button>`).join('')}</div>`;

const choice = (attr: string, value: string, on: boolean, name: string, price: string, note = '') =>
  `<button type="button" class="build-choice" ${attr}="${value}" aria-pressed="${on}"><span>${escapeHtml(name)}${note ? `<em>${escapeHtml(note)}</em>` : ''}</span><small>${price}</small></button>`;

const tick = (attr: string, value: string, on: boolean, name: string, price: string, note = '') =>
  `<label class="build-tick"><input type="checkbox" ${attr}="${value}" ${on ? 'checked' : ''} /><span>${escapeHtml(name)}${note ? `<em>${escapeHtml(note)}</em>` : ''}</span><small>${price}</small></label>`;

function options(): string {
  const k = fitScale(def);
  const laser = (id: LaserId) => cr(Math.round(PLAYER_LASERS[id].price * k));
  const rating = (id: LaserId) => (PLAYER_LASERS[id].minRating ? `Sold to pilots rated ${PLAYER_LASERS[id].minRating} and above` : '');
  switch (step) {
    case 'paint': {
      const c = colourOf(spec.colour);
      return `<h2>Her colour <span>${c ? escapeHtml(c.name) : 'The maker’s own'}</span></h2>${swatches('data-colour', spec.colour)}${c ? `<p class="build-note">${escapeHtml(c.line)}</p>` : ''}`;
    }
    case 'glow':
      return `<h2>How hard she glows</h2><div class="build-choices">${(Object.keys(GLOWS) as GlowId[]).map((g) => choice('data-glow', g, spec.glow === g, GLOWS[g].name, cost(GLOWS[g].price))).join('')}</div><p class="build-note">Never dimmer than the yard’s own: the glow is the signature.</p>`;
    case 'trim':
      return `<h2>Two-tone <span>${cr(TRIM_PRICE)}, and the colour’s own price</span></h2>
        <div class="build-choices">${choice('data-two-tone', '', !spec.trim, 'One colour', 'Included')}${choice('data-two-tone', '1', Boolean(spec.trim), 'Two-tone: the fine lines in a second colour', cr(TRIM_PRICE))}</div>
        ${spec.trim ? swatches('data-trim', spec.trim) : ''}${def.geometry.details ? '' : '<p class="build-note">This hull has few fine lines, so the trim is subtle.</p>'}`;
    case 'aboard':
      return `<h2>Aboard <span>comfort and showing off: nothing that flies or fights better</span></h2><div class="build-ticks">${LUXURIES.map((l) => tick('data-lux', l.id, spec.luxuries.includes(l.id), l.name, cr(l.price), l.blurb)).join('')}</div>`;
    case 'fit':
      return `<h2>Her laser</h2><div class="build-choices">${LASERS.map((id) => choice('data-laser', id, spec.laser === id, PLAYER_LASERS[id].name, laser(id), rating(id))).join('')}</div>
        <h2>Rear laser</h2><div class="build-choices">${choice('data-rear', '', !spec.rear, 'None', '—')}${LASERS.map((id) => choice('data-rear', id, spec.rear === id, PLAYER_LASERS[id].name, laser(id), rating(id))).join('')}</div>
        <h2>Upgrades <span>fitted to a hull this size: ×${k.toFixed(1)}</span></h2><div class="build-ticks">${UPGRADES.map((e) => tick('data-up', e.id, spec.upgrades.includes(e.id), e.name, cr(Math.round(e.price * k)), e.blurb)).join('')}</div>`;
    case 'order':
      return orderStep();
  }
}

function summary(): string {
  const c = colourOf(spec.colour);
  const t = colourOf(spec.trim);
  const kit = [PLAYER_LASERS[spec.laser].name, ...(spec.rear ? [`${PLAYER_LASERS[spec.rear].name} at the rear`] : []), ...spec.upgrades.map((u) => UPGRADES.find((e) => e.id === u)!.name)];
  const aboard = spec.luxuries.map((l) => LUXURIES.find((x) => x.id === l)!.name);
  return `<dl class="build-summary">
    <div><dt>Finish</dt><dd><span class="build-dot" style="--sw:${spec.colour}"></span>${escapeHtml(c?.name ?? 'The maker’s own')}${t ? `, with ${escapeHtml(t.name)} trim` : ''} · ${GLOWS[spec.glow].name}</dd></div>
    <div><dt>Fitted</dt><dd>${kit.map(escapeHtml).join(' · ')}</dd></div>
    ${aboard.length ? `<div><dt>Aboard</dt><dd>${aboard.map(escapeHtml).join(' · ')}</dd></div>` : ''}
  </dl>`;
}

function orderStep(): string {
  const total = quote(def, spec);
  const waiting = saved();
  const days = Math.round(productionHours({}) / 24);
  return `<h2>Her name <span>painted on, 24 letters at most</span></h2>
    <input class="build-name" id="build-name" maxlength="24" placeholder="Halcyon, Brass Neck, Last Orders…" value="${escapeHtml(spec.name)}" aria-label="Her name" />
    <h2>Your ${escapeHtml(def.name)}</h2>
    ${summary()}
    <p class="build-order-total"><span>Price</span><b>${cr(total)}</b></p>
    ${def.concept ? `<p class="build-order-total"><span>Deposit, a tenth, refundable until she’s ready</span><b>${cr(depositFor(total))}</b></p>` : ''}
    <p class="connect-buttons"><button type="button" class="button primary" id="build-order">${def.concept ? 'Order her' : 'Save her for the yard'}</button> <button type="button" class="button ghost" id="build-share" data-share data-share-title="My ${escapeHtml(def.name)}">Share your spec</button></p>
    <p class="build-note" id="build-ordered">${
      waiting
        ? `You have a ${escapeHtml(def.name)} spec waiting for the yard${waiting.spec.name ? `: “${escapeHtml(waiting.spec.name)}”` : ''}. Ordering again replaces it.`
        : def.concept
          ? `Nothing is paid here. Dock at any shipyard and your spec is there: the deposit is one tap, in credits. ${escapeHtml(def.manufacturer ?? 'The yard')} then finish her for you, in about ${days} days.`
          : `Nothing is paid here. Shipyards will sell the ${escapeHtml(def.name)} outright soon; your spec waits at the yard until they do.`
    }</p>`;
}

// --- Drawing it -----------------------------------------------------------------------------

let view: Viewer | null = null;
try {
  view = viewer($<HTMLCanvasElement>('.build-view .ship-canvas'));
  $('.build-view').classList.add('live');
} catch {
  // No WebGL: the drawing stays.
}

let shown = '';
function paint() {
  const key = `${spec.colour}|${spec.glow}|${spec.trim}`;
  if (key === shown) return;
  shown = key;
  view?.show(def, { colour: spec.colour, glow: GLOWS[spec.glow].glow, trim: spec.trim });
  document.querySelector<HTMLElement>('.build-page')!.style.setProperty('--hull', spec.colour);
  const c = colourOf(spec.colour);
  const t = colourOf(spec.trim);
  $('#build-caption').textContent = `${c?.name ?? 'The maker’s own'}${t ? `, with ${t.name} trim` : ''} · ${GLOWS[spec.glow].name}`;
}

function bar() {
  const total = quote(def, spec);
  const p = priceLines(def, spec);
  const i = STEPS.findIndex(([s]) => s === step);
  const next = STEPS[i + 1];
  $('#build-bar').innerHTML = `<div class="build-bar-in">
    <div class="build-price"><b>${cr(total)}</b><span>Hull ${p.hull.toLocaleString('en-GB')} · fit-out ${p.fit.toLocaleString('en-GB')} · finish ${p.finish.toLocaleString('en-GB')}${def.concept ? ` · deposit ${cr(depositFor(total))}` : ''}</span></div>
    ${next ? `<button type="button" class="button primary" data-step="${next[0]}">${next[1]} →</button>` : ''}
  </div>`;
}

function render() {
  $('#build-steps').innerHTML = STEPS.map(([s, label], i) => `<button type="button" data-step="${s}" aria-current="${s === step ? 'step' : 'false'}"><small>${i + 1}</small>${label}</button>`).join('');
  $('#build-options').innerHTML = options();
  paint();
  bar();
  history.replaceState(null, '', link().slice(location.origin.length));
  const share = document.querySelector<HTMLElement>('#build-share');
  if (share) share.dataset.shareUrl = link().slice(location.origin.length);
}

function change(f: () => void) {
  f();
  render();
}

document.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('button');
  if (!b) return;
  const d = b.dataset;
  if (d.step) {
    step = d.step as Step;
    render();
    if (b.closest('#build-bar')) $('#build-steps').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (d.colour) change(() => (spec.colour = d.colour!));
  else if (d.trim) change(() => (spec.trim = d.trim!));
  else if (d.twoTone !== undefined) change(() => (spec.trim = d.twoTone ? (spec.trim ?? ORDERABLE.find((p) => p.colour !== spec.colour)!.colour) : null));
  else if (d.glow) change(() => (spec.glow = d.glow as GlowId));
  else if (d.laser) change(() => (spec.laser = d.laser as LaserId));
  else if (d.rear !== undefined)
    change(() => {
      if (d.rear) spec.rear = d.rear as LaserId;
      else delete spec.rear;
    });
  else if (b.id === 'build-order') order();
});

document.addEventListener('change', (e) => {
  const i = e.target as HTMLInputElement;
  const toggle = (list: string[], id: string) => (i.checked ? [...new Set([...list, id])] : list.filter((x) => x !== id));
  if (i.dataset.lux) change(() => (spec.luxuries = toggle(spec.luxuries, i.dataset.lux!)));
  else if (i.dataset.up) change(() => (spec.upgrades = toggle(spec.upgrades, i.dataset.up!) as Spec['upgrades']));
});

document.addEventListener('input', (e) => {
  const i = e.target as HTMLInputElement;
  if (i.id !== 'build-name') return;
  spec.name = cleanName(i.value);
  history.replaceState(null, '', link().slice(location.origin.length));
});

/** Put the spec where the game finds it (this browser; your account too, once the server has /me/spec). */
function order() {
  spec.name = cleanName(spec.name);
  $<HTMLInputElement>('#build-name').value = spec.name;
  try {
    localStorage.setItem(SPEC_KEY, JSON.stringify({ spec, at: Date.now() }));
  } catch {
    $('#build-ordered').textContent = 'This browser won’t keep it (private browsing?). Share the link to yourself, and open it where you play.';
    return;
  }
  const total = quote(def, spec);
  $('#build-ordered').innerHTML = `<b>She’s on order.</b> Dock at any shipyard${def.concept ? ` and your ${escapeHtml(def.name)} is waiting for your deposit of ${cr(depositFor(total))}` : ` and your spec is waiting`}. On another device? Share the link to yourself, and open it there.`;
  $('#build-ordered').classList.add('done');
  $('#build-order').textContent = 'Ordered ✓';
}

window.addEventListener('hashchange', () => {
  const s = fromLink();
  if (s) change(() => (spec = s));
});

render();
