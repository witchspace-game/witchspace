// Paper by day, space by night (Mark, 1 Nov 2026). On paper a ship is a technical drawing that catches light
// and comes alive; the drawing and the light are the game's own (src/render/ink.ts, look.ts PAPER), so the
// site and the game draw her alike. What's here is the page's side: whether it's on paper, and the easing.

import { PAPER as LOOK } from '../render/look';

export { inkable, lightUp } from '../render/ink';
export { onPaper } from './onPaper';
export const PAPER = LOOK.paper;
export const SPACE = LOOK.space;

/** Eases a value towards where it's going, frame by frame: about `seconds` to get most of the way. */
export function easer(seconds: number) {
  let value = 0;
  return {
    get value() {
      return value;
    },
    step(target: number, dt: number) {
      value += (target - value) * Math.min(1, (dt * 3) / seconds);
      if (Math.abs(target - value) < 0.002) value = target;
      return value;
    },
  };
}
