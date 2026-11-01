import * as THREE from 'three';
import type { ShipDef } from '../content/types';
import { MAX_PIXEL_RATIO } from '../render/look';
import { buildPainted, disposeShip, type Look, type ShipModel } from '../render/shipModel';
import { setLineResolution } from '../render/wire';
import { easer, inkable, lightUp, onPaper, SPACE } from './ink';
import { glow } from './glow';

// A ship turning in neo-vector on a canvas: drag to turn it; left alone, it
// turns slowly by itself. The ship pages show their ship in one; the submit
// page shows whatever file you're about to hand in. Throws without WebGL, so
// the caller can leave its drawing in place.

export interface Viewer {
  /** Show this ship instead (a new file, an edit), in its maker's colours or a paint of your own (the configurator). */
  show(def: ShipDef, look?: Look | null): void;
  /** The ship as she is now, drawn afresh at this size, for a picture of her (a certificate saved as an image). */
  snapshot(width: number, height: number): HTMLCanvasElement;
  /** On paper: show her as a drawing (false) or lit, in neo-vector (true). Off paper she's always lit. */
  light(on: boolean): void;
}

/** `ink`: on paper, start her as a drawing (a ship's own page); everywhere else she's in space, lit. */
export function viewer(canvas: HTMLCanvasElement, { ink = false }: { ink?: boolean } = {}): Viewer {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Opaque, in the frame's own colour: over a see-through canvas the glow pools into a wash.
  // On paper she starts as an ink drawing on a see-through canvas, and the space behind her fades in as she's lit.
  const paper = ink && onPaper();
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: paper });
  renderer.setPixelRatio(Math.min(devicePixelRatio, MAX_PIXEL_RATIO));
  const scene = new THREE.Scene();
  if (!paper) scene.background = new THREE.Color(SPACE);
  const lit = easer(1.2);
  let litTarget = paper ? 0 : 1;
  let inked: ((t: number) => void) | null = null;
  const camera = new THREE.PerspectiveCamera(32, 1, 0.5, 50000);
  const { composer, bloom } = glow(renderer, scene, camera);

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
  const draw = () => {
    if (!model) return;
    model.root.rotation.set(spin.x, spin.y, 0);
    const dist = (model.radius * 1.2) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.min(1, camera.aspect);
    camera.position.set(0, 0, dist);
    camera.lookAt(0, 0, 0);
    if (inked) lightUp(renderer, bloom, inked, lit.value);
    composer.render();
  };
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!model || !visible || document.hidden) return;
    spin.idle += dt;
    if (paper) lit.step(litTarget, dt);
    if (!spin.dragging && spin.idle > 1.5 && !reducedMotion) spin.y += dt * 0.25;
    draw();
  };
  requestAnimationFrame(frame);

  return {
    show(def, look) {
      const next = buildPainted(def, look);
      if (model) {
        scene.remove(model.root);
        disposeShip(model);
      }
      model = next;
      if (paper) inked = inkable(model);
      scene.add(model.root);
    },
    snapshot(width, height) {
      // Drawn at full size, then copied out at once: the drawing buffer is cleared once the browser shows a frame.
      const ratio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      setLineResolution(new THREE.Vector2(width, height));
      draw();
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      out.getContext('2d')!.drawImage(canvas, 0, 0);
      renderer.setPixelRatio(ratio);
      resize();
      draw();
      return out;
    },
    light(on) {
      if (paper) litTarget = on ? 1 : 0;
    },
  };
}
