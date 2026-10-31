// The pop-out keyboard (Mark, 31 October 2026: "Do you think we could build a popout keyboard for the
// desktop version?" … "On desktop you could detach it so it stays available for reference"). Elite came
// with a printed keyboard overlay in 1984; this is ours. Every key labelled for the scheme you fly with
// (game/keys.ts), lighting up as you press it. Three places to keep it:
//   - in the controls card (F1, or "F1 controls" at the top of the screen), with the full list below;
//   - pinned over the game while you fly: dragged where you like, see-through, clicks passing through it;
//   - in its own window, for a second screen, kept in step with the game.
// Desktop only: a phone has its own controls on screen.

import { controlScheme, isTouch } from '../game/input';
import { ARROWS, keyCap, keysFor, LAYOUT, type KeyUse } from '../game/keys';
import { flash } from './hud';

const MAC = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform);
const PIN_KEY = 'witchspace.keyboardPin';

/** Every keyboard on show (the card's, the pinned one, the window's), so a key lights on them all. */
const mounted = new Set<HTMLElement>();

/** What a key does, in full: the controls card's line for it, if the card has drawn one. */
let describe: (k: KeyUse) => string = (k) => k.label;
export function setKeyDescriptions(fn: (k: KeyUse) => string) {
  describe = fn;
}

function keyEl(doc: Document, code: string, width: number, uses: Map<string, KeyUse>, press: (code: string) => void) {
  const el = doc.createElement(code ? 'button' : 'span');
  el.className = code ? 'kb-key' : 'kb-gap';
  el.style.flexGrow = String(width);
  el.style.flexBasis = '0';
  if (!code) return el;
  el.dataset.code = code;
  const use = uses.get(code);
  if (use) {
    el.classList.add('used', `kb-${use.group}`);
    el.title = describe(use);
  } else (el as HTMLButtonElement).disabled = true;
  el.innerHTML = `<b>${keyCap(code, MAC)}</b>${use ? `<i>${use.label}</i>` : ''}`;
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    press(code);
  });
  return el;
}

/** Draw the keyboard into `host`, for the scheme you fly with now. */
function draw(host: HTMLElement, press: (code: string) => void) {
  const doc = host.ownerDocument;
  const uses = keysFor(controlScheme());
  host.replaceChildren();
  const main = doc.createElement('div');
  main.className = 'kb-main';
  for (const row of LAYOUT) {
    const r = doc.createElement('div');
    r.className = 'kb-row';
    for (const [code, w] of row) r.append(keyEl(doc, code, w, uses, press));
    main.append(r);
  }
  const arrows = doc.createElement('div');
  arrows.className = 'kb-arrows';
  for (const [code, col, row] of ARROWS) {
    const k = keyEl(doc, code, 1, uses, press);
    k.style.gridColumn = String(col + 1);
    k.style.gridRow = String(row + 1);
    arrows.append(k);
  }
  host.append(main, arrows);
}

/** Press a key from the keyboard on screen, as if typed, in the game's window. */
function pressInGame(code: string) {
  dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
  setTimeout(() => dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })), 120);
}

function mount(host: HTMLElement) {
  draw(host, pressInGame);
  mounted.add(host);
}

/** The scheme changed (K): relabel every keyboard on show. */
export function refreshKeyboards() {
  for (const host of mounted) {
    if (!host.isConnected) mounted.delete(host);
    else draw(host, pressInGame);
  }
}

function light(code: string, on: boolean) {
  for (const host of mounted) host.querySelector(`[data-code="${code}"]`)?.classList.toggle('down', on);
}
if (typeof window !== 'undefined') {
  addEventListener('keydown', (e) => light(e.code, true));
  addEventListener('keyup', (e) => light(e.code, false));
  addEventListener('blur', () => mounted.forEach((h) => h.querySelectorAll('.down').forEach((k) => k.classList.remove('down'))));
}

// --- In the controls card ---------------------------------------------------------------

/** Put the keyboard at the top of the controls card, with its pin and pop-out buttons. */
export function keyboardInCard(card: HTMLElement) {
  if (isTouch) return;
  let host = card.querySelector<HTMLElement>('.kb');
  if (!host) {
    const bar = card.ownerDocument.createElement('p');
    bar.className = 'kb-bar';
    bar.innerHTML = `<button type="button" class="kb-pin">Pin over the game</button><button type="button" class="kb-out">Open in its own window</button>`;
    host = card.ownerDocument.createElement('div');
    host.className = 'kb';
    card.querySelector('#controls-scheme')!.after(host, bar);
    bar.querySelector<HTMLButtonElement>('.kb-pin')!.onclick = () => setPinned(true);
    bar.querySelector<HTMLButtonElement>('.kb-out')!.onclick = () => openWindow();
  }
  mount(host);
}

// --- Pinned over the game ------------------------------------------------------------------

interface Pin {
  on: boolean;
  x: number;
  y: number;
  /** Key size, in pixels. */
  size: number;
  opacity: number;
}
const loadPin = (): Pin => {
  try {
    return { on: false, x: 24, y: 80, size: 34, opacity: 0.75, ...JSON.parse(localStorage.getItem(PIN_KEY) ?? '{}') };
  } catch {
    return { on: false, x: 24, y: 80, size: 34, opacity: 0.75 };
  }
};
let pin = loadPin();
const savePin = () => {
  try {
    localStorage.setItem(PIN_KEY, JSON.stringify(pin));
  } catch {
    /* storage blocked: for this visit only */
  }
};
let pinned: HTMLElement | null = null;

