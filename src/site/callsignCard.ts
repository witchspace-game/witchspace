import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { shipById } from '../content/ships';
import { buildPainted, disposeShip, type ShipModel } from '../render/shipModel';
import { setLineResolution } from '../render/wire';

// The callsign card's ship: the role's ship in neo-vector over stars, on the right of the card and clear of
// the words, as on the site's share cards (tools/share-card.ts). It turns slowly on the page; picture() draws
// her afresh at 1200×630 for the card you share. Throws without WebGL, so the page can carry on without her.

export const CARD_W = 1200;
export const CARD_H = 630;
/** The ship fits a circle right of the middle, as on the share cards: centre and radius as parts of the card. */
const CENTRE_X = 320 / CARD_W;
const RADIUS = 215 / CARD_H;

export interface CardShip {
  show(shipId: string): void;
  /** The ship and the stars at the card's full size, for the picture. */
  picture(): HTMLCanvasElement;
}

export function cardShip(canvas: HTMLCanvasElement): CardShip {
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  // As sharp as the screen: a phone is 3×, and thin glowing lines show it.
  renderer.setPixelRatio(Math.min(devicePixelRatio, 3));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05070d);
  const camera = new THREE.PerspectiveCamera(30, CARD_W / CARD_H, 1, 100000);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 1.0, 0, 0.2);
  bloom.compositeMaterial.uniforms['bloomFactors'].value = [1, 0.75, 0.45, 0.18, 0.04];
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // Stars, the same sky as the share cards.
  {
    const pos: number[] = [];
    const col: number[] = [];
    const c = new THREE.Color();
    let seed = 7;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 1400; i++) {
      const v = new THREE.Vector3(rnd() * 2 - 1, rnd() * 2 - 1, rnd() * 2 - 1).normalize().multiplyScalar(40000);
      pos.push(v.x, v.y, v.z);
      c.setHSL(0.55 + rnd() * 0.15, 0.35, 0.1 + rnd() ** 3 * 0.5);
      col.push(c.r, c.g, c.b);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    scene.add(new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true })));
  }

  let model: ShipModel | null = null;
  let yaw = -0.75;
  let w = 0;
  let h = 0;

  /** Sizes everything for a w×h picture and aims the camera so the ship sits where the card wants her. */
  const frameFor = (width: number, height: number) => {
    camera.aspect = width / height;
    camera.setViewOffset(width, height, -CENTRE_X * width, 0, width, height);
    if (model) camera.position.set(0, 0, (model.radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (1 / (2 * RADIUS)));
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  };
  const resize = () => {
    w = canvas.clientWidth;
    h = canvas.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
    frameFor(w, h);
  };
  new ResizeObserver(resize).observe(canvas);

  const draw = () => {
    if (!model) return;
    model.root.rotation.set(0.35, yaw, 0);
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
    if (!reducedMotion) yaw += dt * 0.2;
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
