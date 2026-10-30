// The words and rules for /callsign/ (each role in its ship's own paint, content/ships/<ship>.json lineColor) (Mark, 30 October 2026): the roles on the cards, a name tidied the
// way the server tidies it, what the server's answer means, and the variant tried when a name is taken.
// Kept apart from the page so they can be tested.

export const ROLES = [
  { id: 'pirate', name: 'Pirate', ship: 'mamba', shipName: 'Mamba', colour: '#e8d84a' },
  { id: 'trader', name: 'Trader', ship: 'cobra-mk3', shipName: 'Cobra', colour: '#3dffb0' },
  { id: 'explorer', name: 'Explorer', ship: 'falcon', shipName: 'Falcon', colour: '#ff3d6e' },
  { id: 'hero', name: 'Hero', ship: 'viper', shipName: 'Viper', colour: '#4aa8ff' },
  { id: 'legend', name: 'Legend', ship: 'fer-de-lance', shipName: 'Fer-de-lance', colour: '#c9a8ff' },
] as const;
export type Role = (typeof ROLES)[number];
/** "61, 255, 176" for rgba(): the page lights itself in the role's colour. */
export const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(', ');
export const roleById = (id: string | undefined): Role => ROLES.find((r) => r.id === id) ?? ROLES[1];

/** "Every pirate needs a callsign." */
export const roleLine = (r: Role) => `Every ${r.name.toLowerCase()} needs a callsign.`;

/** Show HN, 3 November 2026 at 14:00 UK: until then it's "Claim yours before launch". */
export const LAUNCH = Date.UTC(2026, 10, 3, 14, 0);
export const claimLine = (now: number) => (now < LAUNCH ? 'Claim yours before launch.' : 'Claim yours.');

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
