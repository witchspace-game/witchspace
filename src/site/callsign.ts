import { EDITIONS, editionById } from '../content/editions';
import { shipById, ships } from '../content/ships';
import type { ShipDef } from '../content/types';
import { hullOf, type Commander, type Paint } from '../game/commander';
import { inYards } from '../game/manual';
import { combatRating } from '../game/rating';
import { GLOWS } from '../game/shipyard';
import * as acct from '../net/account';
import type { Look } from '../render/shipModel';
import { cardShip, CARD_H, CARD_W, type CardShip } from './callsignCard';
import { careerById, careerLine, CAREERS, claimLine, cleanCallsign, finishFor, LAUNCH, memberNumber, parseCheck, rgbOf, SCENES, sceneUrl, scenesFor, variants, verdictWords, type Career, type Check, type Finish } from './callsignWords';

// Claim your callsign (/callsign/, docs/design/callsign-card.md, Mark): make your card (a name, what you do,
// a scene from the game behind her, one of your own ships in her own paint, dragged round to the angle you
// like) and share it, no questions asked. Then, if you want the name for good, "make it yours": an email, a
// link back here, and the name is claimed and the card kept, with a link of its own whose preview is the card.
// The check is the server's (GET /callsign/check); a name someone else has can't be shared as yours. Below,
// every card you can't have yet, locked, with how to earn it. /callsign/<career>/ opens on that career.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** Turnstile's public site key (as the ideas board and the game); empty skips it in development. */
const TURNSTILE_SITE_KEY = import.meta.env.DEV ? '' : '0x4AAAAAAFfP1CB8aXita2o_';
declare const turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void } | undefined;
/** A claim waiting on its email link: the name and the card as they were made, kept on this device. */
const PENDING = 'witchspace.callsign.pending';

const input = $<HTMLInputElement>('cs-name');
const verdictEl = $('cs-verdict');
const tryEl = $('cs-try');
const errorEl = $('cs-error');

/** A ship on the card: one you own, in her own paint; or, locked, one you could earn. */
interface Hull {
  key: string;
  ship: string;
  label: string;
  look: Look | null;
  edition?: { id: string; number: number };
  livery?: 'marshal';
}
/** A card to earn, and how. */
interface Earnable extends Hull {
  how: string;
  img: string;
  finish?: Finish;
  mark?: string;
}

let career: Career = careerById(/^\/callsign\/([a-z]+)\/?$/.exec(location.pathname)?.[1] ?? 'explore');
let scene: string = career.scenes[0];
let sceneChosen = false;
let name = '';
let check: Check | 'unknown' | null = null;
let turnstileToken = '';
let widget: string | undefined;

const COBRA: Hull = { key: 'cobra-mk3', ship: 'cobra-mk3', label: 'Cobra Mk III', look: null };
let owned: Hull[] = [COBRA];
let hull: Hull = COBRA;
let preview: Earnable | null = null;
let elite = false;
let member: number | null = null;
/** A founding member claimed before launch; before you've claimed, it's whether you'd be one now. */
let founding = Date.now() < LAUNCH;
let cardUrl: string | null = null;

const pad = (n: number) => String(n).padStart(3, '0');
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // Storage blocked: the claim finishes only if the link opens here and now.
    }
  },
};

/** Her look in her own paint, as the game shows her (src/main.ts paintLook). */
function lookOf(def: ShipDef, p: { colour: string; glow?: keyof typeof GLOWS; trim?: string | null; luxuries?: readonly string[]; ghost?: boolean }): Look {
  return {
    colour: p.colour,
    glow: GLOWS[p.glow ?? 'standard'].glow * (def.style.glow ?? 1),
    trim: p.trim ?? null,
    ...(p.luxuries?.includes('black-light-lights') && !p.ghost ? { lights: true } : {}),
  };
}

/** A ship you own, from your save: her hull and her paint, and her edition and number if she has one. */
function hullFrom(ship: string, paint: Paint | undefined): Hull | null {
  const def = shipById(ship);
  if (!def) return null;
  const e = paint?.edition ? editionById(paint.edition.id) : undefined;
  return {
    key: `${ship}:${paint?.edition ? `${paint.edition.id}-${paint.edition.number}` : (paint?.colour ?? 'maker')}`,
    ship,
    label: e && paint?.edition ? `${e.name} ${pad(paint.edition.number)}` : def.name,
    look: paint ? lookOf(def, paint) : null,
    ...(paint?.edition ? { edition: paint.edition } : {}),
  };
}

