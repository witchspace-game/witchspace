// P: take a photo of the view. The 3D scene is its own canvas with the HUD
// drawn over it in HTML, so a photo is the scene alone: no HUD, just the
// shot, with a small mark in the corner. On phones it goes straight to the
// share sheet (WhatsApp, Instagram, Messages…); elsewhere it's saved.
//
// A WebGL canvas is cleared once it's on screen, so call takePhoto() right
// after rendering a frame, in the same task.

/** Copy the canvas now; save or share it after. */
export function takePhoto(canvas: HTMLCanvasElement, retro: boolean): Promise<string> {
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

  const name = `witchspace-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{8})/, '$1-')}.png`;
  return new Promise((resolve) => {
    out.toBlob(async (blob) => {
      if (!blob) return resolve('Photo failed');
      const file = new File([blob], name, { type: 'image/png' });
      // Phones: hand it to the share sheet. Dismissing it falls back to saving.
      if (matchMedia('(pointer: coarse)').matches && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Witchspace', text: 'witchspace.org.uk' });
          return resolve('Photo shared');
        } catch {
          // Dismissed, or not allowed: save it instead.
        }
      }
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      resolve(`Photo saved · ${name}`);
    }, 'image/png');
  });
}
