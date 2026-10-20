import * as THREE from 'three';
import { behindLines, circleSegments, disposeObject, neoLines, registerParts, retroLines, unregisterParts } from './wire';

/** Where the atmosphere ends, as a multiple of the planet's radius. Debris burns up inside it. */
export const ATMOSPHERE_SCALE = 1.06;

/** A soft glowing rim: brightest where you look through the most air, at the planet's edge. */
function buildAtmosphere(radius: number, color: THREE.Color): THREE.Mesh {
  return new THREE.Mesh(
    new THREE.SphereGeometry(radius, 96, 48),
    new THREE.ShaderMaterial({
      uniforms: { glow: { value: color.clone().multiplyScalar(0.55) } },
      vertexShader: /* glsl */ `
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vNormal = normalize(normalMatrix * normal);
          vView = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 glow;
        varying vec3 vNormal;
        varying vec3 vView;
        void main() {
          float rim = 1.0 - abs(dot(vNormal, vView));
          gl_FragColor = vec4(glow * pow(rim, 6.0), 1.0);
        }`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

/** A planet drawn as a lit globe with glowing lines of latitude and longitude. */
export function buildPlanet(radius: number, lineColor: string): THREE.Group {
  const g = new THREE.Group();
  const color = new THREE.Color(lineColor);
  const sphere = new THREE.SphereGeometry(radius, 64, 32);

  const latitude = (deg: number) => {
    const r = radius * Math.cos(THREE.MathUtils.degToRad(deg));
    const y = radius * Math.sin(THREE.MathUtils.degToRad(deg));
    return circleSegments((t) => new THREE.Vector3(Math.cos(t) * r, y, Math.sin(t) * r), 128);
  };
  const meridian = (deg: number) => {
    const a = THREE.MathUtils.degToRad(deg);
    return circleSegments(
      (t) => new THREE.Vector3(Math.cos(t) * Math.cos(a) * radius, Math.sin(t) * radius, Math.cos(t) * Math.sin(a) * radius),
      128,
    );
  };

  const neoGrid = [...[-60, -30, 0, 30, 60].flatMap(latitude), ...[0, 30, 60, 90, 120, 150].flatMap(meridian)];
  const neo = [
    new THREE.Mesh(sphere, new THREE.MeshLambertMaterial({ color: color.clone().multiplyScalar(0.12), ...behindLines })),
    neoLines(neoGrid, color.clone().multiplyScalar(0.9), 1.2),
    buildAtmosphere(radius * ATMOSPHERE_SCALE, color),
  ];
  // The BBC Micro drew planets as an outline with an equator and a meridian.
  const retro = [
    new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0x000000, ...behindLines })),
    retroLines([...latitude(0), ...meridian(0), ...meridian(90)]),
  ];
  g.add(...neo, ...retro);
  const parts = { neo, retro };
  registerParts(parts);
  g.userData.parts = parts;
  return g;
}

/** Remove a planet built by buildPlanet and free its GPU resources. */
export function disposePlanet(g: THREE.Group) {
  unregisterParts(g.userData.parts);
  disposeObject(g);
}

export function buildSun(radius: number): THREE.Group {
  const g = new THREE.Group();
  const sphere = new THREE.SphereGeometry(radius, 48, 24);
  // Values above 1 feed the bloom pass, so the sun blazes.
  const neo = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 3.1, 1.8) }));
  const retro = new THREE.Mesh(sphere, new THREE.MeshBasicMaterial({ color: 0xffffff }));
  g.add(neo, retro);
  registerParts({ neo: [neo], retro: [retro] });
  return g;
}
