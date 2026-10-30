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
import {
  careerById,
  careerLine,
  CAREERS,
  claimLine,
  cleanCallsign,
  finishFor,
  LAUNCH,
  memberNumber,
  memberSince,
  parseCheck,
  rgbOf,
  SCENES,
  sceneUrl,
  scenesFor,
  variants,
  verdictWords,
  type Career,
  type Check,
  type Finish,
} from './callsignWords';

// Claim your callsign, and build the card that carries it (/callsign/, docs/design/callsign-card.md, Mark):
// type a name and see at once whether it's free; choose what you do (Trade, Fight, Explore, Build), a scene
// from the game behind her, and one of your own ships in her own paint, dragged round to the angle you like;
// then make it yours by signing in with the code from the email, typed here, so it works the same in Safari,
// in the Home Screen app and on a computer. The check is the server's (GET /callsign/check), and claiming
// (POST /me/callsign) judges the same way. Kept (PUT /me/card), the card has a link of its own whose preview
// is the card. Below it, every card you can't have yet, locked, with how to earn it.
// /callsign/<career>/ is the same page with that career chosen, for its own share card.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
/** Turnstile's public site key (as the ideas board and the game); empty skips it in development. */
const TURNSTILE_SITE_KEY = import.meta.env.DEV ? '' : '0x4AAAAAAFfP1CB8aXita2o_';
declare const turnstile: { render: (el: HTMLElement, opts: Record<string, unknown>) => string; reset: (id?: string) => void } | undefined;

const input = $<HTMLInputElement>('cs-name');
const verdictEl = $('cs-verdict');
const tryEl = $('cs-try');
const errorEl = $('cs-error');
const steps = ['cs-email-step', 'cs-code-step', 'cs-change-step', 'cs-claim-step', 'cs-done'] as const;
type Step = (typeof steps)[number] | null;

/** A ship on the card: one you own, in her own paint; or, locked, one you could earn. */
interface Hull {
  key: string;
  ship: string;
  label: string;
  look: Look | null;
  edition?: { id: string; number: number };
  livery?: 'marshal';
}
/** A card to earn: a hull you don't have, or a finish you haven't reached, and how to get it. */
interface Earnable extends Hull {
  how: string;
  img: string;
  finish?: Finish;
  badge?: string;
}

let career: Career = careerById(/^\/callsign\/([a-z]+)\/?$/.exec(location.pathname)?.[1]);
/** The scene behind her: the career's first until you choose one. */
let scene: string = career.scenes[0];
let sceneChosen = false;
let name = '';
let check: Check | null = null;
let email = '';
let turnstileToken = '';
let widget: string | undefined;

/** The ships you own: a new commander's Cobra until your save says otherwise. */
const COBRA: Hull = { key: 'cobra-mk3', ship: 'cobra-mk3', label: 'Cobra Mk III', look: null };
let owned: Hull[] = [COBRA];
let hull: Hull = COBRA;
/** A locked card being looked at, in place of your own. */
let preview: Earnable | null = null;
let elite = false;
let member: number | null = null;
let since: number | null = null;
/** A founding member claimed before launch; before you've claimed, it's whether you'd be one now. */
let founding = Date.now() < LAUNCH;
/** Your kept card's link, once it's kept. */
let cardUrl: string | null = null;

const pad = (n: number) => String(n).padStart(3, '0');

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

// --- The metal ---------------------------------------------------------------------------------------------

/** Each finish's metal, brushed: the plate's rim and the raised number. */
const METALS: Record<Finish, string[]> = {
  titanium: ['#6f747c', '#d9dde3', '#8d929a', '#f2f4f7', '#7d828a', '#c9cdd3'],
  alloy: ['#5d6168', '#b5b9bf', '#6c7077', '#cfd2d6', '#62666c', '#a5a9ae'],
  black: ['#0d0e10', '#3a3c40', '#121315', '#4a4c51', '#16171a', '#2c2e31'],
  gold: ['#7a5a1c', '#f3d27a', '#9b7426', '#ffe9a8', '#86631f', '#d9b25a'],
  'witch-fire': ['#5a0f5c', '#ff4dff', '#3a0a3c', '#7df9ff', '#4a0d4c', '#d64be0'],
  dark: ['#120c1c', '#4b3a6b', '#0d0914', '#6a55a0', '#140e20', '#3b2d55'],
};
/** The raised letters: the metal itself, or a lighter cut of it on the dark finishes. */
const INKS: Partial<Record<Finish, string[]>> = {
  black: ['#8b8f96', '#e7e9ec', '#9a9ea5', '#f4f5f6', '#8f939a', '#d0d3d7'],
  dark: ['#8e7fb3', '#e6dcff', '#9a8cc4', '#f3eeff', '#8a7bb0', '#cfc2f0'],
};
const gradient = (stops: string[]) => `linear-gradient(115deg, ${stops.map((c, i) => `${c} ${Math.round((i / (stops.length - 1)) * 100)}%`).join(', ')})`;

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
/** What's on the card now: your own, or the locked one you're looking at. */
const onCard = (): Hull => preview ?? hull;
const finishNow = (): Finish => preview?.finish ?? finishFor({ edition: hull.edition?.id, elite, founding });
const badgeNow = () => preview?.badge ?? (elite ? 'LEGEND' : founding ? 'FOUNDING MEMBER' : 'MEMBER');