// --- The card ------------------------------------------------------------------------------------------

let ship: CardShip | null = null;
try {
  ship = cardShip($<HTMLCanvasElement>('cs-ship'));
} catch {
  // No WebGL: the card keeps its words over its scene, and so does the picture.
}
if (ship) {
  $('cs-scene').hidden = true;
  const hint = $('cs-hint');
  hint.hidden = false;
  $('cs-ship').addEventListener('pointerdown', () => (hint.hidden = true), { once: true });
}
const card = $('cs-card');
// The card's words are sized from a hundredth of its width, so the preview is the picture in small.
new ResizeObserver(() => card.style.setProperty('--u', `${card.clientWidth / 100}px`)).observe(card);

const shown = () => name || 'Your callsign';
const onCard = (): Hull => preview ?? hull;
const finishNow = (): Finish => preview?.finish ?? finishFor({ edition: hull.edition?.id, elite, founding });
/** The one word for what you've earned, top right: nothing at all if there's nothing to say. */
const markNow = () => preview?.mark ?? (elite ? 'Legend' : hull.edition ? (editionById(hull.edition.id)?.name.replace(/ Edition$/, '') ?? '') : founding ? 'Founding' : '');
const mine = (n: string) => Boolean(n) && acct.currentAccount()?.callsign?.toLowerCase() === n.toLowerCase();

function drawCard() {
  const n = $('cs-card-name');
  n.textContent = shown();
  n.classList.toggle('long', shown().length > 14);
  $('cs-card-sub').textContent = `${career.noun} · ${onCard().label}`;
  const num = $('cs-card-number');
  num.hidden = !member || Boolean(preview);
  num.textContent = memberNumber(member);
  $('cs-card-mark').textContent = markNow();
  card.dataset.finish = finishNow();
  $('cs-line').textContent = careerLine(career);
  const stage = document.querySelector<HTMLElement>('.callsign-hero')!;
  stage.style.setProperty('--role', career.colour);
  stage.style.setProperty('--role-rgb', rgbOf(career.colour));
}

function showShip() {
  const h = onCard();
  ship?.show(h.ship, h.look, h.livery);
}

const tabs = (el: HTMLElement, attr: string, on: string) => {
  for (const b of el.querySelectorAll<HTMLElement>(`[${attr}]`)) b.setAttribute('aria-pressed', String(b.getAttribute(attr) === on));
};

const careers = $('cs-careers');
careers.innerHTML = CAREERS.map((c) => `<button type="button" data-career="${c.id}" style="--c:${c.colour}" aria-pressed="${c.id === career.id}">${c.name}</button>`).join('');
careers.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-career]');
  if (!b) return;
  career = careerById(b.dataset.career);
  tabs(careers, 'data-career', career.id);
  drawScenes();
  if (!sceneChosen) setScene(career.scenes[0]);
  drawCard();
});

const sceneImg = $<HTMLImageElement>('cs-scene');
const scenes = $('cs-scenes');
/** The career's own scenes first, then the rest. */
function drawScenes() {
  scenes.innerHTML = scenesFor(career)
    .map((id) => `<button type="button" class="cs-scene-pick" data-scene="${id}" aria-pressed="${id === scene}" aria-label="${SCENES[id]}" title="${SCENES[id]}"><img src="${sceneUrl(id, true)}" width="240" height="126" alt="" loading="lazy" /></button>`)
    .join('');
}
function setScene(id: string) {
  scene = id;
  tabs(scenes, 'data-scene', id);
  // With WebGL the scene is drawn with her, so her hull hides it; without, it's the picture under the words.
  if (ship) return void ship.scene(sceneUrl(id));
  const next = new Image();
  next.src = sceneUrl(id);
  sceneImg.classList.add('swap');
  const done = () => {
    if (scene !== id) return;
    sceneImg.src = next.src;
    sceneImg.classList.remove('swap');
  };
  if (next.complete) done();
  else next.onload = next.onerror = done;
}
scenes.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-scene]');
  if (!b) return;
  sceneChosen = true;
  setScene(b.dataset.scene!);
});
drawScenes();
setScene(scene);

