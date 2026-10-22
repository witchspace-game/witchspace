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
  /** News of a system that has reached the current one: a short line, or null. */
  news?: (s: StarSystem) => string | null;
  /** Your record of a system: whether you've been, and a line on what you surveyed and found. */
  explored?: (s: StarSystem) => { visited: boolean; line: string };
}

const root = document.querySelector<HTMLElement>('#galaxy-map')!;
const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
const title = root.querySelector<HTMLElement>('.map-title')!;
const info = root.querySelector<HTMLElement>('.map-info')!;
const modeButton = root.querySelector<HTMLButtonElement>('.map-mode')!;
const findForm = root.querySelector<HTMLFormElement>('.map-find')!;
const findInput = findForm.querySelector<HTMLInputElement>('input')!;
const findList = findForm.querySelector<HTMLUListElement>('ul')!;

let mode: ChartMode = 'galactic';
let opts: Options | null = null;
let cursor: StarSystem | null = null;

export const isMapOpen = () => !root.hidden;

export function openMap(o: Options, startMode: ChartMode = small() ? 'local' : 'galactic') {
  opts = o;
  // On a phone the whole galaxy is too small to tap: start close in, as Elite's short-range chart did.
  mode = startMode;
  cursor = o.target ?? o.current;
  root.hidden = false;
  draw();
}

export function closeMap() {
  root.hidden = true;
  opts = null;
  findInput.value = '';
  findList.innerHTML = '';
  findInput.blur();
}

// --- Find a system ---------------------------------------------------------------

/** Systems in this galaxy whose names start with (then contain) what's typed, nearest first. */
function matches(text: string): StarSystem[] {
  const q = text.trim().toLowerCase();
  if (!q || !opts) return [];
  const all = galaxy(opts.current.galaxy);
  const by = (s: StarSystem) => distanceLy(opts!.current, s);
  const starts = all.filter((s) => s.name.toLowerCase().startsWith(q)).sort((a, b) => by(a) - by(b));
  const inside = all.filter((s) => !starts.includes(s) && s.name.toLowerCase().includes(q)).sort((a, b) => by(a) - by(b));
  return [...starts, ...inside].slice(0, 6);
}

/** Put the cursor on a system, showing the whole galaxy if it's off the local chart. */
function findSystem(s: StarSystem) {
  if (!opts) return;
  cursor = s;
  if (mode === 'local') {
    const { toScreen, area } = view();
    const [x, y] = toScreen(s);
    if (x < area.left || x > area.right || y < area.top || y > area.bottom) mode = 'galactic';
  }
  findInput.value = '';
  findList.innerHTML = '';
  findInput.blur();
  draw();
}

findInput.addEventListener('input', () => {
  const found = matches(findInput.value);
  findList.innerHTML = found
    .map((s, i) => `<li><button type="button" data-find="${s.index}"${i === 0 ? ' class="first"' : ''}>${escapeHtml(s.name)} <small>${distanceLy(opts!.current, s).toFixed(1)} LY</small></button></li>`)
    .join('');
});
findForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const first = matches(findInput.value)[0];
  if (first) findSystem(first);
});
findList.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-find]');
  if (b && opts) findSystem(galaxy(opts.current.galaxy)[Number(b.dataset.find)]);
});
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    findInput.value = '';
    findList.innerHTML = '';
    findInput.blur();
  }
});