function drawCard() {
  $('cs-card-kicker').textContent = careerLine(career).replace(/\.$/, '');
  const n = $('cs-card-name');
  n.textContent = shown();
  n.classList.toggle('long', shown().length > 14);
  $('cs-card-sub').textContent = `${career.noun} · ${onCard().label}`;
  $('cs-card-number').textContent = memberNumber(member);
  $('cs-card-since').textContent = memberSince(since ?? Date.now());
  $('cs-card-badge').textContent = badgeNow();
  const finish = finishNow();
  card.dataset.finish = finish;
  card.style.setProperty('--metal', gradient(METALS[finish]));
  card.style.setProperty('--ink', gradient(INKS[finish] ?? METALS[finish]));
  $('cs-line').textContent = careerLine(career);
  const stage = document.querySelector<HTMLElement>('.callsign-hero')!;
  stage.style.setProperty('--role', career.colour);
  stage.style.setProperty('--role-rgb', rgbOf(career.colour));
}

function showShip() {
  const h = onCard();
  ship?.show(h.ship, h.look, h.livery);
}

const careers = $('cs-careers');
careers.innerHTML = CAREERS.map((c) => `<button type="button" class="chip" data-career="${c.id}" style="--c:${c.colour}" aria-pressed="${c.id === career.id}">${c.name}</button>`).join('');
careers.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-career]');
  if (!b) return;
  career = careerById(b.dataset.career);
  for (const c of careers.querySelectorAll<HTMLElement>('[data-career]')) c.setAttribute('aria-pressed', String(c === b));
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
/** Show a scene behind her. */
function setScene(id: string) {
  scene = id;
  for (const b of scenes.querySelectorAll<HTMLElement>('[data-scene]')) b.setAttribute('aria-pressed', String(b.dataset.scene === id));
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

// Your ships: only the ones you own, each in her own paint.
const shipsEl = $('cs-ships');
function drawShips() {
  shipsEl.innerHTML = owned
    .map((h) => `<button type="button" class="chip" data-hull="${h.key}" style="--c:${h.look?.trim ?? h.look?.colour ?? shipById(h.ship)?.style.lineColor ?? '#3dffb0'}" aria-pressed="${h.key === hull.key && !preview}">${h.label}</button>`)
    .join('');
}
shipsEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-hull]');
  const h = owned.find((o) => o.key === b?.dataset.hull);
  if (!h) return;
  hull = h;
  endPreview();
});
drawShips();
showShip();
$('cs-claim').textContent = claimLine(Date.now());

// --- Cards to earn -------------------------------------------------------------------------------------

/** Every card you can't have yet: the yards' ships you don't own, the Marshals', Legend, and the editions. */
function earnables(): Earnable[] {
  const have = new Set(owned.map((h) => h.ship));
  const editions = new Set(owned.flatMap((h) => (h.edition ? [h.edition.id] : [])));
  const yards: Earnable[] = ships
    .filter((d) => inYards(d) && !have.has(d.id))
    .map((d) => ({ key: `ship:${d.id}`, ship: d.id, label: d.name, look: null, img: `/share/ships-${d.id}.jpg`, how: `Buy a ${d.name} at a shipyard, and she can fly on your card.` }));
  const marshal: Earnable = { key: 'marshal', ship: 'lancer', label: 'Co-operative Marshal', look: null, livery: 'marshal', finish: 'gold', badge: 'MARSHAL', img: '/share/ships-lancer.jpg', how: 'The Marshals’ card: a Lancer in their gold band and lights, on gold. Join the Co-operative Marshals (coming to the game).' };
  const legend: Earnable = { ...hull, key: 'legend', finish: 'black', badge: 'LEGEND', img: `/share/ships-${hull.ship}.jpg`, label: 'Legend', how: 'Legend: the black card, on whatever you fly. Reach Elite.' };
  const eds: Earnable[] = EDITIONS.filter((e) => !editions.has(e.id)).map((e) => {
    const def = shipById(e.ship)!;
    return { key: `edition:${e.id}`, ship: e.ship, label: e.name, look: lookOf(def, e), finish: e.id as Finish, badge: 'BY INVITATION', img: `/share/ships-${e.ship}-${e.id}.jpg`, how: `${e.name}: numbered, one of ${e.limit}, and never sold. By invitation, for the people who build Witchspace.` };
  });
  return [...yards, marshal, ...(elite ? [] : [legend]), ...eds];
}