// Your ships: only the ones you own, each in her own paint. One ship needs no choosing.
const shipsEl = $('cs-ships');
function drawShips() {
  $('cs-ships-row').hidden = owned.length < 2;
  shipsEl.innerHTML = owned
    .map((h) => `<button type="button" data-hull="${h.key}" style="--c:${h.look?.trim ?? h.look?.colour ?? shipById(h.ship)?.style.lineColor ?? '#3dffb0'}" aria-pressed="${h.key === hull.key && !preview}">${h.label}</button>`)
    .join('');
}
shipsEl.addEventListener('click', (e) => {
  const h = owned.find((o) => o.key === (e.target as HTMLElement).closest<HTMLElement>('[data-hull]')?.dataset.hull);
  if (!h) return;
  hull = h;
  endPreview();
});
drawShips();
showShip();
$('cs-claim-line').textContent = claimLine(Date.now());

// --- Cards to earn -------------------------------------------------------------------------------------

/** Every card you can't have yet: the yards' ships you don't own, the Marshals', Legend, and the editions. */
function earnables(): Earnable[] {
  const have = new Set(owned.map((h) => h.ship));
  const editions = new Set(owned.flatMap((h) => (h.edition ? [h.edition.id] : [])));
  const yards: Earnable[] = ships
    .filter((d) => inYards(d) && !have.has(d.id))
    .map((d) => ({ key: `ship:${d.id}`, ship: d.id, label: d.name, look: null, img: `/share/ships-${d.id}.jpg`, how: `Buy a ${d.name} at a shipyard, and she can fly on your card.` }));
  const marshal: Earnable = { key: 'marshal', ship: 'lancer', label: 'Marshal', look: null, livery: 'marshal', finish: 'gold', mark: 'Marshal', img: '/share/ships-lancer.jpg', how: 'The Marshals’ card: a Lancer in their gold band. Join the Co-operative Marshals, coming to the game.' };
  const legend: Earnable = { ...hull, key: 'legend', finish: 'black', mark: 'Legend', img: `/share/ships-${hull.ship}.jpg`, label: 'Legend', how: 'Legend, on whatever you fly. Reach Elite.' };
  const eds: Earnable[] = EDITIONS.filter((e) => !editions.has(e.id)).map((e) => ({
    key: `edition:${e.id}`,
    ship: e.ship,
    label: e.name,
    look: lookOf(shipById(e.ship)!, e),
    finish: e.id as Finish,
    mark: 'By invitation',
    img: `/share/ships-${e.ship}-${e.id}.jpg`,
    how: `The ${e.name}: one of ${e.limit}, never sold. By invitation, for the people who build Witchspace.`,
  }));
  return [...yards, marshal, ...(elite ? [] : [legend]), ...eds];
}

const earnEl = $('cs-earn');
function drawEarn() {
  earnEl.innerHTML = earnables()
    .map((e) => `<button type="button" class="cs-earn-tile" data-earn="${e.key}"><span class="cs-earn-pic"><img src="${e.img}" width="1200" height="630" alt="" loading="lazy" /></span>${e.label}</button>`)
    .join('');
}
earnEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-earn]');
  const item = earnables().find((x) => x.key === b?.dataset.earn);
  if (!item) return;
  // Legend is your own ship on its card; anything else is the locked ship herself.
  preview = item.key === 'legend' ? { ...item, ...hull, key: 'legend', finish: 'black', mark: 'Legend', how: item.how, img: item.img, label: hull.label } : item;
  $('cs-card-locked').hidden = false;
  $('cs-earn-note').hidden = false;
  $('cs-hint').hidden = true;
  $('cs-earn-how').textContent = item.how;
  for (const t of earnEl.querySelectorAll<HTMLElement>('[data-earn]')) t.classList.toggle('on', t === b);
  showShip();
  drawShips();
  drawCard();
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
});
function endPreview() {
  preview = null;
  $('cs-card-locked').hidden = true;
  $('cs-earn-note').hidden = true;
  for (const t of earnEl.querySelectorAll<HTMLElement>('[data-earn]')) t.classList.remove('on');
  showShip();
  drawShips();
  drawCard();
}
$('cs-earn-back').addEventListener('click', endPreview);
drawEarn();

