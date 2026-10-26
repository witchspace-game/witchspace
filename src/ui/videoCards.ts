// What every video the game makes carries: the label and title on each frame,
// the house card it ends on, and a still for its poster. Shared by the kill cam
// and the upright cut of a cockpit clip.

export const fontFamily = () => getComputedStyle(document.body).fontFamily || 'sans-serif';

/** Always labelled: RECONSTRUCTION (or another label) and whose, top left; the way back to the game, bottom right. */
export function stamp(g: OffscreenCanvasRenderingContext2D, w: number, h: number, title: string, label = 'RECONSTRUCTION') {
  const s = Math.min(w, h) / 36;
  const pad = s * 1.2;
  g.textAlign = 'left';
  g.textBaseline = 'top';
  g.fillStyle = '#ffd28a';
  g.font = `700 ${s}px ${fontFamily()}`;
  g.fillText(label.split('').join(' '), pad, pad);
  g.fillStyle = 'rgba(216, 226, 240, 0.85)';
  g.font = `400 ${s * 0.85}px ${fontFamily()}`;
  g.fillText(title, pad, pad + s * 1.4, w - pad * 2);
  g.textAlign = 'right';
  g.textBaseline = 'bottom';
  g.fillStyle = 'rgba(61, 255, 176, 0.9)';
  g.font = `600 ${s * 0.9}px ${fontFamily()}`;
  g.fillText('witchspace.org.uk', w - pad, h - pad);
}

/** The house card the video ends on: the mark, the name, and where to play. */
export function houseCard(g: OffscreenCanvasRenderingContext2D, w: number, h: number, title: string, icon: ImageBitmap | null) {
  g.fillStyle = '#000';
  g.fillRect(0, 0, w, h);
  const s = Math.min(w, h) / 20;
  const cy = h / 2;
  if (icon) g.drawImage(icon, w / 2 - s * 1.6, cy - s * 5, s * 3.2, s * 3.2);
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = '#e8fff6';
  g.font = `700 ${s * 1.3}px ${fontFamily()}`;
  g.fillText('W I T C H S P A C E', w / 2, cy);
  g.fillStyle = 'rgba(216, 226, 240, 0.8)';
  g.font = `400 ${s * 0.62}px ${fontFamily()}`;
  g.fillText(title, w / 2, cy + s * 1.4, w * 0.9);
  g.fillStyle = '#3dffb0';
  g.font = `600 ${s * 0.8}px ${fontFamily()}`;
  g.fillText('witchspace.org.uk/play', w / 2, cy + s * 2.9);
  g.fillStyle = 'rgba(216, 226, 240, 0.6)';
  g.font = `400 ${s * 0.55}px ${fontFamily()}`;
  g.fillText('Free · open source · plays in your browser', w / 2, cy + s * 4);
}

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
