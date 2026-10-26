// The upright cut of a cockpit clip, for Shorts, Reels and TikTok: the clip as
// you saw it, enlarged and trimmed a little at the sides (the action is in the
// middle, under the sights), with FLIGHT RECORDER and its title above,
// witchspace.org.uk below, and the house card to end on. Made in the browser,
// frame by frame, with the encoder the kill cam uses; the original is kept.

import { encodeVideo } from './encodeVideo';
import { fontFamily, houseCard, loadIcon, still } from './videoCards';

const W = 720;
const H = 1280;
const FPS = 30;
const CARD = 2.5; // seconds of the house card
// The clip's window: 4:5, full width, between the title band and the foot.
const CLIP_H = Math.round((W * 5) / 4);
const CLIP_Y = 200;

export interface UprightClip {
  video: Blob;
  poster: Blob | null;
  seconds: number;
}

/** Is this video wide (and so worth an upright cut)? */
export async function isWide(video: Blob): Promise<boolean> {
  const v = await load(video).catch(() => null);
  if (!v) return false;
  const wide = v.el.videoWidth > v.el.videoHeight;
  v.done();
  return wide;
}

async function load(video: Blob) {
  const url = URL.createObjectURL(video);
  const el = document.createElement('video');
  el.muted = true;
  el.playsInline = true;
  el.preload = 'auto';
  el.src = url;
  await new Promise<void>((ok, fail) => {
    el.onloadeddata = () => ok();
    el.onerror = () => fail(new Error('could not load the clip'));
  });
  return { el, done: () => URL.revokeObjectURL(url) };
}

const seek = (el: HTMLVideoElement, t: number) =>
  new Promise<void>((ok) => {
    const target = Math.min(Math.max(0, t), Math.max(0, el.duration - 0.001));
    if (Math.abs(el.currentTime - target) < 0.0005) return ok();
    el.onseeked = () => ok();
    el.currentTime = target;
  });

/** Lines of text that fit `width`, at most `max` of them (the last ends in … if it had to be cut). */
function wrap(g: OffscreenCanvasRenderingContext2D, text: string, width: number, max: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (g.measureText(next).width <= width || !line) line = next;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  if (lines.length > max) {
    lines.length = max;
    lines[max - 1] = `${lines[max - 1].replace(/\s+\S*$/, '')}…`;
  }
  return lines;
}

function frame(g: OffscreenCanvasRenderingContext2D, el: HTMLVideoElement, title: string) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, W, H);
  // The clip: the middle of the wide picture, 4:5, filling the width.
  const sh = el.videoHeight;
  const sw = Math.min(el.videoWidth, Math.round((sh * 4) / 5));
  const sx = Math.round((el.videoWidth - sw) / 2);
  g.drawImage(el, sx, 0, sw, sh, 0, CLIP_Y, W, CLIP_H);
  // Above: whose, and what.
  const pad = 36;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = '#ffd28a';
  g.font = `700 26px ${fontFamily()}`;
  g.fillText('F L I G H T   R E C O R D E R', pad, 44);
  g.fillStyle = '#eef3fa';
  g.font = `600 34px ${fontFamily()}`;
  wrap(g, title, W - pad * 2, 2).forEach((l, i) => g.fillText(l, pad, 86 + i * 42));
  // Below: the way to the game.
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(61, 255, 176, 0.95)';
  g.font = `600 34px ${fontFamily()}`;
  g.fillText('witchspace.org.uk', W / 2, CLIP_Y + CLIP_H + 92);
  g.fillStyle = 'rgba(216, 226, 240, 0.65)';
  g.font = `400 22px ${fontFamily()}`;
  g.fillText('Free · plays in your browser', W / 2, CLIP_Y + CLIP_H + 136);
}

/** Make the upright cut. Resolves with it, or null if this browser can't make video. */
export async function uprightCut(video: Blob, title: string, onProgress?: (f: number) => void): Promise<UprightClip | null> {
  const v = await load(video).catch(() => null);
  if (!v) return null;
  const { el } = v;
  const seconds = el.duration;
  const span = Math.ceil(seconds * FPS);
  const icon = await loadIcon();
  let poster: Blob | null = null;
  try {
    const out = await encodeVideo({
      width: W,
      height: H,
      fps: FPS,
      frames: span + Math.ceil(CARD * FPS),
      onProgress,
      draw: async (i, g) => {
        if (i < span) {
          await seek(el, i / FPS);
          frame(g, el, title);
          if (!poster && i >= span * 0.4) poster = await still(g, W, H);
        } else houseCard(g, W, H, title, icon);
      },
    });
    return out ? { video: out, poster, seconds: seconds + CARD } : null;
  } finally {
    v.done();
  }
}
