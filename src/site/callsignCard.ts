import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { shipById } from '../content/ships';
import { buildPainted, disposeShip, type ShipModel } from '../render/shipModel';
import { setLineResolution } from '../render/wire';

// The callsign card's ship: the role's ship in neo-vector, on the right of the card and clear of the words,
// as on the site's share cards (tools/share-card.ts). She's drawn on black and laid over the card's scene with
// a screen blend, so the black drops away and only her glow shows (a see-through canvas would pool the bloom
// into a wash). She turns slowly until you take hold of her: drag to turn her to the angle you want, and she
// stays there. picture() draws her afresh at 1200×630, as she's turned, for the card you share. Throws
// without WebGL, so the page can carry on without her.

export const CARD_W = 1200;
export const CARD_H = 630;
/** The ship fits a circle right of the middle, as on the share cards: centre and radius as parts of the card. */
const CENTRE_X = 320 / CARD_W;
const RADIUS = 215 / CARD_H;

export interface CardShip {
  show(shipId: string): void;
  /** The ship on black at the card's full size, for the picture: lay it over the scene with a screen blend. */
  picture(): HTMLCanvasElement;
}

export function cardShip(canvas: HTMLCanvasElement): CardShip {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // As sharp as the screen: a phone is 3×, and thin glowing lines show it.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  const camera = new THREE.PerspectiveCamera(30, CARD_W / CARD_H, 1, 100000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0, 0.2);
  bloom.compositeMaterial.uniforms['bloomFactors'].value = [1, 0.75, 0.45, 0.18, 0.04];
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  let model: ShipModel | null = null;
  const spin = { x: 0.35, y: -0.75, held: false, dragging: false, lx: 0, ly: 0 };

  /** Sizes everything for a w×h picture and aims the camera so the ship sits where the card wants her. */
  const frameFor = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.setViewOffset(width, height, -CENTRE_X * width, 0, width, height);
    if (model) camera.position.set(0, 0, (model.radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (1 / (2 * RADIUS)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
    frameFor(w, h);
  };
  new ResizeObserver(resize).observe(canvas);

  // Drag to turn her, as on the ship pages. On a phone a sideways drag turns her and an upward one still
  // scrolls the page (touch-action: pan-y in the CSS); with a mouse, up and down tilt her too.
  canvas.addEventListener('pointerdown', (e) => {
    Object.assign(spin, { dragging: true, held: true, lx: e.clientX, ly: e.clientY });
    canvas.setPointerCapture(e.pointerId);
    canvas.classList.add('held');
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!spin.dragging) return;
    spin.y += (e.clientX - spin.lx) * 0.012;
    if (e.pointerType === 'mouse') spin.x = THREE.MathUtils.clamp(spin.x + (e.clientY - spin.ly) * 0.01, -1.2, 1.2);
    Object.assign(spin, { lx: e.clientX, ly: e.clientY });
  });
  const release = () => (spin.dragging = false);
  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', release);

  const draw = () => {
    if (!model) return;
    model.root.rotation.set(spin.x, spin.y, 0);
    composer.render();
  };
  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(canvas);
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (!visible || document.hidden || !model) return;
    // She turns by herself only until you've chosen her angle.
    if (!spin.held && !reducedMotion) spin.y += dt * 0.2;
    draw();
  };
  requestAnimationFrame(frame);

  return {
    show(shipId) {
      const def = shipById(shipId) ?? shipById('cobra-mk3')!;
      if (model) {
        scene.remove(model.root);
        disposeShip(model);
      }
      model = buildPainted(def, null);
      scene.add(model.root);
      resize();
      draw();
    },
    picture() {
      // Drawn at full size and copied out at once: the drawing buffer is cleared once the browser shows a frame.
      const ratio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(CARD_W, CARD_H, false);
      composer.setSize(CARD_W, CARD_H);
      setLineResolution(new THREE.Vector2(CARD_W, CARD_H));
      frameFor(CARD_W, CARD_H);
      draw();
      const out = document.createElement('canvas');
      out.width = CARD_W;
      out.height = CARD_H;
      out.getContext('2d')!.drawImage(canvas, 0, 0);
      renderer.setPixelRatio(ratio);
      resize();
      draw();
      return out;
    },
  };
}
