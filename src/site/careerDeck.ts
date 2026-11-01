// The home page's careers as a callsign card (tools/careerDeck.ts makes the four), one at a time (Mark: "a single
// card with the other cards rotating into the front most position"). Every few seconds the card turns over to
// the next career, pausing while you're over it, holding it or using the keyboard on it; the row beneath turns
// to any of the four, and on a phone you can swipe it. Beside it, that career's ladder, and "Make this card
// yours" goes to /callsign/ with that career chosen.

const deck = document.getElementById('career-deck');
const cta = document.getElementById('career-cta') as HTMLAnchorElement | null;
if (deck) {
  const cards = [...deck.querySelectorAll<HTMLButtonElement>('.deck-card')];
  const row = [...document.querySelectorAll<HTMLButtonElement>('.deck-row button')];
  const ladders = [...document.querySelectorAll<HTMLElement>('.careers .ladder[data-career]')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TURN_MS = 6000;
  /** How long the old card takes to turn edge on (site.css: the new one starts turning in then). */
  const HALF_MS = 300;
  let front = 0;
  // Which way it turns, while Mark chooses: about the upright (the default), top over bottom (?turn=x), or a slide (?turn=slide).
  const turnStyle = new URLSearchParams(location.search).get('turn') ?? '';
  if (turnStyle === 'x' || turnStyle === 'slide') deck.dataset.turn = turnStyle;

  const show = (i: number) => {
    const next = (i + cards.length) % cards.length;
    if (next !== front) {
      // The old card turns away; once it's edge on, it goes back to wait, unseen.
      const old = cards[front];
      old.classList.add('leaving');
      setTimeout(() => {
        old.classList.add('waiting');
        old.classList.remove('leaving');
        requestAnimationFrame(() => requestAnimationFrame(() => old.classList.remove('waiting')));
      }, HALF_MS + 20);
    }
    front = next;
    cards.forEach((card, k) => {
      card.dataset.pos = k === front ? '0' : '1';
      card.tabIndex = k === front ? 0 : -1;
      card.setAttribute('aria-hidden', String(k !== front));
    });
    // The row, the ladder and the button change with the card: at the halfway point, when she's edge on.
    const career = cards[front].dataset.career!;
    clearTimeout(labelTimer);
    labelTimer = window.setTimeout(() => {
      row.forEach((b) => b.setAttribute('aria-current', String(b.dataset.career === career)));
      ladders.forEach((l) => (l.hidden = l.dataset.career !== career));
      if (cta) cta.href = `/callsign/?career=${career}`;
    }, first ? 0 : turnStyle === 'slide' ? 120 : HALF_MS);
    first = false;
  };
  let labelTimer = 0;
  let first = true;
  deck.classList.add('live'); // without the script, every ladder shows
  show(0);

  // Turning by itself, unless something has your attention.
  let held = false;
  let timer = 0;
  const schedule = () => {
    clearTimeout(timer);
    if (!still) timer = window.setTimeout(() => (held || document.hidden ? schedule() : (show(front + 1), schedule())), TURN_MS);
  };
  const hold = (on: boolean) => {
    held = on;
    if (!on) schedule();
  };
  for (const el of [deck, ...row]) {
    el.addEventListener('pointerenter', () => hold(true));
    el.addEventListener('pointerleave', () => hold(false));
  }
  deck.addEventListener('focusin', () => hold(true));
  deck.addEventListener('focusout', () => hold(false));
  schedule();

  row.forEach((b) =>
    b.addEventListener('click', () => {
      show(cards.findIndex((c) => c.dataset.career === b.dataset.career));
      schedule();
    }),
  );
  // The card itself is the one to make yours.
  cards.forEach((card) =>
    card.addEventListener('click', () => {
      if (!moved) location.href = cta?.href ?? `/callsign/?career=${card.dataset.career}`;
    }),
  );
  deck.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      show(front + (e.key === 'ArrowRight' ? 1 : -1));
      cards[front].focus();
      e.preventDefault();
    }
  });

  // Swiping: the card tilts as you drag, as the card on /callsign/ does, and a long enough drag turns it.
  let startX = 0;
  let dx = 0;
  let dragging = false;
  let moved = false;
  deck.addEventListener('pointerdown', (e) => {
    dragging = true;
    moved = false;
    startX = e.clientX;
    dx = 0;
    held = true;
  });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    if (Math.abs(dx) > 6) moved = true;
    const card = cards[front];
    card.style.transition = 'none';
    card.style.transform = `translateX(${dx * 0.5}px) rotateY(${Math.max(-30, Math.min(30, dx / 5))}deg)`;
  });
  window.addEventListener('pointerup', () => {
    if (!dragging) return;
    dragging = false;
    const card = cards[front];
    card.style.transition = '';
    card.style.transform = '';
    if (Math.abs(dx) > 60) show(front + (dx < 0 ? 1 : -1));
    held = false;
    schedule();
    setTimeout(() => (moved = false), 0); // the click that ends a swipe isn't a tap
  });
}
