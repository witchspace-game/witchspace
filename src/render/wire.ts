import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';

// Every drawable exists in two forms: glowing "neo-vector" and authentic
// 1984 white-on-black. One global switch flips them all.

interface Parts {
  neo: THREE.Object3D[];
  retro: THREE.Object3D[];
}

const registry: Parts[] = [];
let retro = false;

function apply(p: Parts) {
  for (const o of p.neo) o.visible = !retro;
  for (const o of p.retro) o.visible = retro;
}

export function registerParts(p: Parts) {
  registry.push(p);
  apply(p);
}

export function unregisterParts(p: Parts) {
  const i = registry.indexOf(p);
  if (i >= 0) registry.splice(i, 1);
}

export function setRetroParts(value: boolean) {
  retro = value;
  registry.forEach(apply);
}

// Fat lines need to know the viewport size in pixels.
const lineMaterials = new Set<LineMaterial>();
const resolution = new THREE.Vector2(1, 1);

export function setLineResolution(size: THREE.Vector2) {
  resolution.copy(size);
  for (const m of lineMaterials) m.resolution.copy(size);
}

export function neoLines(positions: number[], color: THREE.Color, width: number): LineSegments2 {
  const geo = new LineSegmentsGeometry();
  geo.setPositions(positions);
  const mat = new LineMaterial({ color, linewidth: width, worldUnits: false });
  mat.resolution.copy(resolution);
  lineMaterials.add(mat);
  return new LineSegments2(geo, mat);
}

/** Free GPU resources for short-lived objects such as explosion debris. */
export function disposeObject(root: THREE.Object3D) {
  root.traverse((o) => {
    const { geometry, material } = o as THREE.Mesh;
    geometry?.dispose();
    for (const m of Array.isArray(material) ? material : material ? [material] : []) {
      if (m instanceof LineMaterial) lineMaterials.delete(m);
      m.dispose();
    }
  });
  root.removeFromParent();
}

export function retroLines(positions: number[]): THREE.LineSegments {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  return new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: 0xffffff }));
}

/**
 * Push filled faces slightly back so lines lying on them still pass the depth
 * test. The fill then hides whatever is behind it, which gives us the original
 * game's hidden-line removal for free.
 */
export const behindLines = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 } as const;

/** Line segments approximating a circle, for planets and HUD-style rings. */
export function circleSegments(points: (t: number) => THREE.Vector3, steps = 96): number[] {
  const out: number[] = [];
  for (let i = 0; i < steps; i++) {
    const a = points((i / steps) * Math.PI * 2);
    const b = points(((i + 1) / steps) * Math.PI * 2);
    out.push(a.x, a.y, a.z, b.x, b.y, b.z);
  }
  return out;
}
