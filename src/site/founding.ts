import { LAUNCH } from './callsignWords';

// One thin line across the site until launch: callsigns claimed before 3 November 2026, 14:00 UK, are founding
// members' (docs/design/callsign-card.md). It's true, and it ends: after LAUNCH it never shows. Dismissed once,
// it stays dismissed. Not on the callsign page itself, which says it already.

const strip = document.getElementById('founding-strip');
const KEY = 'witchspace.founding-strip.dismissed';
const dismissed = () => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};
if (strip && Date.now() < LAUNCH && !location.pathname.startsWith('/callsign') && !dismissed()) {
  strip.hidden = false;
  // Its height, for the home page, where the header floats over the hero just below it (one line or two).
  const measure = () => document.body.style.setProperty('--strip', `${strip.offsetHeight}px`);
  measure();
  addEventListener('resize', measure);
  strip.querySelector('.founding-close')?.addEventListener('click', () => {
    strip.hidden = true;
    try {
      localStorage.setItem(KEY, '1');
    } catch {
      // Storage blocked: it comes back on the next page, and goes at launch anyway.
    }
  });
}
