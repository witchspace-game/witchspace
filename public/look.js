// Paper by day, space by night (Mark, 1 Nov 2026): the page is paper when the phone or computer is in light
// mode, and space in dark mode. ?look=paper or ?look=space chooses for the visit (?look=auto undoes it).
// Loaded first and blocking, so the choice is made before anything is drawn. A file of its own, not inline:
// the site's Content-Security-Policy (vercel.json) allows only scripts from our own domain.
try {
  const look = new URLSearchParams(location.search).get('look');
  if (look) sessionStorage.setItem('witchspace.look', look);
  const chosen = sessionStorage.getItem('witchspace.look');
  const dark = matchMedia('(prefers-color-scheme: dark)');
  const set = () => document.documentElement.classList.toggle('paper', chosen === 'paper' || (chosen !== 'space' && !dark.matches));
  set();
  dark.addEventListener('change', set);
} catch {}
