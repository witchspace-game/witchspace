// What the whole game shares: the commander, which screen it's on, and the few helpers every part
// uses. main.ts was one file of 9,000 lines; its parts move into modules of their own (Mark, 30
// October 2026: "We have 3 days to split it carefully"), and they share state through here rather
// than through main.ts's own variables, which no other module can change.

import type { Commander } from './game/commander';
import { systemAt, type StarSystem } from './galaxy/generate';

export type State = 'title' | 'newgame' | 'docked' | 'flying' | 'transition' | 'dead';
export type DockTab = 'station' | 'contracts' | 'market' | 'news' | 'saloon' | 'shipyard' | 'money';

export const game = {
  /** The commander being played, once one is loaded or made. */
  commander: null as Commander | null,
  /** Which screen the game is on (main.ts setState changes it, and everything that goes with it). */
  state: 'title' as State,
  /** Which of the station's places is open while docked. */
  dockTab: 'station' as DockTab,
  /** A photograph is taken right after the next frame is drawn (P, or the booth's button). */
  photoPending: false,
};

/** The commander, where one is certain to exist. */
export const cmdr = () => game.commander!;
/** Modern rules (Classic keeps 1984's). */
export const modern = () => game.commander !== null && cmdr().difficulty === 'modern';
/** The element, where it's certain to exist. */
export const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;

/** Where the commander is: Lave before there's a commander. */
export function currentSystem(): StarSystem {
  const loc = game.commander?.location ?? { galaxy: 0, system: 7 };
  return systemAt(loc.galaxy, loc.system);
}
