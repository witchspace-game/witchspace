import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { LensPass } from './lens';
import { ORIGINAL_PIXELS, RETRO_DOT, registerParts, setLineResolution, setRetroParts } from './wire';

// 1984 mode: white lines on black with hard pixels, letterboxed to 4:3. The
// original BBC Micro view was 256x192, which is tiring to look at blown up on
// a modern screen, so we draw about three times finer. ?pixels in the address
// gives the original resolution. Either way every pixel covers a whole number
// of screen pixels, so lines step evenly instead of shimmering.
const DETAIL = ORIGINAL_PIXELS ? 256 : 768; // pixels across, roughly

/** The 1984 view's resolution, and its size on screen in CSS pixels. */
export function retroSize() {
  const dpr = devicePixelRatio || 1;
  // The largest 4:3 box that fits the window, in device pixels.
  const boxW = Math.floor(Math.min(innerWidth, (innerHeight * 4) / 3) * dpr);
  const boxH = Math.floor((boxW * 3) / 4);
  const scale = ORIGINAL_PIXELS ? Math.max(1, Math.floor(boxW / 256)) : Math.max(1, Math.round(boxW / DETAIL));
  const w = ORIGINAL_PIXELS ? 256 : Math.floor(boxW / scale);
  const h = ORIGINAL_PIXELS ? 192 : Math.floor(boxH / scale);
  return { w, h, cssW: (w * scale) / dpr, cssH: (h * scale) / dpr };
}

/** Size a 1984-mode canvas on screen to match retroSize(). */
export function fitRetroCanvas(canvas: HTMLCanvasElement) {
  const { cssW, cssH } = retroSize();
  canvas.style.width = `${cssW}px`;
  canvas.style.height = `${cssH}px`;
}

const neoCanvas = document.querySelector<HTMLCanvasElement>('#neo')!;
const retroCanvas = document.querySelector<HTMLCanvasElement>('#retro')!;

const neoRenderer = new THREE.WebGLRenderer({ canvas: neoCanvas, antialias: true });
neoRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const retroRenderer = new THREE.WebGLRenderer({ canvas: retroCanvas, antialias: false });
retroRenderer.setPixelRatio(1);
// Ships coming through a witchspace rift are clipped at its mouth.
neoRenderer.localClippingEnabled = retroRenderer.localClippingEnabled = true;

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 120000);

const renderPass = new RenderPass(new THREE.Scene(), camera);
const composer = new EffectComposer(neoRenderer);
composer.addPass(renderPass);
/** Space bending around a witchspace rift; see lens.ts. */
export const lens = new LensPass();
composer.addPass(lens);
// The glow is five blurs, tight to screen-wide. Weighted towards the tight
// ones, it hugs the lines; the widest is kept faint, or every ship sits in a
// screen-sized disc of haze. (Radius 0 so these weights are used as given.)
export const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.0, 0, 0.2);
bloom.compositeMaterial.uniforms['bloomFactors'].value = [1, 0.75, 0.45, 0.18, 0.04];
composer.addPass(bloom);
composer.addPass(new OutputPass());
// The glow fades to black over a wide area, and the screen has only a few
// shades of dark red (or green, or blue) to do it in, so it showed as rings.
// A grain of less than one shade per pixel, too fine to see, blends them.
composer.addPass(
  new ShaderPass({
    uniforms: { tDiffuse: { value: null } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      varying vec2 vUv;
      void main() {
        vec4 c = texture2D(tDiffuse, vUv);
        float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
        gl_FragColor = vec4(c.rgb + (n - 0.5) / 255.0, c.a);
      }`,
  }),
);

let retro = false;
export const isRetro = () => retro;

export function setRetro(value: boolean) {
  retro = value;
  document.body.classList.toggle('retro', retro);
  neoCanvas.hidden = retro;
  retroCanvas.hidden = !retro;
  setRetroParts(retro);
  resize();
}

export function render(scene: THREE.Scene) {
  if (retro) {
    retroRenderer.render(scene, camera);
  } else {
    renderPass.scene = scene;
    composer.render();
  }
}

function resize() {
  const r = retroSize();
  camera.aspect = retro ? r.w / r.h : innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  retroRenderer.setSize(r.w, r.h, false);
  fitRetroCanvas(retroCanvas);
  neoRenderer.setSize(innerWidth, innerHeight, false);
  composer.setSize(innerWidth, innerHeight);
  setLineResolution(neoRenderer.getDrawingBufferSize(new THREE.Vector2()));
}
addEventListener('resize', resize);
resize();

/**
 * Render at a fixed size for a while (saving the kill cam as a video), then put
 * everything back as it was. Always the neo view: the 1984 one has its own canvas.
 */
export async function atSize<T>(width: number, height: number, fn: (canvas: HTMLCanvasElement) => Promise<T>): Promise<T> {
  const wasRetro = retro;
  if (wasRetro) setRetro(false);
  const ratio = neoRenderer.getPixelRatio();
  neoRenderer.setPixelRatio(1);
  composer.setPixelRatio(1);
  neoRenderer.setSize(width, height, false);
  composer.setSize(width, height);
  // Lines are drawn in pixels: above 720 across, thicken them in step, so a
  // 1080×1920 video glows as boldly as a 720p one rather than looking spindly.
  const lineScale = Math.max(1, Math.min(width, height) / 720);
  setLineResolution(new THREE.Vector2(width / lineScale, height / lineScale));
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  try {
    return await fn(neoCanvas);
  } finally {
    neoRenderer.setPixelRatio(ratio);
    composer.setPixelRatio(ratio);
    if (wasRetro) setRetro(true);
    else resize();
  }
}

// --- Scenes -----------------------------------------------------------------

function starfield(count: number, size: number, colourful: boolean) {
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(8000);
    pos.push(v.x, v.y, v.z);
    if (colourful) c.setHSL(0.55 + Math.random() * 0.15, 0.35, 0.08 + Math.random() ** 3 * 0.45);
    else c.set(0xffffff);
    col.push(c.r, c.g, c.b);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({ size, sizeAttenuation: false, vertexColors: true, depthWrite: false }),
  );
  // Draw first and never write depth, so anything else in the scene covers them.
  points.renderOrder = -1;
  return points;
}

export interface Space {
  scene: THREE.Scene;
  sun: THREE.DirectionalLight;
  /** Keep this centred on the camera so stars stay at infinity. */
  stars: THREE.Group;
}

export function makeSpace(): Space {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x000000);
  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const sun = new THREE.DirectionalLight(0xfff1dd, 2.2);
  sun.position.set(1, 0.8, 0.6);
  scene.add(sun);

  const stars = new THREE.Group();
  const neo = starfield(2500, 1.2, true);
  const old = starfield(70, RETRO_DOT, false);
  stars.add(neo, old);
  registerParts({ neo: [neo], retro: [old] });
  scene.add(stars);

  return { scene, sun, stars };
}
