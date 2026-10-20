// Held-key state for flight controls. Discrete actions (launch, toggles) are
// handled separately in main.ts via keydown.

const held = new Set<string>();

const FLIGHT_KEYS = new Set([
  'KeyW', 'KeyS', 'KeyA', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'ShiftLeft', 'ShiftRight', 'Slash', 'Comma', 'Period', 'KeyX',
]);

addEventListener('keydown', (e) => {
  held.add(e.code);
  if (FLIGHT_KEYS.has(e.code)) e.preventDefault();
});
addEventListener('keyup', (e) => held.delete(e.code));
addEventListener('blur', () => held.clear());

const any = (...codes: string[]) => codes.some((c) => held.has(c));
const axis = (neg: boolean, pos: boolean) => (pos ? 1 : 0) - (neg ? 1 : 0);

export interface FlightInput {
  /** +1 = nose up */
  pitch: number;
  /** +1 = roll right */
  roll: number;
  /** +1 = speed up */
  throttle: number;
}

export function flightInput(): FlightInput {
  return {
    // Flight-stick style: push forward (W / ↑) to dive. X is the BBC's "climb" key.
    pitch: axis(any('KeyW', 'ArrowUp'), any('KeyS', 'ArrowDown', 'KeyX')),
    // < and > rolled the ship on the BBC Micro.
    roll: axis(any('KeyA', 'ArrowLeft', 'Comma'), any('KeyD', 'ArrowRight', 'Period')),
    throttle: axis(any('ShiftLeft', 'ShiftRight', 'Slash'), any('Space')),
  };
}

export const isSteering = (i: FlightInput) => i.pitch !== 0 || i.roll !== 0 || i.throttle !== 0;
