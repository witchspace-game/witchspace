import { isPitchInverted, isTouch, setTouchFire, setTouchSpeed, toggleInvertPitch, touchAim, touchSpeedTarget } from '../game/input';

// On-screen controls for phones and tablets: drag on the left to aim, a speed
// slider and a fire button on the right, and buttons for everything else
// (wired up through their data-key attributes like the other buttons).

const AIM_SENSITIVITY = 1.6; // finger movement is smaller than mouse movement
// Hold your thumb away from where it first touched and the aim keeps moving
// that way, like a joystick, so long turns don't need swipe after swipe.
const STICK_DEADZONE = 18; // px
const STICK_RATE = 4; // aim pixels per second, per pixel of offset

// Tilt steering (optional): the phone is a flight stick. Tip it left or right
// to turn that way; tip the top towards you (pull back) to climb, away from
// you (push forward) to dive. Measured from how you were holding it when you
// turned it on, and it keeps turning while you hold it tipped.
const TILT_DEADZONE = 3; // degrees
const TILT_RATE = 14; // aim pixels per second, per degree of tilt
const TILT_MAX = 25; // degrees: tilting further doesn't turn faster
let tiltOn = false;
let tiltX = 0; // degrees right of centre
let tiltY = 0; // degrees towards you (nose down)
let tiltCentre: { x: number; y: number } | null = null;

/** Tilt in screen terms (right, and top edge towards you), whichever way up the phone is. */
function screenTilt(e: DeviceOrientationEvent) {
  const beta = e.beta ?? 0; // front-back, degrees
  const gamma = e.gamma ?? 0; // left-right, degrees
  switch (screen.orientation?.angle ?? 0) {
    case 90:
      return { x: beta, y: -gamma };
    case 270:
      return { x: -beta, y: gamma };
    case 180:
      return { x: -gamma, y: -beta };
    default:
      return { x: gamma, y: beta };
  }
}

addEventListener('deviceorientation', (e) => {
  if (!tiltOn || e.beta === null) return;
  const t = screenTilt(e);
  tiltCentre ??= t;
  tiltX = t.x - tiltCentre.x;
  tiltY = t.y - tiltCentre.y;
});

async function toggleTilt(button: HTMLElement) {
  if (tiltOn) {
    tiltOn = false;
    button.classList.remove('on');
    return;
  }
  // iPhones ask permission, and only in response to a tap.
  const DOE = DeviceOrientationEvent as unknown as { requestPermission?: () => Promise<string> };
  if (DOE.requestPermission && (await DOE.requestPermission().catch(() => 'denied')) !== 'granted') {
    button.textContent = 'No tilt';
    return;
  }
  tiltOn = true;
  tiltCentre = null; // the next reading becomes "level"
  tiltX = tiltY = 0;
  button.classList.add('on');
}

let aiming = false;
let startX = 0;
let startY = 0;
let curX = 0;
let curY = 0;

/** Keep receiving a finger's moves even if it slides off the control. */
function capture(el: HTMLElement, id: number) {
  try {
    el.setPointerCapture(id);
  } catch {
    // Synthetic events (tests) have no real pointer to capture.
  }
}

/**
 * A button that works while another finger is down. iOS sends no click for a
 * second finger's tap (say, Lock while you aim), but pointer events always
 * arrive, so act on the touch and skip the click that may follow it.
 */
export function onTap(el: HTMLElement, action: () => void) {
  let tapped = 0;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') return;
    tapped = performance.now();
    action();
  });
  el.addEventListener('click', () => {
    if (performance.now() - tapped > 800) action();
  });
}

/** Close the touch drawer (on launch, so flight starts with a clean screen). */
export let closeDrawer = () => {};

