import * as THREE from 'three';
import type { PlayerShip } from '../game/playerShip';
import { MAX_ROLL_ERROR, type Station } from '../game/station';
import { isRetro } from '../render/renderer';

const SCANNER_RANGE = 4000; // metres
const DOCK_AID_RANGE = 3000;

export interface Blip {
  position: THREE.Vector3;
  color: string;
  big?: boolean;
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
export function flash(text: string, seconds = 2.5) {
  banner.textContent = text;
  banner.hidden = false;
  clearTimeout(bannerTimer);
  if (seconds > 0) bannerTimer = window.setTimeout(() => (banner.hidden = true), seconds * 1000);
}
export function clearFlash() {
  banner.hidden = true;
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
  const line = retro ? '#ffffff' : 'rgba(61,255,176,0.55)';

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

  // Each contact is a dot on the ecliptic with a stalk showing height.
  const local = new THREE.Vector3();
  for (const b of blips) {
    local.copy(b.position);
    ship.obj.worldToLocal(local);
    if (local.length() > SCANNER_RANGE) continue;
    const x = cx + (-local.x / SCANNER_RANGE) * rx;
    const y = cy - (local.z / SCANNER_RANGE) * ry;
    const top = y - (local.y / SCANNER_RANGE) * ry * 1.6;
    const color = retro ? '#ffffff' : b.color;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = retro ? 2 : 1.5;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, top);
    ctx.stroke();
    const s = b.big ? 7 : 5;
    ctx.fillRect(x - s / 2, top - 2, s, 3);
  }
}

function drawCompass(ship: PlayerShip, target: THREE.Vector3) {
  const ctx = compass.getContext('2d')!;
  const { width: w, height: h } = compass;
  const retro = isRetro();
  const r = w / 2 - 3;
  ctx.clearRect(0, 0, w, h);
  ctx.strokeStyle = retro ? '#fff' : 'rgba(61,255,176,0.6)';
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
