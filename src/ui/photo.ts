// P: take a photo of the view. The 3D scene is its own canvas with the HUD
// drawn over it in HTML, so a photo is the scene alone: no HUD, just the
// shot, with a small mark in the corner. Photos go to the flight log, to share
// once you're docked (nothing pops up mid-fight); where the log can't be used
// (storage blocked), savePhoto shares or saves it straight away as before.
//
// A WebGL canvas is cleared once it's on screen, so call takePhoto() right
// after rendering a frame, in the same task.

// With a ship in your sights, the photo carries what the scanner read of her, in a card in the
// corner (Mark, 31 October 2026: the picture "caught the ship but not the manifest or detail"):
// her type, owner, range and standing, and her hold if you were close enough to read it.

/** Copy the canvas now; the image (JPEG, or PNG for 1984 mode's crisp pixels) follows. `caption`: lines for the card. */
export function takePhoto(canvas: HTMLCanvasElement, retro: boolean, caption: string[] = []): Promise<Blob | null> {
  // 1984 mode is drawn small and scaled up by whole pixels: keep it crisp.
  const scale = retro ? Math.max(1, Math.round(1600 / canvas.width)) : 1;
  const out = document.createElement('canvas');
  out.width = canvas.width * scale;
  out.height = canvas.height * scale;
  const ctx = out.getContext('2d')!;
  ctx.imageSmoothingEnabled = !retro;
  ctx.drawImage(canvas, 0, 0, out.width, out.height);

  // The mark, bottom right.
  const size = Math.max(14, Math.round(out.height / 48));
  ctx.font = `600 ${size}px Rajdhani, 'Space Grotesk', sans-serif`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  const pad = Math.round(size * 1.1);
  const text = 'WITCHSPACE · witchspace.org.uk';
  if (!retro) {
    ctx.shadowColor = 'rgba(61, 255, 176, 0.7)';
    ctx.shadowBlur = size * 0.8;
  }
  ctx.fillStyle = retro ? '#ffffff' : 'rgba(234, 255, 246, 0.85)';
  ctx.fillText(text, out.width - pad, out.height - pad);
  ctx.shadowBlur = 0;
  if (caption.length) drawCaption(ctx, caption, size, pad, retro);

  return new Promise((resolve) => out.toBlob(resolve, retro ? 'image/png' : 'image/jpeg', 0.9));
}

/** The scanner's card, top left: a dark panel with a glowing edge, the ship's line brightest. */
function drawCaption(ctx: CanvasRenderingContext2D, lines: string[], size: number, pad: number, retro: boolean) {
  const line = Math.round(size * 1.35);
  const inner = Math.round(size * 0.8);
  const fonts = [`600 ${size}px Rajdhani, 'Space Grotesk', sans-serif`, `500 ${Math.round(size * 0.9)}px Rajdhani, 'Space Grotesk', sans-serif`];
  const most = ctx.canvas.width * 0.6;
  // Long holds wrap at the dots rather than run off the card.
  const wrapped: { text: string; first: boolean }[] = [];
  lines.forEach((text, i) => {
    ctx.font = fonts[i ? 1 : 0];
    let row = '';
    for (const part of text.split(' · ')) {
      const next = row ? `${row} · ${part}` : part;
      if (row && ctx.measureText(next).width > most - inner * 2) {
        wrapped.push({ text: row, first: i === 0 });
        row = part;
      } else row = next;
    }
    wrapped.push({ text: row, first: i === 0 });
  });
  let width = 0;
  for (const w of wrapped) {
    ctx.font = fonts[w.first ? 0 : 1];
    width = Math.max(width, ctx.measureText(w.text).width);
  }
  const box = { x: pad, y: pad, w: Math.min(most, width) + inner * 2, h: wrapped.length * line + inner * 1.4 };
  ctx.fillStyle = retro ? '#000000' : 'rgba(3, 12, 10, 0.72)';
  ctx.fillRect(box.x, box.y, box.w, box.h);
  ctx.strokeStyle = retro ? '#ffffff' : 'rgba(61, 255, 176, 0.75)';
  ctx.lineWidth = Math.max(1, size / 12);
  if (!retro) {
    ctx.shadowColor = 'rgba(61, 255, 176, 0.6)';
    ctx.shadowBlur = size * 0.6;
  }
  ctx.strokeRect(box.x, box.y, box.w, box.h);
  ctx.shadowBlur = 0;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  wrapped.forEach((w, i) => {
    ctx.font = fonts[w.first ? 0 : 1];
    ctx.fillStyle = retro ? '#ffffff' : w.first ? 'rgba(234, 255, 246, 0.95)' : 'rgba(170, 230, 205, 0.9)';
    ctx.fillText(w.text, box.x + inner, box.y + inner * 0.7 + i * line);
  });
}

/** Share a photo (phones) or save it: for when the flight log can't keep it. */
export async function savePhoto(blob: Blob): Promise<string> {
  const name = `witchspace-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
  const file = new File([blob], name, { type: blob.type });
  // Phones: hand it to the share sheet. Dismissing it is a choice, not a cue
  // to download (that's what opened the Files menu on iPhones).
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Witchspace' });
      return 'Photo shared';
    } catch {
      return 'Photo not shared';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return `Photo saved · ${name}`;
}