export function initTouch() {
  if (!isTouch) return;
  document.body.classList.add('touch');
  const root = document.querySelector<HTMLElement>('#touch')!;

  // Aim pad: relative drags move the aiming ring, as a mouse would.
  const pad = root.querySelector<HTMLElement>('.aim-pad')!;
  const finger = pad.querySelector<HTMLElement>('.finger')!;
  const base = pad.querySelector<HTMLElement>('.base')!;
  let aimId: number | null = null;
  let lastX = 0;
  let lastY = 0;
  pad.addEventListener('pointerdown', (e) => {
    aimId = e.pointerId;
    aiming = true;
    lastX = startX = curX = e.clientX;
    lastY = startY = curY = e.clientY;
    base.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    capture(pad, e.pointerId);
    finger.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
    pad.classList.add('active');
  });
  pad.addEventListener('pointermove', (e) => {
    if (e.pointerId !== aimId) return;
    touchAim((e.clientX - lastX) * AIM_SENSITIVITY, (e.clientY - lastY) * AIM_SENSITIVITY);
    lastX = curX = e.clientX;
    lastY = curY = e.clientY;
    finger.style.transform = `translate(${e.clientX}px, ${e.clientY}px)`;
  });
  const endAim = (e: PointerEvent) => {
    if (e.pointerId !== aimId) return;
    aimId = null;
    aiming = false;
    pad.classList.remove('active');
  };
  pad.addEventListener('pointerup', endAim);
  pad.addEventListener('pointercancel', endAim);

  // The drawer: tap the tab (or swipe in from it) to open; it closes after any
  // button in it, another tap on the tab, or a tap anywhere outside it.
  const drawer = root.querySelector<HTMLElement>('.touch-drawer')!;
  const tab = drawer.querySelector<HTMLElement>('.drawer-tab')!;
  const setOpen = (open: boolean) => {
    drawer.classList.toggle('open', open);
    tab.setAttribute('aria-expanded', String(open));
    tab.textContent = open ? '›' : '‹';
  };
  onTap(tab, () => setOpen(!drawer.classList.contains('open')));
  let swipeFrom: number | null = null;
  tab.addEventListener('pointerdown', (e) => (swipeFrom = e.clientX));
  tab.addEventListener('pointerup', (e) => {
    if (swipeFrom === null) return;
    const dx = e.clientX - swipeFrom;
    swipeFrom = null;
    if (Math.abs(dx) > 24) setOpen(dx < 0); // swipe in to open, out to close
  });
  drawer.querySelector('.touch-actions')!.addEventListener('pointerup', (e) => {
    if ((e.target as HTMLElement).closest('button')) setTimeout(() => setOpen(false), 120);
  });
  closeDrawer = () => setOpen(false);
  document.addEventListener('pointerdown', (e) => drawer.classList.contains('open') && !drawer.contains(e.target as Node) && setOpen(false), true);

  const tilt = root.querySelector<HTMLElement>('.tilt')!;
  tilt.addEventListener('click', () => void toggleTilt(tilt));
  // The I key's setting, for phones: flips dragging and tilting alike, and is remembered.
  const invert = root.querySelector<HTMLElement>('.invert')!;
  invert.classList.toggle('on', isPitchInverted());
  invert.addEventListener('click', () => invert.classList.toggle('on', toggleInvertPitch()));

  // Fire: held down.
  const fire = root.querySelector<HTMLElement>('.fire')!;
  fire.addEventListener('pointerdown', (e) => {
    capture(fire, e.pointerId);
    setTouchFire(true);
    fire.classList.add('active');
  });
  for (const type of ['pointerup', 'pointercancel'] as const) {
    fire.addEventListener(type, () => {
      setTouchFire(false);
      fire.classList.remove('active');
    });
  }

  // Speed slider: slide up for faster. It stays where you leave it.
  const speed = root.querySelector<HTMLElement>('.speed')!;
  const setFromY = (y: number) => {
    const r = speed.getBoundingClientRect();
    setTouchSpeed(Math.min(1, Math.max(0, 1 - (y - r.top) / r.height)));
  };
  speed.addEventListener('pointerdown', (e) => {
    capture(speed, e.pointerId);
    setFromY(e.clientY);
  });
  let sliding: number | null = null;
  speed.addEventListener('pointerdown', (e) => (sliding = e.pointerId));
  speed.addEventListener('pointermove', (e) => {
    if (e.pointerId === sliding) setFromY(e.clientY);
  });
  for (const type of ['pointerup', 'pointercancel'] as const) speed.addEventListener(type, () => (sliding = null));
}

/** Each frame: joystick-style aiming, and the slider showing the actual speed, with the speed asked for marked. */
export function updateTouch(dt: number, speedFraction: number) {
  if (!isTouch) return;
  if (tiltOn) {
    const turn = (deg: number) => {
      const a = Math.min(TILT_MAX, Math.abs(deg));
      return a < TILT_DEADZONE ? 0 : Math.sign(deg) * (a - TILT_DEADZONE) * TILT_RATE * dt;
    };
    touchAim(turn(tiltX), -turn(tiltY)); // pull back to climb
  }
  if (aiming) {
    const ox = curX - startX;
    const oy = curY - startY;
    const d = Math.hypot(ox, oy);
    if (d > STICK_DEADZONE) {
      const k = ((d - STICK_DEADZONE) / d) * STICK_RATE * dt;
      touchAim(ox * k, oy * k);
    }
  }
  // The fill is the speed you're doing; a tick marks the speed you asked for. They part company when the
  // docking computer or the autopilot takes the throttle, or the engines are still catching up (Mark).
  const el = document.querySelector<HTMLElement>('#touch .speed')!;
  el.style.setProperty('--v', String(speedFraction));
  const want = touchSpeedTarget();
  el.style.setProperty('--t', String(want ?? speedFraction));
  el.classList.toggle('apart', want !== null && want !== undefined && Math.abs(want - speedFraction) > 0.03);
}
