import { escapeHtml } from './escape';
import { isTouch } from '../game/input';
import { onTap } from './touch';
import { sfx } from '../audio/sound';

// The radio log in flight (docs/design/radio-and-comms.md): everything said
// to you, by whom and when, in one place that fades when it's quiet. On a
// phone it's a pill with an unread count that opens the log, and it folds
// away when a fight starts, as the job strip does.
//
// Anything that wants an answer (a pirate's price, a police order, a Mayday,
// an offer) is also a card on screen, log open or not, with its answers as
// buttons big enough for a thumb (Mark: "it's relatively hard to communicate
// back to a radio message"). Each card has its voice's accent on its edge and
// a subtle entrance, and arrives with a tiny squawk; it goes once answered,
// dismissed, or lapsed.

export type RadioKind = 'station' | 'police' | 'company' | 'ship' | 'pirate' | 'mayday' | 'news' | 'beacon';

export interface RadioAction {
  label: string;
  /** What it says once done: "Accepted". */
  done: string;
  /** Do it; returns what to say back (logged as a reply), or null to say nothing. */
  run: () => { from: string; text: string; colour?: string; kind: RadioKind } | null;
  /** After this (ms since epoch) the offer has gone. */
  until?: number;
  /** Show the seconds left on the card (a police hail's deadline). */
  clock?: boolean;
}

export interface RadioLine {
  from: string;
  text: string;
  kind: RadioKind;
  /** The speaker's colour: a company's, or the role's. */
  colour?: string;
  /** One answer (the old form); `answers` takes several, the first being what Enter does. */
  action?: RadioAction;
  answers?: RadioAction[];
}

interface Entry extends Omit<RadioLine, 'action'> {
  id: number;
  at: number;
  answers?: RadioAction[];
  /** Answered, dismissed or lapsed: what it says now. */
  done?: string;
}

/** How long a card waits for an answer when its answers don't say. */
const CARD_TIME = 30_000;
const CARDS_SHOWN = 2;

const KEEP = 40;
const SHOWN = 4; // lines on screen while closed (desktop)
const QUIET_AFTER = 9000; // ms before the closed log fades out
const TICKER = 5000; // ms the phone pill shows the latest line

const entries: Entry[] = [];
/** Lines already drawn once: only new ones play their entrance. */
const shownBefore = new Set<number>();
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

/**
 * Every call is heard as a transmission, in step with what you see (Mark: the tail came at odd
 * moments): the squawk as the card or line slides in, then the squelch tail as it settles (style.css
 * rcard-in, 0.35 s; a pirate's flicker ends at 0.52 s). A call that cuts in takes over from the last
 * one's tail. Plain messages are softer than calls to answer; your own replies are silent.
 */
const SETTLED: Partial<Record<RadioKind, number>> = { pirate: 520 };
let lastKey = 0;
let tail = 0;
function transmission(e: Entry) {
  if (e.from === 'You') return;
  const now = performance.now();
  if (now - lastKey < 300) return; // a burst of lines doesn't chatter
  lastKey = now;
  clearTimeout(tail);
  const quiet = !e.answers;
  sfx.squawk(e.kind, quiet);
  tail = window.setTimeout(() => sfx.squelch(e.kind, quiet), SETTLED[e.kind] ?? 380);
}

