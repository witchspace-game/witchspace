import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { shipById } from '../content/ships';
import { applyLivery } from '../render/livery';
import { buildPainted, disposeShip, type Look, type ShipModel } from '../render/shipModel';
import { applyParts, setLineResolution } from '../render/wire';

// The callsign card's ship: the role's ship in neo-vector, on the right of the card and clear of the words,
// as on the site's share cards (tools/share-card.ts), in front of the card's scene. She's drawn with her glow on
// black, and the last pass lays that over the scene: screened, so her glow adds to it, and with the scene cut
// away wherever her hull is (a silhouette drawn first), so she's solid and nothing shows through her. (The
// scene isn't in the 3D view itself, or the bloom would glow it a second time.) She turns slowly until you take
// hold of her: drag to turn her to the angle you want, and she stays there. picture() draws the card's
// picture at 1200×630, as she's turned. Throws without WebGL, so the page can carry on without her.

export const CARD_W = 1200;
export const CARD_H = 630;
/** The ship fits a circle right of the middle, as on the share cards: centre and radius as parts of the card. */
const CENTRE_X = 320 / CARD_W;
const RADIUS = 215 / CARD_H;

export interface CardShip {
  /** A ship in her own paint (or her maker's colours), and the Marshals' livery for their card. */
  show(shipId: string, look?: Look | null, livery?: 'marshal'): void;
  /** The scene behind her (an image the card's size); resolves once it's loaded and showing. */
  scene(url: string): Promise<void>;
  /** The scene and the ship at the card's full size, for the picture. */
  picture(): HTMLCanvasElement;
  /** Her angle as you left her (radians), to keep with the card; set it to bring a kept card back. */
  angle(set?: { x: number; y: number }): { x: number; y: number };
}

/** How bright the scene shows behind her: dimmed, so she and the words come first. */
const SCENE_LEVEL = 0.62;

/** The last pass: the scene, cut away where her hull is, with her glow screened over it. */
const BLEND = {
  uniforms: { tDiffuse: { value: null }, tScene: { value: null }, tMask: { value: null }, level: { value: SCENE_LEVEL } },
  vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform sampler2D tScene; uniform sampler2D tMask; uniform float level; varying vec2 vUv;
    void main() {
      vec3 ship = texture2D(tDiffuse, vUv).rgb;
      vec3 back = texture2D(tScene, vUv).rgb * level * (1.0 - texture2D(tMask, vUv).r);
      gl_FragColor = vec4(1.0 - (1.0 - back) * (1.0 - ship), 1.0);
    }`,
};

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
  const blend = new ShaderPass(BLEND);
  composer.addPass(blend);
  // Black until a scene has loaded.
  const none = new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1);
  none.needsUpdate = true;
  blend.uniforms.tScene.value = none;
  // Her hull's silhouette, drawn white on black into a picture of its own, the same size as the card's.
  const mask = new THREE.WebGLRenderTarget(1, 1, { samples: 4 });
  blend.uniforms.tMask.value = mask.texture;
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const black = new THREE.Color(0x000000);
  const drawMask = () => {
    if (!model) return;
    const hidden: THREE.Object3D[] = [];
    const swapped: [THREE.Mesh, THREE.Material | THREE.Material[]][] = [];
    model.root.traverse((o) => {
      const line = (o as { isLineSegments2?: boolean }).isLineSegments2 || (o as THREE.Line).isLine || (o as THREE.LineSegments).isLineSegments;
      if (line && o.visible) {
        o.visible = false;
        hidden.push(o);
      } else if ((o as THREE.Mesh).isMesh) {
        swapped.push([o as THREE.Mesh, (o as THREE.Mesh).material]);
        (o as THREE.Mesh).material = white;
      }
    });
    renderer.setRenderTarget(mask);
    renderer.setClearColor(black, 1);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    for (const o of hidden) o.visible = true;
    for (const [m, mat] of swapped) m.material = mat;
  };

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
    const px = renderer.getDrawingBufferSize(new THREE.Vector2());
    mask.setSize(px.x, px.y);
    setLineResolution(px);
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
    drawMask();
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
    show(shipId, look, livery) {
      const def = shipById(shipId) ?? shipById('cobra-mk3')!;
      if (model) {
        scene.remove(model.root);
        disposeShip(model);
      }
      model = buildPainted(def, look ?? null);
      if (livery) {
        const parts = applyLivery(def, model.root, livery);
        model.parts.neo.push(...parts.neo);
        model.parts.retro.push(...parts.retro);
        applyParts(model.parts);
      }
      scene.add(model.root);
      resize();
      draw();
    },
    scene(url) {
      return new Promise((done) => {
        new THREE.TextureLoader().load(
          url,
          (t) => {
            // Read as it's stored: the blend comes after the output pass, in the screen's own colours.
            t.colorSpace = THREE.NoColorSpace;
            const was = blend.uniforms.tScene.value as THREE.Texture;
            blend.uniforms.tScene.value = t;
            if (was !== none) was.dispose();
            draw();
            done();
          },
          undefined,
          () => done(),
        );
      });
    },
    angle(set) {
      if (set) {
        Object.assign(spin, { x: set.x, y: set.y, held: true });
        draw();
      }
      return { x: Math.round(spin.x * 1000) / 1000, y: Math.round((((spin.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) * 1000) / 1000 };
    },
    picture() {
      // Drawn at full size and copied out at once: the drawing buffer is cleared once the browser shows a frame.
      const ratio = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(CARD_W, CARD_H, false);
      composer.setSize(CARD_W, CARD_H);
      mask.setSize(CARD_W, CARD_H);
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
