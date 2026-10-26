// Sharing, the same way everywhere on the site: any element with data-share
// opens a share sheet (a bottom sheet on phones, a dialog on wider screens).
// It shows a preview of the card the link will unfurl as, offers the
// device's own share sheet when there is one, then WhatsApp, X, Bluesky,
// Reddit, Facebook, email and copy link. Links are always the canonical
// witchspace.org.uk address, never the current URL with its query string.
//
// Also: data-copy="text" and data-copy-from="#id" buttons copy to the
// clipboard and say so.
//
//   <button data-share data-share-url="/press/dogfight/" data-share-title="…" data-share-image="…">Share</button>

import { copyText, destinations, ICONS } from '../ui/shareLinks';

const SITE = 'https://witchspace.org.uk';

export interface ShareTarget {
  /** A path on the site (or a full URL). */
  url: string;
  title: string;
  /** The share card image; defaults to this page's og:image. */
  image?: string;
}

const canonical = (url: string) => (/^https?:/.test(url) ? url : SITE + url);

/** Briefly relabel a button to confirm, then put it back. */
function confirm(button: HTMLElement, text: string) {
  const label = button.dataset.label ?? button.textContent ?? '';
  button.dataset.label = label;
  button.textContent = text;
  button.classList.add('done');
  setTimeout(() => {
    button.textContent = label;
    button.classList.remove('done');
  }, 1800);
}

let open: HTMLElement | null = null;

export function closeShare() {
  if (!open) return;
  const sheet = open;
  open = null;
  sheet.classList.remove('shown');
  setTimeout(() => sheet.remove(), 220);
  document.removeEventListener('keydown', onKey);
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    e.stopPropagation();
    closeShare();
  }
}

export function openShare(target: ShareTarget) {
  closeShare();
  const url = canonical(target.url);
  const image = target.image ?? document.querySelector<HTMLMetaElement>('meta[property="og:image"]')?.content;
  const text = target.title;

  const sheet = document.createElement('div');
  sheet.className = 'share-backdrop';
  sheet.innerHTML = `
    <div class="share-sheet" role="dialog" aria-modal="true" aria-label="Share" tabindex="-1">
      <div class="share-head"><h2>Share</h2><button type="button" class="icon-button" data-close aria-label="Close">${ICONS.close}</button></div>
      ${
        image
          ? `<figure class="share-preview"><img src="${image.startsWith(SITE) ? image.slice(SITE.length) : image}" alt="" /><figcaption><strong></strong><span>${url.replace(/^https?:\/\//, '')}</span></figcaption></figure>`
          : ''
      }
      ${typeof navigator.share === 'function' ? `<button type="button" class="button primary share-native">${ICONS.share}Share…</button>` : ''}
      <div class="share-grid">
        ${destinations(url, text).map(([key, label, href]) => `<a href="${href}" target="_blank" rel="noopener">${ICONS[key]}<span>${label}</span></a>`).join('')}
      </div>
      <div class="share-link"><input type="text" readonly value="${url}" aria-label="Link" /><button type="button" class="button small" data-copy-link>${ICONS.link}Copy link</button></div>
    </div>`;
  sheet.querySelector('.share-preview strong')?.append(text);
  document.body.append(sheet);
  open = sheet;

  sheet.addEventListener('mousedown', (e) => {
    if (e.target === sheet) closeShare();
  });
  sheet.querySelector('[data-close]')!.addEventListener('click', closeShare);
  sheet.querySelector('.share-native')?.addEventListener('click', async () => {
    try {
      await navigator.share({ title: text, text, url });
      closeShare();
    } catch {
      // Dismissed: keep the other options open.
    }
  });
  const copy = sheet.querySelector<HTMLButtonElement>('[data-copy-link]')!;
  copy.addEventListener('click', async () => {
    await copyText(url);
    confirm(copy, 'Copied ✓');
  });
  sheet.querySelector('input')!.addEventListener('focus', (e) => (e.target as HTMLInputElement).select());
  document.addEventListener('keydown', onKey);
  requestAnimationFrame(() => {
    sheet.classList.add('shown');
    sheet.querySelector<HTMLElement>('.share-sheet')!.focus();
  });
}

// Wire up every share and copy button on the page, including ones added later.
document.addEventListener('click', async (e) => {
  const el = (e.target as HTMLElement).closest<HTMLElement>('[data-share], [data-copy], [data-copy-from]');
  if (!el) return;
  e.preventDefault();
  e.stopPropagation();
  if (el.hasAttribute('data-share')) {
    openShare({ url: el.dataset.shareUrl ?? location.pathname, title: el.dataset.shareTitle ?? document.title, image: el.dataset.shareImage });
    return;
  }
  const from = el.dataset.copyFrom ? document.querySelector<HTMLElement>(el.dataset.copyFrom) : null;
  await copyText(from ? from.innerText.trim() : el.dataset.copy!);
  confirm(el, 'Copied ✓');
});
