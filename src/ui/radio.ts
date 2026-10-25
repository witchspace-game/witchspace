import { escapeHtml } from './escape';
import { isTouch } from '../game/input';
import { onTap } from './touch';

// The radio log in flight (docs/design/radio-and-comms.md): everything said
// to you, by whom and when, in one place that fades when it's quiet. On a
// phone it's a pill with an unread count that opens the log, and it folds
// away when a fight starts, as the job strip does.

export type RadioKind = 'station' | 'police' | 'company' | 'ship' | 'pirate' | 'mayday' | 'news' | 'beacon';

export interface RadioAction {
  label: string;
  /** What it says once done: "Accepted". */
  done: string;
  /** Do it; returns what to say back (logged as a reply), or null to say nothing. */
  run: () => { from: string; text: string; colour?: string; kind: RadioKind } | null;
  /** After this (ms since epoch) the offer has gone. */
  until?: number;
}

export interface RadioLine {
  from: string;
  text: string;
  kind: RadioKind;
  /** The speaker's colour: a company's, or the role's. */
  colour?: string;
  action?: RadioAction;
}

interface Entry extends RadioLine {
  id: number;
  at: number;
  /** The action's been taken (or has lapsed): what it says now. */
  done?: string;
}

const KEEP = 40;
const SHOWN = 4; // lines on screen while closed (desktop)
const QUIET_AFTER = 9000; // ms before the closed log fades out
const TICKER = 5000; // ms the phone pill shows the latest line

const entries: Entry[] = [];
let serial = 0;
let open = false;
let unread = 0;
let fighting = false;
let fadeTimer = 0;
let tickerTimer = 0;

const root = () => document.querySelector<HTMLElement>('#radio')!;

const time = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/** Something said to you: into the log, and on screen for a while. */
export function say(line: RadioLine) {
  const e: Entry = { ...line, id: ++serial, at: Date.now() };
  entries.push(e);
  if (entries.length > KEEP) entries.shift();
  if (!open) unread++;
  render();
  wake();
  if (isTouch && !fighting && !open) {
    const el = root();
    el.classList.add('ticker');
    clearTimeout(tickerTimer);
    tickerTimer = window.setTimeout(() => el.classList.remove('ticker'), TICKER);
  }
}

/** Show the closed log again, then let it fade when nothing more is said. */
function wake() {
  const el = root();
  el.classList.remove('quiet');
  clearTimeout(fadeTimer);
  fadeTimer = window.setTimeout(() => el.classList.add('quiet'), QUIET_AFTER);
}

/** Launching: show what was said while you were docked, then let it fade. */
export function wakeRadio() {
  if (!entries.length) return;
  render();
  wake();
}

/** Open or close the full log (' on a keyboard; the pill on a phone). */
export function toggleRadio(show = !open) {
  open = show;
  if (open) unread = 0;
  root().classList.toggle('open', open);
  if (open) root().classList.remove('ticker');
  render();
  wake();
  if (open) root().querySelector('.radio-list')?.scrollTo({ top: 1e6 });
}

/** A fight under way: the phone's log folds away and the ticker keeps quiet. */
export function setRadioFight(on: boolean) {
  fighting = on;
  if (on && isTouch) {
    root().classList.remove('ticker');
    if (open) toggleRadio(false);
  }
}

/** The newest offer still open: what Enter accepts. */
const pending = () => [...entries].reverse().find((e) => e.action && !e.done && (!e.action.until || e.action.until > Date.now()));

/** Enter: take the newest offer on the log. Returns whether there was one. */
export function acceptLatest(): boolean {
  const e = pending();
  if (!e) return false;
  act(e);
  return true;
}

function act(e: Entry) {
  if (!e.action || e.done) return;
  if (e.action.until && e.action.until <= Date.now()) {
    e.done = 'Offer gone';
    return render();
  }
  e.done = e.action.done;
  const reply = e.action.run();
  if (reply) say(reply);
  else render();
}

/** Forget everything (a new commander). */
export function clearRadio() {
  entries.length = 0;
  unread = 0;
  render();
}

function render() {
  const el = root();
  const now = Date.now();
  // Lapsed offers say so.
  for (const e of entries) if (e.action && !e.done && e.action.until && e.action.until <= now) e.done = 'Offer gone';
  el.hidden = !entries.length;
  const shown = open ? entries : entries.slice(-SHOWN);
  el.querySelector('.radio-list')!.innerHTML = shown
    .map((e) => {
      const button = e.action ? (e.done ? `<em class="radio-done">${escapeHtml(e.done)}</em>` : `<button type="button" data-radio="${e.id}">${escapeHtml(e.action.label)}${isTouch ? '' : ' (Enter)'}</button>`) : '';
      return `<li class="r-${e.kind}"><time>${time(e.at)}</time> <b style="${e.colour ? `--who:${e.colour}` : ''}">${escapeHtml(e.from)}</b> ${escapeHtml(e.text)}${button}</li>`;
    })
    .join('');
  const last = entries[entries.length - 1];
  el.querySelector('.radio-count')!.textContent = unread ? String(unread) : '';
  el.querySelector('.radio-ticker')!.textContent = last ? `${last.from} · ${last.text}` : '';
  el.classList.toggle('unread', unread > 0);
}

export function initRadio() {
  const el = root();
  onTap(el.querySelector<HTMLElement>('.radio-pill')!, () => toggleRadio());
  onTap(el.querySelector<HTMLElement>('.radio-close')!, () => toggleRadio(false));
  // A tap anywhere else closes the log too.
  document.addEventListener('pointerdown', (e) => open && !el.contains(e.target as Node) && toggleRadio(false), true);
  // Accept buttons come and go with the list: catch their taps on the list itself.
  const list = el.querySelector<HTMLElement>('.radio-list')!;
  let tapped = 0;
  const press = (target: EventTarget | null) => {
    const b = (target as HTMLElement).closest<HTMLButtonElement>('button[data-radio]');
    const e = b && entries.find((x) => x.id === Number(b.dataset.radio));
    if (e) act(e);
  };
  list.addEventListener('pointerdown', (ev) => {
    if (ev.pointerType === 'mouse') return;
    tapped = performance.now();
    press(ev.target);
  });
  list.addEventListener('click', (ev) => {
    if (performance.now() - tapped > 800) press(ev.target);
  });
}
