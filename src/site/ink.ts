import * as THREE from 'three';
import { GLOW } from '../render/look';
import type { ShipModel } from '../render/shipModel';

// Paper by day, space by night (Mark, 1 Nov 2026: "a traditional really clean paper or white background
// with traditional dark copy"). On paper a ship is a technical drawing: dark ink lines, her hidden edges
// hidden, as in an owner's manual. Lit, she's herself in neo-vector. lit(t) blends between the two, so a
// drawing can catch light and come alive; the glow itself stays the game's (look.ts), only faded in.

export const PAPER = '#f4f1ea';
export const SPACE = '#04060b';
// The clear colour reaches the screen through the glow's output pass, which encodes it once more, so it starts a step darker.
const SPACE_LINEAR = new THREE.Color(SPACE).convertSRGBToLinear();
const INK = new THREE.Color('#1b1e25');
const INK_FINE = new THREE.Color('#6a707c');
/** Ink is drawn a little heavier than the glowing line, which looks wider than it is. */
const INK_WEIGHT = 0.35;
const PAPER_FILL = new THREE.Color(PAPER);

export { onPaper } from './onPaper';

/** Blends a ship between an ink drawing (0) and herself, glowing (1). */
export function inkable(model: ShipModel): (t: number) => void {
  // A flat fill in the paper's colour hides the far edges, as a drawing would. It darkens as she's lit,
  // and once she's fully lit she has her own fill back, so she's exactly as the game draws her.
  const widths = model.lines.map(({ material }) => material.linewidth);
  const fill = model.parts.neo.find((o): o is THREE.Mesh => o instanceof THREE.Mesh);
  const own = fill?.material;
  const flat = new THREE.MeshBasicMaterial({ color: PAPER_FILL, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  return (t) => {
    model.lines.forEach(({ material, base }, i) => {
      material.color.copy(i === 0 ? INK : INK_FINE).lerp(base, t);
      material.linewidth = widths[i] * (1 + INK_WEIGHT * (1 - t));
    });
    // Darkened as it looks, not as it's stored, so the paper fades with the plate behind her (2.2: the screen's curve).
    flat.color.copy(PAPER_FILL).multiplyScalar((1 - t) ** 2.2);
    if (fill && own) fill.material = t >= 1 ? own : flat;
    model.root.userData.lights = t; // the law's lights and band (livery.ts) come on as she's lit; a drawing has none
  };
}

/**
 * The light on her: at 0 an ink drawing on a see-through canvas; at 1 herself, in the game's glow, on space.
 * The glow waits until the space behind her is half there, or it greys the paper as it fades in.
 */
export function lightUp(renderer: THREE.WebGLRenderer, bloom: { strength: number }, inked: (t: number) => void, t: number) {
  inked(t);
  bloom.strength = GLOW.strength * THREE.MathUtils.smoothstep(t, 0.4, 1);
  renderer.setClearColor(SPACE_LINEAR, t);
}

/** Eases a value towards where it's going, frame by frame: about `seconds` to get most of the way. */
export function easer(seconds: number) {
  let value = 0;
  return {
    get value() {
      return value;
    },
    step(target: number, dt: number) {
      value += (target - value) * Math.min(1, (dt * 3) / seconds);
      if (Math.abs(target - value) < 0.002) value = target;
      return value;
    },
  };
}
