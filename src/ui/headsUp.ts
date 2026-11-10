// The heads-up (Mark, 9 November 2026): an important message appears for a moment
// in the middle of the screen, semi-transparent, then shrinks and drifts away into
// the radio's corner, where it's kept. You see what it said, and where to find it
// again. Not for long, clear of the crosshair, and never in a fight (the radio holds
// those for its summary). docs/design/radio-and-comms.md.

/** How long it stays, by length: long enough to read, not long enough to be in the way. */
export const holdFor = (text: string) => Math.min(2800, 1100 + text.length * 20);
const IN = 220;
const AWAY = 650;
/** More than this many waiting: the oldest go straight to the log unseen. */
const QUEUE = 2;

interface HeadsUp {
  /** The voice's mark, as SVG markup. */
  mark: string;
  from: string;
  text: string;
  colour?: string;
  /** Called once it's in the radio's corner, or gone without getting there (dropped or cleared). */
  landed?: () => void;
}

const queue: HeadsUp[] = [];
let showing = false;
let current: HeadsUp | null = null;

const box = () => {
  let el = document.querySelector<HTMLElement>('#heads-up');
  if (!el) {
    el = document.createElement('div');
    el.id = 'heads-up';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.hidden = true;
    document.body.append(el);
  }
  return el;
};

/** Where it goes: the radio's pill on a phone; on a computer, the foot of the log, where its line joins. */
function corner(): DOMRect | null {
  const pill = document.querySelector<HTMLElement>('#radio .radio-pill');
  if (pill && pill.offsetParent) return pill.getBoundingClientRect();
  const list = document.querySelector<HTMLElement>('#radio .radio-list');
  const r = list?.getBoundingClientRect();
  if (r && r.width) return new DOMRect(r.left, r.bottom - 22, r.width, 22);
  // The log's still empty (this is its first line): where it's about to appear, under the job strip.
  const job = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--job-bottom')) || 0;
  return new DOMRect(16, Math.max(44, job + 8), 200, 22);
}

export function headsUp(h: HeadsUp) {
  queue.push(h);
  while (queue.length > QUEUE) queue.shift()?.landed?.();
  if (!showing) next();
}

/** Gone at once: a fight started, or you docked. */
export function clearHeadsUp() {
  for (const h of queue.splice(0)) h.landed?.();
  current?.landed?.();
  current = null;
  const el = box();
  el.getAnimations().forEach((a) => a.cancel());
  el.hidden = true;
  showing = false;
}

function next() {
  const h = queue.shift();
  if (!h) return void (showing = false);
  showing = true;
  current = h;
  const el = box();
  el.innerHTML = '';
  const who = document.createElement('b');
  who.innerHTML = h.mark;
  who.append(h.from);
  const text = document.createElement('span');
  text.textContent = h.text;
  el.append(who, text);
  el.style.setProperty('--who', h.colour ?? '');
  // Under the banner when a flash is up, not on top of it.
  const banner = document.querySelector<HTMLElement>('#banner');
  el.style.top = banner && !banner.hidden ? `${banner.getBoundingClientRect().bottom + 8}px` : '';
  el.hidden = false;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const appear = el.animate([{ opacity: 0, transform: 'translate(-50%, 6px) scale(0.97)' }, { opacity: 1, transform: 'translate(-50%, 0) scale(1)' }], { duration: still ? 1 : IN, easing: 'ease-out', fill: 'forwards' });
  appear.finished
    .then(() => new Promise((r) => setTimeout(r, holdFor(h.text))))
    .then(() => {
      // Away into the corner: shrink towards the radio and fade as it goes.
      const from = el.getBoundingClientRect();
      const to = corner();
      const dx = to && !still ? to.left + Math.min(to.width, 60) / 2 - (from.left + from.width / 2) : 0;
      const dy = to && !still ? to.top + to.height / 2 - (from.top + from.height / 2) : 0;
      return el.animate(
        [
          { opacity: 1, transform: 'translate(-50%, 0) scale(1)' },
          { opacity: 0, transform: `translate(calc(-50% + ${dx}px), ${dy}px) scale(${still ? 1 : 0.18})` },
        ],
        { duration: still ? 400 : AWAY, easing: 'cubic-bezier(0.5, 0, 0.75, 0)', fill: 'forwards' },
      ).finished;
    })
    .catch(() => undefined) // cancelled: cleared
    .then(() => {
      if (!showing || current !== h) return;
      current = null;
      el.hidden = true;
      el.getAnimations().forEach((a) => a.cancel());
      h.landed?.();
      // The radio's corner answers with a glint as it lands.
      document.querySelector('#radio')?.animate([{ filter: 'brightness(1.8)' }, { filter: 'none' }], { duration: 500 });
      next();
    });
}
