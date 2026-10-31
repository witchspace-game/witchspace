// The showroom and the photo booth (moved from main.ts): the ships on the title, new-game and docked
// screens, turning in their own little scene, and the booth for photographing your own.

import { ships } from '../content/ships';
import { hullOf } from '../game/commander';
import { camera, makeSpace } from '../render/renderer';
import { buildShip, type ShipModel } from '../render/shipModel';
import { buildHangar } from '../render/hangar';
import { $, game } from '../core';
import * as THREE from 'three';

// --- Showroom (title, new game and docked screens) --------------------------

export const showroom = makeSpace();
export const showroomModels = ships.map(buildShip);
for (const m of showroomModels) showroom.scene.add(m.root);
export const cobraIndex = Math.max(0, showroomModels.findIndex((m) => m.def.id === 'cobra-mk3'));
export let shipIndex = cobraIndex;
/** Your own hull's place in the showroom. */
export const ownIndex = () => (game.commander ? Math.max(0, showroomModels.findIndex((m) => m.def.id === hullOf(game.commander!))) : cobraIndex);
let flyIn = 0; // 0 = far away, 1 = arrived
const spin = { x: 0.25, y: 0, dragging: false, lastX: 0, lastY: 0, idle: 0 };
let zoom = 1; // showroom zoom: >1 is closer
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 3;

export function showShip(index: number) {
  shipIndex = (index + showroomModels.length) % showroomModels.length;
  showroomModels.forEach((m, i) => (m.root.visible = i === shipIndex));
  flyIn = 0;
  resetShowroomView();
  updateShipPanel();
}

export function resetShowroomView() {
  spin.x = 0.25;
  spin.y = 0;
  spin.idle = 0;
  zoom = 1;
}

function updateShipPanel() {
  const { def } = showroomModels[shipIndex];
  const s = def.stats;
  $('#ship-name').textContent = def.name;
  $('.ship-nav-name').textContent = def.name;
  $('#ship-meta').textContent = [def.concept ? 'Built to order' : '', def.manufacturer, def.role].filter(Boolean).join(' · ');
  $('#ship-desc').textContent = def.description;
  const rows: [string, string][] = [
    ['Max speed', `${s.maxSpeed} m/s`],
    ['Hull', `${s.hull}`],
    ['Shields', `${s.shields}`],
    ['Cargo', `${s.cargo} t`],
    ['Missiles', `${s.missiles ?? 0}`],
    ['Price', s.price ? `${s.price.toLocaleString()} Cr` : 'Not for sale'],
  ];
  $('#ship-stats').innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  $('#ship-credits').textContent = `Design: ${def.credits.authors.join(', ')}${def.credits.aiAssisted ? ' (AI-assisted)' : ''} · ${def.credits.license}`;
}

// When docked, the ship sits in a berth and the camera walks around it.
const hangar = buildHangar();
hangar.visible = false;
showroom.scene.add(hangar);

function updateBerth(dt: number, model: ShipModel) {
  hangar.visible = true;
  showroom.stars.visible = false;
  // Rest the ship on the pad: its lowest point at floor level.
  const lowest = Math.min(...model.def.geometry.vertices.map((v) => v[1]));
  model.root.position.set(0, -lowest + 1, 0);
  model.root.rotation.set(0, 0.5, 0);
  if (!spin.dragging) {
    spin.idle += dt;
    if (spin.idle > 1.5) spin.y += dt * 0.12; // a slow walk around the ship
  }
  const dist = (model.radius * 3.2) / zoom;
  const elevation = THREE.MathUtils.clamp(0.28 + spin.x * 0.5, 0.05, 1.1);
  const centre = new THREE.Vector3(0, -lowest * 0.6 + 4, 0);
  camera.position.set(
    Math.sin(spin.y) * Math.cos(elevation) * dist,
    centre.y + Math.sin(elevation) * dist,
    Math.cos(spin.y) * Math.cos(elevation) * dist,
  );
  // In the shipyard on a phone, the panel takes the lower part of the screen: lift the ship above it.
  if (document.body.classList.contains('yard-open') && innerWidth <= 700) centre.y -= dist * 0.3;
  camera.lookAt(centre);
}

// --- The photo booth ---------------------------------------------------------------
// Your ship as specced (or as you own her), out of the berth, on black or in
// space, from any angle including below, with a longer lens; the picture goes
// to the flight log like a P photo (Mark: "the configurator but without the
// hangar in the background").

export let booth: { bg: 'space' | 'black' } | null = null;
const BOOTH_FOV = 28;
const pinch = new Map<number, [number, number]>();

export function openBooth() {
  booth = { bg: 'space' };
  spin.x = 0.15;
  spin.y = 0.6;
  zoom = 1;
  document.body.classList.add('photo-booth');
  $('#booth').hidden = false;
  $('#booth .booth-bg').textContent = 'Space';
}

