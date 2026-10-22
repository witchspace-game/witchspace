import { distanceLy, GOVERNMENTS, systemAt, type StarSystem } from '../galaxy/generate';
import { EVENT_KINDS, eventsAt } from '../economy/events';
import { DANGER_PREMIUM } from '../economy/market';
import type { Commander } from './commander';
import { COMPANY_IDS, presence, standingName, type CompanyId } from './companies';
import { jumpsBetween, logOf, standing, type Contract } from './contracts';
import { exploreOf } from './explore';
import { ASSIGNMENT_OPEN, ASSIGNMENT_SLOT, assignmentId, assignmentWaiting, roll, slotOf } from '../../server/src/contact';
import { legalStatus } from './law';
import { combatRating } from './rating';

// The companies keep files, and now and then they get in touch (Modern rules).
// Once your standing is high enough, a company may offer a special assignment:
// a small, well-paid, unusual cargo, briefed in its own voice. Offers come from
// the commander, the company and the clock, so the game and the notification
// server agree on when one is waiting.

export { ASSIGNMENT_OPEN, ASSIGNMENT_SLOT, ASSIGNMENT_STANDING, assignmentWaiting } from '../../server/src/contact';

export interface Message {
  id: string;
  company: CompanyId;
  subject: string;
  body: string;
  at: number;
  read?: boolean;
}

interface Voice {
  subject: string;
  label: string;
  body: (to: string, pay: string) => string;
  thanks: string;
}

const VOICES: Record<CompanyId, Voice> = {
  hexon: {
    subject: 'A matter requiring discretion, Commander',
    label: 'Sealed container · class-4 biologicals',
    body: (to, pay) => `One sealed container, to ${to}. It is not to be opened, scanned or discussed. ${pay} on delivery. Report to any Hexon station.`,
    thanks: 'Hexon Holdings thanks you. This delivery did not take place.',
  },
  vorg: {
    subject: 'Mr Vorg would like a favour',
    label: 'Irregular cargo · crated',
    body: (to, pay) => `Two crates of irregular cargo for ${to}. They may tick. Do not worry about the ticking. ${pay}, and Mr Vorg's gratitude, which is worth more.`,
    thanks: 'Vorg Industries is pleased. Mr Vorg mentioned your name in a speech.',
  },
  mutual: {
    subject: 'A member needs help',
    label: 'Relief supplies',
    body: (to, pay) => `A Mutual hauler is stranded at ${to} with sick crew. Medical supplies, quickly. The members will vote you their thanks; the treasurer has found ${pay}.`,
    thanks: 'The Mutual thanks you. The motion to record it passed, eventually.',
  },
  wy: {
    subject: 'Science Division: special order',
    label: 'Science Division sample case',
    body: (to, pay) => `The Science Division requires a sample case delivered to ${to}. Crew safety is a secondary consideration (see clause 214). ${pay}.`,
    thanks: 'Wexley-Yorozu acknowledges receipt. Your file has been updated.',
  },
};

export const thanksFrom = (id: CompanyId) => VOICES[id].thanks;

// The file number: a stable hash of the callsign.
const fileNumber = (name: string) => Math.floor(roll(name, 'file') * 0xffffffff).toString(16).toUpperCase();

/** The assignment a company has for you now, if any, starting from where you are. */
export function assignmentFor(c: Commander, company: CompanyId, here: StarSystem, now: number): (Contract & { expires: number }) | null {
  if (c.difficulty !== 'modern' || !assignmentWaiting(c.name, company, standing(c, company), now)) return null;
  const slot = slotOf(now);
  const id = assignmentId(company, now);
  if (c.contracts?.some((a) => a.id === id) || c.contractsDone?.includes(id)) return null;
  // Somewhere two to four jumps out; Vorg's go where the law is thin.
  const r = (salt: string) => roll(c.name, company, slot, salt);
  const galaxy = Array.from({ length: 256 }, (_, i) => systemAt(here.galaxy, i));
  const reach = galaxy
    .filter((s) => s !== here && distanceLy(here, s) < 30)
    .map((s) => ({ s, n: jumpsBetween(here, s, 4) }))
    .filter(({ n }) => n >= 2 && n <= 4);
  const pool = company === 'vorg' ? reach.filter(({ s }) => s.government <= 2) : reach;
  const from = pool.length ? pool : reach;
  if (!from.length) return null;
  const { s: dest, n } = from[Math.floor(r('dest') * from.length)];
  const danger = Math.round(300 * DANGER_PREMIUM[dest.government] * 2);
  const pay = Math.round(400 + standing(c, company) * 15 + n * 90) + danger;
  return {
    id,
    company,
    good: 'special',
    label: VOICES[company].label,
    special: true,
    qty: 1 + Math.floor(r('qty') * 2),
    from: { galaxy: here.galaxy, system: here.index },
    to: { galaxy: dest.galaxy, system: dest.index },
    jumps: n + 1,
    pay,
    danger,
    rush: false,
    needs: 'Contractor',
    expires: slot * ASSIGNMENT_SLOT + ASSIGNMENT_OPEN,
  };
}

