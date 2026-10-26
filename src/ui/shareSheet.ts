// One share sheet for everything the flight recorder makes: clips, kill cam
// videos and photos (docs/design/flight-recorder.md). The card first, the
// clip's own picture with its title, then one main button and the links.
//
// - On a phone, "Share video…" hands the file itself to the phone's share
//   sheet: Instagram, TikTok, WhatsApp, Messages, and Save Video to Photos.
//   The file is made before the sheet opens, so the tap opens the phone's
//   sheet at once (iOS only allows it straight from a tap). Dismissing it
//   does nothing: there is no fallback to downloading on a phone.
// - On a desktop, the main button saves the file, as you'd expect there.
// - The links (X, Bluesky, Facebook...) share the game, with the clip's
//   title, until clips have pages of their own to link to.

import { escapeHtml } from './escape';
import { copyText, destinations, ICONS } from './shareLinks';

const GAME = 'https://witchspace.org.uk/play';

export interface ShareMedia {
  /** The video or photo. */
  blob: Blob;
  /** A still for the card (videos). */
  poster?: Blob;
  title: string;
  /** The file's name when saved or shared. */
  name: string;
}

const isPhone = () => matchMedia('(pointer: coarse)').matches;

let open: { el: HTMLElement; urls: string[] } | null = null;

export function closeShareSheet() {
  if (!open) return;
  const { el, urls } = open;
  open = null;
  el.classList.remove('shown');
  document.removeEventListener('keydown', onKey, true);
  setTimeout(() => {
    el.remove();
    for (const u of urls) URL.revokeObjectURL(u);
  }, 200);
}

// While the sheet is open, keys are its own: Escape closes it, and nothing
// reaches the game behind.
function onKey(e: KeyboardEvent) {
  e.stopPropagation();
  if (e.key === 'Escape') {
    e.preventDefault();
    closeShareSheet();
  }
}

export const isShareSheetOpen = () => open !== null;

export function openShareSheet(m: ShareMedia) {
  closeShareSheet();
  const file = new File([m.blob], m.name, { type: m.blob.type });
  const video = m.blob.type.startsWith('video/');
  const phone = isPhone();
  const canShareFile = Boolean(navigator.canShare?.({ files: [file] }));
  const urls: string[] = [];
  const objectUrl = (b: Blob) => {
    const u = URL.createObjectURL(b);
    urls.push(u);
    return u;
  };
  const text = `${m.title} · Witchspace, free in your browser`;
  // A phone with a share sheet shares the file; anything else saves it.
  const main = phone && canShareFile ? 'share' : 'save';
  const what = video ? 'video' : 'photo';

  const el = document.createElement('div');
  el.className = 'ws-share';
  el.innerHTML = `
    <div class="ws-share-sheet" role="dialog" aria-modal="true" aria-label="Share">
      <button type="button" class="ws-share-close" data-close aria-label="Close">${ICONS.close}</button>
      <figure class="ws-share-card">
        ${
          video
            ? `<video src="${objectUrl(m.blob)}" ${m.poster ? `poster="${objectUrl(m.poster)}"` : ''} autoplay muted loop playsinline></video>`
            : `<img src="${objectUrl(m.blob)}" alt="" />`
        }
        <figcaption><strong>${escapeHtml(m.title)}</strong><span>witchspace.org.uk</span></figcaption>
      </figure>
      <button type="button" class="ws-share-main primary">${main === 'share' ? `${ICONS.share}Share ${what}…` : `Save ${what}`}</button>
      <p class="ws-share-hint">${
        main === 'share'
          ? `Instagram, TikTok, WhatsApp and the rest. <b>Save ${video ? 'Video' : 'Image'}</b> keeps it in Photos.`
          : canShareFile
            ? `Saves the ${what} to this computer. <button type="button" class="ws-share-more">Or share it…</button>`
            : `Saves the ${what} to this computer, ready to post.`
      }</p>
      <p class="ws-share-or">Or share the game, with its title</p>
      <div class="ws-share-links">
        ${destinations(GAME, text)
          .filter(([key]) => key !== 'email')
          .map(([key, label, href]) => `<a href="${href}" target="_blank" rel="noopener" aria-label="${label}">${ICONS[key]}<span>${label}</span></a>`)
          .join('')}
        <button type="button" class="ws-share-copy" aria-label="Copy link">${ICONS.link}<span>Copy link</span></button>
      </div>
      <p class="ws-share-msg" aria-live="polite"></p>
    </div>`;
  document.body.append(el);
  open = { el, urls };

  const msg = el.querySelector<HTMLElement>('.ws-share-msg')!;
  const shareFile = async () => {
    try {
      await navigator.share({ files: [file], title: m.title });
      closeShareSheet();
    } catch (e) {
      // Dismissed: stay as we were. Refused (the phone wanted a fresh tap): say so.
      if ((e as DOMException)?.name !== 'AbortError') msg.textContent = 'Your phone wouldn’t open its share sheet. Tap again.';
    }
  };
  const save = () => {
    const a = document.createElement('a');
    a.href = objectUrl(m.blob);
    a.download = m.name;
    a.click();
    msg.textContent = `Saved · ${m.name}`;
  };
  el.querySelector<HTMLButtonElement>('.ws-share-main')!.onclick = () => (main === 'share' ? void shareFile() : save());
  const more = el.querySelector<HTMLButtonElement>('.ws-share-more');
  if (more) more.onclick = () => void shareFile();
  const copy = el.querySelector<HTMLButtonElement>('.ws-share-copy')!;
  copy.onclick = async () => {
    await copyText(`${text} ${GAME}`);
    copy.querySelector('span')!.textContent = 'Copied ✓';
  };
  el.querySelector<HTMLButtonElement>('[data-close]')!.onclick = closeShareSheet;
  el.addEventListener('pointerdown', (e) => e.target === el && closeShareSheet());
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => el.classList.add('shown'));
}
