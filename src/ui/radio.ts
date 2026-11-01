import { escapeHtml } from './escape';
import { isTouch } from '../game/input';
import { onTap } from './touch';
import { holdFlashes } from './hud';
import { sfx } from '../audio/sound';

// The radio log in flight (docs/design/radio-and-comms.md): everything said
// to you, by whom and when, in one place that fades when it's quiet. On a
// phone it's a pill with an unread count that opens the log, and it folds
// away when a fight starts, as the job strip does.
//
// Colour says who; weight and motion say how urgent (Mark, 1 November 2026:
// "subtle animation cues and subtle use of color to help identify which
// messages come from who and how urgent they are"). Each voice has a small
// mark and an accent; the text stays plain. Three levels of urgency:
//   now         a card on screen with its answers and a draining time bar,
//               its squawk, and a second squawk in its last seconds;
//   worth       a row with a bright edge and an unread count;
//   background  dim, no motion, folded into one line.
// The log is grouped by voice, one row each, not a wall of lines. In a fight
// only cards interrupt, and the rest is summed up when it's over.

export type RadioKind = 'station' | 'police' | 'company' | 'ship' | 'pirate' | 'mayday' | 'news' | 'beacon';
export type Urgency = 'now' | 'worth' | 'background';

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
  /** How much it needs you, when its kind doesn't say (a card is always "now"). */
  urgency?: Urgency;
}

interface Entry extends Omit<RadioLine, 'action'> {
  id: number;
  at: number;
  answers?: RadioAction[];
  urgency: Urgency;
  /** Answered, dismissed or lapsed: what it says now. */
  done?: string;
  /** The fight summary: a card of its own, never a voice in the log. */
  summary?: boolean;
  /** Its last seconds have been called out once. */
  warned?: boolean;
}

/** How long a card waits for an answer when its answers don't say. */
const CARD_TIME = 30_000;
/** A phone has room for one card beside the crosshair; a computer two. */
const CARDS_SHOWN = isTouch ? 1 : 2;
/** A card's last seconds: it pulses and squawks again. */
const ENDING = 5000;
/** Which card comes first, and which Enter answers: the police before a Mayday before a pirate. */
const FIRST: Partial<Record<RadioKind, number>> = { police: 0, mayday: 1, beacon: 1, pirate: 2 };

const KEEP = 60;
const ROWS = 4; // voices on screen while closed (desktop)
const BACKGROUND_FOR = 3 * 60_000; // background lines drop out of the closed log after this
const QUIET_AFTER = 9000; // ms before the closed log fades out
const TICKER = 5000; // ms the phone pill shows the latest line

/** Each voice's mark (16 × 16, stroked): the shape says what kind of voice. */
const MARKS: Record<RadioKind, string> = {
  station: 'M8 2 L14 8 L8 14 L2 8 Z M6 8 H10',
  police: 'M8 2 L13 4 V8 C13 11 8 14 8 14 C8 14 3 11 3 8 V4 Z',
  pirate: 'M3 3 L13 13 M13 3 L3 13',
  company: 'M3 3 H13 V13 H3 Z',
  ship: 'M8 3 A5 5 0 1 0 8.01 3',
  mayday: 'M8 2 A6 6 0 1 0 8.01 2 M8 6 A2 2 0 1 0 8.01 6',
  news: 'M3 4 H13 M3 8 H13 M3 12 H9',
  beacon: 'M8 2 V14 M2 8 H14 M4 4 L12 12 M12 4 L4 12',
};
const mark = (kind: RadioKind) => `<svg class="rmark" viewBox="0 0 16 16" aria-hidden="true"><path d="${MARKS[kind]}"/></svg>`;

/** A line's urgency when it doesn't say: a card needs you now; traffic and other ships are background. */
const urgencyOf = (l: RadioLine, answers?: RadioAction[]): Urgency => (answers?.length ? 'now' : (l.urgency ?? (l.kind === 'station' || l.kind === 'ship' ? 'background' : 'worth')));

const entries: Entry[] = [];
/** Lines already drawn once: only new ones play their entrance. */
const shownBefore = new Set<number>();
/** Unread lines, by voice. */
const unreadBy = new Map<string, number>();
/** The voice opened in the full log, if one is. */
let thread: string | null = null;
/** Heard in a fight, for the summary after it (and the banners held back meanwhile). */
let heardInFight: Entry[] = [];
let serial = 0;
let open = false;
let unread = 0;
let fighting = false;
let fadeTimer = 0;
let tickerTimer = 0;

const root = () => document.querySelector<HTMLElement>('#radio')!;
const voice = (e: Entry) => `${e.kind}:${e.from}`;

const time = (t: number) => {
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};

