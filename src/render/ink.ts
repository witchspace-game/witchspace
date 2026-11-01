import * as THREE from 'three';
import { GLOW, PAPER } from './look';
import type { ShipModel } from './shipModel';

// A ship as an ink drawing on paper, and lit back into herself (docs/design/neo-look.md; the numbers are
// look.ts's PAPER). The site's light look draws ships this way (Mark, 1 November 2026: "paper by day,
// space by night"); the game can use it for drawings of its own, an owner's manual's plates. At 0 she's
// dark ink with her hidden edges hidden; at 1 she's exactly as the game draws her, glow and all.

const INK = new THREE.Color(PAPER.ink);
const INK_FINE = new THREE.Color(PAPER.inkFine);
const PAPER_FILL = new THREE.Color(PAPER.paper);
// The clear colour reaches the screen through the glow's output pass, which encodes it once more, so it starts a step darker.
const SPACE_LINEAR = new THREE.Color(PAPER.space).convertSRGBToLinear();

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
      if (t >= 1) material.color.copy(base); // exactly, not nearly
      else material.color.copy(i === 0 ? INK : INK_FINE).lerp(base, t);
      material.linewidth = widths[i] * (1 + PAPER.inkWeight * (1 - t));
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
  bloom.strength = GLOW.strength * THREE.MathUtils.smoothstep(t, PAPER.glowFrom, 1);
  renderer.setClearColor(SPACE_LINEAR, t);
}
