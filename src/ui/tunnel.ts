import { fitRetroCanvas, isRetro, retroSize } from '../render/renderer';

const canvas = document.querySelector<HTMLCanvasElement>('#tunnel')!;
const whiteout = document.querySelector<HTMLElement>('#whiteout')!;

/**
 * Transition sequences. Each resolves when its animation finishes.
 * - 'dock': launching or docking. In 1984 mode, the original's tunnel of
 *   rushing rectangles; in neo-vector, a flight down the lit docking bay.
 * - 'hyperspace': stars stretch into streaks, accelerate into a tunnel of
 *   light, converge, and white out. Call fadeFromWhite() after arriving.
 */
export function playTunnel(seconds = 1.6, style: 'dock' | 'hyperspace' = 'dock'): Promise<void> {
  return style === 'hyperspace' ? playHyperspace(seconds) : playDock(seconds);
}

/** Size the canvas to the view. Only resizes when needed, since resizing clears it. */
function sizeCanvas(retro: boolean) {
  const r = retroSize();
  const w = retro ? r.w : innerWidth;
  const h = retro ? r.h : innerHeight;
  if (retro) fitRetroCanvas(canvas);
  else canvas.style.width = canvas.style.height = '';
  if (canvas.width !== w) canvas.width = w;
  if (canvas.height !== h) canvas.height = h;
  return { w, h };
}

