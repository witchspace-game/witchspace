import * as THREE from 'three';
import type { ShipModel } from '../render/shipModel';

// Paper by day, space by night (Mark, 1 Nov 2026: "a traditional really clean paper or white background
// with traditional dark copy"). On paper a ship is a technical drawing: dark ink lines, her hidden edges
// hidden, as in an owner's manual. Lit, she's herself in neo-vector. lit(t) blends between the two, so a
// drawing can catch light and come alive; the glow itself stays the game's (look.ts), only faded in.

export const PAPER = '#f4f1ea';
export const SPACE = '#04060b';
const INK = new THREE.Color('#1b1e25');
const INK_FINE = new THREE.Color('#6a707c');
const PAPER_FILL = new THREE.Color(PAPER);

/** True when the page is on paper (the mock-up's `?look=paper`). */
export const onPaper = () => document.documentElement.classList.contains('paper');

/** Blends a ship between an ink drawing (0) and herself, glowing (1). */
export function inkable(model: ShipModel): (t: number) => void {
  // A flat fill in the paper's colour hides the far edges, as a drawing would; lit, it darkens to her own.
  const fill = model.parts.neo.find((o): o is THREE.Mesh => o instanceof THREE.Mesh);
  const own = (fill?.material as THREE.MeshLambertMaterial | undefined)?.color.clone() ?? new THREE.Color(0);
  const flat = new THREE.MeshBasicMaterial({ color: PAPER_FILL, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
  if (fill) fill.material = flat;
  return (t) => {
    model.lines.forEach(({ material, base }, i) => material.color.copy(i === 0 ? INK : INK_FINE).lerp(base, t));
    flat.color.copy(PAPER_FILL).lerp(own, t);
  };
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
