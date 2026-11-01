import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { GLOW, samplesFor } from '../render/look';

// The game's glow for a page's canvas, all from look.ts: the scene drawn with the game's anti-aliasing
// (steps crawl along long shallow lines on a 1× screen without it, #351), then the bloom, then out to
// the screen. Set the renderer's pixel ratio first: the samples depend on it.
export function glow(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const samples = samplesFor(matchMedia('(pointer: coarse)').matches, renderer.getPixelRatio());
  const composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples }));
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), GLOW.strength, GLOW.radius, GLOW.threshold);
  bloom.compositeMaterial.uniforms['bloomFactors'].value = [...GLOW.factors];
  composer.addPass(bloom);
  composer.addPass(new OutputPass());
  return { composer, bloom };
}
