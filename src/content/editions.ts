// Special editions: a set spec, numbered and limited, built to order like any
// concept (docs/design/ships-and-classes.md, "Spec it, and put down a deposit").
// Nobody configures an edition: that's what makes it one. The server hands out
// the numbers (server/src/accounts.ts), one each, so a painted 037 is true.
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
  /** A rear laser, if she has one. */
  rear?: 'pulse' | 'beam' | 'military';
  upgrades: string[];
  luxuries: string[];
  /** On top of the spec's price: what being one of a hundred costs. */
  premium?: number;
  /** Or her whole price, set by the maker: the premium is whatever the spec leaves. */
  price?: number;
  /** Real hours the yard takes to finish one by hand: longer than an ordinary order, because it's special. */
  finishHours: number;
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
    finishHours: 120,
  },
  {
    // Dark by palette, never by dimming (Mark's idea; the glow is the signature):
    // black-light lines at full strength over faces as dark as the rest, one white-hot canopy.
    id: 'dark',
    name: 'Dark Edition',
    ship: 'fer-de-lance',
    limit: 50,
    blurb: 'Black-light lines over a hull you lose against the stars, and one white-hot canopy. For pilots who would rather not be seen. Fifty will be built, each numbered beside its name.',
    colour: '#8f6bff',
    trim: '#f2f6ff',
    glow: 'deep',
    laser: 'beam',
    rear: 'beam',
    upgrades: ['docking-computer', 'ecm', 'distress-jammer', 'escape-pod', 'combat-computer'],
    luxuries: ['suite', 'voice', 'black-light-lights', 'instrument-cabin'],
    price: 950_000, // Mark: "make it 950K with two new Dark-only luxuries"
    finishHours: 168,
  },
];

export const editionById = (id: string) => EDITIONS.find((e) => e.id === id);

/** An edition's number as it's painted: a quiet 001, not "No. 1". */
export const editionNo = (n: number) => String(n).padStart(3, '0');