/** F on the chart: start typing a name. */
export function focusFind() {
  findInput.focus();
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

/** A phone-sized screen: the chart has to share it with the info panel. */
const small = () => innerHeight < 520 || innerWidth < 700;

/**
 * The part of the screen the chart can use. On a desktop, the margins the
 * layout always had. On a phone, everything between the title and the hint,
 * beside (landscape) or above (portrait) the info panel.
 */
function chartArea() {
  const w = root.clientWidth;
  const h = root.clientHeight;
  if (!small()) return { left: 40, top: 90, right: w - 40, bottom: h - 150 };
  let right = w - 12;
  let bottom = h - 34;
  const r = info.getBoundingClientRect();
  if (r.width && r.left > w * 0.45) right = r.left - 12;
  else if (r.height && r.top > h * 0.35) bottom = r.top - 8;
  return { left: 12, top: w < 700 ? 84 : 52, right, bottom };
}

function view() {
  const cur = opts!.current;
  const a = chartArea();
  const aw = a.right - a.left;
  const ah = a.bottom - a.top;
  if (mode === 'galactic') {
    // Whole galaxy: 256 × 128 chart units, fitted to the space.
    const scale = Math.min(aw / 256, ah / 128);
    const ox = a.left + (aw - 256 * scale) / 2;
    const oy = a.top + (ah - 128 * scale) / 2;
    return { scale, area: a, toScreen: (s: StarSystem) => [ox + s.x * scale, oy + (s.y / 2) * scale] as const };
  }
  // Local: about a tank and a half of fuel each way, centred on you, names on everything.
  const scale = Math.min(aw, ah * 2) / LOCAL_SPAN;
  const cx = a.left + aw / 2;
  const cy = a.top + ah / 2;
  return {
    scale,
    area: a,
    toScreen: (s: StarSystem) => [cx + (s.x - cur.x) * scale, cy + ((s.y - cur.y) / 2) * scale] as const,
  };
}

function draw() {
  if (!opts) return;
  renderInfo(); // first, so the chart knows how much room the panel takes
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
  const { scale, toScreen, area } = view();
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
    if (x < area.left - 4 || y < area.top - 4 || x > area.right + 4 || y > area.bottom + 4) continue;
    const reachable = distanceLy(cur, s) <= opts.range;
    const size = mode === 'galactic' ? 1.5 + s.techLevel / 6 : 2.5 + s.techLevel / 4;
    ctx.fillStyle = reachable || retro ? colours.star : colours.dim;
    if (retro) ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.ceil(size), Math.ceil(size));
    else {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    }
    // Where you've been: a fine ring, so the chart fills in as you explore.
    if (opts.explored?.(s).visited) {
      ctx.strokeStyle = reachable || retro ? colours.star : colours.dim;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, size + 2.5, 0, Math.PI * 2);
      ctx.stroke();
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
  // Systems in the news: a small diamond beside them.
  if (opts.news) {
    ctx.fillStyle = retro ? '#fff' : '#ffb347';
    for (const s of galaxy(cur.galaxy)) {
      if (!opts.news(s)) continue;
      const [x, y] = toScreen(s);
      ctx.beginPath();
      ctx.moveTo(x + 7, y - 9);
      ctx.lineTo(x + 10, y - 6);
      ctx.lineTo(x + 7, y - 3);
      ctx.lineTo(x + 4, y - 6);
      ctx.fill();
    }
  }
  mark(cur, colours.current, 7, false);
  if (opts.target) mark(opts.target, colours.target, 9, false);
  if (cursor) mark(cursor, colours.cursor, 12, true);

  title.textContent = mode === 'galactic' ? `Galactic chart · Galaxy ${cur.galaxy + 1}` : `Local chart · ${cur.name}`;
  modeButton.textContent = mode === 'galactic' ? 'Local chart' : 'Whole galaxy';
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
    ['Population', `${s.population.toFixed(1)} billion (${s.species})`],
    ['Productivity', `${s.productivity.toLocaleString()} M Cr`],
    ['Average radius', `${s.radius.toLocaleString()} km`],
  ];
  const news = opts.news?.(s);
  if (news) rows.push(['News', news]);
  const explored = opts.explored?.(s);
  if (explored) rows.push(['Explored', explored.line]);
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

modeButton.addEventListener('click', () => {
  modeButton.blur();
  toggleMapMode();
});

addEventListener('resize', () => {
  if (isMapOpen()) draw();
});
