import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { ShipDef } from '../content/types';
import { buildShip } from '../render/shipModel';
import { setLineResolution } from '../render/wire';
import { escapeHtml } from '../ui/escape';

// A ship's page: the ship turning in neo-vector (drag to turn it), and the
// ideas board's suggestions that mention it. The page itself is built from
// the ship's file (tools/ships.ts); this only brings it to life.

const view = document.querySelector<HTMLElement>('.ship-view')!;
const canvas = view.querySelector<HTMLCanvasElement>('.ship-canvas')!;
const def = JSON.parse(document.querySelector('#ship-def')!.textContent!) as ShipDef;
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

try {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 50000);
  const model = buildShip(def);
  scene.add(model.root);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0, 0.2);
  bloom.compositeMaterial.uniforms['bloomFactors'].value = [1, 0.75, 0.45, 0.18, 0.04];
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
  };
  new ResizeObserver(resize).observe(canvas);
  resize();
  view.classList.add('live'); // the drawing gives way to the live model

  // Drag to turn it; left alone, it turns slowly by itself.
  const spin = { x: 0.35, y: -0.7, idle: 2, dragging: false, lx: 0, ly: 0 };
  canvas.addEventListener('pointerdown', (e) => {
    Object.assign(spin, { dragging: true, lx: e.clientX, ly: e.clientY });
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!spin.dragging) return;
    spin.y += (e.clientX - spin.lx) * 0.01;
    spin.x = THREE.MathUtils.clamp(spin.x + (e.clientY - spin.ly) * 0.01, -1.2, 1.2);
    Object.assign(spin, { lx: e.clientX, ly: e.clientY, idle: 0 });
  });
  canvas.addEventListener('pointerup', () => (spin.dragging = false));

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden) return;
    spin.idle += dt;
    if (!spin.dragging && spin.idle > 1.5 && !reducedMotion) spin.y += dt * 0.25;
    model.root.rotation.set(spin.x, spin.y, 0);
    const dist = (model.radius * 1.2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    composer.render();
  };
  requestAnimationFrame(frame);
} catch {
  // No WebGL: the drawing stays.
}

// --- Ideas about this ship ----------------------------------------------------------

const API = import.meta.env.DEV ? 'http://127.0.0.1:8787/ideas' : 'https://space.witchspace.org.uk/ideas';
const list = document.querySelector<HTMLUListElement>('.ship-ideas')!;
const name = list.dataset.shipName!;

void (async () => {
  try {
    const res = await fetch(`${API}?sort=top`);
    const { ideas } = (await res.json()) as { ideas: { id: string; title: string; body: string; up: number; down: number; status: string }[] };
    const about = ideas.filter((i) => `${i.title} ${i.body}`.toLowerCase().includes(name.toLowerCase())).slice(0, 5);
    list.innerHTML = about.length
      ? about
          .map((i) => `<li><a href="/ideas/#idea-${escapeHtml(i.id)}">${escapeHtml(i.title)}</a> <span class="muted">${i.up - i.down >= 0 ? '+' : ''}${i.up - i.down}${i.status !== 'open' ? ` · ${escapeHtml(i.status)}` : ''}</span></li>`)
          .join('')
      : `<li class="muted">No ideas about the ${escapeHtml(name)} yet. Be the first.</li>`;
  } catch {
    list.innerHTML = '<li class="muted">The ideas board isn’t answering just now.</li>';
  }
})();
