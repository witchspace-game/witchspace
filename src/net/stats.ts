// Anonymous totals, to tell how Witchspace is played: once a day, which
// rules this device's commander uses, which look is on, and whether it's a
// phone, tablet or computer; and a count of new commanders by rules. Nothing
// identifies the player (see /privacy/).

import { API } from './account';

const KEY = 'witchspace.statsDay';

type Rules = 'modern' | 'classic' | 'none';
type Look = 'neo' | '1984';

function send(body: Record<string, string>) {
  void fetch(`${API}/stats/ping`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true }).catch(() => {});
}

/** Phone, tablet or computer, by the screen and its pointer: an iPad's Safari calls itself a Mac. */
export function deviceKind(): 'phone' | 'tablet' | 'desktop' {
  const touch = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  if (!touch || matchMedia('(pointer: fine)').matches) return 'desktop';
  return Math.min(screen.width, screen.height) < 600 ? 'phone' : 'tablet';
}

/** At most once a day per device. */
export function countDevice(rules: Rules, look: Look) {
  const today = new Date().toISOString().slice(0, 10);
  try {
    if (localStorage.getItem(KEY) === today) return;
    localStorage.setItem(KEY, today);
  } catch {
    // Storage blocked: the server counts each network once a day anyway.
  }
  send({ rules, look, device: deviceKind() });
}

/** A new commander, by rules. */
export const countNewCommander = (rules: Rules, look: Look) => send({ rules, look, event: 'new' });