/** Something said to you: into the log, and on screen for a while. */
export function say(line: RadioLine) {
  const { action, answers, ...rest } = line;
  const all = answers ?? (action ? [action] : undefined);
  const e: Entry = { ...rest, answers: all?.length ? all : undefined, id: ++serial, at: Date.now() };
  entries.push(e);
  transmission(e);
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

/** When a card's answers lapse. */
const until = (e: Entry) => e.answers?.[0]?.until ?? e.at + CARD_TIME;
const waiting = (e: Entry, now = Date.now()) => Boolean(e.answers && !e.done && until(e) > now);

/** The newest card still waiting: what Enter answers. */
const pending = () => [...entries].reverse().find((e) => waiting(e));

/** Enter: give the newest card its first answer. Returns whether there was one. */
export function acceptLatest(): boolean {
  const e = pending();
  if (!e) return false;
  act(e, 0);
  return true;
}

function act(e: Entry, i: number) {
  const a = e.answers?.[i];
  if (!a || e.done) return;
  if (until(e) <= Date.now()) {
    e.done = 'Gone';
    return render();
  }
  e.done = a.done;
  const reply = a.run();
  if (reply) say(reply);
  else render();
}

/** Not answering: the card goes, the line stays in the log. */
function dismiss(e: Entry) {
  if (e.done) return;
  e.done = 'Not answered';
  render();
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
  // Lapsed cards say so.
  for (const e of entries) if (e.answers && !e.done && until(e) <= now) e.done = 'Gone';
  el.hidden = !entries.length;
  const shown = open ? entries : entries.slice(-SHOWN);
  el.querySelector('.radio-list')!.innerHTML = shown
    .map((e) => {
      // Answers live on the card; the open log offers them too, the closed one just says what was said.
      const buttons = e.answers ? (e.done ? `<em class="radio-done">${escapeHtml(e.done)}</em>` : !open ? '' : e.answers.map((a, i) => `<button type="button" data-radio="${e.id}" data-answer="${i}">${escapeHtml(a.label)}${isTouch || i ? '' : ' (Enter)'}</button>`).join('')) : '';
      // The voice is an accent on the line's edge, the name plain (Mark); a line plays its entrance once, as it arrives.
      const fresh = !shownBefore.has(e.id);
      shownBefore.add(e.id);
      return `<li class="r-${e.kind}${fresh ? ' fresh' : ''}" style="${e.colour ? `--who:${e.colour}` : ''}"><time>${time(e.at)}</time> <b>${escapeHtml(e.from)}</b> ${escapeHtml(e.text)}${buttons}</li>`;
    })
    .join('');
  renderCards(now);
  const last = entries[entries.length - 1];
  el.querySelector('.radio-count')!.textContent = unread ? String(unread) : '';
  el.querySelector('.radio-ticker')!.textContent = last ? `${last.from} · ${last.text}` : '';
  el.classList.toggle('unread', unread > 0);
}

/** The cards waiting for an answer, newest at the bottom, a couple at most. */
function renderCards(now: number) {
  const box = document.querySelector<HTMLElement>('#radio-cards');
  if (!box) return;
  const open = entries.filter((e) => waiting(e, now)).slice(-CARDS_SHOWN);
  // Keep cards already on screen (so they don't replay their entrance); add new ones; drop the rest.
  const ids = new Set(open.map((e) => String(e.id)));
  for (const c of [...box.children] as HTMLElement[]) if (!ids.has(c.dataset.card!)) c.remove();
  for (const e of open) {
    let card = box.querySelector<HTMLElement>(`[data-card="${e.id}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = `rcard r-${e.kind}`;
      card.dataset.card = String(e.id);
      if (e.colour) card.style.setProperty('--who', e.colour);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `${e.from}: ${e.text}`);
      card.innerHTML = `<p class="rcard-text"><b>${escapeHtml(e.from)}</b> ${escapeHtml(e.text)}</p>
        <div class="rcard-answers">${e.answers!.map((a, i) => `<button type="button" data-radio="${e.id}" data-answer="${i}"${i ? '' : ' class="primary"'}>${escapeHtml(a.label)}${isTouch || i ? '' : ' <kbd>Enter</kbd>'}</button>`).join('')}${e.answers![0].clock ? '<span class="rcard-left"></span>' : ''}<button type="button" class="rcard-dismiss" data-dismiss="${e.id}" aria-label="Don't answer">✕</button></div>`;
      box.append(card);
    }
  }
  // A deadline counts down on its card.
  for (const e of open) {
    const left = e.answers![0].clock && box.querySelector<HTMLElement>(`[data-card="${e.id}"] .rcard-left`);
    if (left) left.textContent = `${Math.ceil((until(e) - now) / 1000)} s`;
  }
  box.hidden = !open.length;
  clearTimeout(cardTimer);
  // Wake again when the soonest card lapses, so it goes on time (and each second, for a countdown).
  const clocks = open.some((e) => e.answers![0].clock);
  if (open.length) cardTimer = window.setTimeout(render, clocks ? 1000 - (now % 1000) + 20 : Math.max(250, Math.min(...open.map(until)) - now + 50));
}
let cardTimer = 0;

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
    const t = target as HTMLElement;
    const gone = t.closest<HTMLButtonElement>('button[data-dismiss]');
    const off = gone && entries.find((x) => x.id === Number(gone.dataset.dismiss));
    if (off) return dismiss(off);
    const b = t.closest<HTMLButtonElement>('button[data-radio]');
    const e = b && entries.find((x) => x.id === Number(b.dataset.radio));
    if (e) act(e, Number(b!.dataset.answer ?? 0));
  };
  // Answers come and go with the list and the cards: catch their taps on the containers.
  for (const box of [list, document.querySelector<HTMLElement>('#radio-cards')]) {
    if (!box) continue;
    box.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType === 'mouse') return;
      ev.stopPropagation(); // a tap on a card isn't a tap on the flight controls
      tapped = performance.now();
      press(ev.target);
    });
    box.addEventListener('click', (ev) => {
      if (performance.now() - tapped > 800) press(ev.target);
    });
  }
}
