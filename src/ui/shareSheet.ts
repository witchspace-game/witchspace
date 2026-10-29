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
// - The links (X, Bluesky, Facebook...) share the game with the clip's title;
//   or, for a clip with a flight track, a page of its own that replays it
//   (docs/design/flight-recorder.md, "Clip pages"): the track goes up only
//   after the player says yes, once, and never the video.

import { signedIn } from '../net/account';
import { toggleAccountPanel } from './accountPanel';
import { escapeHtml } from './escape';
import { copyText, destinations, ICONS } from './shareLinks';
import { isWide } from './upright';

const GAME = 'https://witchspace.org.uk/play';

export interface ShareMedia {
  /** The video or photo. */
  blob: Blob;
  /** A still for the card (videos). */
  poster?: Blob;
  title: string;
  /** The file's name when saved or shared. */
  name: string;
  /** For a wide clip: make its upright cut (for Shorts and Reels), resolving with it to share instead. */
  upright?: (onProgress: (f: number) => void) => Promise<ShareMedia | null>;
  /**
   * For a clip with a track: put it up as a page, with this video (the one being shared: the sharer
   * decides, Mark), resolving with the page's link. `shared` if it already is; `attach` puts this
   * version's video on a page already up.
   */
  replay?: { shared: string | null; put: () => Promise<{ url: string; title: string } | { error: string }>; attach?: (url: string) => void };
}

