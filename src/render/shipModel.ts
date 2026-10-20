import * as THREE from 'three';
import { deriveEdges } from '../content/geometry';
import type { ShipDef, Vec3 } from '../content/types';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { applyPoliceLivery } from './livery';
import { behindLines, disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

export interface ShipModel {
  def: ShipDef;
  root: THREE.Group;
  radius: number;
  /** Neo-vector line materials and their normal colours, for effects such as heating. */
  lines: { material: LineMaterial; base: THREE.Color }[];
  parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };
}

function linePositions(def: ShipDef): { hull: number[]; detail: number[] } {
  const { vertices, faces, details } = def.geometry;
  const push = (out: number[], a: Vec3, b: Vec3) => out.push(...a, ...b);
  const hull: number[] = [];
  for (const [a, b] of deriveEdges(faces)) push(hull, vertices[a], vertices[b]);
  const detail: number[] = [];
  if (details) for (const [a, b] of details.lines) push(detail, details.vertices[a], details.vertices[b]);
  return { hull, detail };
}

function fillGeometry(def: ShipDef): THREE.BufferGeometry {
  const { vertices, faces } = def.geometry;
  const pos: number[] = [];
  for (const f of faces) {
    for (let i = 1; i < f.length - 1; i++) pos.push(...vertices[f[0]], ...vertices[f[i]], ...vertices[f[i + 1]]);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals(); // non-indexed, so these are flat per face
  return geo;
}

export function buildShip(def: ShipDef): ShipModel {
  const root = new THREE.Group();
  root.name = def.id;
  const color = new THREE.Color(def.style.lineColor);
  const glow = def.style.glow ?? 1;
  const { hull, detail } = linePositions(def);
  const fill = fillGeometry(def);

  const hullLines = neoLines(hull, color.clone().multiplyScalar(1.6 * glow), 2.2);
  const neo: THREE.Object3D[] = [
    new THREE.Mesh(
      fill,
      new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.07), side: THREE.DoubleSide, ...behindLines }),
    ),
    hullLines,
  ];
  const lines = [{ material: hullLines.material, base: hullLines.material.color.clone() }];
  if (detail.length) {
    const detailLines = neoLines(detail, color.clone().multiplyScalar(1.1 * glow), 1.4);
    neo.push(detailLines);
    lines.push({ material: detailLines.material, base: detailLines.material.color.clone() });
  }

  const retro: THREE.Object3D[] = [
    new THREE.Mesh(fill, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, ...behindLines })),
    retroLines([...hull, ...detail]),
  ];

  root.add(...neo, ...retro);
  // Police markings come from the role, never from the ship file.
  if (def.role === 'police') {
    const livery = applyPoliceLivery(def, root);
    neo.push(...livery.neo);
    retro.push(...livery.retro);
  }
  const parts = { neo, retro };
  registerParts(parts);

  let radius = 0;
  for (const v of def.geometry.vertices) radius = Math.max(radius, Math.hypot(...v));
  return { def, root, radius, lines, parts };
}

const WHITE_HOT = new THREE.Color(5, 3.6, 2.2);

/** 0 = normal, 1 = white-hot. Used for re-entry burn-up. */
export function heatShip(model: ShipModel, heat: number) {
  for (const { material, base } of model.lines) material.color.copy(base).lerp(WHITE_HOT, heat);
}

export function disposeShip(model: ShipModel) {
  unregisterParts(model.parts);
  disposeObject(model.root);
}
