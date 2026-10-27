// What every video the game makes carries: the label and title on each frame,
// the one end card they all sign off on, and a still for the poster. Shared by
// the kill cam (wide and upright), the upright cut of a cockpit clip, and the
// end of a replay watched live, so they all end the same way.

type Ctx = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

export const fontFamily = () => getComputedStyle(document.body).fontFamily || 'sans-serif';

/** Lines of text that fit `width`, at most `max` of them (the last ends in … if it had to be cut). */
export function wrap(g: Ctx, text: string, width: number, max: number): string[] {
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

/** How far down an upright frame the stamp's band reaches: keep labels below it. */
export const uprightBand = (w: number) => w * 0.3;

/**
 * Always labelled: RECONSTRUCTION (or another label) and whose, top left; the
 * way back to the game. Wide: the address bottom right. Upright: everything in
 * a band at the top, big enough to read on a phone, clear of the bottom and
 * right edges where Shorts, Reels and TikTok put their buttons and captions.
 */
export function stamp(g: Ctx, w: number, h: number, title: string, label = 'RECONSTRUCTION') {
  const upright = h > w;
  const s = upright ? w / 28 : Math.min(w, h) / 30;
  const pad = upright ? w * 0.06 : s * 1.1;
  const top = upright ? h * 0.05 : pad;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = '#ffd28a';
  g.font = `700 ${s}px ${fontFamily()}`;
  g.fillText(label.split('').join(' '), pad, top);
  g.fillStyle = 'rgba(232, 240, 250, 0.92)';
  g.font = `${upright ? 600 : 400} ${s * (upright ? 1.15 : 0.85)}px ${fontFamily()}`;
  const lines = wrap(g, title, (upright ? w * 0.82 : w * 0.6) - pad, 2);
  const lh = s * (upright ? 1.4 : 1.1);
  lines.forEach((l, i) => g.fillText(l, pad, top + s * 1.6 + i * lh));
  g.fillStyle = 'rgba(61, 255, 176, 0.9)';
  g.font = `600 ${s * 0.9}px ${fontFamily()}`;
  if (upright) {
    g.fillText('witchspace.org.uk', pad, top + s * 1.9 + lines.length * lh);
  } else {
    g.textAlign = 'right';
    g.textBaseline = 'bottom';
    g.fillText('witchspace.org.uk', w - pad, h - pad);
  }
}

/** A line of the assessors' account across the lower part of the frame (above the Shorts buttons when upright). */
export function caption(g: Ctx, w: number, h: number, text: string, alpha: number) {
  if (alpha <= 0) return;
  const upright = h > w;
  const s = upright ? w / 30 : h / 30;
  g.save();
  g.globalAlpha = alpha;
  g.font = `500 ${s}px ${fontFamily()}`;
  const lines = wrap(g, text, upright ? w * 0.8 : w * 0.62, 3);
  const lh = s * 1.35;
  const bottom = upright ? h * 0.7 : h - s * 3.2;
  const y0 = bottom - lines.length * lh;
  const tw = Math.max(...lines.map((l) => g.measureText(l).width));
  g.fillStyle = 'rgba(0, 6, 4, 0.62)';
  g.fillRect(w / 2 - tw / 2 - s * 0.7, y0 - s * 0.45, tw + s * 1.4, lines.length * lh + s * 0.6);
  g.fillStyle = '#e8f0fa';
  g.textAlign = 'center';
  g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, w / 2, y0 + i * lh));
  g.restore();
}

/**
 * The end card every video signs off on: the mark, the name, the line of what
 * happened, and where to play. `alpha` below 1 brings it up over the last of
 * the scene (a cross-fade; the scene darkens as the card comes up).
 */
export function endCard(g: Ctx, w: number, h: number, title: string, icon: ImageBitmap | null, alpha = 1) {
  if (alpha <= 0) return;
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const upright = h > w;
  const s = upright ? w / 15 : Math.min(w, h) / 20;
  const cy = upright ? h * 0.46 : h / 2;
  if (icon) g.drawImage(icon, w / 2 - s * 1.6, cy - s * 5, s * 3.2, s * 3.2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e8fff6';
  g.font = `700 ${s * 1.3}px ${fontFamily()}`;
  const mark = 'W I T C H S P A C E';
  const mw = g.measureText(mark).width;
  if (mw > w * 0.88) g.font = `700 ${(s * 1.3 * w * 0.88) / mw}px ${fontFamily()}`;
  g.fillText(mark, w / 2, cy);
  g.fillStyle = 'rgba(216, 226, 240, 0.85)';
  g.font = `400 ${s * 0.62}px ${fontFamily()}`;
  const lines = wrap(g, title, w * 0.84, 2);
  const lh = s * 0.8;
  lines.forEach((l, i) => g.fillText(l, w / 2, cy + s * 1.4 + i * lh));
  const below = cy + s * 1.4 + (lines.length - 1) * lh;
  g.fillStyle = '#3dffb0';
  g.font = `600 ${s * 0.8}px ${fontFamily()}`;
  g.fillText('witchspace.org.uk/play', w / 2, below + s * 1.5);
  g.fillStyle = 'rgba(216, 226, 240, 0.6)';
  g.font = `400 ${s * 0.55}px ${fontFamily()}`;
  g.fillText('Free · open source · plays in your browser', w / 2, below + s * 2.6);
  g.restore();
}

/** Seconds the end card takes to come up over the last of the scene. */
export const CARD_FADE = 1.4;
/** Seconds the end card holds once it's up. */
export const CARD_HOLD = 2.5;

/** How far the end card is up (0 to 1) at `t` seconds into a video whose scene lasts `scene` seconds: eased in over its last CARD_FADE. */
export function cardAlpha(t: number, scene: number): number {
  const fade = Math.min(CARD_FADE, scene / 2);
  const x = Math.min(1, Math.max(0, (t - (scene - fade)) / fade));
  return x * x * (3 - 2 * x);
}

/** A video's frames: the scene's, then the card's hold. */
export function videoFrames(scene: number, fps: number): { scene: number; total: number } {
  const s = Math.ceil(scene * fps);
  return { scene: s, total: s + Math.ceil(CARD_HOLD * fps) };
}

/** The end card at full strength. */
export const houseCard = (g: Ctx, w: number, h: number, title: string, icon: ImageBitmap | null) => endCard(g, w, h, title, icon, 1);

export async function loadIcon(): Promise<ImageBitmap | null> {
  try {
    return await createImageBitmap(await (await fetch('/icons/icon-512.png')).blob());
  } catch {
    return null;
  }
}

export async function still(g: OffscreenCanvasRenderingContext2D, w: number, h: number): Promise<Blob | null> {
  const c = new OffscreenCanvas(480, Math.round((480 * h) / w));
  c.getContext('2d')!.drawImage(g.canvas, 0, 0, c.width, c.height);
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.8 }).catch(() => null);
}
