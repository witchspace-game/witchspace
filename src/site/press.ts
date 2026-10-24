// The press kit page: filter the gallery, and a full-screen viewer for its
// images and videos. Arrow keys or swipes move through them, Escape closes.
// While an item is open the address bar shows its own page (/press/<id>/),
// so copying the URL shares that item; Back closes the viewer. Without
// JavaScript every card is simply a link to that page.

import { copyText, openShare } from './share';

interface Item {
  id: string;
  kind: 'image' | 'video';
  title: string;
  caption: string;
  info: string;
  large: string;
  video?: string;
  /** The YouTube player, when the video is on the channel. */
  embed?: string;
  og: string;
  download: string;
  direct: string;
}

const items: Item[] = JSON.parse(document.querySelector('#press-media')?.textContent ?? '[]');
const cards = [...document.querySelectorAll<HTMLElement>('.gallery .shot')];

// --- Filters -------------------------------------------------------------------

for (const chip of document.querySelectorAll<HTMLButtonElement>('.chip')) {
  chip.addEventListener('click', () => {
    for (const c of document.querySelectorAll('.chip')) c.setAttribute('aria-pressed', String(c === chip));
    const group = chip.dataset.filter;
    for (const card of cards) card.hidden = Boolean(group) && card.dataset.group !== group;
  });
}

// --- The viewer ----------------------------------------------------------------

const viewer = document.createElement('div');
viewer.className = 'viewer';
viewer.hidden = true;
viewer.setAttribute('role', 'dialog');
viewer.setAttribute('aria-modal', 'true');
viewer.innerHTML = `
  <div class="viewer-stage"></div>
  <button type="button" class="viewer-nav prev" aria-label="Previous">‹</button>
  <button type="button" class="viewer-nav next" aria-label="Next">›</button>
  <button type="button" class="icon-button viewer-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button>
  <div class="viewer-bar">
    <div class="viewer-text"><strong></strong><span></span><small></small></div>
    <div class="viewer-actions">
      <a class="button primary small" data-download download>Download</a>
      <button type="button" class="button small" data-viewer-share>Share</button>
      <button type="button" class="button small" data-viewer-copy>Copy image link</button>
    </div>
  </div>`;
document.body.append(viewer);

const stage = viewer.querySelector<HTMLElement>('.viewer-stage')!;
let index = -1;
let returnTo: HTMLElement | null = null;

/** Visible items only, so the arrows follow the current filter. */
const visible = () => items.filter((it) => !cards.find((c) => c.dataset.id === it.id)?.hidden);

function show(item: Item) {
  index = items.indexOf(item);
  stage.innerHTML =
    item.kind === 'video'
      ? item.embed
        ? `<iframe src="${item.embed}" title="${item.title.replace(/"/g, '&quot;')}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>`
        : `<video src="${item.video}" poster="${item.large}" controls autoplay playsinline></video>`
      : `<img src="${item.large}" alt="${item.caption.replace(/"/g, '&quot;')}" />`;
  viewer.querySelector('.viewer-text strong')!.textContent = item.title;
  viewer.querySelector('.viewer-text span')!.textContent = item.caption;
  viewer.querySelector('.viewer-text small')!.textContent = item.info;
  viewer.querySelector<HTMLAnchorElement>('[data-download]')!.href = item.download;
  viewer.setAttribute('aria-label', item.title);
  // Load the neighbours' images ahead, so arrowing through is instant.
  const list = visible();
  const at = list.indexOf(item);
  for (const n of [list[at + 1], list[at - 1]]) if (n?.kind === 'image') new Image().src = n.large;
}

function openItem(id: string, push = true) {
  const item = items.find((it) => it.id === id);
  if (!item) return;
  if (viewer.hidden) {
    returnTo = document.activeElement as HTMLElement;
    viewer.hidden = false;
    document.body.classList.add('viewing');
    requestAnimationFrame(() => viewer.classList.add('shown'));
  }
  show(item);
  if (push) history.pushState({ press: id }, '', `/press/${id}/`);
  else history.replaceState({ press: id }, '', `/press/${id}/`);
  viewer.querySelector<HTMLElement>('.viewer-close')!.focus();
}

function closeViewer(fromHistory = false) {
  if (viewer.hidden) return;
  viewer.classList.remove('shown');
  viewer.hidden = true;
  stage.innerHTML = ''; // stops any video
  document.body.classList.remove('viewing');
  if (!fromHistory) history.back(); // the entry openItem pushed
  returnTo?.focus();
}

function step(by: number) {
  const list = visible();
  const at = list.indexOf(items[index]);
  const next = list[(at + by + list.length) % list.length];
  if (next) openItem(next.id, false);
}

for (const card of cards) {
  card.querySelector('.shot-open')!.addEventListener('click', (e) => {
    e.preventDefault();
    openItem(card.dataset.id!);
  });
}
for (const b of document.querySelectorAll<HTMLElement>('[data-open]')) b.addEventListener('click', () => openItem(b.dataset.open!));

viewer.querySelector('.prev')!.addEventListener('click', () => step(-1));
viewer.querySelector('.next')!.addEventListener('click', () => step(1));
viewer.querySelector('.viewer-close')!.addEventListener('click', () => closeViewer());
viewer.addEventListener('click', (e) => {
  if (e.target === viewer || e.target === stage) closeViewer();
});
viewer.querySelector('[data-viewer-share]')!.addEventListener('click', () => {
  const item = items[index];
  openShare({ url: `/press/${item.id}/`, title: `${item.title} · Witchspace`, image: item.og });
});
const copyButton = viewer.querySelector<HTMLButtonElement>('[data-viewer-copy]')!;
copyButton.addEventListener('click', async () => {
  await copyText(items[index].direct);
  copyButton.textContent = 'Copied ✓';
  setTimeout(() => (copyButton.textContent = 'Copy image link'), 1800);
});

document.addEventListener('keydown', (e) => {
  if (viewer.hidden || document.querySelector('.share-backdrop')) return;
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === 'ArrowLeft') step(-1);
});

// Swipe left and right on touch screens.
let touchX: number | null = null;
stage.addEventListener('touchstart', (e) => (touchX = e.touches[0].clientX), { passive: true });
stage.addEventListener('touchend', (e) => {
  if (touchX === null) return;
  const dx = e.changedTouches[0].clientX - touchX;
  touchX = null;
  if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
});

addEventListener('popstate', (e) => {
  const id = (e.state as { press?: string } | null)?.press;
  if (id) openItem(id, false);
  else closeViewer(true);
});
