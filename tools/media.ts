// The press kit's images and videos (site/media.json), served from Cloudinary
// at whatever size a page needs. Used by build-site.ts for the press page's
// gallery and for a share page per item, so a shared link unfurls with that
// picture. Anything not uploaded yet (no version) falls back to the copy in
// public/, so the site still works before tools/upload-media.ts has run.

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export interface MediaItem {
  id: string;
  kind: 'image' | 'video';
  group: string;
  file: string;
  poster?: string;
  /** When it was made (YYYY-MM-DD), for files not kept in git; otherwise the first commit's date. */
  added?: string;
  /** Its id on the Witchspace YouTube channel: played from there (free to stream at any scale), downloads still come from Cloudinary. */
  youtube?: string;
  /** Seconds into a video for its still. */
  posterOffset?: number;
  title: string;
  caption: string;
  featured?: boolean;
  version?: number;
  width?: number;
  height?: number;
  bytes?: number;
  duration?: number;
}

export interface Media {
  cloud: string;
  folder: string;
  groups: string[];
  items: MediaItem[];
}

export const loadMedia = (root: string): Media => JSON.parse(readFileSync(join(root, 'site/media.json'), 'utf8'));

const local = (file: string) => '/' + file.replace(/^public\//, '');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Cloudinary text overlays (it has Arial, not the site's fonts): the wordmark, and the address under it. */
const BRAND = [
  'l_text:Arial_26_bold_letter_spacing_9:%20%20WITCHSPACE%20%20,co_rgb:eef3fa,b_rgb:05070dcc/fl_layer_apply,g_north_west,x_36,y_32',
  'l_text:Arial_19_bold:%20%20witchspace.org.uk%20%20%C2%B7%20%20free%20in%20your%20browser%20%20,co_rgb:3dffb0,b_rgb:05070dcc/fl_layer_apply,g_north_west,x_36,y_78',
].join('/');

/** Links to one item, at the sizes the site uses. */
export function links(media: Media, item: MediaItem) {
  const base = `https://res.cloudinary.com/${media.cloud}/${item.kind}/upload`;
  const path = `v${item.version}/${media.folder}/${item.id}`;
  const up = Boolean(item.version);
  // A still: the image itself, or a frame from the video.
  const still = (t: string) => {
    if (!up) return local(item.kind === 'video' ? item.poster! : item.file);
    return item.kind === 'video' ? `${base}/so_${item.posterOffset ?? 1},${t}/${path}.jpg` : `${base}/${t}/${path}.jpg`;
  };
  // Wide frames: crop a phone screenshot taken upright and it's mostly gone, so pad it with space instead.
  const fit = (item.height ?? 0) > (item.width ?? 0) ? 'c_pad,b_rgb:05070d' : 'c_fill,g_auto';
  return {
    thumb: (w: number) => still(`${fit},w_${w},h_${Math.round((w * 9) / 16)},q_auto,f_auto`),
    large: still('c_limit,w_2400,q_auto:good,f_auto'),
    // The share card: the picture, stamped with the name and address so a shared link is ours at a glance.
    og: still(`${fit},w_1200,h_630,q_auto,f_jpg/${BRAND}`),
    video: item.kind === 'video' ? (up ? `${base}/q_auto/${path}.mp4` : local(item.file)) : undefined,
    /** The YouTube player, privacy-enhanced (no cookies until it plays). */
    embed: item.youtube ? `https://www.youtube-nocookie.com/embed/${item.youtube}?autoplay=1&rel=0&playsinline=1` : undefined,
    /** The original file, as a download. */
    download: up ? `${base}/fl_attachment:witchspace-${item.id}/${path}.${item.kind === 'video' ? 'mp4' : 'jpg'}` : local(item.file),
    /** A plain link to the full-size file, for embedding elsewhere. */
    direct: up ? `${base}/${path}.${item.kind === 'video' ? 'mp4' : 'jpg'}` : local(item.file),
  };
}

const describe = (item: MediaItem) => {
  const size = item.width ? `${item.width}×${item.height}` : '';
  const mb = item.bytes ? `${(item.bytes / 1_048_576).toFixed(item.bytes > 10_485_760 ? 0 : 1)} MB` : '';
  const secs = item.duration ? `${Math.round(item.duration)} s` : '';
  return [item.kind === 'video' ? 'MP4' : 'JPEG', size, secs, mb].filter(Boolean).join(' · ');
};

const SHARE_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 10.5 15.4 6.5M8.6 13.5l6.8 4"/></svg>';
const PLAY_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>';

/** A gallery card: opens the viewer, or the item's own page without JavaScript. */
function card(media: Media, item: MediaItem): string {
  const l = links(media, item);
  return `      <figure class="shot${item.kind === 'video' ? ' is-video' : ''}" data-id="${item.id}" data-group="${esc(item.group)}">
        <a class="shot-open" href="/press/${item.id}/" aria-label="View ${esc(item.title)}">
          <img src="${l.thumb(800)}" srcset="${l.thumb(480)} 480w, ${l.thumb(800)} 800w, ${l.thumb(1200)} 1200w" sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 33vw" alt="${esc(item.caption)}" loading="lazy" width="800" height="450" />
          ${item.kind === 'video' ? `<span class="shot-play">${PLAY_ICON}</span>` : ''}
        </a>
        <figcaption>
          <span><strong>${esc(item.title)}</strong><small>${describe(item)}</small></span>
          <button type="button" class="icon-button" data-share data-share-url="/press/${item.id}/" data-share-title="${esc(item.title)} · Witchspace" data-share-image="${l.og}" aria-label="Share ${esc(item.title)}">${SHARE_ICON}</button>
        </figcaption>
      </figure>`;
}

/** The press page's filter chips and gallery. */
export function galleryHtml(media: Media): string {
  const chips = ['All', ...media.groups].map((g, i) => `<button type="button" class="chip" data-filter="${i ? esc(g) : ''}" aria-pressed="${i === 0}">${esc(g)}</button>`).join('');
  return `<div class="chips" role="group" aria-label="Filter the gallery">${chips}</div>
    <div class="gallery">
${media.items.map((item) => card(media, item)).join('\n')}
    </div>`;
}

/** Everything the viewer needs, for the press page's script. */
export function galleryData(media: Media): string {
  const data = media.items.map((item) => {
    const l = links(media, item);
    return { id: item.id, kind: item.kind, title: item.title, caption: item.caption, info: describe(item), large: l.large, video: l.video, embed: l.embed, og: l.og, download: l.download, direct: l.direct };
  });
  return `<script type="application/json" id="press-media">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;
}

/** The share card image for a page: the first featured item, unless one is given. */
export function shareImage(media: Media, id?: string): string {
  const item = media.items.find((i) => i.id === id) ?? media.items.find((i) => i.featured) ?? media.items[0];
  return links(media, item).og;
}

/** A page for one item: what a shared link opens, and unfurls as. */
export function itemPage(media: Media, item: MediaItem, site: string) {
  const l = links(media, item);
  const others = media.items.filter((i) => i.id !== item.id && i.group === item.group).slice(0, 3);
  const figure =
    item.kind === 'video'
      ? l.embed
        ? `<button type="button" class="item-media yt" data-embed="${l.embed}" aria-label="Play ${esc(item.title)}" style="--poster: url('${l.large}')"><span class="shot-play">${PLAY_ICON}</span></button>`
        : `<video class="item-media" controls playsinline preload="metadata" poster="${l.large}"><source src="${l.video}" type="video/mp4" /></video>`
      : `<a href="${l.direct}"><img class="item-media" src="${l.large}" alt="${esc(item.caption)}" width="${item.width ?? 1920}" height="${item.height ?? 1080}" /></a>`;
  const head =
    item.kind === 'video'
      ? `    <meta property="og:video" content="${l.direct}" />\n    <meta property="og:video:secure_url" content="${l.direct}" />\n    <meta property="og:video:type" content="video/mp4" />\n    <meta property="og:video:width" content="${item.width ?? 1280}" />\n    <meta property="og:video:height" content="${item.height ?? 720}" />`
      : '';
  return {
    path: `/press/${item.id}/`,
    title: `${item.title} · Witchspace`,
    description: item.caption,
    image: l.og,
    head,
    scripts: ['/src/site/share.ts', '/src/site/youtube.ts'],
    bodyClass: 'press-item',
    content: `<section class="section item">
  <a class="back" href="/press/#gallery">← The press kit</a>
  <figure>
    ${figure}
    <figcaption>
      <h1>${esc(item.title)}</h1>
      <p>${esc(item.caption)}</p>
      <p class="muted small">${describe(item)} · Free to use when writing about Witchspace</p>
      <div class="actions">
        <a class="button primary" href="${l.download}" download>Download</a>
        <button type="button" class="button" data-share data-share-url="/press/${item.id}/" data-share-title="${esc(item.title)} · Witchspace" data-share-image="${l.og}">Share</button>
        <button type="button" class="button" data-copy="${l.direct}">Copy image link</button>
        <a class="button ghost" href="/play/">Play free</a>
      </div>
    </figcaption>
  </figure>
  ${others.length ? `<h2 class="more-title">More: ${esc(item.group)}</h2>\n  <div class="gallery small">\n${others.map((o) => card(media, o)).join('\n')}\n  </div>` : ''}
</section>`,
    url: site + `/press/${item.id}/`,
  };
}
