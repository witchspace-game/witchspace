import * as THREE from 'three';
import { behindLines, neoLines, registerParts, retroLines } from './wire';

// A docking berth inside the station: a ribbed bay with a floor grid, a
// landing pad and ceiling light strips, in the same wireframe style as
// everything else. The ship sits on the pad with its lowest point at y = 0.

const WIDTH = 170; // metres
const HEIGHT = 90;
const LENGTH = 240;

export function buildHangar(): THREE.Group {
  const g = new THREE.Group();
  const structure: number[] = [];
  const floor: number[] = [];
  const pad: number[] = [];
  const lights: number[] = [];
  const seg = (out: number[], a: THREE.Vector3Tuple, b: THREE.Vector3Tuple) => out.push(...a, ...b);

  // Ribs: the bay's cross-section, repeated along its length.
  const w = WIDTH / 2;
  const profile: [number, number][] = [
    [-w, 0], [-w, HEIGHT * 0.55], [-w * 0.7, HEIGHT], [w * 0.7, HEIGHT], [w, HEIGHT * 0.55], [w, 0],
  ];
  const ribs = 7;
  for (let i = 0; i < ribs; i++) {
    const z = -LENGTH / 2 + (i * LENGTH) / (ribs - 1);
    for (let k = 0; k < profile.length - 1; k++) {
      seg(structure, [profile[k][0], profile[k][1], z], [profile[k + 1][0], profile[k + 1][1], z]);
    }
  }
  // Longerons joining the ribs at each corner of the profile.
  for (const [x, y] of profile) seg(structure, [x, y, -LENGTH / 2], [x, y, LENGTH / 2]);

  // Floor grid.
  for (let x = -w; x <= w + 0.1; x += 17) seg(floor, [x, 0, -LENGTH / 2], [x, 0, LENGTH / 2]);
  for (let z = -LENGTH / 2; z <= LENGTH / 2 + 0.1; z += 20) seg(floor, [-w, 0, z], [w, 0, z]);

  // The landing pad: two nested rectangles and corner markers, slightly raised.
  const rect = (hw: number, hl: number, y: number) => {
    const c: THREE.Vector3Tuple[] = [[-hw, y, -hl], [hw, y, -hl], [hw, y, hl], [-hw, y, hl]];
    for (let i = 0; i < 4; i++) seg(pad, c[i], c[(i + 1) % 4]);
  };
  rect(52, 46, 0.4);
  rect(44, 38, 0.4);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) seg(pad, [sx * 52, 0.4, sz * 46], [sx * 60, 0.4, sz * 54]);

  // Ceiling light strips.
  for (const x of [-w * 0.45, 0, w * 0.45]) seg(lights, [x, HEIGHT - 0.5, -LENGTH / 2 + 10], [x, HEIGHT - 0.5, LENGTH / 2 - 10]);

  // A dark floor and walls so the bay reads as a room and hides the far side.
  const floorMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(WIDTH, LENGTH).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x020806, ...behindLines }),
  );

  const neo = [
    floorMesh,
    neoLines(structure, new THREE.Color('#3dffb0').multiplyScalar(0.32), 1.4),
    neoLines(floor, new THREE.Color('#3dffb0').multiplyScalar(0.14), 1),
    neoLines(pad, new THREE.Color('#ffb347').multiplyScalar(0.9), 1.6),
    neoLines(lights, new THREE.Color(2.4, 2.3, 2), 2.2),
  ];
  const retro = [floorMesh.clone(), retroLines([...structure, ...pad])];
  g.add(...neo, ...retro);
  registerParts({ neo, retro });
  return g;
}
