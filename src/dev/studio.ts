// The photo studio (dev only, /studio/ on the dev server): press shots of any
// ship in any paint, from anywhere, with a long lens if you like. Nothing here
// reaches players: the page isn't in vite.config.ts's list, so it's never built.
//
// Drive it from the address or from window.__photo (Playwright):
//   /studio/?ship=fer-de-lance&edition=witch-fire&cam=-60,-14,95&look=0,0,10&fov=20&bg=space&sun=-900,300,-3000,260
//   window.__photo.set({ cam: [x, y, z], look: [x, y, z], fov: 18, roll: 8, bg: 'black' })
//   await window.__photo.still(3)  // a PNG data URL at three times the window size
//
// Options: ship (content id), edition (an edition's whole look), colour / glow /
// trim (any paint, by hex and 'standard' | 'deep' | 'blazing'), cam, look, roll
// (degrees), fov (degrees: 15 to 25 is a long lens), bg ('black' | 'space' |
// 'berth'), sun / planet (x, y, z, radius; planet colour as planetColour),
// plate (text for a name plate, e.g. "Moxon · Witch-fire Edition 001").

import * as THREE from 'three';
import { shipById } from '../content/ships';
import { editionById } from '../content/editions';
import { atSize, camera, makeSpace, render } from '../render/renderer';
import { buildPainted, disposeShip, type Look, type ShipModel } from '../render/shipModel';
import { buildHangar } from '../render/hangar';
import { buildPlanet, buildSun } from '../render/bodies';
import { GLOWS, type GlowId } from '../game/shipyard';

type V3 = [number, number, number];
interface Shot {
  ship: string;
  edition?: string;
  colour?: string;
  glow?: GlowId;
  trim?: string | null;
  cam: V3;
  look: V3;
  roll: number;
  fov: number;
  bg: 'black' | 'space' | 'berth';
  sun?: [number, number, number, number] | null;
  planet?: [number, number, number, number] | null;
  planetColour?: string;
  plate?: string;
}

const space = makeSpace();
const hangar = buildHangar();
space.scene.add(hangar);
let model: ShipModel | null = null;
let sun: THREE.Group | null = null;
let planet: THREE.Group | null = null;
let shot: Shot = { ship: 'fer-de-lance', cam: [-70, 18, 110], look: [0, 0, 0], roll: 0, fov: 22, bg: 'space' };
let built = '';

const nums = (s: string | null, n: number) => {
  const v = s?.split(',').map(Number);
  return v && v.length === n && v.every(Number.isFinite) ? v : undefined;
};

function fromAddress(): Partial<Shot> {
  const q = new URLSearchParams(location.search);
  const out: Partial<Shot> = {};
  for (const k of ['ship', 'edition', 'colour', 'trim', 'planetColour', 'plate'] as const) if (q.has(k)) out[k] = q.get(k)!;
  if (q.has('glow')) out.glow = q.get('glow') as GlowId;
  if (q.has('bg')) out.bg = q.get('bg') as Shot['bg'];
  if (q.has('fov')) out.fov = Number(q.get('fov'));
  if (q.has('roll')) out.roll = Number(q.get('roll'));
  const cam = nums(q.get('cam'), 3);
  const look = nums(q.get('look'), 3);
  if (cam) out.cam = cam as V3;
  if (look) out.look = look as V3;
  const s = nums(q.get('sun'), 4);
  const p = nums(q.get('planet'), 4);
  if (s) out.sun = s as Shot['sun'];
  if (p) out.planet = p as Shot['planet'];
  return out;
}

/** The ship's look: an edition's whole finish, or the paint given, or the maker's own. */
function lookOf(s: Shot): Look | null {
  const def = shipById(s.ship);
  const e = s.edition ? editionById(s.edition) : undefined;
  const colour = s.colour ?? e?.colour;
  if (!def || (!colour && !s.glow && !s.trim)) return null;
  return { colour: colour ?? def.style.lineColor, glow: GLOWS[s.glow ?? e?.glow ?? 'standard'].glow * (def.style.glow ?? 1), trim: s.trim ?? e?.trim ?? null };
}

function apply() {
  const def = shipById(shot.ship) ?? shipById('fer-de-lance')!;
  const look = lookOf(shot);
  const key = JSON.stringify([def.id, look]);
  if (key !== built) {
    if (model) {
      space.scene.remove(model.root);
      disposeShip(model);
    }
    model = buildPainted(def, look);
    space.scene.add(model.root);
    built = key;
  }
  // In the berth she rests on the pad; elsewhere she floats at the origin.
  const lowest = Math.min(...def.geometry.vertices.map((v) => v[1]));
  model!.root.position.set(0, shot.bg === 'berth' ? -lowest + 1 : 0, 0);
  hangar.visible = shot.bg === 'berth';
  space.stars.visible = shot.bg === 'space';
  for (const [key, make] of [['sun', (r: number) => buildSun(r)], ['planet', (r: number) => buildPlanet(r, shot.planetColour ?? '#5a7cff')]] as const) {
    const want = shot[key];
    const have = key === 'sun' ? sun : planet;
    if (have) space.scene.remove(have);
    const g = want && shot.bg !== 'black' ? make(want[3]) : null;
    if (g) {
      g.position.set(want![0], want![1], want![2]);
      space.scene.add(g);
    }
    if (key === 'sun') sun = g;
    else planet = g;
  }
  camera.fov = shot.fov;
  camera.position.set(...shot.cam);
  camera.up.set(0, 1, 0);
  camera.lookAt(new THREE.Vector3(...shot.look));
  camera.rotateZ(THREE.MathUtils.degToRad(shot.roll));
  camera.updateProjectionMatrix();
  space.stars.position.copy(camera.position);
  const plate = document.querySelector<HTMLElement>('#plate')!;
  plate.textContent = shot.plate ?? '';
  plate.hidden = !shot.plate;
  plate.style.setProperty('--c', look?.colour ?? def.style.lineColor);
}

function frame() {
  // The camera's aspect follows the window (the renderer resizes it); keep the shot's lens.
  if (camera.fov !== shot.fov) apply();
  render(space.scene);
  requestAnimationFrame(frame);
}

const settle = (frames: number) => new Promise<void>((done) => {
  const step = () => (frames-- <= 0 ? done() : requestAnimationFrame(step));
  step();
});

const photo = {
  set(opts: Partial<Shot>) {
    shot = { ...shot, ...opts };
    apply();
    return shot;
  },
  get: () => shot,
  /** A still at `scale` times the window size, with the glow settled: a PNG data URL. */
  async still(scale = 2): Promise<string> {
    await settle(10);
    return atSize(Math.round(innerWidth * scale), Math.round(innerHeight * scale), async (canvas) => {
      apply();
      for (let i = 0; i < 4; i++) render(space.scene);
      return canvas.toDataURL('image/png');
    });
  },
};
Object.assign(window, { __photo: photo });

shot = { ...shot, ...fromAddress() };
apply();
requestAnimationFrame(frame);
