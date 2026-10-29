// The engine voices, to hear without flying (dev only: /tools/engine.html on the dev server).
// Your own engine (EngineSound) at a throttle and stick you set, and another ship (ShipVoice)
// flying past you from left to right.

import * as THREE from 'three';
import { sfx, unlockAudio } from '../src/audio/sound';
import { EngineSound, grandShot, precisionLaunch, setListener, ShipVoice, type EngineVoice, type LaserSound } from '../src/audio/spatial';

const engine = new EngineSound();
const $ = <T extends HTMLElement>(q: string) => document.querySelector<T>(q)!;
const speed = $<HTMLInputElement>('#speed');
let turn = 0;
let pass: { voice: ShipVoice; t: number } | null = null;

// The listener at the origin looking ahead (down -z), as the game's camera does.
const listener = new THREE.PerspectiveCamera();
listener.updateMatrixWorld();
setListener(listener);

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-voice]'))
  b.onclick = () => {
    unlockAudio();
    engine.start(b.dataset.voice as EngineVoice);
    for (const o of document.querySelectorAll('[data-voice]')) o.classList.toggle('on', o === b);
  };
$('#spool').onclick = () => {
  unlockAudio();
  engine.spool();
};
$('#stop').onclick = () => {
  engine.stop();
  for (const o of document.querySelectorAll('[data-voice]')) o.classList.remove('on');
};
const pull = $('#pull');
pull.addEventListener('pointerdown', () => ((turn = 1), pull.classList.add('held')));
for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) pull.addEventListener(type, () => ((turn = 0), pull.classList.remove('held')));

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-pass]'))
  b.onclick = () => {
    unlockAudio();
    pass?.voice.dispose();
    pass = { voice: new ShipVoice(new THREE.Vector3(-900, 0, -120), b.dataset.pass as EngineVoice), t: 0 };
  };

// Lasers: a tap fires once; held, they fire at the laser's own rate (pulse 4 a second, beam and military 10).
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-shot]')) {
  const kind = b.dataset.shot!;
  const once = () => (kind === 'drone' ? sfx.laser() : grandShot(kind as LaserSound, null));
  let timer = 0;
  b.addEventListener('pointerdown', () => {
    unlockAudio();
    once();
    timer = window.setInterval(once, kind === 'pulse' || kind === 'drone' ? 250 : 100);
  });
  for (const type of ['pointerup', 'pointercancel', 'pointerleave'] as const) b.addEventListener(type, () => clearInterval(timer));
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-launch]'))
  b.onclick = () => {
    unlockAudio();
    if (b.dataset.launch === 'grand') precisionLaunch(null);
    else sfx.missileLaunch();
  };

let last = performance.now();
function frame(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  engine.update(Number(speed.value), turn, dt);
  if (pass) {
    // About five seconds from far left to far right, 120 m ahead, at a good speed.
    pass.t += dt;
    const x = -900 + pass.t * 360;
    pass.voice.update(new THREE.Vector3(x, 0, -120), 0.8);
    if (x > 900) {
      pass.voice.dispose();
      pass = null;
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