function playDock(seconds: number): Promise<void> {
  canvas.hidden = false;
  const ctx = canvas.getContext('2d')!;
  const retro = isRetro();
  const start = performance.now();
  return new Promise((resolve) => {
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const { w, h } = sizeCanvas(retro);
      if (retro) drawRectangles(ctx, w, h, t);
      else drawBay(ctx, w, h, t, seconds);
      if (t < seconds) requestAnimationFrame(frame);
      else {
        canvas.hidden = true;
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/** 1984 mode: the original's tunnel of white rectangles rushing towards you. */
function drawRectangles(ctx: CanvasRenderingContext2D, w: number, h: number, t: number) {
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1;
  ctx.shadowBlur = 0;
  // Rectangles grow exponentially, so they appear to rush towards you.
  for (let i = 0; i < 12; i++) {
    const k = ((i / 12 + t * 1.4) % 1) ** 3;
    const rw = (w / 2) * k * 1.4;
    const rh = (h / 2) * k * 1.4;
    ctx.strokeRect(w / 2 - rw, h / 2 - rh, rw * 2, rh * 2);
  }
}

// Neo-vector: flying down the station's docking bay. Rows of warm lights set
// into the walls stream past towards a vanishing point, fading in from black
// and out again at the end.
const BAY_ROWS = 9; // rows of lights along the bay
const BAY_SPEED = 0.9; // the bay's length passed per second
const BAY_LIGHTS: [number, number][] = [
  // [across, up] on the bay's walls, in units of its half-width and half-height.
  [-1, -0.55], [-1, 0], [-1, 0.55], [1, -0.55], [1, 0], [1, 0.55],
  [-0.5, 1], [0, 1], [0.5, 1], [-0.5, -1], [0, -1], [0.5, -1],
];

function drawBay(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, seconds: number) {
  ctx.globalCompositeOperation = 'source-over';
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(2, 4, 8, 0.85)'; // a trace of the last frame stays: a little motion blur
  ctx.fillRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const fx = w * 0.42; // perspective scale
  const fy = h * 0.42;
  const fade = Math.min(1, t / 0.25, (seconds - t) / 0.35);
  // The bay's four long edges, faint, running away to the far end.
  ctx.strokeStyle = `rgba(150, 175, 205, ${0.16 * fade})`;
  ctx.lineWidth = 1;
  for (const [ax, ay] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.beginPath();
    ctx.moveTo(cx + (ax * fx) / 0.03, cy + (ay * fy) / 0.03);
    ctx.lineTo(cx + (ax * fx) / 3, cy + (ay * fy) / 3);
    ctx.stroke();
  }
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  for (let i = 0; i < BAY_ROWS; i++) {
    // Depth runs from far (1) to near (0); each row cycles towards you.
    const z = 1 - ((i / BAY_ROWS + t * BAY_SPEED) % 1);
    const near = Math.max(0.035, z * 3);
    const nearer = Math.max(0.03, near * 0.86); // a short dash, not a ray
    const glow = (1 - z) ** 1.5 * fade;
    for (const [ax, ay] of BAY_LIGHTS) {
      const x0 = cx + (ax * fx) / near;
      const y0 = cy + (ay * fy) / near;
      const x1 = cx + (ax * fx) / nearer;
      const y1 = cy + (ay * fy) / nearer;
      ctx.strokeStyle = `rgba(255, 196, 120, ${0.85 * glow})`;
      ctx.lineWidth = 1 + 5 * (1 - z);
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
      ctx.stroke();
    }
  }
  // The far end of the bay: a soft glow where you're heading.
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(w, h) * 0.08);
  g.addColorStop(0, `rgba(255, 226, 180, ${0.22 * fade})`);
  g.addColorStop(1, 'rgba(255, 226, 180, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = 'source-over';
}

const smooth = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

function playHyperspace(seconds: number): Promise<void> {
  canvas.hidden = false;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const retro = isRetro();
  const start = performance.now();
  let last = start;

  // Stars as points in a tube ahead of us: an angle around the axis, a radius
  // from it, and a depth. Moving forward means reducing depth.
  const N = retro ? 140 : 520;
  const stars = Array.from({ length: N }, () => ({
    angle: Math.random() * Math.PI * 2,
    radius: 0.15 + Math.random() * 0.85,
    z: 0.05 + Math.random() * 0.95,
    tint: Math.random(),
  }));

  return new Promise((resolve) => {
    const frame = (now: number) => {
      const t = (now - start) / 1000;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w, h } = sizeCanvas(retro);
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.max(w, h) * 0.12;
      const p = t / seconds;

      // Speed builds smoothly, holds, then surges at the end.
      const speed = 0.08 + 1.6 * smooth(p / 0.55) + 2.4 * smooth((p - 0.75) / 0.25);
      const trail = 0.012 + 0.22 * smooth(p / 0.6);

      // The view of the system fades out behind the streaks over the first
      // half second, whatever the frame rate.
      canvas.style.background = `rgba(0, 2, 6, ${retro ? 1 : smooth(t / 0.5)})`;

      // Leave a faint afterimage for silky motion.
      ctx.globalCompositeOperation = 'source-over';
      if (retro) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
      } else {
        // Fade the previous frame towards transparent, keeping a short trail.
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = retro ? 'source-over' : 'lighter';
      ctx.lineCap = 'round';
      const twist = smooth(p) * 0.35; // a gentle rotation as we go deeper
      for (const s of stars) {
        s.z -= speed * dt;
        if (s.z <= 0.02) {
          s.z += 1;
          s.angle = Math.random() * Math.PI * 2;
        }
        const a = s.angle + twist;
        const r1 = (s.radius / s.z) * scale;
        const r0 = (s.radius / (s.z + trail)) * scale;
        if (r1 > Math.hypot(w, h)) continue;
        const nearness = Math.min(1, 0.15 / s.z);
        if (retro) {
          ctx.strokeStyle = '#fff';
          ctx.lineWidth = 1;
        } else {
          // Pale blue-white, a touch warmer for some stars.
          const hue = 200 + s.tint * 25;
          ctx.strokeStyle = `hsla(${hue}, 70%, ${70 + nearness * 25}%, ${0.25 + nearness * 0.75})`;
          ctx.lineWidth = 0.6 + nearness * 1.8;
        }
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
        ctx.stroke();
      }

      // A soft glow gathering at the vanishing point.
      if (!retro) {
        const glow = smooth((p - 0.3) / 0.7);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(w, h) * (0.08 + glow * 0.35));
        g.addColorStop(0, `rgba(210, 235, 255, ${0.55 * glow})`);
        g.addColorStop(1, 'rgba(210, 235, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);
      }

      // The final moment: everything washes to white.
      const white = smooth((p - 0.86) / 0.14);
      if (white > 0) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.fillStyle = retro ? `rgba(255,255,255,${white > 0.5 ? 1 : 0})` : `rgba(240, 248, 255, ${white})`;
        ctx.fillRect(0, 0, w, h);
      }

      if (t < seconds) requestAnimationFrame(frame);
      else {
        // Hand over to the white overlay, which fades out once we've arrived.
        whiteout.classList.remove('fade');
        whiteout.hidden = false;
        canvas.hidden = true;
        canvas.style.background = '';
        resolve();
      }
    };
    requestAnimationFrame(frame);
  });
}

/** After a hyperspace arrival: let the new system emerge from the white. */
export function fadeFromWhite() {
  if (whiteout.hidden) return;
  void whiteout.offsetWidth; // restart the transition
  whiteout.classList.add('fade');
  setTimeout(() => {
    whiteout.hidden = true;
    whiteout.classList.remove('fade');
  }, 1600);
}
