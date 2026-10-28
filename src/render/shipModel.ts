import * as THREE from 'three';
import { deriveEdges } from '../content/geometry';
import type { ShipDef, Vec3 } from '../content/types';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { applyLivery } from './livery';
import { behindLines, disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

export interface ShipModel {
  def: ShipDef;
  root: THREE.Group;
  radius: number;
  /** Neo-vector line materials and their normal colours, for effects such as heating. */
  lines: { material: LineMaterial; base: THREE.Color }[];
  parts: { neo: THREE.Object3D[]; retro: THREE.Object3D[] };
  /** Its own line colours, kept while it's shown as unidentified. */
  unidentified?: THREE.Color[];
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

  // A mark in its own colour: a nod, finer and softer than the hull lines.
  const mark: number[] = [];
  if (def.insignia) for (const [a, b] of def.insignia.lines) mark.push(...def.insignia.vertices[a], ...def.insignia.vertices[b]);
  if (mark.length) {
    const markLines = neoLines(mark, new THREE.Color(def.insignia!.color).multiplyScalar(0.9 * glow), 1.0);
    neo.push(markLines);
    lines.push({ material: markLines.material, base: markLines.material.color.clone() });
  }

  const retro: THREE.Object3D[] = [
    new THREE.Mesh(fill, new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide, ...behindLines })),
    retroLines([...hull, ...detail, ...mark]),
  ];

  root.add(...neo, ...retro);
  // Police markings come from the role, never from the ship file.
  if (def.role === 'police' || def.role === 'marshal') {
    const livery = applyLivery(def, root, def.role);
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
/** What the display shows for a ship with no transponder, until its hull is read: a cold white. */
export const UNIDENTIFIED = new THREE.Color('#d8e2f0');

/**
 * Show a ship as unidentified (no transponder, too far for a hull read), or
 * in its own colours again. The glow stays: you can see it, you just can't
 * tell what it is.
 */
export function showUnidentified(model: ShipModel, on: boolean) {
  model.unidentified ??= model.lines.map((l) => l.base.clone());
  model.lines.forEach((l, i) => {
    l.base.copy(on ? UNIDENTIFIED.clone().multiplyScalar(i === 0 ? 1.6 : 1.1) : model.unidentified![i]);
    l.material.color.copy(l.base);
  });
}

export function heatShip(model: ShipModel, heat: number) {
  for (const { material, base } of model.lines) material.color.copy(base).lerp(WHITE_HOT, heat);
}

export function disposeShip(model: ShipModel) {
  unregisterParts(model.parts);
  disposeObject(model.root);
}

/** A ship's finish from the yard: its colour, how hard it glows, and a trim colour for the fine lines. */
export interface Look {
  colour: string;
  glow: number;
  trim: string | null;
}

/** A ship built in its owner's paint (two-tone: the fine lines in the trim colour). */
export function buildPainted(def: ShipDef, look: Look | null | undefined): ShipModel {
  if (!look) return buildShip(def);
  const m = buildShip({ ...def, style: { ...def.style, lineColor: look.colour, glow: look.glow } });
  if (look.trim && def.geometry.details && m.lines[1]) {
    m.lines[1].material.color.set(look.trim).multiplyScalar(1.1 * look.glow);
    m.lines[1].base.copy(m.lines[1].material.color);
  }
  return m;
}
