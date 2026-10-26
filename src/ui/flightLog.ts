// The flight log in its own station tab, and the replay player (the death replay
// too): watch, share, keep or delete the clips and photos the ship kept.

import { BUDGET, clearUnkept, deleteMoment, listMoments, momentBytes, setSaved, type LoggedMoment } from '../game/flightLog';
import { escapeHtml } from './escape';
import { openShareSheet } from './shareSheet';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
// Object URLs for the flight log's list, and separately for the replay player:
// redrawing the list must never revoke a video the player is still loading
// (Safari loads a little at a time, so a revoked URL stops it dead).
const logUrls: string[] = [];
const replayUrls: string[] = [];
const urlIn = (pool: string[]) => (b: Blob) => {
  const u = URL.createObjectURL(b);
  pool.push(u);
  return u;
};
const url = urlIn(logUrls);
const replayUrl = urlIn(replayUrls);
const revoke = (pool: string[]) => {
  while (pool.length) URL.revokeObjectURL(pool.pop()!);
};

const media = (m: LoggedMoment) => (m.video ?? m.photo)!;
const extension = (b: Blob) => ({ 'video/mp4': 'mp4', 'image/png': 'png' })[b.type] ?? 'jpg';
const fileName = (m: LoggedMoment) => `witchspace-${m.system.toLowerCase()}-${new Date(m.created).toISOString().slice(0, 16).replace(/[-:T]/g, '')}.${extension(media(m))}`;
const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1048576))} MB`;

/** Opens the kill cam on a moment's track (set by the game). */
let outsideView: ((m: LoggedMoment) => void) | null = null;
export const setOutsideView = (fn: (m: LoggedMoment) => void) => (outsideView = fn);

/** Share a moment: the share sheet, with its card (ui/shareSheet.ts). */
export const shareMoment = (m: LoggedMoment) => openShareSheet({ blob: media(m), poster: m.poster ?? undefined, title: m.title, name: fileName(m) });

/** The replay player over everything: the death replay, or a moment from the log. `note` replaces the line under it. */
export function openReplay(m: LoggedMoment, heading: string, onChange?: () => void, note = 'Only the view is recorded. It stays on this device unless you share it.') {
  const box = $('#replay');
  revoke(replayUrls);
  const kept = () => (m.saved ? 'Kept' : 'Keep');
  box.innerHTML = `<div class="replay-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(heading)}">
    <p class="replay-heading">${escapeHtml(heading)}</p>
    ${m.video ? `<video src="${replayUrl(m.video)}" ${m.poster ? `poster="${replayUrl(m.poster)}"` : ''} controls autoplay playsinline muted></video>` : `<img src="${replayUrl(media(m))}" alt="${escapeHtml(m.title)}" />`}
    <h3>${escapeHtml(m.title)}</h3>
    <p class="replay-meta">${m.events.map((e) => escapeHtml(e.text)).join(' · ')}</p>
    <div class="replay-actions">
      ${m.track && outsideView ? '<button type="button" class="primary" data-act="outside">Watch it from outside</button>' : ''}
      <button type="button"${m.track ? '' : ' class="primary"'} data-act="share">Share</button>
      <button type="button" data-act="keep" aria-pressed="${m.saved}">${kept()}</button>
      <button type="button" data-act="close">Close</button>
    </div>
    <p class="replay-note">${escapeHtml(note)}</p>
  </div>`;
  box.hidden = false;
  const close = () => {
    box.hidden = true;
    box.innerHTML = '';
    revoke(replayUrls);
  };
  box.querySelector<HTMLButtonElement>('[data-act="share"]')!.onclick = () => shareMoment(m);
  box.querySelector<HTMLButtonElement>('[data-act="keep"]')!.onclick = async (e) => {
    m.saved = !m.saved;
    await setSaved(m.id, m.saved);
    (e.target as HTMLButtonElement).textContent = kept();
    (e.target as HTMLButtonElement).setAttribute('aria-pressed', String(m.saved));
    onChange?.();
  };
  box.querySelector<HTMLButtonElement>('[data-act="close"]')!.onclick = close;
  const outside = box.querySelector<HTMLButtonElement>('[data-act="outside"]');
  if (outside) outside.onclick = () => outsideView?.(m);
  box.onclick = (e) => e.target === box && close();
}

export const isReplayOpen = () => !$('#replay').hidden;
export function closeReplay() {
  const box = $('#replay');
  box.hidden = true;
  box.innerHTML = '';
  revoke(replayUrls);
}

/** The flight log, its own tab when docked. */
export async function renderFlightLog(opts: { available: boolean; unavailable: string; enabled: boolean; intro: boolean; onToggle: (on?: boolean) => void }) {
  const el = $('#flight-log');
  revoke(logUrls);
  const moments = await listMoments();
  const toggle = opts.available ? `<button type="button" class="log-toggle" aria-pressed="${opts.enabled}">Flight recorder: ${opts.enabled ? 'on' : 'off'}</button>` : '';
  const how = 'Your ship keeps the last minute of flight in memory and saves only the moments worth keeping: a fight, a Legend, the Marshals, a discovery and your last moments. Shift+P (or holding the camera button) keeps the last 30 seconds yourself; P takes a photo.';
  let head: string;
  if (!opts.available) head = `<p class="meta">${escapeHtml(opts.unavailable)} Photos (P) still come here.</p>`;
  else if (opts.intro)
    head = `<div class="log-intro"><p><strong>Your flight recorder</strong> ${how} Everything stays on this device (up to ${megabytes(BUDGET)}) unless you share it, and what you don't Keep clears after a week.</p>
      <p class="log-intro-actions"><button type="button" class="primary" data-intro="on">Keep it on</button><button type="button" data-intro="off">Turn it off</button></p></div>`;
  else if (!moments.length) head = `<p class="meta">${opts.enabled ? how : 'The flight recorder is off. Photos (P) still come here.'} ${toggle}</p>`;
  else head = '';
  if (moments.length) {
    const used = moments.reduce((n, m) => n + momentBytes(m), 0);
    const unkept = moments.some((m) => !m.saved);
    head += `<p class="meta">${moments.length} ${moments.length === 1 ? 'moment' : 'moments'} · ${megabytes(used)} of ${megabytes(BUDGET)} on this device · what you don't Keep clears after a week. ${opts.intro ? '' : toggle} ${unkept ? '<button type="button" class="log-clear">Clear unkept</button>' : ''}</p>
      <ul class="log-list">${moments
        .map(
          (m) => `<li data-id="${m.id}">
          <button type="button" class="log-play" aria-label="${m.video ? 'Watch' : 'View'} ${escapeHtml(m.title)}"><img src="${url(m.poster ?? media(m))}" alt="" /><span>${m.video ? `${Math.round(m.seconds)} s` : 'Photo'}</span></button>
          <div><strong>${escapeHtml(m.title.replace(/^CMDR [^:]+: /, ''))}</strong><small>${escapeHtml(m.events.map((e) => e.text).join(' · '))}</small>
          <span class="log-actions">${m.track && outsideView ? '<button type="button" data-act="outside">From outside</button>' : ''}<button type="button" data-act="share">Share</button><button type="button" data-act="keep" aria-pressed="${m.saved}">${m.saved ? 'Kept' : 'Keep'}</button><button type="button" data-act="delete">Delete</button></span></div>
        </li>`,
        )
        .join('')}</ul>`;
  }
  el.innerHTML = head;
  el.querySelector<HTMLButtonElement>('.log-toggle')?.addEventListener('click', () => opts.onToggle());
  for (const b of el.querySelectorAll<HTMLButtonElement>('[data-intro]')) b.onclick = () => opts.onToggle(b.dataset.intro === 'on');
  const clear = el.querySelector<HTMLButtonElement>('.log-clear');
  if (clear)
    clear.onclick = async () => {
      if (!clear.dataset.armed) {
        clear.dataset.armed = '1';
        clear.textContent = 'Clear every unkept moment?';
        return;
      }
      await clearUnkept();
      void renderFlightLog(opts);
    };
  for (const li of el.querySelectorAll<HTMLLIElement>('li[data-id]')) {
    const m = moments.find((x) => x.id === li.dataset.id)!;
    const refresh = () => void renderFlightLog(opts);
    li.querySelector<HTMLButtonElement>('.log-play')!.onclick = () => openReplay(m, 'From the flight log', refresh, m.photo ? 'Taken with your ship camera. It stays on this device unless you share it.' : undefined);
    const outside = li.querySelector<HTMLButtonElement>('[data-act="outside"]');
    if (outside) outside.onclick = () => outsideView?.(m);
    li.querySelector<HTMLButtonElement>('[data-act="share"]')!.onclick = () => shareMoment(m);
    li.querySelector<HTMLButtonElement>('[data-act="keep"]')!.onclick = async () => {
      await setSaved(m.id, !m.saved);
      refresh();
    };
    li.querySelector<HTMLButtonElement>('[data-act="delete"]')!.onclick = async (e) => {
      const b = e.target as HTMLButtonElement;
      if (b.dataset.armed) {
        await deleteMoment(m.id);
        refresh();
      } else {
        b.dataset.armed = '1';
        b.textContent = 'Delete?';
      }
    };
  }
}
