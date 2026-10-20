import { distanceLy, ECONOMIES, galaxy, GOVERNMENTS, type StarSystem } from '../galaxy/generate';
import { escapeHtml } from './escape';
import { stationName } from '../galaxy/stationNames';
import { isRetro } from '../render/renderer';

// The galactic and local charts. Systems are plotted at (x, y/2): the
// original's distance formula counts vertical distance at half weight, so
// halving y makes the jump-range circle a true circle.

export type ChartMode = 'galactic' | 'local';

const LOCAL_SPAN = 60; // chart units shown across the local view
const LY_PER_UNIT = 0.4; // light years per chart unit (after halving y)

interface Options {
  current: StarSystem;
  /** Fuel range in light years; drawn as a circle. */
  range: number;
  /** Currently chosen destination, if any. */
  target: StarSystem | null;
  onTarget: (s: StarSystem) => void;
}

const root = document.querySelector<HTMLElement>('#galaxy-map')!;
const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
const title = root.querySelector<HTMLElement>('.map-title')!;
const info = root.querySelector<HTMLElement>('.map-info')!;

let mode: ChartMode = 'galactic';
let opts: Options | null = null;
let cursor: StarSystem | null = null;

export const isMapOpen = () => !root.hidden;

export function openMap(o: Options, startMode: ChartMode = 'galactic') {
  opts = o;
  mode = startMode;
  cursor = o.target ?? o.current;
  root.hidden = false;
  draw();
}

export function closeMap() {
  root.hidden = true;
  opts = null;
}

export function toggleMapMode() {
  mode = mode === 'galactic' ? 'local' : 'galactic';
  draw();
}

/** Arrow keys move the cursor to the nearest system in that direction. */
export function moveCursor(dx: number, dy: number) {
  if (!opts || !cursor) return;
  const from = cursor;
  let best: StarSystem | null = null;
  let bestScore = Infinity;
  for (const s of galaxy(from.galaxy)) {
    if (s === from) continue;
    const vx = s.x - from.x;
    const vy = (s.y - from.y) / 2;
    const along = vx * dx + vy * dy;
    if (along <= 0) continue;
    const across = Math.abs(vx * dy - vy * dx);
    // The nearest system within 60° of that direction, with a mild
    // preference for ones closer to straight ahead.
    const angle = Math.atan2(across, along);
    if (angle > Math.PI / 3) continue;
    const score = Math.hypot(vx, vy) * (1 + angle * 1.5);
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (best) {
    cursor = best;
    draw();
  }
}

/** Confirm the system under the cursor as the destination. */
export function chooseCursor() {
  if (opts && cursor && cursor !== opts.current) {
    opts.target = cursor;
    opts.onTarget(cursor);
    draw();
  }
}

// --- Drawing -------------------------------------------------------------------

function view() {
  const w = root.clientWidth;
  const h = root.clientHeight;
  const cur = opts!.current;
  if (mode === 'galactic') {
    // Whole galaxy: 256 × 128 chart units, fitted with a margin.
    const scale = Math.min((w - 80) / 256, (h - 240) / 128);
    const ox = (w - 256 * scale) / 2;
    const oy = 90 + (h - 240 - 128 * scale) / 2;
    return { scale, toScreen: (s: StarSystem) => [ox + s.x * scale, oy + (s.y / 2) * scale] as const };
  }
  const scale = Math.min(w - 80, h - 240) / LOCAL_SPAN;
  const cx = w / 2;
  const cy = 90 + (h - 240) / 2;
  return {
    scale,
    toScreen: (s: StarSystem) => [cx + (s.x - cur.x) * scale, cy + ((s.y - cur.y) / 2) * scale] as const,
  };
}

function draw() {
  if (!opts) return;
  const retro = isRetro();
  const dpr = Math.min(devicePixelRatio, 2);
  const w = root.clientWidth;
  const h = root.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  const colours = retro
    ? { star: '#fff', dim: '#fff', current: '#fff', range: '#fff', target: '#fff', cursor: '#fff', text: '#fff' }
    : { star: '#9fd8c4', dim: '#3c6a5c', current: '#3dffb0', range: 'rgba(61,255,176,0.45)', target: '#ffb347', cursor: '#ffffff', text: '#d7fff0' };
  const font = retro ? '10px "Press Start 2P", monospace' : '14px Rajdhani, sans-serif';
  const { scale, toScreen } = view();
  const cur = opts.current;

  // Jump range circle around the current system.
  const [cx, cy] = toScreen(cur);
  ctx.strokeStyle = colours.range;
  ctx.lineWidth = retro ? 2 : 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, (opts.range / LY_PER_UNIT) * scale, 0, Math.PI * 2);
  ctx.stroke();

  // Systems.
  ctx.font = font;
  ctx.textBaseline = 'middle';
  for (const s of galaxy(cur.galaxy)) {
    const [x, y] = toScreen(s);
    if (x < -20 || y < 60 || x > w + 20 || y > h - 130) continue;
    const reachable = distanceLy(cur, s) <= opts.range;
    const size = mode === 'galactic' ? 1.5 + s.techLevel / 6 : 2.5 + s.techLevel / 4;
    ctx.fillStyle = reachable || retro ? colours.star : colours.dim;
    if (retro) ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.ceil(size), Math.ceil(size));
    else {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    if (mode === 'local') {
      ctx.fillStyle = reachable ? colours.text : colours.dim;
      ctx.fillText(s.name, x + size + 6, y);
    }
  }

  // Current system, chosen destination and the cursor.
  const mark = (s: StarSystem, colour: string, radius: number, cross: boolean) => {
    const [x, y] = toScreen(s);
    ctx.strokeStyle = colour;
    ctx.lineWidth = retro ? 2 : 2;
    if (!retro) {
      ctx.shadowColor = colour;
      ctx.shadowBlur = 10;
    }
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    if (cross) {
      ctx.beginPath();
      ctx.moveTo(x - radius - 6, y);
      ctx.lineTo(x - radius + 3, y);
      ctx.moveTo(x + radius - 3, y);
      ctx.lineTo(x + radius + 6, y);
      ctx.moveTo(x, y - radius - 6);
      ctx.lineTo(x, y - radius + 3);
      ctx.moveTo(x, y + radius - 3);
      ctx.lineTo(x, y + radius + 6);
      ctx.stroke();
    }
    ctx.shadowBlur = 0;
  };
  mark(cur, colours.current, 7, false);
  if (opts.target) mark(opts.target, colours.target, 9, false);
  if (cursor) mark(cursor, colours.cursor, 12, true);

  title.textContent = mode === 'galactic' ? `Galactic chart · Galaxy ${cur.galaxy + 1}` : `Local chart · ${cur.name}`;
  renderInfo();
}

