// Flight controls from keyboard, mouse, touch surfaces and gamepad, combined
// into one set of axes. Discrete actions (launch, toggles) go through main.ts.
//
// Two schemes:
//   mouse    (default) mouse aims, W/S throttle, A/D roll
//   keyboard (classic) W/S pitch, A/D roll, Space/Shift throttle, as on the BBC

export type ControlScheme = 'mouse' | 'keyboard';

const clamp1 = (v: number) => Math.max(-1, Math.min(1, v));

function load<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null;
    return v && allowed.includes(v) ? v : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Not saved; the setting still applies for this session.
  }
}

// --- Settings -----------------------------------------------------------------

let scheme = load<ControlScheme>('witchspace.controls', 'mouse', ['mouse', 'keyboard']);
export const controlScheme = () => scheme;
export function toggleControlScheme(): ControlScheme {
  scheme = scheme === 'mouse' ? 'keyboard' : 'mouse';
  save('witchspace.controls', scheme);
  if (scheme === 'keyboard' && document.pointerLockElement) document.exitPointerLock();
  return scheme;
}

// Pitch direction: by default the keyboard scheme is flight-stick style
// (W = dive) and the mouse aims like a game (mouse up = aim up). I flips both.
let invertPitch = load<'0' | '1'>('witchspace.invertPitch', '0', ['0', '1']) === '1';
export const isPitchInverted = () => invertPitch;
export function toggleInvertPitch(): boolean {
  invertPitch = !invertPitch;
  save('witchspace.invertPitch', invertPitch ? '1' : '0');
  return invertPitch;
}

// --- Keyboard -----------------------------------------------------------------
// Holding a turn key builds the rate up gradually, as in the original, so a
// tap gives a fine correction and a long hold gives a full-rate turn.

const KEY_RAMP = 0.7; // seconds from tap to full rate
const held = new Map<string, number>(); // code -> time first pressed (ms)

const FLIGHT_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'Slash', 'Comma', 'Period', 'KeyX', 'KeyF',
]);

