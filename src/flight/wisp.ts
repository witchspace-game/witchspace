// The lost courier's prototype, the Will-o'-the-Wisp (moved from main.ts): enemy lasers miss half the
// time, half the missiles are spoofed. Only while your lasers are cold: an explorer's way out, not
// armour for picking fights.

import { isWorking } from '../game/commander';
import { game } from '../core';
import { flight } from '../scene';

export const EVADE_LASERS = 0.5;
export const EVADE_MISSILES = 0.5;
export const EVADE_MISSILE_RANGE = 400; // metres: where it decides whether a missile is fooled
const WISP_COLD = 10; // seconds since you last fired
let lastPlayerShot = -Infinity;
/** Missiles it has already tried to fool. */
export const evadeChecked = new WeakSet<object>();
export const evading = () => game.commander?.difficulty === 'modern' && isWorking(game.commander, 'wisp') && flight.elapsed - lastPlayerShot > WISP_COLD;
/** You fired: the Wisp goes quiet. */
export const wispShot = () => (lastPlayerShot = flight.elapsed);
