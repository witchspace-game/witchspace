import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { ShipDef } from '../content/types';
import { buildShip, disposeShip, type ShipModel } from '../render/shipModel';
import { setLineResolution } from '../render/wire';

// A ship turning in neo-vector on a canvas: drag to turn it; left alone, it
// turns slowly by itself. The ship pages show their ship in one; the submit
// page shows whatever file you're about to hand in. Throws without WebGL, so
// the caller can leave its drawing in place.

export interface Viewer {
  /** Show this ship instead (a new file, an edit). */
  show(def: ShipDef): void;
}

export function viewer(canvas: HTMLCanvasElement): Viewer {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Opaque, in the frame's own colour: over a see-through canvas the glow pools into a wash.
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#04060b');
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 50000);
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

  let model: ShipModel | null = null;
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!model || !visible || document.hidden) return;
    spin.idle += dt;
    if (!spin.dragging && spin.idle > 1.5 && !reducedMotion) spin.y += dt * 0.25;
    model.root.rotation.set(spin.x, spin.y, 0);
    const dist = (model.radius * 1.2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    composer.render();
  };
  requestAnimationFrame(frame);

  return {
    show(def) {
      const next = buildShip(def);
      if (model) {
        scene.remove(model.root);
        disposeShip(model);
      }
      model = next;
      scene.add(model.root);
    },
  };
}
