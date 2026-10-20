// Flight controls from keyboard, mouse and gamepad, combined into one set of
// analogue axes. Discrete actions (launch, toggles) go through main.ts.

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

// --- Keyboard ---------------------------------------------------------------
// Holding a key builds the turn rate up gradually, as in the original, so a
// tap gives a fine correction and a long hold gives a full-rate turn.

const KEY_RAMP = 0.7; // seconds from tap to full rate

const held = new Map<string, number>(); // code -> time first pressed (ms)

const FLIGHT_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'Slash', 'Comma', 'Period', 'KeyX',
]);

addEventListener('keydown', (e) => {
  if (!held.has(e.code)) held.set(e.code, performance.now());
  if (FLIGHT_KEYS.has(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

/** 0..1: how far a key group has ramped up. */
function keyRamp(now: number, ...codes: string[]): number {
  let since = Infinity;
  for (const c of codes) since = Math.min(since, held.get(c) ?? Infinity);
  if (since === Infinity) return 0;
  const k = Math.min(1, (now - since) / 1000 / KEY_RAMP);
  return 0.15 + 0.85 * k * k; // a tap still does something
}
const keyHeld = (...codes: string[]) => codes.some((c) => held.has(c));

// --- Pitch direction ----------------------------------------------------------
// Default is flight-stick style (W / push forward = dive). Many players expect
// the opposite, so it can be flipped with I, and the choice is remembered.

const INVERT_KEY = 'witchspace.invertPitch';
let invertPitch = (() => {
  try {
    return localStorage.getItem(INVERT_KEY) === '1';
  } catch {
    return false;
  }
})();

export const isPitchInverted = () => invertPitch;

export function toggleInvertPitch(): boolean {
  invertPitch = !invertPitch;
  try {
    localStorage.setItem(INVERT_KEY, invertPitch ? '1' : '0');
  } catch {
    // Not saved; the setting still applies for this session.
  }
  return invertPitch;
}

// --- Mouse (pointer lock) ------------------------------------------------------
// While captured, the mouse is a joystick that springs back to centre: move
// it to turn, stop moving and the ship stops turning. Scroll for speed.

const MOUSE_RANGE = 160; // pixels of travel for full deflection
const MOUSE_RECENTRE = 3; // per second; how quickly the stick springs back
const stick = { x: 0, y: 0, moved: false };
let wheel = 0;
let mouseEnabled = false;

export const isMouseFlying = () => mouseEnabled && document.pointerLockElement !== null;

/** Allow capturing the mouse by clicking the game (only while flying). */
export function setMouseFlightAvailable(available: boolean) {
  mouseEnabled = available;
  if (!available && document.pointerLockElement) document.exitPointerLock();
  if (!available) centreMouseStick();
}

export function centreMouseStick() {
  stick.x = 0;
  stick.y = 0;
}

addEventListener('mousedown', (e) => {
  if (!mouseEnabled || document.pointerLockElement) return;
  if ((e.target as HTMLElement).closest('button, a, input')) return;
  centreMouseStick();
  void document.body.requestPointerLock?.();
});
addEventListener('mousemove', (e) => {
  if (!isMouseFlying()) return;
  stick.x += e.movementX / MOUSE_RANGE;
  stick.y += e.movementY / MOUSE_RANGE;
  const r = Math.hypot(stick.x, stick.y);
  if (r > 1) {
    stick.x /= r;
    stick.y /= r;
  }
  stick.moved = true;
});
// Scrolling works whenever you're flying, captured or not, so a mouse can
// sit alongside the keyboard. A notched wheel, an Apple Magic Mouse's touch
// surface and a trackpad all arrive as scroll events, so we scale by distance
// rather than counting events (a Magic Mouse swipe sends dozens of them).
//   forwards/back -> speed      sideways -> fine roll
// With macOS natural scrolling (the default), both follow your finger.
const SCROLL_SPEED = 0.0008; // fraction of top speed per pixel; a wheel notch ≈ 8%
const SWIPE_ROLL = 0.012; // roll per pixel of sideways swipe
const SWIPE_ROLL_DECAY = 6; // per second; a swipe gives a short, smooth roll

let swipeRoll = 0;

addEventListener(
  'wheel',
  (e) => {
    if (!mouseEnabled) return;
    const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1; // lines / pages -> pixels
    wheel += e.deltaY * scale;
    swipeRoll = clamp1(swipeRoll - e.deltaX * scale * SWIPE_ROLL);
    e.preventDefault();
  },
  { passive: false },
);
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) centreMouseStick();
});

/** Current virtual stick position, for the on-screen indicator. */
export const mouseStick = () => ({ x: stick.x, y: stick.y });

// --- Gamepad ----------------------------------------------------------------

const DEADZONE = 0.15;
let padButtons: boolean[] = [];

/** Deadzone, then a gentle curve so small stick movements are precise. */
function shapeAxis(v: number): number {
  const a = Math.abs(v);
  if (a < DEADZONE) return 0;
  const n = (a - DEADZONE) / (1 - DEADZONE);
  return Math.sign(v) * (0.4 * n + 0.6 * n * n);
}

function activePad(): Gamepad | null {
  for (const p of navigator.getGamepads?.() ?? []) if (p?.connected) return p;
  return null;
}

/**
 * Standard-mapping gamepad buttons that were pressed since the last call,
 * reported as virtual key names for main.ts to act on.
 */
export function gamepadPresses(): ('PadA' | 'PadB' | 'PadY' | 'PadStart')[] {
  const pad = activePad();
  if (!pad) return [];
  const names: Record<number, 'PadA' | 'PadB' | 'PadY' | 'PadStart'> = { 0: 'PadA', 1: 'PadB', 3: 'PadY', 9: 'PadStart' };
  const out: ('PadA' | 'PadB' | 'PadY' | 'PadStart')[] = [];
  pad.buttons.forEach((b, i) => {
    if (b.pressed && !padButtons[i] && names[i]) out.push(names[i]);
  });
  padButtons = pad.buttons.map((b) => b.pressed);
  return out;
}

// --- Combined -----------------------------------------------------------------

export interface FlightInput {
  /** +1 = nose up */
  pitch: number;
  /** +1 = roll right */
  roll: number;
  /** +1 = speed up (held) */
  throttle: number;
  /** One-off change in speed, as a fraction of top speed (scroll wheel / swipe). */
  speedStep: number;
  /** True if the pilot is actively touching any control this frame. */
  active: boolean;
}

let lastPoll = performance.now();

export function flightInput(): FlightInput {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastPoll) / 1000);
  lastPoll = now;

  // Flight-stick convention: push forward (W / ↑) to dive. X is the BBC's "climb" key.
  const kbPitch = keyRamp(now, 'KeyS', 'ArrowDown', 'KeyX') - keyRamp(now, 'KeyW', 'ArrowUp');
  // < and > rolled the ship on the BBC Micro.
  const kbRoll = keyRamp(now, 'KeyD', 'ArrowRight', 'Period') - keyRamp(now, 'KeyA', 'ArrowLeft', 'Comma');
  const kbThrottle = (keyHeld('Space') ? 1 : 0) - (keyHeld('ShiftLeft', 'ShiftRight', 'Slash') ? 1 : 0);

  // Mouse: pull back (towards you) to climb, like a joystick.
  const mouse = isMouseFlying() ? { pitch: shapeAxis(stick.y), roll: shapeAxis(stick.x) } : { pitch: 0, roll: 0 };

  const pad = activePad();
  const padPitch = pad ? shapeAxis(pad.axes[1] ?? 0) : 0;
  const padRoll = pad ? shapeAxis(pad.axes[0] ?? 0) : 0;
  const padThrottle = pad ? (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0) : 0;

  const speedStep = wheel * SCROLL_SPEED;
  const swipe = swipeRoll;
  swipeRoll *= Math.exp(-dt * SWIPE_ROLL_DECAY);
  if (Math.abs(swipeRoll) < 0.01) swipeRoll = 0;
  const mouseMoved = stick.moved;
  wheel = 0;
  stick.moved = false;
  if (!mouseMoved) {
    const k = Math.exp(-dt * MOUSE_RECENTRE);
    stick.x *= k;
    stick.y *= k;
  }

  const pitchSign = invertPitch ? -1 : 1;
  const input: FlightInput = {
    pitch: pitchSign * clamp1(kbPitch + mouse.pitch + padPitch),
    roll: clamp1(kbRoll + mouse.roll + padRoll + swipe),
    throttle: clamp1(kbThrottle + padThrottle),
    speedStep,
    active: false,
  };
  // A resting mouse stick is not "steering"; moving it is.
  input.active =
    kbPitch !== 0 || kbRoll !== 0 || kbThrottle !== 0 || padPitch !== 0 || padRoll !== 0 ||
    Math.abs(padThrottle) > 0.05 || speedStep !== 0 || swipe !== 0 || mouseMoved;
  return input;
}