// --- Is it free? ---------------------------------------------------------------------------------------

const cache = new Map<string, Check>();
async function ask(n: string): Promise<Check | 'unknown'> {
  const had = cache.get(n.toLowerCase());
  if (had) return had;
  try {
    const token = acct.sessionToken();
    const res = await fetch(`${acct.API}/callsign/check?name=${encodeURIComponent(n)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const answer = res.ok ? parseCheck(await res.json()) : null;
    if (!answer) return 'unknown';
    cache.set(n.toLowerCase(), answer);
    return answer;
  } catch {
    return 'unknown';
  }
}

function say(text: string, kind = '') {
  verdictEl.textContent = text;
  verdictEl.className = `cs-verdict ${kind}`;
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const valid = (n: string) => n.replace(/[^\p{L}\p{N}]/gu, '').length >= 2;
/** A card can be shared with a name that's free or yours (or when the check can't answer), never someone else's. */
const shareable = () => valid(name) && (check === 'unknown' || (check !== null && (check.verdict === 'free' || check.verdict === 'yours')));

/** What sits under the card: sharing, and making the name yours, as the name allows. */
function drawActions() {
  const isMine = mine(name);
  $<HTMLButtonElement>('cs-share').disabled = !shareable() && !isMine;
  $('cs-fly').hidden = !isMine;
  $('cs-claim').hidden = isMine || !shareable();
  $('cs-claim-open').textContent = acct.currentAccount()?.callsign ? `Change your callsign to CMDR ${name}` : `Make CMDR ${name} yours`;
  const mineEl = $('cs-mine');
  mineEl.hidden = !isMine;
  mineEl.innerHTML = isMine ? `CMDR ${escapeHtml(name)} is yours${cardUrl ? ` · <a href="${escapeHtml(cardUrl)}">${escapeHtml(cardUrl.replace(/^https:\/\//, ''))}</a>` : ''}` : '';
}

let asking = 0;
async function judge() {
  const n = cleanCallsign(input.value);
  name = n;
  check = null;
  drawCard();
  tryEl.hidden = true;
  errorEl.hidden = true;
  $('cs-email-form').hidden = true;
  $('cs-sent').hidden = true;
  if (!valid(n)) {
    say('');
    drawActions();
    return;
  }
  const ticket = ++asking;
  say('Checking…');
  const answer = await ask(n);
  if (ticket !== asking) return;
  check = answer;
  if (answer === 'unknown') say('');
  else {
    name = answer.name;
    drawCard();
    if (answer.verdict === 'yours') say(mine(answer.name) ? '' : `CMDR ${answer.name} is held for you.`, 'yours');
    else say(answer.verdict === 'free' ? 'Free' : verdictWords(answer), answer.verdict);
    if (answer.verdict === 'taken') void suggest(answer.name, ticket);
  }
  drawActions();
}

/** A name that's taken: try "II", "III" and "IV" and offer the free ones. */
async function suggest(n: string, ticket: number) {
  const free: string[] = [];
  for (const v of variants(n)) {
    const a = await ask(v);
    if (ticket !== asking) return;
    if (a !== 'unknown' && a.verdict === 'free') free.push(a.name);
    if (free.length === 2) break;
  }
  if (!free.length) return;
  tryEl.textContent = 'Free: ';
  for (const f of free) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'link-button';
    b.textContent = `CMDR ${f}`;
    b.addEventListener('click', () => {
      input.value = f;
      void judge();
    });
    tryEl.append(b);
  }
  tryEl.hidden = false;
}

let timer = 0;
input.addEventListener('input', () => {
  clearTimeout(timer);
  timer = window.setTimeout(() => void judge(), 400);
});
$('cs-name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(timer);
  input.blur();
  void judge();
});

// --- Making it yours: an email, a link back here --------------------------------------------------------

function fail(e: unknown) {
  errorEl.textContent = (e as Error).message || 'Something went wrong: try again.';
  errorEl.hidden = false;
}

function mountTurnstile() {
  const el = $('cs-turnstile');
  if (!TURNSTILE_SITE_KEY || widget !== undefined) return;
  const draw = () => (widget = turnstile?.render(el, { sitekey: TURNSTILE_SITE_KEY, theme: 'dark', size: 'flexible', callback: (t: string) => (turnstileToken = t) }));
  if (typeof turnstile !== 'undefined') return void draw();
  (window as unknown as Record<string, unknown>).onCallsignTurnstile = draw;
  const s = document.createElement('script');
  s.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onCallsignTurnstile&render=explicit';
  s.async = true;
  document.head.append(s);
}

/** The card as it's made now, to finish building when the link comes back. */
const choices = () => ({ name, career: career.id, scene, hull: hull.key, angle: ship?.angle() });

$('cs-claim-open').addEventListener('click', () => {
  // Signed in already: no email needed.
  if (acct.signedIn()) return void claim(name);
  $('cs-email-form').hidden = false;
  mountTurnstile();
  $('cs-email').focus();
});

$('cs-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  const email = $<HTMLInputElement>('cs-email').value.trim();
  const send = $<HTMLButtonElement>('cs-send');
  send.disabled = true;
  try {
    // The link brings you back here (next), and the email names the callsign it's for.
    const res = await fetch(`${acct.API}/auth/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, turnstile: turnstileToken, next: '/callsign/', callsign: name }),
    });
    const r = (await res.json().catch(() => ({}))) as { error?: string; devLink?: string };
    if (!res.ok) throw new Error(r.error ?? 'Something went wrong');
    store.set(PENDING, JSON.stringify(choices()));
    $('cs-email-form').hidden = true;
    const sent = $('cs-sent');
    sent.hidden = false;
    sent.textContent = `Check your email: open the link on this device, and CMDR ${name} is yours.`;
    if (r.devLink) sent.insertAdjacentHTML('beforeend', ` <a href="${escapeHtml(r.devLink)}">Development: open it</a>`);
  } catch (err) {
    fail(err);
    if (widget !== undefined) turnstile?.reset(widget);
    turnstileToken = '';
  } finally {
    send.disabled = false;
  }
});

