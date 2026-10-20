import * as THREE from 'three';

// Situational awareness: brackets around ships you can see, arrows at the
// screen edge for ones you can't, and a flash showing where hits came from.

export interface Marker {
  position: THREE.Vector3;
  color: string;
  /** Show distance under the bracket. */
  label?: string;
  /** Size of the thing being marked, in metres, for bracket scaling. */
  radius: number;
}

const layer = document.querySelector<HTMLElement>('#indicators')!;
const pool: HTMLElement[] = [];
const EDGE_INSET = 44; // px from the screen edge for off-screen arrows

function element(i: number): HTMLElement {
  while (pool.length <= i) {
    const el = document.createElement('div');
    el.innerHTML = '<i></i><span></span>';
    layer.append(el);
    pool.push(el);
  }
  return pool[i];
}

export function clearIndicators() {
  for (const el of pool) el.hidden = true;
}

export function updateIndicators(camera: THREE.PerspectiveCamera, view: DOMRect, markers: Marker[]) {
  const toCamera = camera.matrixWorldInverse;
  const cx = view.left + view.width / 2;
  const cy = view.top + view.height / 2;
  const v = new THREE.Vector3();
  const ndc = new THREE.Vector3();

  markers.forEach((m, i) => {
    const el = element(i);
    el.hidden = false;
    el.style.setProperty('--c', m.color);
    v.copy(m.position).applyMatrix4(toCamera); // camera space: -Z is ahead
    const dist = v.length();
    ndc.copy(m.position).project(camera);
    const ahead = v.z < 0;
    const onScreen = ahead && Math.abs(ndc.x) < 0.94 && Math.abs(ndc.y) < 0.92;
    const label = el.querySelector('span')!;
    label.textContent = m.label ?? '';

    if (onScreen) {
      el.className = 'bracket';
      const x = cx + (ndc.x * view.width) / 2;
      const y = cy - (ndc.y * view.height) / 2;
      // Bracket grows with apparent size, within sensible limits.
      const px = THREE.MathUtils.clamp((m.radius / dist) * view.height * 1.6, 18, 140);
      el.style.width = el.style.height = `${px}px`;
      el.style.transform = `translate(${x - px / 2}px, ${y - px / 2}px)`;
    } else {
      el.className = 'edge';
      // Direction on screen towards the marker (also correct when it's behind).
      let dx = v.x;
      let dy = -v.y;
      if (Math.hypot(dx, dy) < 1e-6) dx = 1;
      const angle = Math.atan2(dy, dx);
      const hw = view.width / 2 - EDGE_INSET;
      const hh = view.height / 2 - EDGE_INSET;
      const scale = Math.min(hw / Math.abs(Math.cos(angle) || 1e-6), hh / Math.abs(Math.sin(angle) || 1e-6));
      const x = cx + Math.cos(angle) * scale;
      const y = cy + Math.sin(angle) * scale;
      el.style.width = el.style.height = '';
      el.style.transform = `translate(${x}px, ${y}px) rotate(${angle}rad)`;
    }
  });
  for (let i = markers.length; i < pool.length; i++) pool[i].hidden = true;
}

const hitDir = document.querySelector<HTMLElement>('#hit-dir')!;

/** Flash an arc on the side of the screen a hit came from. */
export function showHitDirection(camera: THREE.PerspectiveCamera, from: THREE.Vector3) {
  const v = from.clone().applyMatrix4(camera.matrixWorldInverse);
  const angle = Math.atan2(-v.y, v.x) + Math.PI / 2; // 0 = top of screen
  hitDir.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
  hitDir.classList.remove('on');
  void hitDir.offsetWidth; // restart the animation
  hitDir.classList.add('on');
}
