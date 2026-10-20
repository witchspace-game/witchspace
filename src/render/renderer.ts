import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { registerParts, setLineResolution, setRetroParts } from './wire';

// The original BBC Micro space view was 256x192 pixels.
const RETRO_W = 256;
const RETRO_H = 192;

const neoCanvas = document.querySelector<HTMLCanvasElement>('#neo')!;
const retroCanvas = document.querySelector<HTMLCanvasElement>('#retro')!;

const neoRenderer = new THREE.WebGLRenderer({ canvas: neoCanvas, antialias: true });
neoRenderer.setPixelRatio(Math.min(devicePixelRatio, 2));
const retroRenderer = new THREE.WebGLRenderer({ canvas: retroCanvas, antialias: false });
retroRenderer.setPixelRatio(1);
retroRenderer.setSize(RETRO_W, RETRO_H, false);

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
  camera.aspect = retro ? RETRO_W / RETRO_H : innerWidth / innerHeight;
  camera.updateProjectionMatrix();
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
  const old = starfield(70, 1, false);
  stars.add(neo, old);
  registerParts({ neo: [neo], retro: [old] });
  scene.add(stars);

  return { scene, sun, stars };
}
