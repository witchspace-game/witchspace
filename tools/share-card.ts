// The share card's ship: the game's own model, in neo-vector with its glow,
// on the right of the card, over a starfield. See share-card.html.
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { shipById } from '../src/content/ships';
import { buildPainted } from '../src/render/shipModel';
import { setLineResolution } from '../src/render/wire';

const q = new URLSearchParams(location.search);
const $ = (id: string) => document.getElementById(id)!;
$('kicker').textContent = q.get('kicker') ?? '';
$('title').textContent = q.get('title') ?? 'Witchspace';
$('title').classList.toggle('long', ($('title').textContent ?? '').length > 18);
$('sub').textContent = q.get('sub') ?? '';

const W = 1200;
const H = 630;
const canvas = $('sky') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setSize(W, H, false);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05070d);
const camera = new THREE.PerspectiveCamera(30, W / H, 1, 100000);

// Stars.
{
  const pos: number[] = [];
  const col: number[] = [];
  const c = new THREE.Color();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
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

const def = shipById(q.get('ship') ?? 'cobra-mk3') ?? shipById('cobra-mk3')!;
// A paint of its own (a numbered edition), or the maker's colours.
const paint = q.get('paint');
const model = buildPainted(def, paint ? JSON.parse(paint) : null);
model.root.rotation.set(Number(q.get('pitch') ?? 0.35), Number(q.get('yaw') ?? -0.75), 0);
scene.add(model.root);
// The ship fits a circle on the right of the card, clear of the words:
// centred 320 px right of the middle, 215 px across its radius.
const CENTRE_X = 320;
const RADIUS_PX = 215;
const dist = (model.radius / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))) * (H / 2 / RADIUS_PX);
camera.position.set(0, 0, dist);
camera.lookAt(0, 0, 0);
camera.setViewOffset(W, H, -CENTRE_X, 0, W, H);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 1.0, 0, 0.2);
bloom.compositeMaterial.uniforms['bloomFactors'].value = [1, 0.75, 0.45, 0.18, 0.04];
composer.addPass(bloom);
composer.addPass(new OutputPass());
setLineResolution(renderer.getDrawingBufferSize(new THREE.Vector2()));
composer.render();
void document.fonts.ready.then(() => document.body.classList.add('ready'));