/**
 * Every call is heard as a transmission, in step with what you see (Mark: the tail came at odd
 * moments): the squawk as the card or line slides in, then the squelch tail as it settles (style.css
 * rcard-in, 0.35 s; a pirate's flicker ends at 0.52 s). A call that cuts in takes over from the last
 * one's tail. Plain messages are softer than calls to answer; background chatter and your own
 * replies are silent.
 */
const SETTLED: Partial<Record<RadioKind, number>> = { pirate: 520 };
let lastKey = 0;
let tail = 0;
function transmission(e: Entry) {
  if (e.from === 'You' || e.urgency === 'background') return;
  const now = performance.now();
  if (now - lastKey < 300) return; // a burst of lines doesn't chatter
  lastKey = now;
  clearTimeout(tail);
  const quiet = e.urgency !== 'now';
  sfx.squawk(e.kind, quiet);
  tail = window.setTimeout(() => sfx.squelch(e.kind, quiet), SETTLED[e.kind] ?? 380);
}

/** Something said to you: into the log, and on screen for a while. Returns its id, to settle it later. */
export function say(line: RadioLine): number {
  const { action, answers, ...rest } = line;
  const all = answers ?? (action ? [action] : undefined);
  const e: Entry = { ...rest, answers: all?.length ? all : undefined, urgency: urgencyOf(line, all), id: ++serial, at: Date.now() };
  entries.push(e);
  transmission(e);
  if (entries.length > KEEP) entries.shift();
  if (e.from !== 'You' && e.urgency !== 'background') {
    if (!open || thread !== voice(e)) unreadBy.set(voice(e), (unreadBy.get(voice(e)) ?? 0) + 1);
    if (!open) unread++;
  }
  if (fighting && e.urgency !== 'now' && e.from !== 'You') heardInFight.push(e);
  render();
  wake();
  if (isTouch && !fighting && !open && e.urgency !== 'background') {
    const el = root();
    el.classList.add('ticker');
    clearTimeout(tickerTimer);
    tickerTimer = window.setTimeout(() => el.classList.remove('ticker'), TICKER);
  }
  return e.id;
}

/** A card overtaken by events (the police ask again later, a pirate opened fire): it goes, saying why. */
export function settle(id: number, done: string) {
  const e = entries.find((x) => x.id === id);
  if (!e || e.done || !e.answers) return;
  e.done = done;
  render();
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
  else thread = null;
  root().classList.toggle('open', open);
  if (open) root().classList.remove('ticker');
  render();
  wake();
}

/**
 * A fight under way: only cards interrupt. The phone's log folds away, the ticker keeps quiet,
 * and banners that aren't warnings wait. When it's over, one card sums up what you missed.
 */
export function setRadioFight(on: boolean) {
  if (on === fighting) return;
  fighting = on;
  const held = holdFlashes(on);
  if (on) {
    heardInFight = [];
    if (isTouch) {
      root().classList.remove('ticker');
      if (open) toggleRadio(false);
    }
    return;
  }
  // Who said what: one line each, the latest of what each voice said ("Hexon: Running late", "Lave police ×2: …").
  const by = new Map<string, { name: string; n: number; last: string }>();
  for (const e of heardInFight) {
    const name = e.kind === 'news' ? 'News' : e.from;
    by.set(name, { name, n: (by.get(name)?.n ?? 0) + 1, last: e.text.split(' · ')[0] });
  }
  const parts = [...by.values()].map((v) => `${v.name}${v.n > 1 ? ` ×${v.n}` : ''}: ${v.last}`);
  heardInFight = [];
  const all = [...parts, ...held];
  if (!all.length) return;
  const e: Entry = {
    id: ++serial,
    at: Date.now(),
    kind: 'news',
    from: 'While you were fighting',
    text: all.join(' · '),
    urgency: 'now',
    summary: true,
    answers: [{ label: 'Open the radio', done: 'Opened', until: Date.now() + 20_000, run: () => (toggleRadio(true), null) }],
  };
  entries.push(e);
  render();
}

/** When a card's answers lapse. */
const until = (e: Entry) => e.answers?.[0]?.until ?? e.at + CARD_TIME;
const waiting = (e: Entry, now = Date.now()) => Boolean(e.answers && !e.done && until(e) > now);
/** The cards waiting, most urgent first: the police, a Mayday, a pirate, then the rest, newest first. */
const cardsWaiting = (now = Date.now()) =>
  entries.filter((e) => waiting(e, now)).sort((a, b) => (FIRST[a.kind] ?? 3) - (FIRST[b.kind] ?? 3) || b.at - a.at);

/** Enter: give the first card its first answer. Returns whether there was one. */
export function acceptLatest(): boolean {
  const e = cardsWaiting()[0];
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
  unreadBy.clear();
  heardInFight = [];
  thread = null;
  unread = 0;
  render();
}