/** Take the name (POST /me/callsign), then keep the card as it is. */
async function claim(n: string) {
  errorEl.hidden = true;
  try {
    name = await acct.setCallsign(n);
    input.value = name;
    check = { name, verdict: 'yours' };
    await loadMine();
    say('');
    drawActions();
    await keep();
  } catch (err) {
    // Taken in the meantime, or not allowed after all: back to the box.
    fail(err);
    cache.clear();
    void judge();
  }
}

// --- Keeping it ------------------------------------------------------------------------------------------

async function asMe<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = acct.sessionToken();
  const res = await fetch(acct.API + path, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
  return data;
}

/** Keep the card on your account (PUT /me/card), for its link's preview; null if it can't be kept. */
async function keep(): Promise<string | null> {
  if (preview || !mine(name)) return null;
  const file = await picture();
  if (!file) return null;
  const body = new FormData();
  body.append('card', JSON.stringify({ career: career.id, scene, ship: hull.ship, ...(hull.edition ? { edition: hull.edition } : {}), angle: ship?.angle() ?? { x: 0.35, y: 5.53 } }));
  body.append('image', file);
  try {
    const r = await asMe<{ url: string }>('/me/card', { method: 'PUT', body });
    cardUrl = r.url;
    drawActions();
    return r.url;
  } catch {
    return null;
  }
}

// --- The picture -------------------------------------------------------------------------------------------

/** Each finish's sheen and the ink of its word, as on the page (site.css .cs-card[data-finish]). */
const SHEENS: Record<Finish, [string, string]> = {
  titanium: ['rgba(214,224,238,0.09)', '#c9d3e0'],
  alloy: ['rgba(255,255,255,0.05)', '#a7b0bc'],
  black: ['rgba(255,255,255,0.03)', '#e8eaee'],
  gold: ['rgba(255,214,120,0.12)', '#f0cf7a'],
  'witch-fire': ['rgba(255,77,255,0.1)', '#ff9cff'],
  dark: ['rgba(157,123,255,0.1)', '#c6b4ff'],
};