function placePin() {
  if (!pinned) return;
  const w = pinned.offsetWidth;
  const h = pinned.offsetHeight;
  pin.x = Math.max(0, Math.min(innerWidth - Math.min(w, innerWidth), pin.x));
  pin.y = Math.max(0, Math.min(innerHeight - Math.min(h, innerHeight), pin.y));
  pinned.style.transform = `translate(${pin.x}px, ${pin.y}px)`;
  pinned.style.setProperty('--kb-size-pin', `${pin.size}px`);
  pinned.style.setProperty('--kb-opacity', String(pin.opacity));
}

/** Pin the keyboard over the game (or take it down). It stays while you fly, and remembers where. */
export function setPinned(on: boolean) {
  if (isTouch) return;
  pin.on = on;
  savePin();
  if (!on) {
    pinned?.remove();
    if (pinned) mounted.delete(pinned.querySelector('.kb')!);
    pinned = null;
    return;
  }
  if (pinned) return;
  pinned = document.createElement('section');
  pinned.id = 'keyboard-pin';
  pinned.setAttribute('aria-label', 'Keyboard, pinned');
  pinned.innerHTML = `<header class="kb-handle" title="Drag to move"><span>Keys</span>
    <button type="button" data-act="smaller" title="Smaller">−</button><button type="button" data-act="bigger" title="Bigger">+</button>
    <button type="button" data-act="fade" title="More or less see-through">◐</button><button type="button" data-act="window" title="Open in its own window">⧉</button>
    <button type="button" data-act="close" title="Unpin">✕</button></header><div class="kb"></div>`;
  document.body.append(pinned);
  mount(pinned.querySelector<HTMLElement>('.kb')!);
  const handle = pinned.querySelector<HTMLElement>('.kb-handle')!;
  handle.addEventListener('click', (e) => {
    const act = (e.target as HTMLElement).closest<HTMLElement>('[data-act]')?.dataset.act;
    if (act === 'smaller') pin.size = Math.max(24, pin.size - 4);
    else if (act === 'bigger') pin.size = Math.min(56, pin.size + 4);
    else if (act === 'fade') pin.opacity = pin.opacity > 0.6 ? 0.45 : pin.opacity > 0.3 ? 0.25 : 0.9;
    else if (act === 'window') return openWindow();
    else if (act === 'close') return setPinned(false);
    savePin();
    placePin();
  });
  // Drag by the handle. The keyboard itself lets clicks through to the game, so it never fires a laser by accident.
  let from: { x: number; y: number; px: number; py: number } | null = null;
  handle.addEventListener('pointerdown', (e) => {
    if ((e.target as HTMLElement).closest('button')) return;
    from = { x: e.clientX, y: e.clientY, px: pin.x, py: pin.y };
    handle.setPointerCapture(e.pointerId);
    e.stopPropagation();
  });
  handle.addEventListener('pointermove', (e) => {
    if (!from) return;
    pin.x = from.px + e.clientX - from.x;
    pin.y = from.py + e.clientY - from.y;
    placePin();
  });
  handle.addEventListener('pointerup', () => {
    if (from) savePin();
    from = null;
  });
  handle.addEventListener('mousedown', (e) => e.stopPropagation()); // not a click to fly
  placePin();
}
if (typeof window !== 'undefined') addEventListener('resize', placePin);

// --- In its own window ---------------------------------------------------------------------

let popup: Window | null = null;

/** Open the keyboard in a window of its own (a second screen), kept in step with the game. */
export function openWindow() {
  if (isTouch) return;
  if (popup && !popup.closed) return popup.focus();
  const w = window.open('', 'witchspace-keyboard', 'popup,width=920,height=390');
  if (!w) return flash('Your browser blocked the window · allow pop-ups for this site, or pin the keyboard instead', 4);
  popup = w;
  const doc = w.document;
  doc.title = 'Keys · Witchspace';
  doc.head.replaceChildren(...[...document.head.querySelectorAll('style, link[rel="stylesheet"]')].map((n) => doc.importNode(n, true)));
  doc.body.className = `keyboard-window${document.body.classList.contains('retro') ? ' retro' : ''}`;
  doc.body.innerHTML = '<div class="kb"></div><p class="kb-note">Keys light up as you press them in the game. Click a key to press it there.</p>';
  const host = doc.querySelector<HTMLElement>('.kb')!;
  mount(host);
  // Keys typed while this window has the focus go to the game, and light up here.
  for (const type of ['keydown', 'keyup'] as const) {
    w.addEventListener(type, (e) => {
      dispatchEvent(new KeyboardEvent(type, { code: e.code, key: e.key, shiftKey: e.shiftKey, bubbles: true }));
      e.preventDefault();
    });
  }
  w.addEventListener('pagehide', () => {
    mounted.delete(host);
    popup = null;
  });
  // While it's open, it's the keyboard on show: the pinned one steps aside.
  if (pinned) setPinned(false);
}

/** On load: put the keyboard back where it was pinned. */
export function initKeyboard() {
  if (!isTouch && pin.on) setPinned(true);
}
