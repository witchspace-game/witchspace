// The combat rating, as in 1984: earned by kills, from Harmless to Elite.
// The names are the original's, kept as a tribute.

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