/** Can this company's assignment be picked up here? Only where it does business. */
export const companyHere = (company: CompanyId, s: StarSystem) => presence(s)[company] > 0.5;

/**
 * New messages from the companies since you last looked: one for each
 * assignment waiting. Adds them to the commander's inbox and returns them.
 */
export function checkMessages(c: Commander, here: StarSystem, now: number): Message[] {
  if (c.difficulty !== 'modern') return [];
  const fresh: Message[] = [];
  for (const company of COMPANY_IDS) {
    const offer = assignmentFor(c, company, here, now);
    if (!offer || c.messages?.some((m) => m.id === offer.id)) continue;
    const to = systemAt(offer.to.galaxy, offer.to.system);
    const voice = VOICES[company];
    fresh.push({ id: offer.id, company, subject: voice.subject, body: voice.body(`${to.name} (${GOVERNMENTS[to.government]})`, `${offer.pay.toLocaleString()} Cr`), at: now });
  }
  if (fresh.length) c.messages = [...fresh, ...(c.messages ?? [])].slice(0, 20);
  return fresh;
}

// --- Files ---------------------------------------------------------------------

/** A line of a file: text, or a redaction ([REDACTED] in the game). */
export type FileLine = { text: string; redacted?: boolean };

/** What a company has on you, in its own style. */
export function fileOn(c: Commander, company: CompanyId, here: StarSystem, now: number): { title: string; lines: FileLine[] } {
  const log = logOf(c, company);
  const visited = exploreOf(c).visited;
  const status = legalStatus(c);
  const lines: FileLine[] = [
    { text: `Subject: CMDR ${c.name}. Standing: ${standingName(standing(c, company))}.` },
    { text: `Contracts: ${log.delivered} delivered, ${log.late} late, ${log.failed} failed.${log.special ? ` Special assignments: ${log.special}.` : ''}` },
    { text: `Combat rating: ${combatRating(c.kills)}. Legal standing here: ${status === 'clean' ? 'clean' : status}${c.warrant ? ', Marshals warrant' : ''}.` },
    { text: `Travel: ${visited.length} systems. Last seen: ${here.name}.` },
  ];
  // Something they noticed that you didn't: a crisis you passed through.
  const week = 7 * 24 * 3600_000;
  for (const key of visited.slice(-12).reverse()) {
    const [g, i] = key.split(':').map(Number);
    const s = systemAt(g, i);
    const e = eventsAt(s, now - week, now)[0];
    if (e) {
      lines.push({ text: `Subject was present at ${s.name} during the ${EVENT_KINDS[e.type].name.toLowerCase()}.`, redacted: company !== 'mutual' });
      break;
    }
  }
  switch (company) {
    case 'hexon':
      lines.push({ text: 'Bureau of Continuity interest: noted.', redacted: true });
      return { title: `Hexon Holdings · Continuity of care · File ${fileNumber(c.name)}`, lines };
    case 'vorg':
      lines.push({ text: `Assessment: ${log.delivered + log.special >= 5 ? 'Useful.' : 'Not yet useful.'}` });
      return { title: 'Vorg Industries · Personnel', lines: lines.slice(0, 1).concat(lines.slice(-1)) };
    case 'mutual':
      lines.push({ text: 'Calls answered: on file. Thank you for flying with the Mutual.' });
      return { title: "Carriers' Mutual · Membership card", lines };
    case 'wy':
      lines.push({ text: 'Page 214:' }, { text: 'Subject is suitable for special orders.', redacted: true });
      return { title: 'Wexley-Yorozu · Science Division · Personnel suitability', lines };
  }
}
