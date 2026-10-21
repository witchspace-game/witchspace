import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
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

export const camera = new THREE.PerspectiveCamera(50, innerWidth / innerHeight, 1, 120000);

const renderPass = new RenderPass(new THREE.Scene(), camera);
const composer = new EffectComposer(neoRenderer);
composer.addPass(renderPass);
composer.addPass(new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 1.0, 0.5, 0.2));
composer.addPass(new OutputPass());

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
