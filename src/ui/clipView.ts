// A shared clip's page, video first (Mark: "it took me to the reconstruction page"): the video
// its sharer chose to share (their cockpit clip, an upright cut or a reconstruction they filmed)
// plays first, with its title, hearts and a way to play; "Watch it from outside" then opens the
// kill cam on the flight track, rebuilt from the numbers (ui/killCam.ts).

import { escapeHtml } from './escape';
import { careerById, careerLine, LAUNCH } from '../site/callsignWords';

const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7 4.5c2 0 3.5 1.1 5 3 1.5-1.9 3-3 5-3 3.4 0 5.6 3.4 4.3 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

export interface ClipView {
  title: string;
  video: { url: string; upright: boolean };
  hearts: number;
  mine: boolean;
  heart: (on: boolean) => Promise<{ hearts: number; mine: boolean } | null>;
  report: () => Promise<boolean>;
  /** Open the kill cam on the track. */
  outside: () => void;
  /** Gone: back to the game's title (a visitor) or the flight log (yours). */
  closed: () => void;
  /** Who flew it, for a visitor who isn't signed in: a quiet invitation once it has played. */
  invite?: { callsign: string; career: string | null } | null;
}

/**
 * After a shared clip, for a visitor not signed in (Marketing, 1 November 2026: a friend sent them
 * something, and a clip ended with nothing): who flew it, and a way to a callsign of their own. One quiet
 * line under the video once it has played; never over it, never a box to close.
 */
export function inviteLine(by: { callsign: string; career: string | null }, now = Date.now()): string {
  const career = by.career ? careerById(by.career) : null;
  const href = `/callsign/?${career ? `career=${encodeURIComponent(career.id)}&` : ''}from=clip`;
  return `CMDR ${escapeHtml(by.callsign)} flew this. ${career ? careerLine(career) : 'Every pilot needs a callsign.'} <a href="${href}">${now < LAUNCH ? 'Founding members until launch: claim yours' : 'Claim yours'} →</a>`;
}

export function showClipView(c: ClipView) {
  document.querySelector('#clip-view')?.remove();
  const el = document.createElement('section');
  el.id = 'clip-view';
  el.className = c.video.upright ? 'upright' : '';
  el.setAttribute('aria-label', c.title);
  el.innerHTML = `<header class="cv-head">
      <p class="cv-title">${escapeHtml(c.title)}</p>
      <button type="button" class="cv-close" aria-label="Close">✕</button>
    </header>
    <video class="cv-video" src="${escapeHtml(c.video.url)}" controls playsinline autoplay muted preload="auto"></video>
    <p class="cv-invite" hidden></p>
    <div class="cv-actions">
      <button type="button" class="primary cv-play">Play Witchspace free</button>
      <button type="button" class="cv-outside">Watch it from outside</button>
      <button type="button" class="cv-heart" aria-pressed="${c.mine}" aria-label="Heart this clip">${HEART}<b>${c.hearts}</b></button>
      <button type="button" class="cv-report">Report</button>
    </div>`;
  document.body.append(el);
  const video = el.querySelector<HTMLVideoElement>('.cv-video')!;
  if (c.invite)
    video.addEventListener(
      'ended',
      () => {
        const p = el.querySelector<HTMLElement>('.cv-invite')!;
        p.innerHTML = inviteLine(c.invite!);
        p.hidden = false;
      },
      { once: true },
    );
  // It starts muted (browsers only autoplay that way); the first tap anywhere brings the sound up.
  el.addEventListener('pointerdown', () => (video.muted = false), { once: true });
  const close = () => {
    video.pause();
    el.remove();
  };
  el.querySelector<HTMLButtonElement>('.cv-close')!.onclick = () => {
    close();
    c.closed();
  };
  el.querySelector<HTMLButtonElement>('.cv-play')!.onclick = () => {
    close();
    c.closed();
  };
  el.querySelector<HTMLButtonElement>('.cv-outside')!.onclick = () => {
    close();
    c.outside();
  };
  const heart = el.querySelector<HTMLButtonElement>('.cv-heart')!;
  heart.onclick = async () => {
    const r = await c.heart(heart.getAttribute('aria-pressed') !== 'true');
    if (!r) return;
    heart.setAttribute('aria-pressed', String(r.mine));
    heart.querySelector('b')!.textContent = String(r.hearts);
  };
  const report = el.querySelector<HTMLButtonElement>('.cv-report')!;
  report.onclick = async () => {
    report.disabled = true;
    report.textContent = (await c.report()) ? 'Reported · thank you' : 'Couldn’t report';
  };
}