function renderInfo() {
  if (!opts || !cursor) return;
  const s = cursor;
  const d = distanceLy(opts.current, s);
  const here = s === opts.current;
  const rows: [string, string][] = [
    ['Distance', here ? 'You are here' : `${d.toFixed(1)} light years${d <= opts.range ? '' : ' (out of range)'}`],
    ['Station', stationName(s).name],
    ['Economy', ECONOMIES[s.economy]],
    ['Government', GOVERNMENTS[s.government]],
    ['Tech level', String(s.techLevel)],
    ['Population', `${s.population.toFixed(1)} billion`],
    ['Productivity', `${s.productivity.toLocaleString()} M Cr`],
    ['Average radius', `${s.radius.toLocaleString()} km`],
  ];
  const isTarget = opts.target === s;
  // Station names are community content, so everything is escaped.
  info.innerHTML = `<h3>${escapeHtml(s.name)}${isTarget ? ' <em>Destination</em>' : ''}</h3><dl>${rows
    .map(([k, v]) => `<dt>${escapeHtml(k)}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('')}</dl>`;
}

// Click a system to select it; click it again to set it as the destination.
canvas.addEventListener('click', (e) => {
  if (!opts) return;
  const rect = canvas.getBoundingClientRect();
  const px = e.clientX - rect.left;
  const py = e.clientY - rect.top;
  const { toScreen } = view();
  let best: StarSystem | null = null;
  let bestD = 18;
  for (const s of galaxy(opts.current.galaxy)) {
    const [x, y] = toScreen(s);
    const d = Math.hypot(x - px, y - py);
    if (d < bestD) {
      bestD = d;
      best = s;
    }
  }
  if (!best) return;
  if (best === cursor) chooseCursor();
  else {
    cursor = best;
    draw();
  }
});

addEventListener('resize', () => {
  if (isMapOpen()) draw();
});