export function closeBooth() {
  booth = null;
  document.body.classList.remove('photo-booth');
  $('#booth').hidden = true;
  camera.fov = 50;
  camera.updateProjectionMatrix();
  resetShowroomView();
}
$('#booth .booth-close').addEventListener('click', closeBooth);
$('#booth .booth-snap').addEventListener('click', () => (game.photoPending = true));
$('#booth .booth-bg').addEventListener('click', (e) => {
  if (!booth) return;
  booth.bg = booth.bg === 'space' ? 'black' : 'space';
  (e.target as HTMLElement).textContent = booth.bg === 'space' ? 'Space' : 'Black';
});
// Two fingers zoom.
addEventListener('pointerdown', (e) => booth && pinch.set(e.pointerId, [e.clientX, e.clientY]));
addEventListener('pointerup', (e) => pinch.delete(e.pointerId));
addEventListener('pointercancel', (e) => pinch.delete(e.pointerId));
addEventListener('pointermove', (e) => {
  if (!booth || !pinch.has(e.pointerId) || pinch.size !== 2) return;
  const [a, b] = [...pinch.values()];
  const before = Math.hypot(a[0] - b[0], a[1] - b[1]);
  pinch.set(e.pointerId, [e.clientX, e.clientY]);
  const [c, d] = [...pinch.values()];
  const after = Math.hypot(c[0] - d[0], c[1] - d[1]);
  if (before > 0) zoom = THREE.MathUtils.clamp(zoom * (after / before), ZOOM_MIN, ZOOM_MAX);
  spin.dragging = false; // a pinch, not a turn
});

function updateBooth(model: ShipModel) {
  hangar.visible = false;
  showroom.stars.visible = booth!.bg === 'space';
  model.root.position.set(0, 0, 0);
  model.root.rotation.set(0, 0, 0);
  if (camera.fov !== BOOTH_FOV) {
    camera.fov = BOOTH_FOV;
    camera.updateProjectionMatrix();
  }
  if (camera.view?.enabled) camera.clearViewOffset();
  // Free all the way round, and from well below: the angles the berth can't reach.
  const elevation = THREE.MathUtils.clamp(spin.x * 0.6, -1.45, 1.45);
  // Fit her to the narrower of the two sides, so a phone held upright frames her whole.
  const half = THREE.MathUtils.degToRad(BOOTH_FOV / 2);
  const narrow = Math.min(half, Math.atan(Math.tan(half) * camera.aspect));
  const dist = (model.radius * 1.1) / Math.sin(narrow) / zoom;
  camera.position.set(Math.sin(spin.y) * Math.cos(elevation) * dist, Math.sin(elevation) * dist, Math.cos(spin.y) * Math.cos(elevation) * dist);
  camera.lookAt(0, 0, 0);
  showroom.stars.position.copy(camera.position);
}

export function updateShowroom(dt: number) {
  const model = showroomModels[shipIndex];
  if (booth && game.state === 'docked') return updateBooth(model);
  if (game.state === 'docked') {
    if (camera.view?.enabled) camera.clearViewOffset();
    updateBerth(dt, model);
    return;
  }
  hangar.visible = false;
  showroom.stars.visible = true;
  const dist = (showroomDistance(model.radius) ?? model.radius * 3.4) / zoom;
  flyIn = Math.min(1, flyIn + dt * 0.7);
  const ease = 1 - Math.pow(1 - flyIn, 3);
  model.root.position.set(0, 0, -dist * 12 * (1 - ease));
  if (!spin.dragging) {
    spin.idle += dt;
    if (spin.idle > 1.5) spin.y += dt * 0.5;
  }
  model.root.rotation.set(spin.x, spin.y, 0);
  camera.position.set(0, model.radius * 0.35, dist);
  camera.lookAt(0, 0, 0);
  showroom.stars.position.copy(camera.position);
  frameShipInSpace();
  placeShipNav(model.radius, dist);
}

