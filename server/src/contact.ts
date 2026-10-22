// When the trading companies get in touch (Modern rules): shared by the game
// (src/game/assignments.ts) and the notification server (notify.ts), so both
// agree on when a special assignment is waiting. It depends only on the
// callsign, the standing and the clock: nothing else about the player.

export type CompanyId = 'hexon' | 'vorg' | 'mutual' | 'wy';
export const CONTACT_COMPANIES: CompanyId[] = ['hexon', 'vorg', 'mutual', 'wy'];

/** A new chance of an assignment from each company every three days. */
export const ASSIGNMENT_SLOT = 72 * 3600_000;
/** An offer stands for two days. */
export const ASSIGNMENT_OPEN = 48 * 3600_000;
/** Standing points a company wants before it trusts you with one (Contractor). */
export const ASSIGNMENT_STANDING = 5;

/** How each company opens its message. */
export const CONTACT: Record<CompanyId, { name: string; subject: string }> = {
  hexon: { name: 'Hexon Holdings', subject: 'A matter requiring discretion, Commander' },
  vorg: { name: 'Vorg Industries', subject: 'Mr Vorg would like a favour' },
  mutual: { name: "Carriers' Mutual", subject: 'A member needs help' },
  wy: { name: 'Wexley-Yorozu', subject: 'Science Division: special order' },
};

/** A small stable hash of a string. */
function strHash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A stable number in [0, 1) from any parts. */
export const roll = (...parts: (string | number)[]) => (strHash(parts.join('|')) % 100_000) / 100_000;

export const slotOf = (now: number) => Math.floor(now / ASSIGNMENT_SLOT);
export const assignmentId = (company: CompanyId, now: number) => `special:${company}:${slotOf(now)}`;

/** Whether a company has an assignment waiting for this commander now. */
export function assignmentWaiting(callsign: string, company: CompanyId, points: number, now: number): boolean {
  if (points < ASSIGNMENT_STANDING) return false;
  const slot = slotOf(now);
  if (now - slot * ASSIGNMENT_SLOT > ASSIGNMENT_OPEN) return false;
  return roll(callsign, company, slot, 'offer') < 0.4;
}
