import { distanceLy, GOVERNMENTS, systemAt, type StarSystem } from '../galaxy/generate';
import { EVENT_KINDS, eventsAt } from '../economy/events';
import { DANGER_PREMIUM } from '../economy/market';
import type { Commander } from './commander';
import { COMPANIES, COMPANY_IDS, presence, standingName, type CompanyId } from './companies';
import { addStanding, finish, jumpsBetween, logContract, logOf, standing, type Contract } from './contracts';
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

// --- When things go wrong (docs/design/companies-and-contracts.md, section 2c) ------

/** Special cargo that survived its ship: where it is, and when it was lost. */
export interface AdriftCase {
  contract: string;
  company: CompanyId;
  label: string;
  galaxy: number;
  system: number;
  position: [number, number, number];
  lost: number;
  /** Lost close to the station: its crew picked the case up, and holds it for you. */
  held?: boolean;
}

/** Lost within this distance of the station (metres), the station crew recovers the case. */
export const STATION_CREW_RANGE = 3000;

/** The crew's salvage fee: a tenth of the contract's pay, never more than half your spare credits. */
export const salvageFee = (pay: number, credits: number) => Math.min(Math.round(pay / 10), Math.floor(Math.max(0, credits - 100) / 2));

/** It holds station this long (real time, so a night away doesn't cost you it), then falls. */
export const ADRIFT_HOLD = 24 * 3600_000;
/** Once it starts falling, about this long until it's gone. */
export const ADRIFT_FALL = 20 * 60_000;

/** Ship lost with special cargo aboard: the cases survive, adrift where you were (or with the station crew, if close). */
export function setAdrift(c: Commander, here: StarSystem, position: [number, number, number], now: number, nearStation = false): AdriftCase[] {
  const cases: AdriftCase[] = [];
  for (const a of c.contracts ?? []) {
    if (!a.special || a.adrift) continue;
    a.adrift = true;
    cases.push({ contract: a.id, company: a.company, label: a.label ?? 'Sealed case', galaxy: here.galaxy, system: here.index, position, lost: now, ...(nearStation ? { held: true } : {}) });
  }
  c.adrift = [...(c.adrift ?? []), ...cases];
  return cases;
}

/** Brought back aboard: the contract carries on. */
export function recoverCase(c: Commander, contract: string): string {
  const a = c.contracts?.find((x) => x.id === contract);
  c.adrift = (c.adrift ?? []).filter((x) => x.contract !== contract);
  if (!a) return '';
  a.adrift = false;
  return `${a.label ?? 'Case'} recovered: it answered your transponder · contract back on`;
}

/** Cases whose time has run out while you were elsewhere: gone, and the contract with them. */
export function expireCases(c: Commander, now: number, inScene: (contract: string) => boolean): string[] {
  const notes: string[] = [];
  for (const k of [...(c.adrift ?? [])]) {
    if (k.held || now - k.lost < ADRIFT_HOLD + ADRIFT_FALL || inScene(k.contract)) continue;
    notes.push(caseLost(c, k.contract));
  }
  return notes;
}

/** Docked where the station crew is holding your case: it's handed back, for a salvage fee. */
export function collectHeld(c: Commander, here: StarSystem): string[] {
  const notes: string[] = [];
  for (const k of [...(c.adrift ?? [])]) {
    if (!k.held || k.galaxy !== here.galaxy || k.system !== here.index) continue;
    const a = c.contracts?.find((x) => x.id === k.contract);
    const fee = a ? salvageFee(a.pay, c.credits) : 0;
    c.credits = Math.round((c.credits - fee) * 10) / 10;
    recoverCase(c, k.contract);
    notes.push(`The station crew recovered your ${k.label}${fee ? ` · salvage fee ${fee} Cr` : ''} · contract back on`);
  }
  return notes;
}

/** A case fell into the planet (the consequences come later: section 2c, step 2). */
export function caseLost(c: Commander, contract: string): string {
  const k = c.adrift?.find((x) => x.contract === contract);
  c.adrift = (c.adrift ?? []).filter((x) => x.contract !== contract);
  const a = c.contracts?.find((x) => x.id === contract);
  if (!a) return '';
  finish(c, a.id);
  addStanding(c, a.company, -4);
  logContract(c, a.company, 'failed');
  return `${COMPANIES[a.company].name}'s ${a.label ?? 'case'} fell towards ${k ? systemAt(k.galaxy, k.system).name : 'the planet'}: contract failed`;
}

/** Who would buy whose secrets. The Mutual's relief supplies aren't for sale. */
export const RIVAL: Partial<Record<CompanyId, CompanyId>> = { wy: 'hexon', hexon: 'vorg', vorg: 'hexon' };

/** What a rival pays for another company's special cargo. */
export const rivalPrice = (a: Contract) => Math.round(a.pay * 1.5);

/** Sell a special cargo to the owner's rival instead of delivering it. */
export function sellToRival(c: Commander, contract: string, here: StarSystem): string | null {
  const a = c.contracts?.find((x) => x.id === contract);
  const buyer = a && RIVAL[a.company];
  if (!a || !buyer || a.adrift || !companyHere(buyer, here)) return null;
  const price = rivalPrice(a);
  c.credits = Math.round((c.credits + price) * 10) / 10;
  finish(c, a.id);
  addStanding(c, a.company, -10);
  addStanding(c, buyer, 3);
  logContract(c, a.company, 'failed');
  return `${COMPANIES[buyer].name} paid ${price.toLocaleString()} Cr for ${COMPANIES[a.company].name}'s ${a.label ?? 'cargo'}. ${COMPANIES[a.company].name} will find out.`;
}