async function picture(): Promise<File | null> {
  // The callsign in the game's own type: make sure it's loaded before it's drawn.
  await document.fonts.load("600 64px 'Rajdhani'").catch(() => []);
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, CARD_W, CARD_H);
  if (ship) {
    await ship.scene(sceneUrl(scene));
    g.drawImage(ship.picture(), 0, 0);
  } else {
    const bg = await new Promise<HTMLImageElement | null>((done) => {
      const im = new Image();
      im.onload = () => done(im);
      im.onerror = () => done(null);
      im.src = sceneUrl(scene);
    });
    if (bg) {
      g.drawImage(bg, 0, 0, CARD_W, CARD_H);
      g.fillStyle = 'rgba(0,0,0,0.38)';
      g.fillRect(0, 0, CARD_W, CARD_H);
    }
  }
  const fade = g.createLinearGradient(0, 0, CARD_W, 0);
  fade.addColorStop(0, 'rgba(3,5,10,0.88)');
  fade.addColorStop(0.4, 'rgba(3,5,10,0.5)');
  fade.addColorStop(0.64, 'rgba(3,5,10,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, CARD_W, CARD_H);
  const [sheen, markInk] = SHEENS[finishNow()];
  const shine = g.createLinearGradient(0, 0, CARD_W * 0.42, CARD_H * 0.78);
  shine.addColorStop(0, sheen);
  shine.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = shine;
  g.fillRect(0, 0, CARD_W, CARD_H);

  const css = getComputedStyle(document.body);
  const body = css.fontFamily;
  const head = getComputedStyle($('cs-card-name')).fontFamily;
  const accent = css.getPropertyValue('--accent').trim() || '#3dffb0';
  const x = 72;
  g.textBaseline = 'alphabetic';
  g.save();
  g.strokeStyle = accent;
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.shadowColor = accent;
  g.shadowBlur = 5;
  g.translate(x, 52);
  g.scale(31 / 32, 31 / 32);
  g.stroke(new Path2D('M4 18 L12 9 L20 9 L28 18 L18 23 L14 23 Z M12 9 L14 23 M20 9 L18 23'));
  g.restore();
  g.fillStyle = 'rgba(238,243,250,0.9)';
  g.font = `700 19px ${head}`;
  g.letterSpacing = '6.5px';
  g.fillText('WITCHSPACE', x + 44, 75);
  const mark = markNow().toUpperCase();
  if (mark) {
    g.textAlign = 'right';
    g.fillStyle = markInk;
    g.font = `600 15px ${body}`;
    g.letterSpacing = '4.8px';
    g.fillText(mark, CARD_W - 72, 75);
    g.textAlign = 'left';
  }

  // From the foot up: the number, what you fly, the name, CMDR.
  let y = CARD_H - 63;
  if (member && !preview) {
    g.fillStyle = 'rgba(205,214,228,0.6)';
    g.font = `500 17px ${head}`;
    g.letterSpacing = '5px';
    g.fillText(memberNumber(member), x, y);
    y -= 36;
  }
  g.letterSpacing = '0px';
  g.fillStyle = 'rgba(205,214,228,0.82)';
  g.font = `400 20px ${body}`;
  g.fillText(`${career.noun} · ${onCard().label}`, x, y);
  y -= 34;
  const callsignFont = getComputedStyle($('cs-card-name')).fontFamily;
  let size = name.length > 14 ? 53 : 67;
  g.font = `600 ${size}px ${callsignFont}`;
  g.letterSpacing = `${Math.round(size * 0.06)}px`;
  const full = shown().toUpperCase();
  while (g.measureText(full).width > 660 && size > 30) g.font = `600 ${(size -= 2)}px ${callsignFont}`;
  g.fillStyle = '#eef3fa';
  g.fillText(full, x, y);
  g.letterSpacing = '0px';
  g.fillStyle = 'rgba(185,198,216,0.75)';
  g.font = `600 15px ${body}`;
  g.letterSpacing = '4.8px';
  g.fillText('CMDR', x, y - size * 0.9 - 8);
  g.letterSpacing = '0px';
  g.fillStyle = 'rgba(205,214,228,0.45)';
  g.font = `500 14px ${body}`;
  g.textAlign = 'right';
  g.fillText('witchspace.org.uk/callsign', CARD_W - 72, CARD_H - 63);
  g.textAlign = 'left';

  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, 'image/jpeg', 0.88));
  return blob ? new File([blob], `cmdr-${shown().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}.jpg`, { type: 'image/jpeg' }) : null;
}