const accent = (e: Entry) => (e.colour ? `--who:${e.colour}` : '');

/** One voice's row: its mark, its name, its latest line, and how many you haven't read. */
function row(latest: Entry, more: number, now: number, folded = false) {
  const v = voice(latest);
  const fresh = !shownBefore.has(latest.id);
  shownBefore.add(latest.id);
  const count = folded ? (more ? `<span class="rrow-more">${more} more</span>` : '') : unreadBy.get(v) ? `<span class="rrow-count">${unreadBy.get(v)}</span>` : `<time>${time(latest.at)}</time>`;
  const card = waiting(latest, now) ? '<span class="rrow-card" aria-label="On a card">↑</span>' : '';
  const button = open ? `<button type="button" class="rrow" data-voice="${escapeHtml(v)}" aria-expanded="${thread === v}">` : '<div class="rrow">';
  return `<li class="r-${latest.kind} u-${latest.urgency}${fresh ? ' fresh' : ''}" style="${accent(latest)}">${button}${mark(latest.kind)}<b>${escapeHtml(latest.from)}</b><span class="rrow-text">${escapeHtml(latest.text)}</span>${card}${count}${open ? '</button>' : '</div>'}</li>`;
}

/** The lines of one voice, opened in the full log, with any answers still waiting. */
function threadOf(v: string, now: number) {
  const lines = entries.filter((e) => !e.summary && voice(e) === v);
  return `<li class="rthread"><ol>${lines
    .map((e) => {
      const buttons = e.answers ? (e.done ? `<em class="radio-done">${escapeHtml(e.done)}</em>` : waiting(e, now) ? e.answers.map((a, i) => `<button type="button" data-radio="${e.id}" data-answer="${i}">${escapeHtml(a.label)}</button>`).join('') : '') : '';
      return `<li><time>${time(e.at)}</time> ${escapeHtml(e.text)}${buttons}</li>`;
    })
    .join('')}</ol></li>`;
}

function render() {
  const el = root();
  const now = Date.now();
  // Lapsed cards say so.
  for (const e of entries) if (e.answers && !e.done && until(e) <= now) e.done = 'Gone';
  el.hidden = !entries.length;
  // One row per voice, the latest line on it, newest at the bottom; background folds into one row.
  const voices = new Map<string, Entry>();
  const background: Entry[] = [];
  for (const e of entries) {
    if (e.summary) continue;
    if (e.urgency === 'background' && !waiting(e, now)) {
      if (open || now - e.at < BACKGROUND_FOR) background.push(e);
      continue;
    }
    voices.delete(voice(e)); // re-inserted, so the map keeps the order of each voice's latest line
    voices.set(voice(e), e);
  }
  let rows = [...voices.values()].map((e) => row(e, 0, now) + (open && thread === voice(e) ? threadOf(voice(e), now) : ''));
  const last = background[background.length - 1];
  if (last) rows.push(row(last, background.length - 1, now, true) + (open && thread === voice(last) ? threadOf(voice(last), now) : ''));
  if (!open) rows = rows.slice(-ROWS);
  el.querySelector('.radio-list')!.innerHTML = rows.join('');
  renderCards(now);
  const lastSaid = [...entries].reverse().find((e) => !e.summary && e.urgency !== 'background');
  el.querySelector('.radio-count')!.textContent = unread ? String(unread) : '';
  el.querySelector('.radio-ticker')!.textContent = lastSaid ? `${lastSaid.from} · ${lastSaid.text}` : '';
  // The pill carries the marks of the voices waiting to be read, so a glance says who.
  const marks = [...unreadBy.entries()].filter(([, n]) => n > 0).slice(-3).map(([v]) => {
    const e = [...entries].reverse().find((x) => voice(x) === v);
    return e ? `<span class="r-${e.kind}" style="${accent(e)}">${mark(e.kind)}</span>` : '';
  });
  el.querySelector('.radio-marks')!.innerHTML = unread ? marks.join('') : '';
  el.classList.toggle('unread', unread > 0);
}

