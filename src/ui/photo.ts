// P: take a photo of the view. The 3D scene is its own canvas with the HUD
// drawn over it in HTML, so a photo is the scene alone: no HUD, just the
// shot, with a small mark in the corner. Photos go to the flight log, to share
// once you're docked (nothing pops up mid-fight); where the log can't be used
// (storage blocked), savePhoto shares or saves it straight away as before.
//
// A WebGL canvas is cleared once it's on screen, so call takePhoto() right
// after rendering a frame, in the same task.

/** Copy the canvas now; the image (JPEG, or PNG for 1984 mode's crisp pixels) follows. */
export function takePhoto(canvas: HTMLCanvasElement, retro: boolean): Promise<Blob | null> {
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

  return new Promise((resolve) => out.toBlob(resolve, retro ? 'image/png' : 'image/jpeg', 0.9));
}

/** Share a photo (phones) or save it: for when the flight log can't keep it. */
export async function savePhoto(blob: Blob): Promise<string> {
  const name = `witchspace-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}.${blob.type === 'image/png' ? 'png' : 'jpg'}`;
  const file = new File([blob], name, { type: blob.type });
  // Phones: hand it to the share sheet. Dismissing it falls back to saving.
  if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Witchspace', text: 'witchspace.org.uk' });
      return 'Photo shared';
    } catch {
      // Dismissed, or not allowed: save it instead.
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return `Photo saved · ${name}`;
}