/** The ship browser sits just under the ship, wherever the ship is on screen, clear of the panel and buttons. */
function placeShipNav(radius: number, dist: number) {
  const nav = $('#ship-nav');
  if (game.state !== 'title') return;
  camera.updateMatrixWorld();
  const centre = new THREE.Vector3(0, 0, 0).project(camera);
  const x = ((centre.x + 1) / 2) * innerWidth;
  const y = ((1 - centre.y) / 2) * innerHeight;
  const shipPx = (radius / dist) * (innerHeight / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
  const space = showroomSpace();
  const controls = document.querySelector<HTMLElement>('nav.controls[data-screen="title"]');
  const floor = Math.min(space ? space.bottom - 52 : innerHeight, controls && !sideways.matches ? controls.getBoundingClientRect().top - 56 : innerHeight - 56);
  // On a phone the open space round the ship is tight: the arrows go either side of it instead.
  const flank = space !== null;
  nav.classList.toggle('flank', flank);
  if (space) nav.style.setProperty('--w', `${Math.round(space.right - space.left - 24)}px`);
  nav.style.setProperty('--x', `${Math.round(x)}px`);
  nav.style.setProperty('--y', `${Math.round(flank ? y - 22 : Math.min(y + shipPx * 0.75 + 16, floor))}px`);
}

/** Phones on their side: the title screen's card and buttons share a column on the left (style.css). */
const sideways = matchMedia('(max-height: 500px) and (orientation: landscape)');

/**
 * The open space the title-screen ship should fill, on a phone: between the
 * title and the panel when upright, right of the column on its side; null otherwise.
 */
function showroomSpace(): { left: number; right: number; top: number; bottom: number } | null {
  const panel = document.querySelector<HTMLElement>('.panel[data-screen="title"]');
  const title = document.querySelector<HTMLElement>('header.title');
  if (!panel || panel.hidden || !title) return null;
  if (sideways.matches) return { left: panel.getBoundingClientRect().right, right: innerWidth, top: 0, bottom: innerHeight };
  if (innerHeight <= innerWidth) return null;
  return { left: 0, right: innerWidth, top: title.getBoundingClientRect().bottom, bottom: panel.getBoundingClientRect().top };
}

/** How far back the camera stands so the ship fits that space, side to side and top to bottom. */
function showroomDistance(radius: number): number | null {
  const space = showroomSpace();
  if (!space) return null;
  const room = Math.min(space.bottom - space.top, space.right - space.left) * 0.85; // pixels for the ship's full width
  const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
  return (radius * 2 * innerHeight) / (room * 2 * Math.tan(halfFov));
}

/**
 * On a phone the ship would sit behind the panel: shift the view so it's
 * centred in the open space instead.
 */
function frameShipInSpace() {
  const w = innerWidth;
  const h = innerHeight;
  const space = showroomSpace();
  if (!space) {
    if (camera.view?.enabled) camera.clearViewOffset();
    return;
  }
  // How far the ship should move left and up, in pixels.
  const shiftX = w / 2 - (space.left + space.right) / 2;
  const shiftY = h / 2 - (space.top + space.bottom) / 2;
  camera.setViewOffset(w, h, Math.round(shiftX), Math.round(shiftY), w, h);
}

// Inspect the ship on the title and docked screens: drag to rotate, scroll
// (or swipe on a Magic Mouse or trackpad) to zoom, double-click to reset.
const inShowroom = () => game.state === 'title' || game.state === 'docked' || game.state === 'newgame';
const onControl = (e: Event) => Boolean((e.target as HTMLElement).closest('button, a, input, .panel, #galaxy-map, #controls-card'));

// On the title screen a quick sideways flick changes the ship (a slow drag
// still turns it), on the ship or on its card.
const flick = { x: 0, y: 0, t: 0, spinY: 0, on: false };
function flickStart(e: PointerEvent) {
  Object.assign(flick, { x: e.clientX, y: e.clientY, t: performance.now(), spinY: spin.y, on: game.state === 'title' });
}
function flickEnd(e: PointerEvent) {
  if (!flick.on) return;
  flick.on = false;
  const dx = e.clientX - flick.x;
  const dy = e.clientY - flick.y;
  if (performance.now() - flick.t > 350 || Math.abs(dx) < 50 || Math.abs(dx) < Math.abs(dy) * 2) return;
  spin.y = flick.spinY; // it was a flick, not a turn
  showShip(shipIndex + (dx < 0 ? 1 : -1));
}
document.querySelector<HTMLElement>('.panel[data-screen="title"]')?.addEventListener('pointerdown', flickStart);

addEventListener('pointerdown', (e) => {
  if (!inShowroom() || onControl(e)) return;
  spin.dragging = true;
  spin.lastX = e.clientX;
  spin.lastY = e.clientY;
  flickStart(e);
});
addEventListener('pointermove', (e) => {
  if (!spin.dragging) return;
  spin.y += (e.clientX - spin.lastX) * 0.01;
  spin.x += (e.clientY - spin.lastY) * 0.01;
  spin.lastX = e.clientX;
  spin.lastY = e.clientY;
  spin.idle = 0;
});
addEventListener('pointerup', (e) => {
  spin.dragging = false;
  flickEnd(e);
});
addEventListener(
  'wheel',
  (e) => {
    if (!inShowroom() || onControl(e)) return;
    const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1;
    zoom = THREE.MathUtils.clamp(zoom * Math.exp(-e.deltaY * scale * 0.0015), ZOOM_MIN, ZOOM_MAX);
    spin.idle = 0;
    e.preventDefault();
  },
  { passive: false },
);
addEventListener('dblclick', (e) => {
  if (inShowroom() && !onControl(e)) resetShowroomView();
});
