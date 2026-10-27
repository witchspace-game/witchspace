// The flight log, full screen from the button beside the galaxy map, and the replay player (the death replay
// too): watch, share, keep or delete the clips and photos the ship kept.

import { addMoment, BUDGET, clearUnkept, deleteMoment, listMoments, momentBytes, setSaved, type LoggedMoment } from '../game/flightLog';
import { escapeHtml } from './escape';
import { openShareSheet } from './shareSheet';
import { uprightCut } from './upright';
import { myClips, sharedLink, shareTrack, takeDownClip, type MyClip } from '../net/clips';

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

/** Plays one of your public clips in the game, over the flight log (set by the game). */
let watchClip: ((id: string) => void) | null = null;
export const setWatchClip = (fn: (id: string) => void) => (watchClip = fn);

/** Opens the kill cam on a moment's track (set by the game). */
let outsideView: ((m: LoggedMoment) => void) | null = null;
export const setOutsideView = (fn: (m: LoggedMoment) => void) => (outsideView = fn);

/**
 * Share a moment: the share sheet, with its card (ui/shareSheet.ts). A cockpit
 * clip can be cut upright there (ui/upright.ts); the cut joins the flight log
 * beside the original. Reconstructions are made upright by the kill cam itself.
 */
export function shareMoment(m: LoggedMoment, onChange?: () => void) {
  // One video at a time: an iPhone can be short of decoders, and the share sheet has its own preview.
  document.querySelector<HTMLVideoElement>('#replay video')?.pause();
  const recon = m.tags.includes('reconstruction') || m.tags.includes('upright');
  openShareSheet({
    blob: media(m),
    poster: m.poster ?? undefined,
    title: m.title,
    name: fileName(m),
    // A clip with a track can have a page that replays it (net/clips.ts).
    replay: m.track ? { shared: sharedLink(m.id), put: () => shareTrack(m.id, m.track!, m.seconds) } : undefined,
    upright:
      m.video && !recon
        ? async (onProgress) => {
            const cut = await uprightCut(m.video!, m.title, onProgress);
            if (!cut) return null;
            const when = Date.now();
            const made: LoggedMoment = { ...m, id: `${when}-upright`, created: when, tags: [...m.tags, 'upright'], video: cut.video, poster: cut.poster, seconds: cut.seconds, photo: undefined, track: undefined, saved: false };
            await addMoment(made).catch(() => false);
            onChange?.();
            return { blob: cut.video, poster: cut.poster ?? undefined, title: m.title, name: fileName(made).replace(/\.mp4$/, '-upright.mp4') };
          }
        : undefined,
  });
}

/**
 * The service worker serves stored clips at an address, a piece at a time (public/sw.js): what an
 * iPhone's player needs, since in a Home Screen app it won't play a video from memory (Mark's
 * screenshot: "the player said unsupported"). Registered as the flight log loads; it takes charge
 * at once, so the first clip opened can use it.
 */
if ('serviceWorker' in navigator && location.protocol !== 'file:') void navigator.serviceWorker.register('/sw.js').catch(() => {});
const clipAddress = (id: string) => (navigator.serviceWorker?.controller ? `/flight-log/clip/${encodeURIComponent(id)}` : null);

/** Put a playing video into `holder`: from the service worker's address, or else from memory; a short note there if it can't play. */
async function mountVideo(holder: HTMLElement, clip: Blob, poster: Blob | null, id?: string) {
  const say = (why: string) => {
    const note = holder.querySelector('.replay-loading');
    if (note) note.textContent = `This clip won't play here (${why}). Share or save it to watch it.`;
  };
  const address = id ? clipAddress(id) : null;
  let bytes: ArrayBuffer | null = null;
  if (!address) {
    try {
      bytes = await clip.arrayBuffer();
    } catch (e) {
      return say(`it couldn't be read from this device: ${(e as Error).name || 'error'}`);
    }
  }
  if (!holder.isConnected) return;
  const video = document.createElement('video');
  Object.assign(video, { controls: true, muted: true, playsInline: true, autoplay: true, loop: false });
  video.setAttribute('playsinline', '');
  if (poster) video.poster = replayUrl(poster);
  video.src = address ?? replayUrl(new Blob([bytes!], { type: clip.type || 'video/mp4' }));
  // In as soon as its file is ready, with the still as its poster (a phone may not load it until tapped).
  const note = holder.querySelector('.replay-loading');
  holder.replaceChildren(video, ...(note ? [note] : []));
  if (note) note.textContent = '';
  video.onerror = () => say(`the player said ${['', 'aborted', 'network', 'decode', 'unsupported'][video.error?.code ?? 0] || 'error'}${address ? ', from its address' : ', from memory'}`);
  video.load();
  void video.play().catch(() => {}); // muted autoplay; if the browser holds it, the controls are there
}