/** The cards waiting for an answer, most urgent at the top: two on a computer, one on a phone. */
function renderCards(now: number) {
  const box = document.querySelector<HTMLElement>('#radio-cards');
  if (!box) return;
  const all = cardsWaiting(now);
  const shown = all.slice(0, CARDS_SHOWN);
  // Keep cards already on screen (so they don't replay their entrance); add new ones; drop the rest.
  const ids = new Set(shown.map((e) => String(e.id)));
  for (const c of [...box.querySelectorAll<HTMLElement>('.rcard')]) if (!ids.has(c.dataset.card!)) c.remove();
  shown.forEach((e, at) => {
    let card = box.querySelector<HTMLElement>(`[data-card="${e.id}"]`);
    if (!card) {
      card = document.createElement('div');
      card.className = `rcard r-${e.kind}${e.summary ? ' r-summary' : ''}`;
      card.dataset.card = String(e.id);
      if (e.colour) card.style.setProperty('--who', e.colour);
      card.setAttribute('role', 'group');
      card.setAttribute('aria-label', `${e.from}: ${e.text}`);
      const left = until(e) - now;
      card.innerHTML = `<p class="rcard-text">${e.summary ? '' : mark(e.kind)}<b>${escapeHtml(e.from)}</b> ${escapeHtml(e.text)}</p>
        <div class="rcard-answers">${e.answers!.map((a, i) => `<button type="button" data-radio="${e.id}" data-answer="${i}"${i ? '' : ' class="primary"'}>${escapeHtml(a.label)}<kbd>Enter</kbd></button>`).join('')}${e.answers![0].clock ? '<span class="rcard-left"></span>' : ''}<button type="button" class="rcard-dismiss" data-dismiss="${e.id}" aria-label="Don't answer">✕</button></div>
        <i class="rcard-time" style="animation-duration:${Math.max(0, left)}ms"></i>`;
      box.append(card);
    }
    // Only the first card says Enter: that's the one it answers.
    card.classList.toggle('first', at === 0 && !isTouch);
    if (at === 0) box.prepend(card);
    // Its last seconds: a pulse and a second squawk, once.
    const ending = until(e) - now <= ENDING;
    if (ending && !e.warned && !e.summary) {
      e.warned = true;
      sfx.squawk(e.kind, false);
    }
    card.classList.toggle('ending', ending && !e.summary);
  });
  // Cards waiting behind the one on a phone.
  let more = box.querySelector<HTMLElement>('.rcard-more');
  const behind = all.slice(CARDS_SHOWN);
  if (behind.length) {
    if (!more) {
      more = document.createElement('p');
      more.className = 'rcard-more';
      box.append(more);
    }
    const text = `+${behind.length} waiting: ${behind.map((e) => (e.kind === 'mayday' ? 'a Mayday' : e.from)).join(', ')}`;
    if (more.textContent !== text) more.textContent = text;
  } else more?.remove();
  // A deadline counts down on its card.
  for (const e of shown) {
    const left = e.answers![0].clock && box.querySelector<HTMLElement>(`[data-card="${e.id}"] .rcard-left`);
    if (left) left.textContent = `${Math.ceil((until(e) - now) / 1000)} s`;
  }
  box.hidden = !shown.length;
  clearTimeout(cardTimer);
  // Wake again when the soonest card lapses or reaches its last seconds, so it changes on time (and each second, for a countdown).
  const clocks = shown.some((e) => e.answers![0].clock);
  const next = Math.min(...shown.flatMap((e) => [until(e), until(e) - ENDING].filter((t) => t > now)));
  if (shown.length) cardTimer = window.setTimeout(render, clocks ? 1000 - (now % 1000) + 20 : Math.max(250, next - now + 50));
}
let cardTimer = 0;

export function initRadio() {
  const el = root();
  onTap(el.querySelector<HTMLElement>('.radio-pill')!, () => toggleRadio());
  onTap(el.querySelector<HTMLElement>('.radio-close')!, () => toggleRadio(false));
  // A tap anywhere else closes the log too.
  document.addEventListener('pointerdown', (e) => open && !el.contains(e.target as Node) && toggleRadio(false), true);
  const list = el.querySelector<HTMLElement>('.radio-list')!;
  let tapped = 0;
  const press = (target: EventTarget | null) => {
    const t = target as HTMLElement;
    const gone = t.closest<HTMLButtonElement>('button[data-dismiss]');
    const off = gone && entries.find((x) => x.id === Number(gone.dataset.dismiss));
    if (off) return dismiss(off);
    const b = t.closest<HTMLButtonElement>('button[data-radio]');
    const e = b && entries.find((x) => x.id === Number(b.dataset.radio));
    if (e) return act(e, Number(b!.dataset.answer ?? 0));
    // A voice's row: open its conversation (or close it again).
    const r = t.closest<HTMLButtonElement>('button[data-voice]');
    if (r) {
      thread = thread === r.dataset.voice ? null : r.dataset.voice!;
      if (thread) unreadBy.delete(thread);
      render();
    }
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

/** How a line said to you is shown (main.ts radio()). */
export interface RadioOpts {
  /** Seconds to flash it: always under Classic, and under Modern if it's urgent. */
  flash?: number;
  urgent?: boolean;
  colour?: string;
  action?: RadioAction;
  /** Several answers, as a card (src/ui/radio.ts); the first is what Enter does. */
  answers?: RadioAction[];
  /** The flashed text, when it isn't "from · text". */
  line?: string;
  /** How much it needs you, when its kind doesn't say. */
  urgency?: Urgency;
}