addEventListener('keydown', (e) => {
  if ((e.target as HTMLElement).closest?.('input, textarea')) return; // typing, not flying
  if (!held.has(e.code)) held.set(e.code, performance.now());
  if (FLIGHT_KEYS.has(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

function keyRamp(now: number, ...codes: string[]): number {
  let since = Infinity;
  for (const c of codes) since = Math.min(since, held.get(c) ?? Infinity);
  if (since === Infinity) return 0;
  const k = Math.min(1, (now - since) / 1000 / KEY_RAMP);
  return 0.15 + 0.85 * k * k; // a tap still does something
}
const keyHeld = (...codes: string[]) => codes.some((c) => held.has(c));

// --- Mouse ----------------------------------------------------------------------

let flying = false;
let aimDx = 0;
let aimDy = 0;
let mouseFire = false;
let recentre = false;
let wheel = 0;
// Holding the right button locks the nose and the mouse rolls the ship, like
// a stick: the further from where you pressed, the faster. A quick tap
// centres the aim and levels the wings instead (Mark).
const MOUSE_ROLL_PX = 100; // pixels from the press for a full-rate roll
const TAP_MS = 250;
const TAP_PX = 6;
let rolling = false;
let rollStick = 0;
let rollTravel = 0;
let rollPressAt = 0;
let level = false;
let swipeRoll = 0;

/** Mouse capture and scrolling only apply while flying. */
export function setFlying(value: boolean) {
  flying = value;
  if (!value && document.pointerLockElement) document.exitPointerLock();
  aimDx = aimDy = wheel = swipeRoll = rollStick = 0;
  mouseFire = recentre = touchFire = rolling = level = false;
  touchSpeed = null;
}

// --- Touch -------------------------------------------------------------------
// Phones and tablets fly with the mouse-aim scheme: drag on the left of the
// screen to move the aiming ring, a slider for speed and a fire button.
// Add ?touch to the URL to try touch mode with a mouse.

export const isTouch =
  matchMedia('(pointer: coarse)').matches || new URLSearchParams(location.search).has('touch');
let touchFire = false;
let touchSpeed: number | null = null; // speed the slider asks for, as a fraction of top speed
let touchMoved = false;

/** Drag on the aim pad: moves the aiming ring like the mouse does. */
export function touchAim(dx: number, dy: number) {
  aimDx += dx;
  aimDy += dy;
}
export function setTouchFire(on: boolean) {
  touchFire = on;
}
/** The speed slider: a target speed (0..1 of top speed), or null to leave speed alone. */
export function setTouchSpeed(fraction: number | null) {
  touchSpeed = fraction;
  touchMoved = true;
}
export const touchSpeedTarget = () => touchSpeed;

/** Aiming with the ring: the mouse is captured, or we're on a touch screen. */
export const isMouseCaptured = () => flying && (isTouch || document.pointerLockElement !== null);
// Not while a chart is open: there a click picks a system and a drag moves the chart.
export const wantsMouseCapture = () => flying && !suppressed && !isTouch && scheme === 'mouse' && !document.pointerLockElement;

addEventListener('mousedown', (e) => {
  if (isTouch) return; // taps arrive as mouse events too; touch has its own fire button
  if (isMouseCaptured()) {
    if (e.button === 0) mouseFire = true; // left: fire
    if (e.button === 2) {
      // right: centre the aim, then roll while held
      recentre = rolling = true;
      rollStick = rollTravel = 0;
      rollPressAt = performance.now();
    }
    return;
  }
  if (!wantsMouseCapture()) return;
  if ((e.target as HTMLElement).closest('button, a, input')) return;
  void document.body.requestPointerLock?.();
});
addEventListener('mouseup', (e) => {
  if (e.button === 0) mouseFire = false;
  if (e.button === 2 && rolling) {
    if (performance.now() - rollPressAt < TAP_MS && rollTravel < TAP_PX) level = true;
    rolling = false;
    rollStick = 0;
  }
});
addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement) rolling = false;
});
addEventListener('contextmenu', (e) => {
  if (flying) e.preventDefault();
});
addEventListener('mousemove', (e) => {
  if (!isMouseCaptured()) return;
  if (rolling) {
    rollTravel += Math.abs(e.movementX) + Math.abs(e.movementY);
    rollStick = clamp1(rollStick + e.movementX / MOUSE_ROLL_PX);
    return;
  }
  aimDx += e.movementX;
  aimDy += e.movementY;
});

// A notched wheel, an Apple Magic Mouse's touch surface and a trackpad all
// arrive as scroll events, so scale by distance rather than counting events
// (a Magic Mouse swipe sends dozens). Forwards/back = speed, sideways = roll.
// With macOS natural scrolling (the default), both follow your finger.
const SCROLL_SPEED = 0.0008; // fraction of top speed per pixel; a wheel notch ≈ 8%
const SWIPE_ROLL = 0.012; // roll per pixel of sideways swipe
const SWIPE_ROLL_DECAY = 6; // per second; a swipe gives a short, smooth roll

addEventListener(
  'wheel',
  (e) => {
    if (!flying) return;
    const scale = e.deltaMode === 1 ? 33 : e.deltaMode === 2 ? 800 : 1; // lines / pages -> pixels
    wheel += e.deltaY * scale;
    swipeRoll = clamp1(swipeRoll - e.deltaX * scale * SWIPE_ROLL);
    e.preventDefault();
  },
  { passive: false },
);

// --- Gamepad ------------------------------------------------------------------

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

export type PadButton = 'PadA' | 'PadB' | 'PadY' | 'PadStart';

/** Standard-mapping gamepad buttons pressed since the last call. */
export function gamepadPresses(): PadButton[] {
  const pad = activePad();
  if (!pad) return [];
  const names: Record<number, PadButton> = { 0: 'PadA', 1: 'PadB', 3: 'PadY', 9: 'PadStart' };
  const out: PadButton[] = [];
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
  /** +1 = nose right */
  yaw: number;
  /** +1 = speed up (held) */
  throttle: number;
  /** One-off change in speed, as a fraction of top speed (scroll / swipe). */
  speedStep: number;
  /** Mouse movement since last frame, in pixels, for the aiming reticle. */
  aimDx: number;
  aimDy: number;
  /** Fire the lasers (held). */
  fire: boolean;
  /** Touch speed slider: the speed wanted, as a fraction of top speed. */
  speedTarget?: number;
  /** Snap the aim back to the nose this frame (right button pressed). */
  recentre?: boolean;
  /** Rolling with the mouse (right button held): keep the bank it leaves. */
  mouseRoll?: boolean;
  /** Level the wings again (a tap of the right button). */
  level?: boolean;
  /** True if the pilot is touching any control this frame. */
  active: boolean;
}

let lastPoll = performance.now();
let suppressed = false;

/** While a chart is open, the arrow keys move its cursor instead of the ship. */
export function setFlightInputSuppressed(value: boolean) {
  suppressed = value;
  if (value && document.pointerLockElement) document.exitPointerLock();
}

export function flightInput(): FlightInput {
  const now = performance.now();
  const dt = Math.min(0.1, (now - lastPoll) / 1000);
  lastPoll = now;
  const sign = invertPitch ? -1 : 1;

  // Arrow keys always pitch and roll; < > roll as on the BBC Micro.
  let kbPitch = keyRamp(now, 'ArrowDown') - keyRamp(now, 'ArrowUp');
  let kbRoll = keyRamp(now, 'ArrowRight', 'Period') - keyRamp(now, 'ArrowLeft', 'Comma');
  let kbYaw = 0;
  let kbThrottle = (keyHeld('Space') ? 1 : 0) - (keyHeld('ShiftLeft', 'ShiftRight', 'Slash') ? 1 : 0);

  if (scheme === 'mouse') {
    // Modern layout: W/S throttle, A/D roll, Q/E yaw.
    kbThrottle += (keyHeld('KeyW') ? 1 : 0) - (keyHeld('KeyS') ? 1 : 0);
    kbRoll += keyRamp(now, 'KeyD') - keyRamp(now, 'KeyA');
    kbYaw = keyRamp(now, 'KeyE') - keyRamp(now, 'KeyQ');
  } else {
    // Classic: W/S pitch (push forward to dive). X is the missile, so it doesn't climb too.
    kbPitch += keyRamp(now, 'KeyS') - keyRamp(now, 'KeyW');
    kbRoll += keyRamp(now, 'KeyD') - keyRamp(now, 'KeyA');
  }

  const pad = activePad();
  const padPitch = pad ? shapeAxis(pad.axes[1] ?? 0) : 0;
  const padRoll = pad ? shapeAxis(pad.axes[0] ?? 0) : 0;
  const padYaw = pad ? shapeAxis(pad.axes[2] ?? 0) : 0;
  const padThrottle = pad ? (pad.buttons[7]?.value ?? 0) - (pad.buttons[6]?.value ?? 0) : 0;

  const swipe = swipeRoll;
  swipeRoll *= Math.exp(-dt * SWIPE_ROLL_DECAY);
  if (Math.abs(swipeRoll) < 0.01) swipeRoll = 0;

  const mouseRoll = rolling && rollTravel >= TAP_PX;
  const input: FlightInput = {
    pitch: sign * clamp1(kbPitch + padPitch),
    roll: clamp1(kbRoll + padRoll + swipe + (rolling ? rollStick : 0)),
    yaw: clamp1(kbYaw + padYaw),
    throttle: clamp1(kbThrottle + padThrottle),
    speedStep: wheel * SCROLL_SPEED,
    aimDx,
    aimDy: sign * aimDy,
    fire: mouseFire || touchFire || keyHeld('KeyF') || Boolean(pad?.buttons[5]?.pressed),
    speedTarget: touchSpeed ?? undefined,
    recentre,
    mouseRoll,
    level,
    active: false,
  };
  recentre = level = false;
  input.active =
    input.pitch !== 0 || input.roll !== 0 || input.yaw !== 0 || input.throttle !== 0 ||
    input.speedStep !== 0 || aimDx !== 0 || aimDy !== 0 || touchMoved;
  touchMoved = false;
  aimDx = aimDy = wheel = 0;
  if (suppressed) {
    input.pitch = input.roll = input.yaw = input.throttle = input.speedStep = input.aimDx = input.aimDy = 0;
    input.fire = false;
    input.active = false;
    input.speedTarget = undefined;
  }
  return input;
}
