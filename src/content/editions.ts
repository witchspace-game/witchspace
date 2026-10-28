// Special editions: a set spec, numbered and limited, built to order like any
// concept (docs/design/ships-and-classes.md, "Spec it, and put down a deposit").
// Nobody configures an edition: that's what makes it one. The server hands out
// the numbers (server/src/accounts.ts), one each, so "No. 37 of 100" is true.
// No dependencies: the game and the server both read this.

export interface Edition {
  id: string;
  name: string;
  ship: string;
  limit: number;
  /** What it is, in a line. */
  blurb: string;
  colour: string;
  trim: string | null;
  glow: 'standard' | 'deep' | 'blazing';
  laser: 'pulse' | 'beam' | 'military';
  upgrades: string[];
  luxuries: string[];
  /** On top of the spec's price: what being one of a hundred costs. */
  premium: number;
}

export const EDITIONS: Edition[] = [
  {
    id: 'witch-fire',
    name: 'Witch-fire Edition',
    ship: 'fer-de-lance',
    limit: 100,
    blurb: 'Nebula, with the glass deck lit in witch-fire, blazing. A hundred will be built, each numbered beside its name.',
    colour: '#ff4dff',
    trim: '#7df9ff',
    glow: 'blazing',
    laser: 'beam',
    upgrades: ['docking-computer', 'fuel-scoops', 'escape-pod'],
    luxuries: ['suite', 'gold-name', 'starlight'],
    premium: 75_000,
  },
];

export const editionById = (id: string) => EDITIONS.find((e) => e.id === id);
