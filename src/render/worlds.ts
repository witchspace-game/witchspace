import * as THREE from 'three';
import type { World } from '../game/explore';
import { buildPlanet } from './bodies';
import { circleSegments, disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

// What makes each system's planet its own (game/explore.ts decides; this draws):
// rings as a few fine ellipses, moons as small grey globes, and the beacons
// that mark points of interest.

/** Rings around a planet of this radius, in the planet's own frame (add to its group). */
export function buildRings(radius: number, rings: NonNullable<World['rings']>, lineColor: string): THREE.Group {
  const g = new THREE.Group();
  const color = new THREE.Color(lineColor).lerp(new THREE.Color('#e8dcc0'), 0.5);
  const bands = 5;
  const positions: number[] = [];
  for (let i = 0; i < bands; i++) {
    const r = radius * (rings.inner + ((rings.outer - rings.inner) * i) / (bands - 1));
    positions.push(...circleSegments((t) => new THREE.Vector3(Math.cos(t) * r, 0, Math.sin(t) * r), 160));
  }
  const neo = [neoLines(positions, color.multiplyScalar(0.7), 1)];
  // The BBC Micro would have managed two: the edges.
  const edges = [rings.inner, rings.outer].flatMap((k) => circleSegments((t) => new THREE.Vector3(Math.cos(t) * radius * k, 0, Math.sin(t) * radius * k), 96));
  const retro = [retroLines(edges)];
  g.add(...neo, ...retro);
  g.rotation.set(rings.tiltX, 0, rings.tiltZ);
  const parts = { neo, retro };
  registerParts(parts);
  g.userData.parts = parts;
  return g;
}

/** A moon: a small grey globe without air. */
export function buildMoon(radius: number): THREE.Group {
  return buildPlanet(radius, '#9aa3ad', false);
}

/** A beacon: a small lit diamond whose lamp blinks (call blinkBeacon each frame). */
export function buildBeacon(size = 14): THREE.Group {
  const g = new THREE.Group();
  const s = size;
  const tips = [new THREE.Vector3(0, s * 1.6, 0), new THREE.Vector3(0, -s * 1.6, 0)];
  const ring = [0, 1, 2, 3].map((i) => new THREE.Vector3(Math.cos((i * Math.PI) / 2) * s, 0, Math.sin((i * Math.PI) / 2) * s));
  const positions: number[] = [];
  for (let i = 0; i < 4; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % 4];
    positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
    for (const tip of tips) positions.push(a.x, a.y, a.z, tip.x, tip.y, tip.z);
  }
  const neo: THREE.Object3D[] = [neoLines(positions, new THREE.Color('#c9b3ff'), 1.5)];
  const retro = [retroLines(positions)];
  // Values above 1 feed the bloom pass.
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(s * 0.35, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.4, 4) }));
  lamp.position.y = s * 1.9;
  neo.push(lamp);
  g.add(...neo, ...retro);
  const parts = { neo, retro };
  registerParts(parts);
  g.userData.parts = parts;
  g.userData.lamp = lamp;
  return g;
}

export function blinkBeacon(g: THREE.Group, time: number) {
  (g.userData.lamp as THREE.Mesh).visible = time % 2 < 0.25;
}

/** Free anything built here. */
export function disposeWorldPart(g: THREE.Group) {
  if (g.userData.parts) unregisterParts(g.userData.parts);
  disposeObject(g);
}
