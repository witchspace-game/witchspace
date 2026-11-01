// The home page's careers as a deck of callsign cards (tools/careerDeck.ts makes them): one at the front, the
// others fanned behind. It turns by itself every few seconds, pausing while you're over it, holding it or
// using the keyboard on it; tap a card behind to bring it forward, or swipe the front one on a phone. Beside
// it, the front career's ladder, and "Make this card yours" goes to /callsign/ with that career chosen.

const deck = document.getElementById('career-deck');
const cta = document.getElementById('career-cta') as HTMLAnchorElement | null;
if (deck) {
  const cards = [...deck.querySelectorAll<HTMLButtonElement>('.deck-card')];
  const ladders = [...document.querySelectorAll<HTMLElement>('.careers .ladder[data-career]')];
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TURN_MS = 6000;
  let front = 0;

  const show = (i: number) => {
    front = (i + cards.length) % cards.length;
    cards.forEach((card, k) => {
      const pos = (k - front + cards.length) % cards.length;
      card.dataset.pos = String(pos);
      card.tabIndex = pos === 0 ? 0 : -1;
      card.setAttribute('aria-pressed', String(pos === 0));
    });
    const career = cards[front].dataset.career!;
    ladders.forEach((l) => (l.hidden = l.dataset.career !== career));
    if (cta) cta.href = `/callsign/?career=${career}`;
  };
  deck.classList.add('live'); // without the script, every ladder shows and the cards sit fanned
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
  deck.addEventListener('pointerenter', () => hold(true));
  deck.addEventListener('pointerleave', () => hold(false));
  deck.addEventListener('focusin', () => hold(true));
  deck.addEventListener('focusout', () => hold(false));
  schedule();

  // A card behind comes forward; the front card is the one to make yours.
  cards.forEach((card, k) =>
    card.addEventListener('click', () => {
      if (moved) return;
      if (k === front) location.href = cta?.href ?? `/callsign/?career=${card.dataset.career}`;
      else show(k);
    }),
  );
  deck.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      show(front + (e.key === 'ArrowRight' ? 1 : -1));
      cards[front].focus();
      e.preventDefault();
    }
  });

  // Swiping the front card: she tilts as you drag, as the card on /callsign/ does, and a long enough drag turns the deck.
  let startX = 0;
  let dx = 0;
  let dragging = false;
  let moved = false;
  deck.addEventListener('pointerdown', (e) => {
    if (!(e.target as HTMLElement).closest('.deck-card[data-pos="0"]')) return;
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
    card.style.transform = `translate(${dx * 0.6}px, -50%) rotateY(${Math.max(-25, Math.min(25, dx / 6))}deg) rotate(${dx / 40}deg)`;
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
