// The galaxy: 8 galaxies of 256 star systems, generated from three 16-bit
// seeds exactly as in the original Elite (1984), so Lave, Diso, Leesti and
// friends are where every commander remembers them. This is our own
// implementation of the published algorithm; see CREDITS.md.
//
// Only the systems' facts come from the algorithm. Planet descriptions are
// written fresh for Witchspace.

export const GALAXIES = 8;
export const SYSTEMS_PER_GALAXY = 256;

export const ECONOMIES = [
  'Rich Industrial',
  'Average Industrial',
  'Poor Industrial',
  'Mainly Industrial',
  'Mainly Agricultural',
  'Rich Agricultural',
  'Average Agricultural',
  'Poor Agricultural',
] as const;

export const GOVERNMENTS = [
  'Anarchy',
  'Feudal',
  'Multi-Government',
  'Dictatorship',
  'Communist',
  'Confederacy',
  'Democracy',
  'Corporate State',
] as const;

export interface StarSystem {
  galaxy: number; // 0..7
  index: number; // 0..255 within its galaxy
  name: string;
  /** Galactic chart coordinates, 0..255 each. */
  x: number;
  y: number;
  /** 0 = Rich Industrial … 7 = Poor Agricultural. */
  economy: number;
  /** 0 = Anarchy … 7 = Corporate State. */
  government: number;
  /** 1..15, as shown to the player. */
  techLevel: number;
  /** Billions of people. */
  population: number;
  /** Millions of credits. */
  productivity: number;
  /** Planet radius in km. */
  radius: number;
  /** Who lives there, as the original's data screen says: "Human Colonials" or "Small Yellow Bony Lobsters". */
  species: string;
  /** Bytes for anything else that should be stable per system (descriptions, markets). */
  extraSeed: [number, number, number, number];
}

type Seed = [number, number, number];

const GALAXY_ONE: Seed = [0x5a4a, 0x0248, 0xb753];

// The name syllables: pairs of letters, where '.' means "no letter".
const PAIRS = '..LEXEGEZACEBISOUSESARMAINDIREA.ERATENBERALAVETIEDORQUANTEISRION';

const hi = (w: number) => (w >> 8) & 0xff;
const lo = (w: number) => w & 0xff;

/** The three seeds act as a Fibonacci-like sequence of 16-bit words. */
function twist(s: Seed): void {
  const next = (s[0] + s[1] + s[2]) & 0xffff;
  s[0] = s[1];
  s[1] = s[2];
  s[2] = next;
}

/** Rotate each byte of a word left by one bit: how one galaxy's seed becomes the next. */
function rotateBytes(w: number): number {
  const rot = (b: number) => ((b << 1) | (b >> 7)) & 0xff;
  return (rot(hi(w)) << 8) | rot(lo(w));
}

function makeSystem(s: Seed, galaxy: number, index: number): StarSystem {
  const [w0, w1, w2] = s;
  const government = (w1 >> 3) & 7;
  let economy = (w0 >> 8) & 7;
  if (government <= 1) economy |= 2; // anarchies and feudal worlds are never rich

  let tech = ((w1 >> 8) & 3) + (economy ^ 7);
  tech += government >> 1;
  if (government & 1) tech += 1;

  const populationUnits = 4 * tech + economy + government + 1;
  const productivity = ((economy ^ 7) + 3) * (government + 4) * populationUnits * 8;
  const x = hi(w1);
  const y = hi(w0);
  const radius = 256 * (((w2 >> 8) & 15) + 11) + x;
  const extraSeed: [number, number, number, number] = [lo(w1), hi(w1), lo(w2), hi(w2)];
  const longName = (w0 & 64) !== 0;
  const species = speciesOf(w0, w1, w2);

  // Four syllables are always drawn, so every system advances the seed equally.
  const syllables: string[] = [];
  for (let i = 0; i < 4; i++) {
    const p = 2 * (hi(s[2]) & 31);
    syllables.push(PAIRS[p] + PAIRS[p + 1]);
    twist(s);
  }
  const raw = syllables.slice(0, longName ? 4 : 3).join('').replace(/\./g, '');
  const name = raw.charAt(0) + raw.slice(1).toLowerCase();

  return {
    galaxy,
    index,
    name,
    x,
    y,
    economy,
    government,
    techLevel: tech + 1,
    population: populationUnits / 10,
    productivity,
    radius,
    species,
    extraSeed,
  };
}

const SIZES = ['Large', 'Fierce', 'Small'];
const COLOURS = ['Green', 'Red', 'Yellow', 'Blue', 'Black', 'Harmless'];
const BODIES = ['Slimy', 'Bug-Eyed', 'Horned', 'Bony', 'Fat', 'Furry'];
const KINDS = ['Rodents', 'Frogs', 'Lizards', 'Lobsters', 'Birds', 'Humanoids', 'Felines', 'Insects'];

/** The species, from the seeds as the original's TT25 does it. Some pairings can't happen (no slimy humanoids). */
function speciesOf(w0: number, w1: number, w2: number): string {
  if (!(lo(w2) & 0x80)) return 'Human Colonials';
  const s2hi = hi(w2);
  const body = (hi(w0) ^ hi(w1)) & 7;
  const words = [SIZES[(s2hi >> 2) & 7], COLOURS[(s2hi >> 5) & 7], BODIES[body], KINDS[((s2hi & 3) + body) & 7]];
  return words.filter(Boolean).join(' ');
}

const cache = new Map<number, StarSystem[]>();

/** All 256 systems of a galaxy (0..7). */
export function galaxy(n: number): StarSystem[] {
  const hit = cache.get(n);
  if (hit) return hit;
  let seed: Seed = [...GALAXY_ONE];
  for (let g = 0; g < n; g++) seed = seed.map(rotateBytes) as Seed;
  const systems: StarSystem[] = [];
  for (let i = 0; i < SYSTEMS_PER_GALAXY; i++) systems.push(makeSystem(seed, n, i));
  cache.set(n, systems);
  return systems;
}

export const systemAt = (g: number, i: number): StarSystem => galaxy(g)[i];

/**
 * Distance in light years, worked out as the original's TT111 does: halve the
 * vertical difference (the chart is twice as wide as it is tall), take the
 * whole-number square root, then times four. So every distance is a multiple
 * of 0.4 LY, and Tibedied is 17.6 LY from Lave.
 */
export function distanceLy(a: StarSystem, b: StarSystem): number {
  const dx = Math.abs(a.x - b.x);
  const dy = Math.abs(a.y - b.y) >> 1;
  return (4 * Math.floor(Math.sqrt(dx * dx + dy * dy))) / 10;
}

/**
 * The system nearest a point on a galaxy's chart, found as TT111 finds it:
 * by half the sum of the horizontal and vertical differences, first found
 * wins a tie.
 */
export function nearestTo(g: number, x: number, y: number): StarSystem {
  let best = galaxy(g)[0];
  let bestD = Infinity;
  for (const s of galaxy(g)) {
    const d = (Math.abs(s.x - x) >> 1) + (Math.abs(s.y - y) >> 1);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

/** Systems within `ly` light years of `from`, nearest first (excluding `from`). */
export function systemsWithin(from: StarSystem, ly: number): StarSystem[] {
  return galaxy(from.galaxy)
    .filter((s) => s !== from && distanceLy(from, s) <= ly)
    .sort((a, b) => distanceLy(from, a) - distanceLy(from, b));
}

/** Where every commander begins: Lave, in the first galaxy. */
export const HOME = { galaxy: 0, index: 7 };
