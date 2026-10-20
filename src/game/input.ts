// Flight controls from keyboard, mouse and gamepad, combined into one set of
// analogue axes. Discrete actions (launch, toggles) go through main.ts.

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

// --- Mouse (pointer lock) ------------------------------------------------------
// While captured, the mouse is a virtual joystick: move it to deflect the
// stick, and it stays where you leave it, like a real one. Scroll for speed.

const MOUSE_RANGE = 220; // pixels of travel for full deflection
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
addEventListener(
  'wheel',
  (e) => {
    if (!isMouseFlying()) return;
    wheel += Math.sign(e.deltaY);
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
  /** One-off change in speed, as a fraction of top speed (scroll wheel). */
  speedStep: number;
  /** True if the pilot is actively touching any control this frame. */
  active: boolean;
}

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

export function flightInput(): FlightInput {
  const now = performance.now();

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

  const speedStep = -wheel * 0.08;
  const mouseMoved = stick.moved;
  wheel = 0;
  stick.moved = false;

  const input: FlightInput = {
    pitch: clamp1(kbPitch + mouse.pitch + padPitch),
    roll: clamp1(kbRoll + mouse.roll + padRoll),
    throttle: clamp1(kbThrottle + padThrottle),
    speedStep,
    active: false,
  };
  // A resting mouse stick is not "steering"; moving it is.
  input.active =
    kbPitch !== 0 || kbRoll !== 0 || kbThrottle !== 0 || padPitch !== 0 || padRoll !== 0 ||
    Math.abs(padThrottle) > 0.05 || speedStep !== 0 || mouseMoved;
  return input;
}
