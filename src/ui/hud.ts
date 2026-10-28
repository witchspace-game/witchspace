import * as THREE from 'three';
import type { PlayerShip } from '../game/playerShip';
import { MAX_ROLL_ERROR, type Station } from '../game/station';
import { isRetro } from '../render/renderer';

const DOCK_AID_RANGE = 3000;

// The scanner: the original's ellipse with stalks for height. Two ranges
// (R switches): close for dogfights, wide for traffic.
const SCANNER_RANGES = [4000, 12000]; // metres

// The dashboard glows in your ship's paint: green in a Cobra from the yard,
// Nebula pink in a Witch-fire Edition. The scanner's contacts keep their own colours.
let dash = '61,255,176';
export function setDashColour(hex: string | null) {
  const n = parseInt((hex ?? '#3dffb0').slice(1), 16);
  dash = `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
  document.documentElement.style.setProperty('--dash', `rgb(${dash})`);
}
let rangeIndex = (() => {
  try {
    return Number(localStorage.getItem('witchspace.scannerRange') ?? 0) === 1 ? 1 : 0;
  } catch {
    return 0;
  }
})();

/** Switch the scanner's range; returns the new range in metres. */
export function toggleScannerRange(): number {
  rangeIndex = 1 - rangeIndex;
  try {
    localStorage.setItem('witchspace.scannerRange', String(rangeIndex));
  } catch {
    // Storage blocked: the choice lasts this session.
  }
  return SCANNER_RANGES[rangeIndex];
}

export type BlipKind = 'station' | 'ship' | 'commander' | 'cargo' | 'missile';

export interface Blip {
  position: THREE.Vector3;
  color: string;
  kind: BlipKind;
  /** The ship in your sights. */
  sighted?: boolean;
  /** Your missile is locked on to it. */
  locked?: boolean;
}

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

const gauges = {
  shields: $('#g-shields'),
  hull: $('#g-hull'),
  speed: $('#g-speed'),
  roll: $('#g-roll'),
  pitch: $('#g-pitch'),
};
const scanner = $<HTMLCanvasElement>('#scanner');
const compass = $<HTMLCanvasElement>('#compass');
const dockAid = $('#dock-aid');
const aid = {
  dist: $('#aid-dist'),
  roll: $('#aid-roll'),
  heading: $('#aid-heading'),
  rollMarker: $('#aid-roll-marker'),
  rollMatch: $('#aid-roll-match'),
};
const banner = $('#banner');
const dcLight = $('#dc-light');

const setBar = (el: HTMLElement, frac: number) => el.style.setProperty('--v', String(THREE.MathUtils.clamp(frac, 0, 1)));
const setCentred = (el: HTMLElement, v: number) => el.style.setProperty('--v', String(THREE.MathUtils.clamp(v, -1, 1)));

let bannerTimer = 0;
/** Messages that warn of danger or trouble with the law get a red edge. */
const DANGER = /incoming|destroyed!|fugitive|offender|sting|lost|refused|under attack|overheated|game over|warrant|cease fire|damaged|hostile/i;

// Messages wait their turn, so each can be read: one stays up long enough to
// read before the next replaces it. A warning shows at once; so does an update
// of the message on screen (the same words before the first " · ", like a
// countdown); a repeat just keeps it up. A few at most wait, oldest dropped.
const QUEUE_MAX = 3;
const readTime = (text: string, seconds: number) => Math.min(seconds, Math.max(1.8, text.length / 18));
const topic = (text: string) => text.split(' · ')[0];
let showing = '';
let shownAt = 0;
let sticky = false; // shown with no time limit (game over): nothing replaces it
let queue: { text: string; seconds: number }[] = [];
let queueTimer = 0;

export function flash(text: string, seconds = 2.5) {
  const now = performance.now() / 1000;
  const up = !banner.hidden;
  if (up && text === showing && !sticky) return show(text, seconds, false);
  const urgent = DANGER.test(text) || seconds === 0;
  if (!up || urgent || (!sticky && (topic(text) === topic(showing) || now - shownAt >= readTime(showing, 99)))) return show(text, seconds, true);
  if (sticky) return;
  queue = queue.filter((q) => topic(q.text) !== topic(text));
  queue.push({ text, seconds });
  if (queue.length > QUEUE_MAX) queue.shift();
  clearTimeout(queueTimer);
  queueTimer = window.setTimeout(next, (readTime(showing, 99) - (now - shownAt)) * 1000);
}

function show(text: string, seconds: number, fresh: boolean) {
  banner.textContent = text;
  banner.hidden = false;
  banner.classList.toggle('danger', DANGER.test(text));
  if (fresh) {
    showing = text;
    shownAt = performance.now() / 1000;
    sticky = seconds === 0;
    // Restart the entrance each time a new message arrives.
    banner.classList.remove('pop');
    void banner.offsetWidth;
    banner.classList.add('pop');
  }
  clearTimeout(bannerTimer);
  if (seconds > 0) bannerTimer = window.setTimeout(() => {
    banner.hidden = true;
    next();
  }, seconds * 1000);
  if (fresh && queue.length) {
    clearTimeout(queueTimer);
    queueTimer = window.setTimeout(next, readTime(text, seconds || 99) * 1000);
  }
}

function next() {
  if (sticky) return;
  const n = queue.shift();
  if (n) show(n.text, Math.max(n.seconds, readTime(n.text, n.seconds)), true);
}

export function clearFlash() {
  banner.hidden = true;
  queue = [];
  sticky = false;
  clearTimeout(queueTimer);
}

let interference = 0;
/** Sensor interference (0..1), as near a witchspace rift: static on the scanner. */
export function setInterference(level: number) {
  interference = level;
}

/** Speckles of static across the scanner, thicker the worse the interference. */
function drawStatic(ctx: CanvasRenderingContext2D, w: number, h: number) {
  ctx.fillStyle = isRetro() ? '#ffffff' : 'rgba(207,224,255,0.75)';
  for (let i = 0; i < interference * 260; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 1);
}

function drawScanner(ship: PlayerShip, blips: Blip[]) {
  const ctx = scanner.getContext('2d')!;
  const { width: w, height: h } = scanner;
  const retro = isRetro();
  ctx.clearRect(0, 0, w, h);
  const cx = w / 2;
  const cy = h / 2;
  const rx = w / 2 - 6;
  const ry = h / 2 - 6;
  const line = retro ? '#ffffff' : `rgba(${dash},0.55)`;

  ctx.lineWidth = retro ? 2 : 1.25;
  ctx.strokeStyle = line;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx / 2, ry / 2, 0, 0, Math.PI * 2);
  ctx.moveTo(cx - rx, cy);
  ctx.lineTo(cx + rx, cy);
  ctx.moveTo(cx, cy - ry);
  ctx.lineTo(cx, cy + ry);
  ctx.stroke();
  ctx.globalAlpha = 1;

  const range = SCANNER_RANGES[rangeIndex];
  const now = performance.now() / 1000;
  ctx.font = `${retro ? 8 : 11}px ${retro ? '"Press Start 2P", monospace' : 'Rajdhani, sans-serif'}`;
  ctx.fillStyle = line;
  ctx.textAlign = 'right';
  ctx.fillText(`${range / 1000} km`, w - 4, h - 4);
  ctx.textAlign = 'left';

  // Each contact sits on the ecliptic with a stalk showing its height.
  // Ships are bars, as in 1984; cargo a small box; missiles a blinking dart.
  const local = new THREE.Vector3();
  for (const b of blips) {
    local.copy(b.position);
    ship.obj.worldToLocal(local);
    const color = retro ? '#ffffff' : b.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = retro ? 2 : 1.5;
    if (local.length() > range) {
      // Out of range: an arrow on the rim pointing its way. Not for cargo.
      if (b.kind === 'cargo') continue;
      const ang = Math.atan2(local.z, -local.x);
      const ex = cx + Math.cos(ang) * rx;
      const ey = cy - Math.sin(ang) * ry;
      ctx.globalAlpha = 0.75;
      ctx.beginPath();
      const out = Math.atan2(-(ey - cy) / ry, (ex - cx) / rx);
      const tip = (b.kind === 'station' ? 7 : 5) + (retro ? 1 : 0);
      ctx.moveTo(ex + Math.cos(out) * 2, ey - Math.sin(out) * 2);
      ctx.lineTo(ex - Math.cos(out) * tip + Math.sin(out) * tip * 0.6, ey + Math.sin(out) * tip + Math.cos(out) * tip * 0.6);
      ctx.lineTo(ex - Math.cos(out) * tip - Math.sin(out) * tip * 0.6, ey + Math.sin(out) * tip - Math.cos(out) * tip * 0.6);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
      continue;
    }
    const x = cx + (-local.x / range) * rx;
    const y = cy - (local.z / range) * ry;
    const top = y - (local.y / range) * ry * 1.6;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top);
    ctx.stroke();
    if (b.kind === 'cargo') {
      ctx.strokeRect(Math.round(x - 2) + 0.5, Math.round(top - 3) + 0.5, 4, 4);
    } else if (b.kind === 'missile') {
      if (Math.floor(now * 6) % 2 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, top - 4);
        ctx.lineTo(x - 3, top + 2);
        ctx.lineTo(x + 3, top + 2);
        ctx.closePath();
        ctx.fill();
      }
    } else if (b.kind === 'commander') {
      // Another commander: a diamond, so players stand out from NPC ships.
      ctx.beginPath();
      ctx.moveTo(x, top - 4);
      ctx.lineTo(x + 4, top);
      ctx.lineTo(x, top + 4);
      ctx.lineTo(x - 4, top);
      ctx.closePath();
      ctx.fill();
    } else {
      const s = b.kind === 'station' ? 9 : 6;
      ctx.fillRect(x - s / 2, top - 2, s, 3);
    }
    // The ship in your sights gets brackets; a missile lock, a pulsing ring.
    if (b.sighted) {
      ctx.strokeStyle = retro ? '#ffffff' : '#eafff6';
      ctx.lineWidth = 1;
      const r = 6;
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.beginPath();
        ctx.moveTo(x + sx * r, top + sy * (r - 3));
        ctx.lineTo(x + sx * r, top + sy * r);
        ctx.lineTo(x + sx * (r - 3), top + sy * r);
        ctx.stroke();
      }
    }
    if (b.locked) {
      ctx.strokeStyle = retro ? '#ffffff' : '#ff4d6d';
      ctx.lineWidth = 1.5;
      ctx.globalAlpha = 0.5 + 0.5 * Math.sin(now * 8);
      ctx.beginPath();
      ctx.arc(x, top, 9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }
  if (interference > 0) drawStatic(ctx, w, h);
}

function drawCompass(ship: PlayerShip, target: THREE.Vector3) {
  const ctx = compass.getContext('2d')!;
  const { width: w, height: h } = compass;
  const retro = isRetro();
  const r = w / 2 - 3;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = retro ? '#fff' : `rgba(${dash},0.6)`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  ctx.stroke();
  const dir = ship.obj.worldToLocal(target.clone()).normalize();
  const x = w / 2 + -dir.x * (r - 4);
  const y = h / 2 - dir.y * (r - 4);
  // Solid dot: station is ahead. Hollow: it's behind you.
  ctx.fillStyle = ctx.strokeStyle = retro ? '#fff' : '#ffb347';
  ctx.beginPath();
  ctx.arc(x, y, 4, 0, Math.PI * 2);
  if (dir.z >= 0) ctx.fill();
  else ctx.stroke();
}

export function updateHud(ship: PlayerShip, station: Station, blips: Blip[], dockingComputerOn: boolean, rollMatching: boolean) {
  setBar(gauges.shields, ship.shields / ship.def.stats.shields);
  setBar(gauges.hull, ship.hull / ship.def.stats.hull);
  setBar(gauges.speed, ship.speed / ship.maxSpeed);
  setCentred(gauges.roll, ship.rollGauge);
  setCentred(gauges.pitch, ship.pitchGauge);
  dcLight.classList.toggle('on', dockingComputerOn);

  drawScanner(ship, blips);
  drawCompass(ship, station.root.position);

  const dist = ship.obj.position.distanceTo(station.root.position);
  const show = dist < DOCK_AID_RANGE && !isRetro();
  dockAid.hidden = !show;
  if (show) {
    const roll = station.rollError(ship);
    const heading = station.headingError(ship);
    const rollOk = Math.abs(roll) <= MAX_ROLL_ERROR;
    aid.dist.textContent = `${Math.max(0, Math.round(dist - 80))} m`;
    aid.roll.textContent = `${Math.round(THREE.MathUtils.radToDeg(roll))}°`;
    aid.roll.classList.toggle('ok', rollOk);
    aid.heading.textContent = `${Math.round(THREE.MathUtils.radToDeg(heading))}°`;
    aid.heading.classList.toggle('ok', heading < THREE.MathUtils.degToRad(20));
    setCentred(aid.rollMarker, roll / (Math.PI / 2));
    aid.rollMarker.classList.toggle('ok', rollOk);
    aid.rollMatch.hidden = !rollMatching;
  }
}
