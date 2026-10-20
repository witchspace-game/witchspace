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
scene.background = new THREE.Color(0x02060a);
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

function resize() {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  renderer.setSize(w, h, false);
  composer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
}
new ResizeObserver(resize).observe(canvas);
resize();

// Only animate while the hero is on screen and the tab is visible.
let visible = true;
new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);

const clock = new THREE.Clock();
let spin = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.1);
  if (!visible || document.hidden) return;

  shownFor += dt;
  if (shownFor > SHOW_SECONDS && showcase.length > 1) show((index = (index + 1) % showcase.length));

  const model = showcase[index];
  const dist = model.radius * (camera.aspect < 1 ? 6 : 4.4);
  // Fly in from the distance, as on the original's title screen.
  const t = reducedMotion ? 1 : Math.min(1, shownFor / 1.6);
  const ease = 1 - Math.pow(1 - t, 3);
  spin += dt * (reducedMotion ? 0.12 : 0.4);
  model.root.position.set(0, 0, -dist * 10 * (1 - ease));
  model.root.rotation.set(0.3, spin, 0);
  // Look below the ship so it sits in the upper part of the hero, above the title.
  camera.position.set(0, model.radius * 0.25, dist);
  camera.lookAt(0, -model.radius * 0.95, 0);
  composer.render();
}
frame();
