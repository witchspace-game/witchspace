// The words and rules for /callsign/ and the commander's card (docs/design/callsign-card.md): the four
// careers, the scenes behind her, the metal, a name tidied the way the server tidies it, what the server's
// answer means, and the variant tried when a name is taken. Kept apart from the page so they can be tested.

/** The game's own four (the home page's ladders): each its colour, its line, and its scenes first. */
export const CAREERS = [
  { id: 'trade', name: 'Trade', noun: 'Trader', colour: '#3dffb0', scenes: ['coriolis', 'coriolis-below'] },
  { id: 'fight', name: 'Fight', noun: 'Fighter', colour: '#ff5470', scenes: ['crossfire', 'pack-closing', 'mamba-close'] },
  { id: 'explore', name: 'Explore', noun: 'Explorer', colour: '#4ad7ff', scenes: ['debris', 'low-over-diso', 'beacon', 'rift'] },
  { id: 'build', name: 'Build', noun: 'Builder', colour: '#ffb347', scenes: ['station-rising', 'yard'] },
] as const;
export type Career = (typeof CAREERS)[number];
export const careerById = (id: string | undefined): Career => CAREERS.find((c) => c.id === id) ?? CAREERS[0];

/** "61, 255, 176" for rgba(): the page lights itself in the career's colour. */
export const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');

/** The scenes behind the card: moments from the press library (public/screens), cut so the subject sits left
 *  and her side of the card stays clear, and clear of the dashboard, into public/callsign/<id>.jpg (and
 *  <id>-s.jpg, small, for the picker). */
export const SCENES: Record<string, string> = {
  coriolis: 'A Coriolis station',
  'coriolis-below': 'The station from below',
  crossfire: 'Crossfire',
  'pack-closing': 'A pack closing',
  'mamba-close': 'A Mamba breaks up',
  debris: 'Debris across a ringed world',
  'low-over-diso': 'Low over Diso',
  beacon: 'A beacon and its world',
  rift: 'A witchspace rift',
  'station-rising': 'A station rising',
  yard: 'The yard by its moon',
};
export const sceneUrl = (id: string, small = false) => `/callsign/${id}${small ? '-s' : ''}.jpg`;
/** A career's own scenes first, then everyone else's. */
export const scenesFor = (c: Career): string[] => [...c.scenes, ...Object.keys(SCENES).filter((s) => !(c.scenes as readonly string[]).includes(s))];

/** "Every trader needs a callsign." */
export const careerLine = (c: Career) => `Every ${c.noun.toLowerCase()} needs a callsign.`;

/** Show HN, 3 November 2026 at 14:00 UK: until then it's "Claim yours before launch", and a founding member's card. */
export const LAUNCH = Date.UTC(2026, 10, 3, 14, 0);
export const claimLine = (now: number) => (now < LAUNCH ? 'Claim yours before launch.' : 'Claim yours.');

/** The plate's metal: what you've earned, never bought. */
export type Finish = 'titanium' | 'alloy' | 'black' | 'gold' | 'witch-fire' | 'dark';
export const FINISHES: Record<Finish, string> = {
  titanium: 'Titanium',
  alloy: 'Alloy',
  black: 'Black',
  gold: 'Gold',
  'witch-fire': 'Witch-fire',
  dark: 'Dark',
};
/** An edition's card wears its own finish; Elite wears black; founding members titanium; everyone else alloy. */
export function finishFor(o: { edition?: string | null; elite?: boolean; founding?: boolean }): Finish {
  if (o.edition === 'witch-fire' || o.edition === 'dark') return o.edition;
  if (o.elite) return 'black';
  return o.founding ? 'titanium' : 'alloy';
}

/** "0000 0042": eight digits in two groups, never sixteen, so it can't read as a bank card's number. */
export const memberNumber = (n: number | null | undefined) => (n ? String(n).padStart(8, '0').replace(/^(\d{4})(\d{4})$/, '$1 $2') : '•••• ••••');
/** "MEMBER SINCE 10/26". */
export const memberSince = (ms: number) => {
  const d = new Date(ms);
  return `MEMBER SINCE ${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCFullYear()).slice(2)}`;
};

/** A name as the server keeps it (server/src/protocol.ts cleanName): letters, digits, spaces and . ' _ -, at most 24. */
export function cleanCallsign(raw: string): string {
  return raw
    .replace(/[^\p{L}\p{N} .'_-]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^(cmdr|commander)\s+/i, '')
    .slice(0, 24)
    .trim();
}

export type Verdict = 'free' | 'taken' | 'reserved' | 'never' | 'yours';
export interface Check {
  name: string;
  verdict: Verdict;
  reason?: string;
}

/** What GET /callsign/check sent, if it makes sense; anything else is "couldn't check". */
export function parseCheck(v: unknown): Check | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (typeof o.name !== 'string' || !['free', 'taken', 'reserved', 'never', 'yours'].includes(o.verdict as string)) return null;
  return { name: o.name, verdict: o.verdict as Verdict, ...(typeof o.reason === 'string' && o.reason ? { reason: o.reason } : {}) };
}

/** The answer under the box. */
export function verdictWords(c: Check): string {
  switch (c.verdict) {
    case 'free':
      return `CMDR ${c.name} is free.`;
    case 'yours':
      return `CMDR ${c.name} is yours.`;
    case 'taken':
      return `CMDR ${c.name} is taken: another commander has it.`;
    case 'reserved':
      return `${c.name} is reserved.`;
    case 'never':
      return `${c.name} can’t be a callsign${c.reason ? `: ${c.reason.charAt(0).toLowerCase()}${c.reason.slice(1)}` : ''}.`;
  }
}

/** Names to try when one is taken: "Lead Balloon II", then III and IV, each within 24 letters. */
export function variants(name: string): string[] {
  const base = name.replace(/\s+(II|III|IV)$/, '');
  return ['II', 'III', 'IV'].map((n) => `${base.slice(0, 24 - n.length - 1).trim()} ${n}`).filter((v) => v !== name);
}
