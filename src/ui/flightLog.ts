// The flight log in the station tab, and the replay player (the death replay
// too): watch, share, keep or delete what the flight recorder kept.

import { deleteMoment, listMoments, MAX, setSaved, type LoggedMoment } from '../game/flightLog';
import { escapeHtml } from './escape';

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
const urls: string[] = [];
const url = (b: Blob) => {
  const u = URL.createObjectURL(b);
  urls.push(u);
  return u;
};

const fileName = (m: LoggedMoment) => `witchspace-${m.system.toLowerCase()}-${new Date(m.created).toISOString().slice(0, 16).replace(/[-:T]/g, '')}.mp4`;

/** Share a moment's clip: the share sheet where there is one (phones), otherwise download it. */
export async function shareMoment(m: LoggedMoment): Promise<string> {
  const file = new File([m.video], fileName(m), { type: 'video/mp4' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: m.title, text: `${m.title} · Witchspace, free in your browser: https://witchspace.org.uk/play` });
      return 'Shared';
    } catch {
      /* dismissed: fall back to saving */
    }
  }
  const a = document.createElement('a');
  a.href = url(m.video);
  a.download = fileName(m);
  a.click();
  return 'Saved to your downloads';
}

/** The replay player over everything: the death replay, or a moment from the log. */
export function openReplay(m: LoggedMoment, heading: string, onChange?: () => void) {
  const box = $('#replay');
  const kept = () => (m.saved ? 'Kept' : 'Keep');
  box.innerHTML = `<div class="replay-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(heading)}">
    <p class="replay-heading">${escapeHtml(heading)}</p>
    <video src="${url(m.video)}" ${m.poster ? `poster="${url(m.poster)}"` : ''} controls autoplay playsinline muted></video>
    <h3>${escapeHtml(m.title)}</h3>
    <p class="replay-meta">${m.events.map((e) => escapeHtml(e.text)).join(' · ')}</p>
    <div class="replay-actions">
      <button type="button" class="primary" data-act="share">Share</button>
      <button type="button" data-act="keep" aria-pressed="${m.saved}">${kept()}</button>
      <button type="button" data-act="close">Close</button>
    </div>
    <p class="replay-note">Only the view is recorded. It stays on this device unless you share it.</p>
  </div>`;
  box.hidden = false;
  const close = () => {
    box.hidden = true;
    box.innerHTML = '';
  };
  box.querySelector<HTMLButtonElement>('[data-act="share"]')!.onclick = async (e) => {
    (e.target as HTMLButtonElement).textContent = await shareMoment(m);
  };
  box.querySelector<HTMLButtonElement>('[data-act="keep"]')!.onclick = async (e) => {
    m.saved = !m.saved;
    await setSaved(m.id, m.saved);
    (e.target as HTMLButtonElement).textContent = kept();
    (e.target as HTMLButtonElement).setAttribute('aria-pressed', String(m.saved));
    onChange?.();
  };
  box.querySelector<HTMLButtonElement>('[data-act="close"]')!.onclick = close;
  box.onclick = (e) => e.target === box && close();
}

export const isReplayOpen = () => !$('#replay').hidden;
export function closeReplay() {
  const box = $('#replay');
  box.hidden = true;
  box.innerHTML = '';
}

/** The flight log, in the station tab. */
export async function renderFlightLog(opts: { available: boolean; enabled: boolean; onToggle: () => void }) {
  const el = $('#flight-log');
  while (urls.length) URL.revokeObjectURL(urls.pop()!);
  if (!opts.available) {
    el.innerHTML = `<p class="meta">This browser can't record video, so there's no flight recorder here. Photos (P) still work.</p>`;
    return;
  }
  const moments = await listMoments();
  const toggle = `<button type="button" class="log-toggle" aria-pressed="${opts.enabled}">Flight recorder: ${opts.enabled ? 'on' : 'off'}</button>`;
  if (!moments.length) {
    el.innerHTML = `<p class="meta">${opts.enabled ? 'Your ship keeps the last 30 seconds of flight. Kills, Legends, the Marshals, discoveries and your last moments are kept here by themselves; press Shift+P (or hold the camera button) to keep one yourself.' : 'The flight recorder is off.'} ${toggle}</p>`;
  } else {
    el.innerHTML = `<p class="meta">${moments.length} of ${MAX} · kept on this device · the oldest unkept moment makes room for new ones. ${toggle}</p>
      <ul class="log-list">${moments
        .map(
          (m) => `<li data-id="${m.id}">
          <button type="button" class="log-play" aria-label="Watch ${escapeHtml(m.title)}">${m.poster ? `<img src="${url(m.poster)}" alt="" />` : ''}<span>${Math.round(m.seconds)} s</span></button>
          <div><strong>${escapeHtml(m.title.replace(/^CMDR [^:]+: /, ''))}</strong><small>${escapeHtml(m.events.map((e) => e.text).join(' · '))}</small>
          <span class="log-actions"><button type="button" data-act="share">Share</button><button type="button" data-act="keep" aria-pressed="${m.saved}">${m.saved ? 'Kept' : 'Keep'}</button><button type="button" data-act="delete">Delete</button></span></div>
        </li>`,
        )
        .join('')}</ul>`;
  }
  el.querySelector<HTMLButtonElement>('.log-toggle')!.onclick = opts.onToggle;
  for (const li of el.querySelectorAll<HTMLLIElement>('li[data-id]')) {
    const m = moments.find((x) => x.id === li.dataset.id)!;
    const refresh = () => void renderFlightLog(opts);
    li.querySelector<HTMLButtonElement>('.log-play')!.onclick = () => openReplay(m, 'From the flight log', refresh);
    li.querySelector<HTMLButtonElement>('[data-act="share"]')!.onclick = async (e) => {
      (e.target as HTMLButtonElement).textContent = await shareMoment(m);
    };
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
