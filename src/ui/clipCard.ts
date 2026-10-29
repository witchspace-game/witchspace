// A shared clip's card for link previews (X, Bluesky, Messages...), Mark: a
// real frame of the flight, the mark, what happened (the title the server
// wrote from the track), who flew it, and where to play. Drawn here from the
// moment's own video and put up beside the clip (net/clips.ts putCard); the
// server keeps it only while the clip is up (server/src/clips.ts).

import { fontFamily, loadIcon, wrap } from './videoCards';

export const CARD_W = 1200;
export const CARD_H = 630;

const seek = (v: HTMLVideoElement, t: number) =>
  new Promise<void>((done) => {
    v.onseeked = () => done();
    v.currentTime = t;
  });

/**
 * The best moment of a clip: the brightest of a dozen frames across it, which in a fight is the
 * explosion. Null if the video won't play here.
 */
async function bestFrame(video: Blob): Promise<ImageBitmap | null> {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  const src = URL.createObjectURL(video);
  v.src = src;
  try {
    await new Promise((ok, fail) => {
      v.onloadeddata = ok;
      v.onerror = fail;
      setTimeout(fail, 8000);
    });
    const probe = new OffscreenCanvas(48, 27);
    const pg = probe.getContext('2d', { willReadFrequently: true })!;
    let best = -1;
    let at = 0;
    const n = 12;
    for (let i = 0; i < n; i++) {
      const t = (v.duration * (i + 0.5)) / n;
      await seek(v, t);
      pg.drawImage(v, 0, 0, 48, 27);
      const d = pg.getImageData(0, 0, 48, 27).data;
      let sum = 0;
      for (let k = 0; k < d.length; k += 4) sum += 0.2126 * d[k] + 0.7152 * d[k + 1] + 0.0722 * d[k + 2];
      if (sum > best) {
        best = sum;
        at = t;
      }
    }
    await seek(v, at);
    return await createImageBitmap(v);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(src);
  }
}

/** The card, as a JPEG: from the moment's video, else its poster. Null with neither (the server shows its own card). */
export async function drawClipCard(media: { video?: Blob; poster: Blob | null }, title: string): Promise<Blob | null> {
  const frame = (media.video && (await bestFrame(media.video))) || (media.poster && (await createImageBitmap(media.poster).catch(() => null)));
  if (!frame) return null;
  const c = new OffscreenCanvas(CARD_W, CARD_H);
  const g = c.getContext('2d')!;
  g.fillStyle = '#000';
  g.fillRect(0, 0, CARD_W, CARD_H);
  // The frame, filling the card.
  const s = Math.max(CARD_W / frame.width, CARD_H / frame.height);
  g.drawImage(frame, (CARD_W - frame.width * s) / 2, (CARD_H - frame.height * s) / 2, frame.width * s, frame.height * s);
  frame.close();
  // Dark behind the words: across the top for the mark, and up from the bottom.
  const top = g.createLinearGradient(0, 0, 0, 150);
  top.addColorStop(0, 'rgba(0,0,0,0.7)');
  top.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = top;
  g.fillRect(0, 0, CARD_W, 150);
  const bottom = g.createLinearGradient(0, CARD_H * 0.38, 0, CARD_H);
  bottom.addColorStop(0, 'rgba(0,0,0,0)');
  bottom.addColorStop(1, 'rgba(0,0,0,0.88)');
  g.fillStyle = bottom;
  g.fillRect(0, CARD_H * 0.38, CARD_W, CARD_H * 0.62);

  const font = fontFamily();
  const icon = await loadIcon();
  if (icon) g.drawImage(icon, 48, 36, 64, 64);
  g.textBaseline = 'middle';
  g.fillStyle = '#e8fff6';
  g.font = `700 34px ${font}`;
  g.fillText('W I T C H S P A C E', icon ? 128 : 48, 68);

  // "CMDR Jameson: 3 kills in one fight at Xeaqu": who, then what happened, large.
  const split = title.indexOf(': ');
  const who = split > 0 ? title.slice(0, split) : null;
  const line = split > 0 ? title.slice(split + 2) : title;
  g.textBaseline = 'alphabetic';
  g.font = `700 60px ${font}`;
  const lines = wrap(g, line.charAt(0).toUpperCase() + line.slice(1), CARD_W - 96, 2);
  const base = CARD_H - 92;
  g.fillStyle = '#ffffff';
  g.shadowColor = 'rgba(0,0,0,0.8)';
  g.shadowBlur = 16;
  lines.forEach((l, i) => g.fillText(l, 48, base - (lines.length - 1 - i) * 70));
  if (who) {
    g.fillStyle = '#3dffb0';
    g.font = `600 30px ${font}`;
    g.fillText(who, 48, base - (lines.length - 1) * 70 - 78);
  }
  g.shadowBlur = 0;
  g.fillStyle = 'rgba(216, 226, 240, 0.85)';
  g.font = `500 26px ${font}`;
  g.fillText('Free in your browser · witchspace.org.uk', 48, CARD_H - 40);

  for (const quality of [0.86, 0.7, 0.55]) {
    const jpeg = await c.convertToBlob({ type: 'image/jpeg', quality }).catch(() => null);
    if (jpeg && jpeg.size < 380_000) return jpeg;
  }
  return null;
}
