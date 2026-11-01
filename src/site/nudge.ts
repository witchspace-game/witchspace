import { claimLine } from './callsignWords';

// The callsign card, offered once (Mark): on a computer, to someone who hasn't signed in, who has been on the
// site a while and whose pointer heads for the tabs to leave. A small card in the corner, never a cover over
// the page, and never again once it's been seen. Not on a phone (there's no warning before leaving there; the
// game asks at a moment worth it instead), not on /callsign/ itself, and not for a signed-in commander.

const SEEN = 'witchspace.callsign.offered';
const SESSION = 'witchspace.session';
/** How long on the site, this visit, before it may be offered. */
const AFTER = 25_000;

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return 'blocked';
  }
};

const desktop = matchMedia('(pointer: fine) and (min-width: 900px)').matches;
if (desktop && !location.pathname.startsWith('/callsign/') && !read(SEEN) && !read(SESSION)) {
  const since = performance.now();
  const leaving = (e: MouseEvent) => {
    if (e.clientY > 8 || e.relatedTarget || performance.now() - since < AFTER) return;
    document.removeEventListener('mouseout', leaving);
    offer();
  };
  document.addEventListener('mouseout', leaving);
}

function offer() {
  try {
    localStorage.setItem(SEEN, String(Date.now()));
  } catch {
    // Storage blocked: it may come again on another visit, and that's all.
  }
  // The callsign in the game's own type, as on the card: Rajdhani, served with the site's fonts (fonts.css).
  const el = document.createElement('aside');
  el.className = 'cs-nudge';
  el.setAttribute('aria-label', 'Claim your callsign');
  el.innerHTML = `
    <button type="button" class="cs-nudge-close" aria-label="Close">×</button>
    <a class="cs-nudge-card" href="/callsign/">
      <img src="/callsign/debris.jpg" width="1200" height="630" alt="" />
      <span class="cs-nudge-copy"><small>CMDR</small><b>Your callsign</b></span>
    </a>
    <p><b>Every pilot needs a callsign.</b> ${claimLine(Date.now())}</p>
    <a class="button primary small" href="/callsign/">Make your card</a>`;
  document.body.append(el);
  requestAnimationFrame(() => el.classList.add('shown'));
  const close = () => {
    el.classList.remove('shown');
    setTimeout(() => el.remove(), 300);
  };
  el.querySelector('.cs-nudge-close')!.addEventListener('click', close);
  document.addEventListener('keydown', (e) => e.key === 'Escape' && close(), { once: true });
}
