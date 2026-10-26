// The combat rating, as in 1984: from Harmless to Elite, with the original's
// names and thresholds. Under Modern rules the thresholds count rating points
// weighted by danger (docs/design/combat-rating.md); a commander's `kills`
// field holds those points (old saves' kills carry over one for one). Classic
// still counts one a kill, as the first BBC version did.

const RATINGS: [number, string][] = [
  [6400, 'Elite'],
  [2560, 'Deadly'],
  [512, 'Dangerous'],
  [128, 'Competent'],
  [64, 'Above Average'],
  [32, 'Average'],
  [16, 'Poor'],
  [8, 'Mostly Harmless'],
  [0, 'Harmless'],
];

export function combatRating(kills: number): string {
  return RATINGS.find(([min]) => kills >= min)![1];
}

/** Kills needed for the next rating, or null at Elite. */
export function nextRating(kills: number): { name: string; at: number } | null {
  for (let i = RATINGS.length - 1; i >= 0; i--) {
    if (RATINGS[i][0] > kills) return { name: RATINGS[i][1], at: RATINGS[i][0] };
  }
  return null;
}

/** The ranks in order, Harmless first. */
export const RANK_NAMES = RATINGS.map(([, name]) => name).reverse();

/**
 * A rank's insignia, shown beside a commander's callsign: chevrons for the
 * lower ranks, diamonds for the middle, stars at the top, and Elite's own mark.
 */
const INSIGNIA: Record<string, string> = {
  Harmless: '',
  'Mostly Harmless': '›',
  Poor: '››',
  Average: '›››',
  'Above Average': '◆',
  Competent: '◆◆',
  Dangerous: '◆◆◆',
  Deadly: '★',
  Elite: '★ ELITE',
};

export const rankInsignia = (rank: string) => INSIGNIA[rank] ?? '';

// --- Points for a kill (Modern rules) ------------------------------------------------

/** What the rating needs to know about a ship you destroyed. */
export interface Foe {
  /** The ship's own value (its file's stats.ratingValue). */
  value: number;
  role: string;
  bounty: number;
  /** It fired on you first: defending yourself is legitimate, whoever it was. */
  firedFirst: boolean;
  /** Its laser's name: "Beam laser", "Military laser"... */
  laser: string;
  missiles: number;
  ecm: boolean;
  /** Other ships fighting you when it died. */
  wingmen: number;
}

export type NoRating = 'crime' | 'too easy';

/** Pirates and aliens are fair game; anything else is a crime unless it fired first. */
const ROLE = (f: Foe) => (f.role === 'pirate' || f.bounty > 0 ? 1.3 : f.role === 'alien' || f.firedFirst ? 1 : 0);

/** How well armed it was: better lasers and extra kit, up to double. */
function threat(f: Foe): number {
  const laser = /military/i.test(f.laser) ? 1.5 : /beam/i.test(f.laser) ? 1.2 : 1;
  const kit = 1 + (f.ecm ? 0.15 : 0) + Math.min(f.missiles, 4) * 0.05;
  return Math.min(2, laser * kit);
}

/** Outnumbered: each kill counts for more, up to double. */
const odds = (f: Foe) => Math.min(2, 1 + 0.25 * Math.max(0, f.wingmen));

// How dangerous a foe is, as a rank (index into RANK_NAMES): a lone Sidewinder
// pirate is Poor, a pirate Cobra with a beam laser Competent, a Thargoid Dangerous.
const DANGER: [number, number][] = [
  [3.5, 7], // Deadly
  [2, 6], // Dangerous
  [1.3, 5], // Competent
  [0.9, 4], // Above Average
  [0.6, 3], // Average
  [0.4, 2], // Poor
  [0.15, 1], // Mostly Harmless
];
export function threatRank(f: Foe): number {
  const danger = f.value * Math.max(1, ROLE(f)) * threat(f);
  return DANGER.find(([min]) => danger >= min)?.[1] ?? 0;
}

/** Easy targets wear thin as you improve: half a rank above it, a quarter two above, nothing beyond. */
const EXPERIENCE = [1, 0.5, 0.25];

/**
 * Rating points for destroying `f`, for a commander with `points` so far: ship
 * value × role × threat × the odds × experience, halved when the combat
 * computer flew the fight. Nothing for a crime, or for a foe far beneath you,
 * and it says which.
 */
export function killPoints(f: Foe, points: number, computer = false): { points: number; none?: NoRating } {
  const role = ROLE(f);
  if (role === 0) return { points: 0, none: 'crime' };
  const above = RANK_NAMES.indexOf(combatRating(points)) - threatRank(f);
  const experience = above <= 0 ? 1 : (EXPERIENCE[above] ?? 0);
  if (experience === 0) return { points: 0, none: 'too easy' };
  const raw = f.value * role * threat(f) * odds(f) * experience * (computer ? 0.5 : 1);
  return { points: Math.round(raw * 100) / 100 };
}

/** The note after a kill: "+0.43 rating", or why there was none. */
export const pointsNote = (r: { points: number; none?: NoRating }) =>
  r.none === 'crime' ? 'No rating · crime' : r.none === 'too easy' ? 'No rating · too easy for you' : r.points > 0 ? `+${r.points.toFixed(2).replace(/0$/, '')} rating` : '';

/** Status: "Competent · 41 points to Dangerous". */
export function ratingProgress(points: number): string {
  const next = nextRating(points);
  const rank = combatRating(points);
  if (!next) return `${rank} · ${Math.floor(points).toLocaleString()} points`;
  const left = next.at - points;
  return `${rank} · ${left < 10 ? left.toFixed(1) : Math.ceil(left).toLocaleString()} points to ${next.name}`;
}

/** "Right On Commander!" every 256 points, as in the original, even beyond Elite. */
export const rightOn = (before: number, after: number) => Math.floor(after / 256) > Math.floor(before / 256);