// Asked again from 29 October 2026: the video now goes up with the page, where before it stayed on the device.
const CONSENT_KEY = 'witchspace.replay-consent-video';
const consented = () => {
  try {
    return localStorage.getItem(CONSENT_KEY) === 'yes';
  } catch {
    return false;
  }
};

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
            ? `<video ${m.poster ? `poster="${objectUrl(m.poster)}"` : ''} autoplay muted loop playsinline></video>`
            : `<img src="${objectUrl(m.blob)}" alt="" />`
        }
        <figcaption><strong>${escapeHtml(m.title)}</strong><span>witchspace.org.uk</span></figcaption>
      </figure>
      ${
        // A guest shares anonymously; their own callsign is theirs to claim by email, while nobody else has it (Mark).
        signedIn()
          ? ''
          : '<p class="ws-share-who">Shared as <b>A commander</b>. <button type="button" class="ws-share-claim">Claim your callsign</button> to put your name on it: free, with your email, while it’s still free to take.</p>'
      }
      <button type="button" class="ws-share-main primary">${main === 'share' ? `${ICONS.share}Share ${what}…` : `Save ${what}`}</button>
      <p class="ws-share-hint">${
        main === 'share'
          ? `Instagram, TikTok, WhatsApp and the rest. <b>Save ${video ? 'Video' : 'Image'}</b> keeps it in Photos.`
          : canShareFile
            ? `Saves the ${what} to this computer. <button type="button" class="ws-share-more">Or share it…</button>`
            : `Saves the ${what} to this computer, ready to post.`
      }</p>
      <button type="button" class="ws-share-upright" hidden>Make an upright version <span>for Shorts, Reels and TikTok</span></button>
      <div class="ws-share-replay" hidden>
        <button type="button" class="ws-share-put">${ICONS.link}Share a link that plays it</button>
        <div class="ws-share-consent" hidden>
          <p>Put this ${video ? 'video' : 'moment'} on witchspace.org.uk? Anyone with the link can watch it, and watch the fight rebuilt from outside from your flight track. You can take it down from your flight log.</p>
          <p class="ws-share-consent-actions"><button type="button" class="primary" data-consent="yes">Put it up</button><button type="button" data-consent="no">Not now</button></p>
        </div>
      </div>
      <p class="ws-share-or">Or share the game, with its title</p>
      <div class="ws-share-links"></div>
      <p class="ws-share-msg" aria-live="polite"></p>
    </div>`;
  document.body.append(el);
  open = { el, urls };
  // Copied into memory first: iPhone Safari won't play a video straight from the flight log's database.
  const preview = el.querySelector('video');
  if (preview)
    void m.blob.arrayBuffer().then((bytes) => {
      if (preview.isConnected) preview.src = objectUrl(new Blob([bytes], { type: m.blob.type || 'video/mp4' }));
    });

  const msg = el.querySelector<HTMLElement>('.ws-share-msg')!;
  // The links: the game with the clip's title, or the clip's own page once it has one.
  let linkUrl = GAME;
  let linkText = text;
  const links = el.querySelector<HTMLElement>('.ws-share-links')!;
  const drawLinks = () => {
    links.innerHTML =
      destinations(linkUrl, linkText)
        .filter(([key]) => key !== 'email')
        .map(([key, label, href]) => `<a href="${href}" target="_blank" rel="noopener" aria-label="${label}">${ICONS[key]}<span>${label}</span></a>`)
        .join('') + `<button type="button" class="ws-share-copy" aria-label="Copy link">${ICONS.link}<span>Copy link</span></button>`;
    const copy = links.querySelector<HTMLButtonElement>('.ws-share-copy')!;
    copy.onclick = async () => {
      await copyText(linkUrl === GAME ? `${linkText} ${GAME}` : linkUrl);
      copy.querySelector('span')!.textContent = 'Copied ✓';
    };
  };
  const toPage = (url: string, title: string) => {
    linkUrl = url;
    linkText = `${title} · on Witchspace`;
    el.querySelector('.ws-share-replay')!.setAttribute('hidden', '');
    el.querySelector('.ws-share-or')!.textContent = 'Share the link: it plays this video';
    drawLinks();
  };
  drawLinks();
  if (m.replay?.shared) {
    toPage(m.replay.shared, m.title);
    m.replay.attach?.(m.replay.shared); // this version is the one the page plays now
  }
  else if (m.replay) {
    const box = el.querySelector<HTMLElement>('.ws-share-replay')!;
    const consent = box.querySelector<HTMLElement>('.ws-share-consent')!;
    const put = box.querySelector<HTMLButtonElement>('.ws-share-put')!;
    box.hidden = false;
    const go = async () => {
      put.disabled = true;
      put.textContent = 'Putting it up…';
      const r = await m.replay!.put();
      if (open?.el !== el) return;
      if ('url' in r) toPage(r.url, r.title || m.title);
      else {
        put.disabled = false;
        put.innerHTML = `${ICONS.link}Share a link that plays it`;
        msg.textContent = r.error;
      }
    };
    put.onclick = () => (consented() ? void go() : ((consent.hidden = false), (put.hidden = true)));
    for (const b of consent.querySelectorAll<HTMLButtonElement>('[data-consent]'))
      b.onclick = () => {
        consent.hidden = true;
        put.hidden = false;
        if (b.dataset.consent !== 'yes') return;
        try {
          localStorage.setItem(CONSENT_KEY, 'yes');
        } catch {
          /* asked again next time */
        }
        void go();
      };
  }
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
  // A wide clip can be cut upright: offered once we know its shape.
  const up = el.querySelector<HTMLButtonElement>('.ws-share-upright')!;
  if (video && m.upright) void isWide(m.blob).then((wide) => open?.el === el && (up.hidden = !wide));
  up.onclick = async () => {
    up.disabled = true;
    const label = up.innerHTML;
    const result = await m.upright!((f) => (up.textContent = `Making the upright version · ${Math.round(f * 100)}%`)).catch(() => null);
    if (open?.el !== el) return; // closed meanwhile
    if (result) openShareSheet(result);
    else {
      up.disabled = false;
      up.innerHTML = label;
      msg.textContent = "This browser can't make video, so there's no upright version here.";
    }
  };
  el.querySelector<HTMLButtonElement>('[data-close]')!.onclick = closeShareSheet;
  const claim = el.querySelector<HTMLButtonElement>('.ws-share-claim');
  if (claim)
    claim.onclick = () => {
      closeShareSheet();
      toggleAccountPanel(true);
    };
  el.addEventListener('pointerdown', (e) => e.target === el && closeShareSheet());
  document.addEventListener('keydown', onKey, true);
  requestAnimationFrame(() => el.classList.add('shown'));
}