const earnEl = $('cs-earn');
function drawEarn() {
  earnEl.innerHTML = earnables()
    .map((e) => `<button type="button" class="cs-earn-tile" data-earn="${e.key}"><span class="cs-earn-pic"><img src="${e.img}" width="1200" height="630" alt="" loading="lazy" /></span><b>${e.label}</b><span class="cs-earn-lock">Locked</span></button>`)
    .join('');
}
earnEl.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-earn]');
  const item = earnables().find((x) => x.key === b?.dataset.earn);
  if (!item) return;
  // Legend is your own ship on the black card; anything else is the locked ship herself.
  preview = item.key === 'legend' ? { ...item, ...hull, key: 'legend', finish: 'black', badge: 'LEGEND', how: item.how, img: item.img } : item;
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

const cache = new Map<string, Check | 'unknown'>();
async function ask(n: string): Promise<Check | 'unknown'> {
  const key = n.toLowerCase();
  const had = cache.get(key);
  if (had) return had;
  try {
    const token = acct.sessionToken();
    const res = await fetch(`${acct.API}/callsign/check?name=${encodeURIComponent(n)}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const answer = res.ok ? (parseCheck(await res.json()) ?? 'unknown') : 'unknown';
    if (answer !== 'unknown') cache.set(key, answer);
    return answer;
  } catch {
    return 'unknown';
  }
}

const mine = (n: string) => acct.currentAccount()?.callsign?.toLowerCase() === n.toLowerCase();

function say(text: string, kind = '') {
  verdictEl.textContent = text;
  verdictEl.className = `cs-verdict ${kind}`;
}

/** Which step follows the answer: sign in to claim it, or (signed in already) claim it with one press. */
function nextStep(): Step {
  if (!check || !['free', 'yours'].includes(check.verdict)) return null;
  if (check.verdict === 'yours' && mine(check.name)) return null;
  return acct.signedIn() ? 'cs-claim-step' : 'cs-email-step';
}

function show(step: Step) {
  for (const s of steps) $(s).hidden = s !== step;
  if (step === 'cs-email-step') mountTurnstile();
}

let asking = 0;
async function judge() {
  const n = cleanCallsign(input.value);
  name = n;
  drawCard();
  tryEl.hidden = true;
  errorEl.hidden = true;
  check = null;
  if (n.replace(/[^\p{L}\p{N}]/gu, '').length < 2) {
    say('Letters, numbers and spaces, two to 24 of them.');
    show(null);
    return;
  }
  const ticket = ++asking;
  say('Checking…');
  const answer = await ask(n);
  if (ticket !== asking) return;
  if (answer === 'unknown') {
    // The check isn't answering: let them carry on, and the claim itself will say if it's gone.
    check = { name: n, verdict: 'free' };
    say(`Couldn’t check just now. Carry on, and we’ll check CMDR ${n} as you claim it.`);
  } else {
    check = answer;
    name = answer.name;
    drawCard();
    if (answer.verdict === 'yours') say(mine(answer.name) ? `CMDR ${answer.name} is already yours.` : `CMDR ${answer.name} is held for you: claim it.`, 'yours');
    else say(verdictWords(answer), answer.verdict);
    if (answer.verdict === 'taken') void suggest(answer.name, ticket);
  }
  show(nextStep());
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
  tryEl.innerHTML = 'Free: ';
  for (const f of free) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip';
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
  timer = window.setTimeout(() => void judge(), 450);
});
$('cs-name-form').addEventListener('submit', (e) => {
  e.preventDefault();
  clearTimeout(timer);
  void judge().then(() => {
    const step = nextStep();
    if (step === 'cs-email-step') $('cs-email').focus();
  });
});

// --- Making it yours -----------------------------------------------------------------------------------

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

$('cs-email-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  email = $<HTMLInputElement>('cs-email').value.trim();
  const send = $<HTMLButtonElement>('cs-send');
  send.disabled = true;
  try {
    const r = await acct.requestLink(email, turnstileToken);
    $('cs-sent').textContent = `We’ve sent a six-digit code to ${email}. Type it here to make CMDR ${name} yours.`;
    if (r.devCode) $('cs-sent').textContent += ` (Development: ${r.devCode})`;
    show('cs-code-step');
    $('cs-code').focus();
  } catch (err) {
    fail(err);
    if (widget !== undefined) turnstile?.reset(widget);
    turnstileToken = '';
  } finally {
    send.disabled = false;
  }
});

$('cs-again').addEventListener('click', () => {
  show('cs-email-step');
  $('cs-email').focus();
});

$('cs-code-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  try {
    const a = await acct.signInWithCode(email, $<HTMLInputElement>('cs-code').value.trim());
    // Signed in to an account that already flies under another name: ask before renaming it.
    if (a.callsign && !mine(name)) return askChange(a.callsign);
    await claim();
  } catch (err) {
    fail(err);
  }
});

function askChange(current: string) {
  $('cs-already').textContent = `You’re already CMDR ${current}.`;
  $('cs-keep').textContent = `Keep CMDR ${current}`;
  $('cs-change').textContent = `Change to CMDR ${name}`;
  show('cs-change-step');
}
$('cs-keep').addEventListener('click', () => {
  input.value = acct.currentAccount()?.callsign ?? '';
  name = cleanCallsign(input.value);
  drawCard();
  done();
});
$('cs-change').addEventListener('click', () => void claim());
$('cs-claim-now').addEventListener('click', () => {
  const current = acct.currentAccount()?.callsign;
  if (current && !mine(name)) return askChange(current);
  void claim();
});

async function claim() {
  errorEl.hidden = true;
  try {
    name = await acct.setCallsign(name);
    input.value = name;
    drawCard();
    done();
  } catch (err) {
    // Taken in the minute it took to sign in, or not allowed after all: back to the box, signed in now.
    fail(err);
    cache.clear();
    void judge();
    input.focus();
  }
}

function done() {
  say('');
  tryEl.hidden = true;
  $('cs-done-title').textContent = `CMDR ${name} is yours.`;
  show('cs-done');
  // Your number, now it's yours, and the card kept with it.
  void loadMine().then(() => keep());
}

// --- Keeping it ------------------------------------------------------------------------------------------

/** The server, as the signed-in commander. */
async function asMe<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = acct.sessionToken();
  const res = await fetch(acct.API + path, { ...init, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers ?? {}) } });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? 'Something went wrong');
  return data;
}

/** Keep the card on your account (PUT /me/card): its choices and its picture, for its link's preview. */
async function keep(): Promise<string | null> {
  if (preview || !acct.currentAccount()?.callsign) return null;
  const file = await picture();
  if (!file) return null;
  const body = new FormData();
  body.append('card', JSON.stringify({ career: career.id, scene, ship: hull.ship, ...(hull.edition ? { edition: hull.edition } : {}), angle: ship?.angle() ?? { x: 0.35, y: 5.53 } }));
  body.append('image', file);
  try {
    const r = await asMe<{ id: string; v: number; url: string }>('/me/card', { method: 'PUT', body });
    cardUrl = r.url;
    $('cs-kept').hidden = false;
    $('cs-kept-link').textContent = r.url.replace(/^https:\/\//, '');
    $<HTMLAnchorElement>('cs-kept-link').href = r.url;
    return r.url;
  } catch {
    // Not kept (the server's half not there yet, or a ship it doesn't know you own): sharing still works.
    return null;
  }
}

$('cs-keep-card').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('cs-keep-card');
  b.disabled = true;
  const url = await keep();
  b.disabled = false;
  b.textContent = url ? 'Kept' : 'Couldn’t keep it just now';
  setTimeout(() => (b.textContent = 'Keep this card'), 2500);
});

// --- The picture -------------------------------------------------------------------------------------------

async function picture(): Promise<File | null> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, CARD_W, CARD_H);
  // The scene and her together, as the card shows them; without WebGL, the scene alone, dimmed as on the page.
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
  // The career's light behind her, and the fade behind the words, as on the page.
  const rgb = rgbOf(career.colour);
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.translate(CARD_W * 0.72, CARD_H * 0.5);
  g.scale(1, (CARD_H * 0.6) / (CARD_W * 0.45));
  const r = g.createRadialGradient(0, 0, 0, 0, 0, CARD_W * 0.32);
  r.addColorStop(0, `rgba(${rgb},0.1)`);
  r.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = r;
  g.fillRect(-CARD_W, -CARD_W, CARD_W * 2, CARD_W * 2);
  g.restore();
  const fade = g.createLinearGradient(0, 0, CARD_W, 0);
  fade.addColorStop(0, 'rgba(3,5,10,0.92)');
  fade.addColorStop(0.42, 'rgba(3,5,10,0.62)');
  fade.addColorStop(0.68, 'rgba(3,5,10,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, CARD_W, CARD_H);

  const finish = finishNow();
  const metal = (stops: string[], x0: number, y0: number, x1: number, y1: number) => {
    const m = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach((s, i) => m.addColorStop(i / (stops.length - 1), s));
    return m;
  };
  const css = getComputedStyle(document.body);
  const body = css.fontFamily;
  const head = getComputedStyle($('cs-card-name')).fontFamily;
  const accent = css.getPropertyValue('--accent').trim() || '#3dffb0';
  const x = 72;
  g.textBaseline = 'alphabetic';
  // The brand, with its mark.
  g.save();
  g.strokeStyle = accent;
  g.lineWidth = 2.2;
  g.lineJoin = 'round';
  g.shadowColor = accent;
  g.shadowBlur = 6;
  g.translate(x, 60);
  g.scale(40 / 32, 40 / 32);
  g.stroke(new Path2D('M4 18 L12 9 L20 9 L28 18 L18 23 L14 23 Z M12 9 L14 23 M20 9 L18 23'));
  g.restore();
  g.fillStyle = '#eef3fa';
  g.font = `700 24px ${head}`;
  g.letterSpacing = '7px';
  g.fillText('WITCHSPACE', x + 54, 88);
  // The badge, top right, in the metal.
  g.font = `700 17px ${body}`;
  g.letterSpacing = '4px';
  g.textAlign = 'right';
  const ink = INKS[finish] ?? METALS[finish];
  g.fillStyle = metal(ink, CARD_W - 360, 70, CARD_W - 72, 95);
  g.fillText(badgeNow(), CARD_W - 72, 88);
  // The address, bottom right.
  g.letterSpacing = '0.6px';
  g.fillStyle = 'rgba(200,210,225,0.75)';
  g.font = `500 17px ${body}`;
  g.fillText('witchspace.org.uk/callsign', CARD_W - 72, CARD_H - 62);
  g.textAlign = 'left';

  // From the foot up: the number, what you fly, the name, COMMANDER, the line.
  const num = memberNumber(member);
  g.font = `600 34px ${head}`;
  g.letterSpacing = '5px';
  g.save();
  g.shadowColor = 'rgba(0,0,0,0.7)';
  g.shadowOffsetY = 2;
  g.shadowBlur = 2;
  g.fillStyle = metal(ink, x, CARD_H - 92, x + 260, CARD_H - 60);
  g.fillText(num, x, CARD_H - 62);
  g.restore();
  const nw = g.measureText(num).width;
  g.font = `600 13px ${body}`;
  g.letterSpacing = '2.5px';
  g.fillStyle = 'rgba(200,210,225,0.7)';
  g.fillText(memberSince(since ?? Date.now()), x + nw + 26, CARD_H - 66);
  g.letterSpacing = '0px';
  g.fillStyle = '#b9c6d8';
  g.font = `400 24px ${body}`;
  g.fillText(`${career.noun} · ${onCard().label}`, x, CARD_H - 128);
  let size = name.length > 14 ? 52 : 66;
  g.font = `700 ${size}px ${head}`;
  const full = shown();
  while (g.measureText(full).width > 640 && size > 30) g.font = `700 ${(size -= 2)}px ${head}`;
  g.save();
  g.shadowColor = `rgba(${rgb},0.3)`;
  g.shadowBlur = 36;
  g.fillStyle = '#eef3fa';
  g.fillText(full, x, CARD_H - 172);
  g.restore();
  const top = CARD_H - 172 - size * 0.95;
  g.fillStyle = '#95a3b8';
  g.font = `600 17px ${body}`;
  g.letterSpacing = '5px';
  g.fillText('COMMANDER', x, top - 6);
  g.fillStyle = career.colour;
  g.font = `600 18px ${body}`;
  g.letterSpacing = '3.6px';
  g.fillText(careerLine(career).replace(/\.$/, '').toUpperCase(), x, top - 42);
  g.letterSpacing = '0px';

  // The plate's rim: brushed metal round the edge, with a fine dark line inside it.
  const rim = 14;
  g.save();
  g.beginPath();
  g.rect(0, 0, CARD_W, CARD_H);
  g.rect(rim, rim, CARD_W - rim * 2, CARD_H - rim * 2);
  g.fillStyle = metal(METALS[finish], 0, 0, CARD_W, CARD_H * 1.6);
  g.fill('evenodd');
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = 2;
  g.strokeRect(rim + 1, rim + 1, CARD_W - rim * 2 - 2, CARD_H - rim * 2 - 2);
  g.restore();

  const blob = await new Promise<Blob | null>((done) => c.toBlob(done, 'image/jpeg', 0.88));
  return blob ? new File([blob], `cmdr-${shown().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}.jpg`, { type: 'image/jpeg' }) : null;
}

// --- Sharing it --------------------------------------------------------------------------------------------

$('cs-share').addEventListener('click', async () => {
  if (preview) endPreview();
  // Kept first, so the link's preview is this card; if it can't be kept, the career's page.
  const url = (await keep()) ?? cardUrl ?? `${location.origin}/callsign/${career.id}/`;
  const file = await picture();
  if (!file) return;
  const text = `${careerLine(career)} I’m CMDR ${name} in Witchspace.`;
  // On a phone, the share sheet takes the picture (and Save Image is there); elsewhere it downloads.
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

// --- Signed in: your own ships, your number, and your card as you kept it ------------------------------------

type Me = { member?: number; memberSince?: number; founding?: boolean };
async function loadMine() {
  const r = await acct.refresh();
  if (!r) return;
  const me = { ...(r.account as unknown as Me), ...(r as unknown as Me) };
  if (me.member) member = me.member;
  if (me.memberSince) since = me.memberSince;
  if (typeof me.founding === 'boolean') founding = me.founding;
  const cs = r.account.callsign;
  if (cs && !input.value) {
    input.value = cs;
    name = cs;
    say(`You’re CMDR ${cs}. Type another name to change it.`, 'yours');
    $('cs-done-title').textContent = `CMDR ${cs}`;
    show('cs-done');
  }
  try {
    const { data } = await acct.fetchSave();
    const c = data as Commander | null;
    if (c) {
      const list = [hullFrom(hullOf(c), c.paint), ...(c.fleet ?? []).map((s) => hullFrom(s.ship, s.paint))].filter((h): h is Hull => Boolean(h));
      owned = list.filter((h, i) => list.findIndex((o) => o.key === h.key) === i);
      if (!owned.length) owned = [COBRA];
      hull = owned[0];
      elite = combatRating(c.kills ?? 0) === 'Elite';
    }
  } catch {
    // No save in the cloud yet: the starter Cobra.
  }
  try {
    const { card: kept } = await asMe<{ card: { career: string; scene: string; ship: string; edition?: { id: string; number: number }; angle: { x: number; y: number }; url: string } | null }>('/me/card');
    if (kept) {
      career = careerById(kept.career);
      for (const b of careers.querySelectorAll<HTMLElement>('[data-career]')) b.setAttribute('aria-pressed', String(b.dataset.career === career.id));
      hull = owned.find((h) => h.ship === kept.ship && h.edition?.id === kept.edition?.id) ?? hull;
      sceneChosen = true;
      drawScenes();
      setScene(SCENES[kept.scene] ? kept.scene : career.scenes[0]);
      ship?.angle(kept.angle);
      cardUrl = kept.url;
      $('cs-kept').hidden = false;
      $('cs-kept-link').textContent = kept.url.replace(/^https:\/\//, '');
      $<HTMLAnchorElement>('cs-kept-link').href = kept.url;
    }
  } catch {
    // Nothing kept yet, or the server's half isn't there: build it afresh.
  }
  drawShips();
  drawEarn();
  showShip();
  drawCard();
  $('cs-ships-note').textContent = owned.length > 1 ? 'The ships you own, in their own paint.' : 'Your ship, in her own paint. Buy another, and she can fly here too.';
}

drawCard();
void loadMine();
