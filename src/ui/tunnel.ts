import { isRetro } from '../render/renderer';

const canvas = document.querySelector<HTMLCanvasElement>('#tunnel')!;

/**
 * The launch / docking tunnel: nested rectangles rushing past, as in the
 * original. Resolves when the animation finishes.
 */
export function playTunnel(seconds = 1.6): Promise<void> {
  canvas.hidden = false;
  const ctx = canvas.getContext('2d')!;
  const retro = isRetro();
  const start = performance.now();

  return new Promise((resolve) => {
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const w = (canvas.width = retro ? 256 : innerWidth);
      const h = (canvas.height = retro ? 192 : innerHeight);
      ctx.fillStyle = '#000';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = retro ? '#fff' : '#3dffb0';
      ctx.lineWidth = retro ? 1 : 2;
      if (!retro) {
        ctx.shadowColor = '#3dffb0';
        ctx.shadowBlur = 14;
      }
      // Rectangles grow exponentially, so they appear to rush towards you.
      for (let i = 0; i < 12; i++) {
        const k = ((i / 12 + t * 1.4) % 1) ** 3;
        const rw = (w / 2) * k * 1.4;
        const rh = (h / 2) * k * 1.4;
        ctx.strokeRect(w / 2 - rw, h / 2 - rh, rw * 2, rh * 2);
      }
      if (t < seconds) requestAnimationFrame(frame);
      else {
        canvas.hidden = true;
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}
