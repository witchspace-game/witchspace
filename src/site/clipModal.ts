import { getClip, heartClip } from '../net/clips';
import { escapeHtml } from '../ui/escape';
import { inviteLine } from '../ui/clipView';

// The home page's "Latest flight": the clip plays over the page, not on a page of its own (Mark: "It opens
// the full page to watch the clip. I was expecting it to open a modal window"). The link stays /clip/<id>, so
// it works without the script and is the one people copy; a clip with no video (older ones) still goes there,
// where the game rebuilds the flight.

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';
const CLOSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

async function open(id: string, href: string) {
  const clip = await getClip(id);
  if (!clip?.video) {
    location.href = href;
    return;
  }
  const back = document.activeElement as HTMLElement | null;
  const el = document.createElement('div');
  el.className = 'clip-modal';
  el.innerHTML = `<div class="clip-box${clip.video.upright ? ' upright' : ''}" role="dialog" aria-modal="true" aria-label="${escapeHtml(clip.title)}" tabindex="-1">
      <button type="button" class="clip-close" aria-label="Close">${CLOSE}</button>
      <video src="${escapeHtml(clip.video.url)}" playsinline muted autoplay controls preload="metadata"></video>
      <div class="clip-foot">
        <p class="clip-title">${escapeHtml(clip.title)}</p>
        <div class="clip-actions">
          <button type="button" class="button ghost small clip-heart" aria-pressed="${clip.mine}">${HEART}<span>${clip.hearts}</span></button>
          <a class="button ghost small" href="${escapeHtml(href)}">Watch it from outside</a>
          <a class="button primary small" href="/play/">Play Witchspace free</a>
        </div>
        <p class="clip-invite" hidden></p>
      </div>
    </div>`;
  document.body.append(el);
  document.documentElement.classList.add('clip-open');
  const box = el.querySelector<HTMLElement>('.clip-box')!;
  const video = el.querySelector('video')!;
  // Its shape from the film itself: the upright flag says how it was cut, not always how it came out.
  video.addEventListener('loadedmetadata', () => box.classList.toggle('upright', video.videoHeight > video.videoWidth));
  requestAnimationFrame(() => el.classList.add('shown'));
  box.focus();

  const close = () => {
    video.pause();
    el.remove();
    document.documentElement.classList.remove('clip-open');
    removeEventListener('keydown', onKey);
    back?.focus();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
  addEventListener('keydown', onKey);
  el.addEventListener('click', (e) => {
    if (e.target === el) close();
  });
  el.querySelector('.clip-close')!.addEventListener('click', close);

  // At the end, who flew it, and a callsign of your own.
  const by = (clip as { by?: { callsign: string; career: string | null } | null }).by;
  if (by) video.addEventListener('ended', () => {
    const line = el.querySelector<HTMLElement>('.clip-invite')!;
    line.innerHTML = inviteLine(by);
    line.hidden = false;
  });

  const heart = el.querySelector<HTMLButtonElement>('.clip-heart')!;
  heart.addEventListener('click', async () => {
    const on = heart.getAttribute('aria-pressed') !== 'true';
    const r = await heartClip(id, on);
    if (!r) return;
    heart.setAttribute('aria-pressed', String(r.mine));
    heart.querySelector('span')!.textContent = String(r.hearts);
  });
}

/** Clip links in this part of the page open the player over it. */
export function clipModal(root: HTMLElement) {
  root.addEventListener('click', (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; // a new tab is still a new tab
    const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="/clip/"]');
    const id = a?.getAttribute('href')!.match(/^\/clip\/([a-z0-9]{8,12})\/?$/)?.[1];
    if (!a || !id) return;
    e.preventDefault();
    void open(id, a.getAttribute('href')!);
  });
}
