import * as acct from '../net/account';
import { cardShip, CARD_H, CARD_W, type CardShip } from './callsignCard';
import { claimLine, cleanCallsign, parseCheck, rgbOf, roleById, roleLine, ROLES, variants, verdictWords, type Check, type Role } from './callsignWords';

// Claim your callsign (/callsign/, Mark, 30 October 2026): type a name and see at once whether it's free,
// pick a role for your card, then make it yours by signing in with the code from the email, typed here,
// so it works the same in Safari, in the Home Screen app and on a computer. The check is the server's
// (GET /callsign/check), and claiming (POST /me/callsign) judges the same way, so they can't disagree.
// /callsign/<role>/ is the same page with that role chosen, for its own share card.

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

let role: Role = roleById(/^\/callsign\/([a-z]+)\/?$/.exec(location.pathname)?.[1]);
let name = '';
let check: Check | null = null;
let email = '';
let turnstileToken = '';
let widget: string | undefined;

// --- The card ------------------------------------------------------------------------------------------

let ship: CardShip | null = null;
try {
  ship = cardShip($<HTMLCanvasElement>('cs-ship'));
} catch {
  // No WebGL: the card keeps its words over the dark, and the picture is words only.
}
const card = $('cs-card');
// The card's words are sized from a hundredth of its width, so the preview is the picture in small.
new ResizeObserver(() => card.style.setProperty('--u', `${card.clientWidth / 100}px`)).observe(card);

const shown = () => name || 'Your callsign';
function drawCard() {
  $('cs-card-kicker').textContent = roleLine(role).replace(/\.$/, '');
  const n = $('cs-card-name');
  n.textContent = shown();
  n.classList.toggle('long', shown().length > 14);
  $('cs-card-sub').textContent = `${role.name} · flies a ${role.shipName}`;
  $('cs-line').textContent = roleLine(role);
  const stage = document.querySelector<HTMLElement>('.callsign-hero')!;
  stage.style.setProperty('--role', role.colour);
  stage.style.setProperty('--role-rgb', rgbOf(role.colour));
}

const roles = $('cs-roles');
roles.innerHTML = ROLES.map((r) => `<button type="button" class="chip" data-role="${r.id}" style="--c:${r.colour}" aria-pressed="${r.id === role.id}">${r.name}</button>`).join('');
roles.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-role]');
  if (!b) return;
  role = roleById(b.dataset.role);
  for (const c of roles.querySelectorAll<HTMLElement>('[data-role]')) c.setAttribute('aria-pressed', String(c === b));
  ship?.show(role.ship);
  drawCard();
});
ship?.show(role.ship);
$('cs-claim').textContent = claimLine(Date.now());

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
}

// --- Sharing the card ----------------------------------------------------------------------------------

async function picture(): Promise<File | null> {
  await document.fonts.ready;
  const c = document.createElement('canvas');
  c.width = CARD_W;
  c.height = CARD_H;
  const g = c.getContext('2d')!;
  g.fillStyle = '#05070d';
  g.fillRect(0, 0, CARD_W, CARD_H);
  if (ship) g.drawImage(ship.picture(), 0, 0);
  // The role's light behind her, and the fade behind the words, as on the page.
  const rgb = rgbOf(role.colour);
  const glow = (x: number, y: number, rx: number, ry: number, colour: string) => {
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    const r = g.createRadialGradient(0, 0, 0, 0, 0, rx);
    r.addColorStop(0, colour);
    r.addColorStop(1, 'rgba(5,7,13,0)');
    g.fillStyle = r;
    g.fillRect(-rx, -rx, rx * 2, rx * 2);
    g.restore();
  };
  g.globalCompositeOperation = 'lighter';
  glow(CARD_W * 0.72, CARD_H * 0.5, CARD_W * 0.45 * 0.7, CARD_H * 0.6 * 0.7, `rgba(${rgb},0.13)`);
  glow(CARD_W, 0, CARD_W * 0.35 * 0.7, CARD_H * 0.45 * 0.7, 'rgba(74,215,255,0.1)');
  g.globalCompositeOperation = 'source-over';
  const fade = g.createLinearGradient(0, 0, CARD_W, 0);
  fade.addColorStop(0, 'rgba(5,7,13,0.92)');
  fade.addColorStop(0.46, 'rgba(5,7,13,0.55)');
  fade.addColorStop(0.7, 'rgba(5,7,13,0)');
  g.fillStyle = fade;
  g.fillRect(0, 0, CARD_W, CARD_H);

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
  g.translate(x, 64);
  g.scale(40 / 32, 40 / 32);
  g.stroke(new Path2D('M4 18 L12 9 L20 9 L28 18 L18 23 L14 23 Z M12 9 L14 23 M20 9 L18 23'));
  g.restore();
  g.fillStyle = '#eef3fa';
  g.font = `700 24px ${head}`;
  g.letterSpacing = '7px';
  g.fillText('WITCHSPACE', x + 54, 92);
  g.letterSpacing = '0px';

  // From the foot up: the address, the role, the name, the line.
  const max = 640;
  g.fillStyle = '#95a3b8';
  g.font = `400 20px ${body}`;
  g.fillText('witchspace.org.uk/callsign', x, CARD_H - 60);
  g.fillStyle = '#b9c6d8';
  g.font = `400 26px ${body}`;
  g.fillText(`${role.name} · flies a ${role.shipName}`, x, CARD_H - 120);
  let size = name.length > 14 ? 53 : 70;
  g.font = `700 ${size}px ${head}`;
  const full = shown();
  while (g.measureText(full).width > max && size > 30) g.font = `700 ${(size -= 2)}px ${head}`;
  g.save();
  g.shadowColor = `rgba(${rgb},0.3)`;
  g.shadowBlur = 36;
  g.fillStyle = '#eef3fa';
  g.fillText(full, x, CARD_H - 170);
  g.restore();
  const top = CARD_H - 170 - size * 0.95;
  g.fillStyle = '#95a3b8';
  g.font = `600 18px ${body}`;
  g.letterSpacing = '5.4px';
  g.fillText('COMMANDER', x, top - 6);
  g.fillStyle = role.colour;
  g.font = `600 19px ${body}`;
  g.letterSpacing = '3.8px';
  g.fillText(roleLine(role).replace(/\.$/, '').toUpperCase(), x, top - 44);
  g.letterSpacing = '0px';

  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.9));
  return blob ? new File([blob], `cmdr-${shown().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-')}.jpg`, { type: 'image/jpeg' }) : null;
}

$('cs-share').addEventListener('click', async () => {
  const file = await picture();
  if (!file) return;
  const url = `${location.origin}/callsign/${role.id}/`;
  const text = `${roleLine(role)} I’m CMDR ${name} in Witchspace.`;
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

// --- Already signed in ---------------------------------------------------------------------------------

drawCard();
void acct.refresh().then((r) => {
  const cs = r?.account.callsign;
  if (!cs || input.value) return;
  input.value = cs;
  name = cs;
  drawCard();
  say(`You’re CMDR ${cs}. Type another name to change it.`, 'yours');
});
