import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { ships } from '../content/ships';
import { buildShip } from '../render/shipModel';
import { setLineResolution } from '../render/wire';

// The home page hero: the game's own ships, flying in one after another and
// turning slowly, in neo-vector style.

const canvas = document.querySelector<HTMLCanvasElement>('#hero-canvas')!;
const label = document.querySelector<HTMLElement>('#hero-ship');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
scene.add(new THREE.AmbientLight(0xffffff, 0.6));
const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
sun.position.set(1, 0.8, 0.6);
scene.add(sun);

const camera = new THREE.PerspectiveCamera(40, 1, 1, 20000);

// A dim starfield.
{
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(6000);
    pos.push(v.x, v.y, v.z);
    c.setHSL(0.55 + Math.random() * 0.15, 0.35, 0.08 + Math.random() ** 3 * 0.45);
    col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.2, sizeAttenuation: false, vertexColors: true })));
}

const showcase = ships.filter((s) => s.role !== 'cargo').map(buildShip);

// How tall each model can get on screen while it turns (it spins about Y
// with a slight tilt), so tall stations and flat ships both fit the frame.
const TILT = 0.3;
const fitHeight = new Map(
  showcase.map((m) => [
    m,
    Math.max(...m.def.geometry.vertices.map(([x, y, z]) => Math.abs(y) * Math.cos(TILT) + Math.hypot(x, z) * Math.sin(TILT))),
  ]),
);
for (const m of showcase) {
  m.root.visible = false;
  scene.add(m.root);
}
// Start with the Cobra, the ship every commander remembers.
let index = Math.max(0, showcase.findIndex((m) => m.def.id === 'cobra-mk3'));
let shownFor = 0;
const SHOW_SECONDS = 8;

function show(i: number) {
  showcase.forEach((m, j) => (m.root.visible = j === i));
  shownFor = 0;
  if (label) label.textContent = showcase[i].def.name;
}
show(index);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0.5, 0.2);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// Where the model goes: the clear space beside the headline if there's room,
// otherwise above it, measured from the page itself, so it never meets the
// text whatever the window's shape. In view coordinates (-1 to 1): the centre,
// and how far the model may reach each way.
const copy = document.querySelector<HTMLElement>('.hero-copy');
const header = document.querySelector<HTMLElement>('.site-header');
let slot = { x: 0.48, y: 0.06, w: 0.36, h: 0.46 };
function measureSlot() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!copy || !w || !h) return;
  const c = canvas.getBoundingClientRect();
  const t = copy.getBoundingClientRect();
  let top = (header ? header.getBoundingClientRect().bottom : c.top) - c.top + 16;
  // On small screens the ship's name sits up top: keep clear of it too.
  const name = label?.getBoundingClientRect();
  if (name && name.height && name.bottom < t.top) top = Math.max(top, name.bottom - c.top + 8);
  const bottom = Math.min(h - 70, innerHeight - c.top - 24); // clear of the ship's name, and on screen when the hero's taller than it
  // Where the words actually end (the block itself runs wider than its lines).
  // The lines of text themselves, not their (full-width) boxes; and only those
  // on screen: on a short screen the rest is below, out of the ship's way.
  let inkRight = t.left;
  const range = document.createRange();
  const walk = document.createTreeWalker(copy, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    if (!n.textContent?.trim()) continue;
    range.selectNodeContents(n);
    for (const r of range.getClientRects()) if (r.top - c.top < bottom) inkRight = Math.max(inkRight, r.right);
  }
  const beside = { left: inkRight - c.left + 32, right: w - 24, top, bottom };
  const above = { left: 24, right: w - 24, top, bottom: t.top - c.top - 24 };
  // Whichever lets the model be bigger (ships are about twice as wide as they are tall).
  const room = (b: typeof beside) => Math.min(b.right - b.left, (b.bottom - b.top) * 2);
  const r = room(beside) >= room(above) ? beside : above;
  slot = {
    x: (r.left + r.right) / w - 1,
    y: 1 - (r.top + r.bottom) / h,
    w: Math.max(0.05, ((r.right - r.left) / w) * 0.9),
    h: Math.max(0.05, ((r.bottom - r.top) / h) * 0.9),
  };
}
void document.fonts?.ready.then(measureSlot);

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
  measureSlot();
}
new ResizeObserver(resize).observe(canvas);
resize();

// The header is transparent over the hero; make it solid once you scroll.
const onScroll = () => document.body.classList.toggle('scrolled', scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

// Only animate while the hero is on screen and the tab is visible.
let visible = true;
new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

// Timer pauses while the tab is hidden, so there's no huge step on return.
const timer = new THREE.Timer();
timer.connect(document);
let spin = 0;

function frame(now?: number) {
  requestAnimationFrame(frame);
  timer.update(now);
  const dt = Math.min(timer.getDelta(), 0.1);
  if (!visible || document.hidden) return;

  shownFor += dt;
  if (shownFor > SHOW_SECONDS && showcase.length > 1) show((index = (index + 1) % showcase.length));

  const model = showcase[index];
  // Sized to its slot (measureSlot), so it never meets the text or the header.
  const tanHalf = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const dist = Math.max(
    (fitHeight.get(model)! * 1.15) / (slot.h * tanHalf),
    model.radius / (slot.w * tanHalf * camera.aspect),
  );
  // Fly in from the distance, as on the original's title screen.
  const t = reducedMotion ? 1 : Math.min(1, shownFor / 1.6);
  const ease = 1 - Math.pow(1 - t, 3);
  spin += dt * (reducedMotion ? 0.12 : 0.4);
  model.root.position.set(0, 0, -dist * 10 * (1 - ease));
  model.root.rotation.set(TILT, spin, 0);
  // Aim the camera away from the model so it lands in its slot on screen.
  camera.position.set(-slot.x * dist * tanHalf * camera.aspect, -slot.y * dist * tanHalf, dist);
  camera.lookAt(camera.position.x, camera.position.y, 0);
  composer.render();
}
frame();