// --- Sharing it --------------------------------------------------------------------------------------------

$('cs-share').addEventListener('click', async () => {
  if (preview) endPreview();
  if (!shareable() && !mine(name)) return;
  // Yours: kept first, so its link's preview is this card. Not yet yours: the picture, and the page to make one.
  const url = (await keep()) ?? cardUrl ?? `${location.origin}/callsign/${career.id}/`;
  const file = await picture();
  if (!file) return;
  const text = `${careerLine(career)} I’m CMDR ${name} in Witchspace.`;
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: `${text} ${url}` });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(file);
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
});

// --- Signed in: your own ships, your number, your card as you kept it, and a claim come back by email -----

type Me = { member?: number; founding?: boolean };
type Kept = { career: string; scene: string; ship: string; edition?: { id: string; number: number }; angle: { x: number; y: number }; url: string };

function restore(o: { career?: string; scene?: string; hull?: string; ship?: string; edition?: { id: string }; angle?: { x: number; y: number } }) {
  if (o.career) {
    career = careerById(o.career);
    tabs(careers, 'data-career', career.id);
  }
  hull = owned.find((h) => h.key === o.hull) ?? owned.find((h) => h.ship === o.ship && h.edition?.id === o.edition?.id) ?? hull;
  if (o.scene && SCENES[o.scene]) {
    sceneChosen = true;
    scene = o.scene;
    drawScenes();
    setScene(o.scene);
  }
  if (o.angle) ship?.angle(o.angle);
}

async function loadMine() {
  const r = await acct.refresh();
  if (!r) return;
  const me = r as unknown as Me;
  if (me.member) member = me.member;
  if (typeof me.founding === 'boolean') founding = me.founding;
  try {
    const c = (await acct.fetchSave()).data as Commander | null;
    if (c) {
      const list = [hullFrom(hullOf(c), c.paint), ...(c.fleet ?? []).map((s) => hullFrom(s.ship, s.paint))].filter((h): h is Hull => Boolean(h));
      owned = list.filter((h, i) => list.findIndex((o) => o.key === h.key) === i);
      if (!owned.length) owned = [COBRA];
      if (!owned.some((h) => h.key === hull.key)) hull = owned[0];
      elite = combatRating(c.kills ?? 0) === 'Elite';
    }
  } catch {
    // No save in the cloud yet: the starter Cobra.
  }
  drawShips();
  drawEarn();
  showShip();
  drawCard();
}

async function start() {
  drawCard();
  drawActions();
  try {
    await acct.completeSignInFromUrl();
  } catch {
    fail(new Error('That link has expired or been used: ask for another.'));
  }
  await loadMine();
  const pending = store.get(PENDING);
  const cs = acct.currentAccount()?.callsign;
  if (pending && acct.signedIn()) {
    // Back from the email: finish the card as it was made, and make the name yours.
    store.set(PENDING, null);
    const p = JSON.parse(pending) as { name: string; career: string; scene: string; hull: string; angle?: { x: number; y: number } };
    restore(p);
    input.value = p.name;
    name = p.name;
    drawCard();
    showShip();
    if (!mine(p.name)) return void claim(p.name);
  } else if (cs) {
    try {
      const { card: kept } = await asMe<{ card: Kept | null }>('/me/card');
      if (kept) {
        restore(kept);
        cardUrl = kept.url;
      }
    } catch {
      // Nothing kept yet.
    }
    input.value = cs;
    name = cs;
    showShip();
  }
  if (name && mine(name)) check = { name, verdict: 'yours' };
  drawCard();
  drawActions();
}
void start();
