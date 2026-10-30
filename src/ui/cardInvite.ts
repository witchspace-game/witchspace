// The invitation to make your callsign card (Website's /callsign/, Mark's yes): once only, for a
// commander who isn't signed in, at a moment worth it (the first docking, kill or survey) rather than
// as an exit pop-up, since phones give no warning before leaving. Always docked, never mid-flight.

import { escapeHtml } from './escape';

export type CardCareer = 'trade' | 'fight' | 'explore';

const WHO: Record<CardCareer, string> = { trade: 'trader', fight: 'fighter', explore: 'explorer' };

/** The card page, ready-made from this commander: same tab, so a Home Screen game stays in the app. */
export const cardLink = (name: string, career: CardCareer) => `/callsign/?name=${encodeURIComponent(name)}&career=${career}&from=game`;

export function showCardInvite(name: string, career: CardCareer) {
  document.querySelector('#card-invite')?.remove();
  const el = document.createElement('section');
  el.id = 'card-invite';
  el.className = 'panel card-invite';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-label', 'Make your callsign card');
  el.innerHTML = `<h2>Every ${WHO[career]} needs a callsign.</h2>
    <p class="meta">Make your card: your ship, your callsign, ready to share.</p>
    <p class="card-invite-actions"><a class="button primary" href="${escapeHtml(cardLink(name, career))}">Make your card</a> <button type="button" class="card-invite-later">Not now</button></p>`;
  el.querySelector<HTMLButtonElement>('.card-invite-later')!.onclick = () => el.remove();
  document.body.append(el);
}

export const hideCardInvite = () => document.querySelector('#card-invite')?.remove();
