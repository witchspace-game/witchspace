import * as THREE from 'three';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Space bending around a witchspace rift, like a gravitational lens: the
// stars (and anything else) near it are pulled out of place, magnified and
// twisted. Done on the finished frame, so it bends whatever is behind the
// rift. The real starfield is too sparse to show it off, so the pass adds a
// faint field of its own stars, bent the same way. Neo-vector mode only.

const LensShader = {
  uniforms: {
    tDiffuse: { value: null as THREE.Texture | null },
    center: { value: new THREE.Vector2(0.5, 0.5) },
    radius: { value: 0.1 }, // in units of screen height
    strength: { value: 0 },
    twist: { value: 0 },
    aspect: { value: 1 },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec2 center;
    uniform float radius;
    uniform float strength;
    uniform float twist;
    uniform float aspect;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    // Faint stars fixed around the rift, seen through the bend.
    float stars(vec2 p) {
      vec2 q = p / radius * 9.0;
      vec2 cell = floor(q);
      float h = hash(cell);
      if (h < 0.82) return 0.0;
      vec2 at = cell + vec2(hash(cell + 7.1), hash(cell + 3.7));
      float size = 0.05 + 0.06 * hash(cell + 1.3);
      return smoothstep(size, 0.0, length(q - at)) * (0.4 + 0.6 * h);
    }

    // Where to sample from for a point at offset d (in screen-height units).
    vec2 bend(vec2 d) {
      float r = length(d);
      float x = r / radius;
      // Light near the rim is pulled in towards the centre (so the view there
      // is magnified), falling away to nothing a few radii out.
      float pull = strength / (1.0 + x * x) * smoothstep(4.5, 1.0, x);
      // And the whole region swirls, most strongly at the rim.
      float a = twist * exp(-(x - 1.0) * (x - 1.0) * 0.8);
      float c = cos(a), s = sin(a);
      d = mat2(c, -s, s, c) * d;
      return d * (1.0 - pull);
    }

    void main() {
      vec2 d = vUv - center;
      d.x *= aspect;
      if (strength <= 0.0 || length(d) > radius * 5.0) {
        gl_FragColor = texture2D(tDiffuse, vUv);
        return;
      }
      vec2 bent = bend(d);
      vec3 seen = texture2D(tDiffuse, center + bent * vec2(1.0 / aspect, 1.0)).rgb;
      float x = length(d) / radius;
      float field = stars(bent) * strength * smoothstep(0.85, 1.15, x) * smoothstep(5.0, 2.5, x);
      gl_FragColor = vec4(seen + field * vec3(0.75, 0.8, 1.0), 1.0);
    }`,
};

export class LensPass extends ShaderPass {
  constructor() {
    super(LensShader);
    this.enabled = false;
  }

  /**
   * Bend the view around a world point. `radius` is in metres; `strength`
   * 0..1 sets how hard space bends. Call each frame before rendering.
   */
  aim(camera: THREE.PerspectiveCamera, at: THREE.Vector3 | null, radius: number, strength: number) {
    if (!at || strength <= 0) {
      this.enabled = false;
      return;
    }
    const view = at.clone().applyMatrix4(camera.matrixWorldInverse);
    if (view.z > -radius * 0.5) {
      this.enabled = false; // behind or around the camera
      return;
    }
    const p = at.clone().project(camera);
    const u = this.uniforms;
    u.center.value.set((p.x + 1) / 2, (p.y + 1) / 2);
    u.radius.value = radius / (2 * -view.z * Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2));
    u.strength.value = 0.55 * strength;
    u.twist.value = 0.9 * strength;
    u.aspect.value = camera.aspect;
    this.enabled = true;
  }
}