/** The replay player over everything: the death replay, or a moment from the log. `note` replaces the line under it. */
export function openReplay(m: LoggedMoment, heading: string, onChange?: () => void, note = 'Only the view is recorded. It stays on this device unless you share it.') {
  const box = $('#replay');
  revoke(replayUrls);
  const kept = () => (m.saved ? 'Kept' : 'Keep');
  box.innerHTML = `<div class="replay-card" role="dialog" aria-modal="true" aria-label="${escapeHtml(heading)}">
    <p class="replay-heading">${escapeHtml(heading)}</p>
    ${m.video ? `<div class="replay-video">${m.poster ? `<img src="${replayUrl(m.poster)}" alt="" />` : ''}<p class="replay-loading">Loading the clip&hellip;</p></div>` : `<img src="${replayUrl(media(m))}" alt="${escapeHtml(m.title)}" />`}
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
  // iPhone Safari won't play a video straight from the flight log's database
  // (it reads it a range at a time, and a stored blob can't serve ranges), but
  // the same file plays once it's copied into memory: so copy it first. The
  // player goes in only once its file is ready, with the still showing till
  // then: an empty player on an iPhone shows "can't play" and may stay that
  // way (Mark's screenshots). If it fails, say why, so it can be fixed.
  const holder = box.querySelector<HTMLElement>('.replay-video');
  if (holder && m.video) void mountVideo(holder, m.video, m.poster, m.id);
  const close = () => {
    box.hidden = true;
    box.innerHTML = '';
    revoke(replayUrls);
  };
  box.querySelector<HTMLButtonElement>('[data-act="share"]')!.onclick = () => shareMoment(m, onChange);
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

/**
 * Your clips on witchspace.org.uk, at the top of the flight log, and a mark on each moment that's up
 * (Mark: "I don't know how to take down my own clips. I don't even know where my clips are?"). From
 * the server, so a clip shared from another device signed in as you shows too. Take it down: gone
 * from its page and the live feed; Put it back undoes that.
 */
async function showPublic(el: HTMLElement, moments: LoggedMoment[]) {
  const box = el.querySelector<HTMLElement>('.log-public');
  if (!box) return;
  const clips = await myClips();
  if (!box.isConnected || !clips?.length) return;
  const up = clips.filter((c) => c.up);
  const row = (c: MyClip) => `<li data-clip="${c.id}" class="${c.up ? '' : 'down'}">
      <a href="${escapeHtml(c.url)}" target="_blank" rel="noopener">${escapeHtml(c.title.replace(/^CMDR [^:]+: /, ''))}</a>
      <small>${c.up ? `♥ ${c.hearts} · ${new Date(c.created).toLocaleDateString()}` : 'Taken down'}</small>
      <button type="button" data-${c.up ? 'down' : 'up'}="${c.id}">${c.up ? 'Take it down' : 'Put it back'}</button>
    </li>`;
  box.innerHTML = `<h3>Your clips on witchspace.org.uk <small>${up.length} up · anyone with the link can watch them</small></h3><ul>${clips.map(row).join('')}</ul>`;
  box.hidden = false;
  // The moments here that are up get a mark: public, with their hearts.
  const byUrl = new Map(up.map((c) => [c.url, c]));
  for (const m of moments) {
    const link = sharedLink(m.id);
    const c = link ? byUrl.get(link) : undefined;
    const strong = c && el.querySelector(`li[data-id="${m.id}"] strong`);
    if (strong && !strong.querySelector('.log-public-mark')) strong.insertAdjacentHTML('beforeend', ` <em class="log-public-mark" title="${escapeHtml(c.url)}">Public · ♥ ${c.hearts}</em>`);
  }
  box.onclick = async (e) => {
    // A clip's link plays it here, over the flight log, and closing comes back to it: opening the page itself
    // reloaded the game at the title screen in the Home Screen app (Mark). Long-press still copies the link.
    const link = (e.target as HTMLElement).closest<HTMLAnchorElement>('li[data-clip] a');
    if (link && watchClip) {
      e.preventDefault();
      watchClip(link.closest<HTMLElement>('li[data-clip]')!.dataset.clip!);
      return;
    }
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-down], button[data-up]');
    if (!b) return;
    const down = Boolean(b.dataset.down);
    if (down && !b.dataset.armed) {
      b.dataset.armed = '1';
      b.textContent = 'Take it down? Press again';
      return;
    }
    b.disabled = true;
    const r = await takeDownClip((b.dataset.down ?? b.dataset.up)!, down);
    if ('error' in r) {
      b.disabled = false;
      b.textContent = r.error;
      return;
    }
    for (const mark of el.querySelectorAll('.log-public-mark')) mark.remove();
    void showPublic(el, moments);
  };
}

/** The flight log, its own tab when docked. */
export async function renderFlightLog(opts: {
  available: boolean;
  unavailable: string;
  enabled: boolean;
  intro: boolean;
  onToggle: (on?: boolean) => void;
  /** Recording in HD, or stepped down to SD (and whether HD can be tried again). */
  quality?: { hd: boolean; canRetry: boolean; retry: () => void };
}) {
  const el = $('#flight-log');
  revoke(logUrls);
  const moments = await listMoments();
  const toggle = opts.available ? `<button type="button" class="log-toggle" aria-pressed="${opts.enabled}">Flight recorder: ${opts.enabled ? 'on' : 'off'}</button>` : '';
  const q = opts.available && opts.enabled ? opts.quality : undefined;
  const quality = q
    ? q.hd
      ? '<span class="log-quality">Recording in HD (720p)</span>'
      : `<span class="log-quality">Recording at 480p: in HD the game was slowing down on this device.${q.canRetry ? ' <button type="button" class="log-hd">Try HD again</button>' : ''}</span>`
    : '';
  const how = 'Your ship keeps the last minute of flight in memory and saves only the moments worth keeping: a fight, a Legend, the Marshals, a discovery and your last moments. Shift+P (or holding the camera button) keeps the last 30 seconds yourself; P takes a photo.';
  let head: string;
  if (!opts.available) head = `<p class="meta">${escapeHtml(opts.unavailable)} Photos (P) still come here.</p>`;
  else if (opts.intro)
    head = `<div class="log-intro"><p><strong>Your flight recorder</strong> ${how} Everything stays on this device (up to ${megabytes(BUDGET)}) unless you share it, and what you don't Keep clears after a week.</p>
      <p class="log-intro-actions"><button type="button" class="primary" data-intro="on">Keep it on</button><button type="button" data-intro="off">Turn it off</button></p></div>`;
  else if (!moments.length) head = `<p class="meta">${opts.enabled ? how : 'The flight recorder is off. Photos (P) still come here.'} ${toggle} ${quality}</p>`;
  else head = '';
  if (moments.length) {
    const used = moments.reduce((n, m) => n + momentBytes(m), 0);
    const unkept = moments.some((m) => !m.saved);
    head += `<p class="meta">${moments.length} ${moments.length === 1 ? 'moment' : 'moments'} · ${megabytes(used)} of ${megabytes(BUDGET)} on this device · what you don't Keep clears after a week. ${opts.intro ? '' : toggle} ${unkept ? '<button type="button" class="log-clear">Clear unkept</button>' : ''} ${quality}</p>
      <ul class="log-list">${moments
        .map(
          (m) => `<li data-id="${m.id}">
          <button type="button" class="log-play" aria-label="${m.video ? 'Watch' : 'View'} ${escapeHtml(m.title)}"><img src="${url(m.poster ?? media(m))}" alt="" /><span>${m.video ? `${Math.round(m.seconds)} s${m.tags.includes('upright') ? ' · upright' : ''}` : 'Photo'}</span></button>
          <div><strong>${escapeHtml(m.title.replace(/^CMDR [^:]+: /, ''))}</strong><small>${escapeHtml(m.events.map((e) => e.text).join(' · '))}</small>
          <span class="log-actions">${m.track && outsideView ? '<button type="button" data-act="outside">From outside</button>' : ''}<button type="button" data-act="share">Share</button><button type="button" data-act="keep" aria-pressed="${m.saved}">${m.saved ? 'Kept' : 'Keep'}</button><button type="button" data-act="delete">Delete</button></span></div>
        </li>`,
        )
        .join('')}</ul>`;
  }
  el.innerHTML = `<section class="log-public" hidden aria-live="polite"></section>${head}`;
  void showPublic(el, moments);
  el.querySelector<HTMLButtonElement>('.log-toggle')?.addEventListener('click', () => opts.onToggle());
  el.querySelector<HTMLButtonElement>('.log-hd')?.addEventListener('click', () => {
    q?.retry();
    void renderFlightLog(opts);
  });
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
    li.querySelector<HTMLButtonElement>('[data-act="share"]')!.onclick = () => shareMoment(m, refresh);
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
