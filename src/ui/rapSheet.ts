// Your record (an idea from a player on the ideas board, "Rap sheet": "a way to see what I did to get
// Fugitive status", a Viper hit by mistake, ideally with the clip). Where you stand now, system by
// system, and the offences on file, each with the flight recorder's moment of it while that's here.

import { COOL_JUMPS, RAP_SHEET } from '../game/law';
import type { Commander } from '../game/commander';
import { listMoments } from '../game/flightLog';
import { systemAt } from '../galaxy/generate';
import { escapeHtml } from './escape';
import { openReplay } from './flightLog';

const STATUS = { offender: 'Offender', fugitive: 'Fugitive' } as const;

const when = (t: number) => {
  const d = new Date(t);
  const today = new Date().toDateString() === d.toDateString();
  return `${today ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}, ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
};

/** Whether there's anything to show: a record somewhere, a warrant, or offences on file. */
export const hasRecord = (c: Commander) => Boolean(c.warrant || Object.keys(c.records).length || c.rapSheet?.length);

export async function openRapSheet(c: Commander) {
  document.querySelector('.rap-sheet')?.remove();
  const onDevice = new Map((await listMoments()).map((m) => [m.id, m]));
  const standing = Object.entries(c.records).flatMap(([key, r]) => {
    if (r.status === 'clean') return [];
    const [g, i] = key.split(':').map(Number);
    const left = COOL_JUMPS[r.status] - r.jumps;
    const next = r.status === 'fugitive' ? 'Offender' : 'clean';
    return `<li><div><b>${escapeHtml(systemAt(g, i).name)}</b> · <span class="rap-made ${r.status}">${STATUS[r.status]}</span></div><span>${left} jump${left === 1 ? '' : 's'} away and it cools to ${next}</span></li>`;
  });
  if (c.warrant) standing.unshift('<li class="rap-warrant"><b>Co-operative Marshals warrant</b><span>Wanted in every system with a government, until you settle at a station or surrender</span></li>');
  const offences = [...(c.rapSheet ?? [])].reverse();
  const el = document.createElement('div');
  el.className = 'moment-more rap-sheet';
  el.innerHTML = `<div class="moment-more-sheet" role="dialog" aria-modal="true" aria-label="Your record">
      <h3>Your record</h3>
      ${standing.length ? `<ul class="rap-now">${standing.join('')}</ul><p class="rap-note">Settle at a station there for a clean record, or surrender to the police.</p>` : '<p class="rap-note">Clean everywhere.</p>'}
      <h4>On file</h4>
      ${
        offences.length
          ? `<ul class="rap-list">${offences
              .map(
                (o, n) => `<li>
          <span class="rap-when">${when(o.t)} · ${escapeHtml(systemAt(o.galaxy, o.system).name)}</span>
          <b>${escapeHtml(o.what)}</b>
          <span class="rap-made ${o.made}">${STATUS[o.made]}${o.warrant ? ' · Marshals warrant' : ''}</span>
          ${o.moment && onDevice.has(o.moment) ? `<button type="button" data-watch="${n}">Watch</button>` : ''}
        </li>`,
              )
              .join('')}</ul>`
          : '<p class="rap-note">Nothing on file.</p>'
      }
      <p class="rap-note">Your last ${RAP_SHEET} offences are kept. A clip stays while it's in your flight log.</p>
      <button type="button" class="moment-more-close">Close</button>
    </div>`;
  document.body.append(el);
  const close = () => el.remove();
  el.addEventListener('pointerdown', (e) => e.target === el && close());
  el.querySelector<HTMLButtonElement>('.moment-more-close')!.onclick = close;
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-watch]')) {
    b.onclick = () => {
      const m = onDevice.get(offences[Number(b.dataset.watch)].moment!);
      if (!m) return;
      close();
      openReplay(m, 'Your record');
    };
  }
}
