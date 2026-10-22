import { distanceLy, GOVERNMENTS, systemAt, type StarSystem } from '../galaxy/generate';
import { EVENT_KINDS, eventsAt, setCausedEvents, type EventType, type WorldEvent } from '../economy/events';
import { DANGER_PREMIUM } from '../economy/market';
import type { Commander } from './commander';
import { COMPANIES, COMPANY_IDS, presence, standingName, type CompanyId } from './companies';
import { addStanding, finish, jumpsBetween, logContract, logOf, standing, type Contract } from './contracts';
import { exploreOf } from './explore';
import { ASSIGNMENT_OPEN, ASSIGNMENT_SLOT, assignmentId, assignmentWaiting, roll, slotOf } from '../../server/src/contact';
import { legalStatus, recordCrime } from './law';
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
  /** Who it's really from, when it isn't the company (the station police, a "friend", pirates). */
  from?: string;
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
    ...(c.favours?.[company] ? [{ text: `Favours owed: ${c.favours[company]}.` }] : []),
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
  // What you caused, as the company noticed it.
  const lastCaused = (c.caused ?? []).slice(-1)[0];
  if (lastCaused) {
    const s = systemAt(lastCaused.galaxy, lastCaused.system);
    lines.push({ text: `Subject's ${lastCaused.caused} before the ${EVENT_KINDS[lastCaused.type].name.toLowerCase()} at ${s.name}.`, redacted: company !== 'mutual' });
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
  /**
   * What became of it, once something did: an honest station crew, the station
   * police wanting a word, a crew member holding it for blackmail, or pirates
   * holding it for ransom.
   */
  fate?: 'honest' | 'police' | 'blackmail' | 'ransom';
}

/** Lost within this distance of the station (metres), the station crew recovers the case. */
export const STATION_CREW_RANGE = 3000;

/** The crew's salvage fee: a tenth of the contract's pay, never more than half your spare credits. */
export const salvageFee = (pay: number, credits: number) => Math.min(Math.round(pay / 10), Math.floor(Math.max(0, credits - 100) / 2));

/** It holds station this long (real time, so a night away doesn't cost you it), then falls. */
export const ADRIFT_HOLD = 24 * 3600_000;
/** Once it starts falling, about this long until it's gone. */
export const ADRIFT_FALL = 20 * 60_000;
/** Left in the lanes this long while you're elsewhere, pirates may find it first. */
export const PIRATES_FIND = 6 * 3600_000;

const caseRoll = (c: Commander, k: { contract: string }, salt: string) => roll(c.name, k.contract, salt);

/** What a blackmailer asks, and what pirates ask, for a case. */
export const blackmailPrice = (pay: number) => Math.max(200, Math.round(pay * 1.5));
export const ransomPrice = (pay: number) => Math.max(150, Math.round(pay * 0.8));

function tell(c: Commander, m: Omit<Message, 'at'>, now: number) {
  if (c.messages?.some((x) => x.id === m.id)) return;
  c.messages = [{ ...m, at: now }, ...(c.messages ?? [])].slice(0, 20);
}

/** Ship lost with special cargo aboard: the cases survive, adrift where you were (or with the station crew, if close). */
export function setAdrift(c: Commander, here: StarSystem, position: [number, number, number], now: number, nearStation = false): AdriftCase[] {
  const cases: AdriftCase[] = [];
  for (const a of c.contracts ?? []) {
    if (!a.special || a.adrift) continue;
    a.adrift = true;
    const k: AdriftCase = { contract: a.id, company: a.company, label: a.label ?? 'Sealed case', galaxy: here.galaxy, system: here.index, position, lost: now };
    if (nearStation) {
      // What the station does with it is a gamble: an honest crew, the police, or someone with an eye for leverage.
      const r = caseRoll(c, k, 'station');
      k.held = true;
      k.fate = r < 0.25 ? 'honest' : r < 0.65 ? 'police' : 'blackmail';
      const station = here.name;
      if (k.fate === 'police')
        tell(c, { id: `${k.contract}:police`, company: a.company, from: `${station} station police`, subject: 'A word, Commander', body: `Your ${k.label} was recovered by the station crew and handed to us. We'd like to discuss its contents. Report to ${station} station.` }, now);
      if (k.fate === 'blackmail')
        tell(c, { id: `${k.contract}:blackmail`, company: a.company, from: 'A friend at the station', subject: 'I have something of yours', body: `Your ${k.label} didn't reach the station office. ${blackmailPrice(a.pay).toLocaleString()} Cr and it's yours again. Otherwise ${COMPANIES[a.company].name} hears it was opened.` }, now);
    }
    cases.push(k);
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

/** The case is gone for good: the contract fails, and the company remembers. */
function failCase(c: Commander, contract: string, points: number) {
  c.adrift = (c.adrift ?? []).filter((x) => x.contract !== contract);
  const a = c.contracts?.find((x) => x.id === contract);
  if (!a) return null;
  finish(c, a.id);
  addStanding(c, a.company, points);
  logContract(c, a.company, 'failed');
  return a;
}

/** Pirates have it: they want paying. */
export function takenByPirates(c: Commander, contract: string, now: number): string {
  const k = c.adrift?.find((x) => x.contract === contract);
  const a = c.contracts?.find((x) => x.id === contract);
  if (!k || !a) return '';
  k.fate = 'ransom';
  k.held = false;
  tell(c, { id: `${contract}:ransom`, company: a.company, from: 'Pirates', subject: 'Nice crate', body: `We've got your ${k.label}. ${ransomPrice(a.pay).toLocaleString()} Cr and we'll leave it at ${systemAt(k.galaxy, k.system).name} station for you. No tricks.` }, now);
  return `Pirates have your ${k.label}: they'll want paying`;
}

/** Cases whose time has run out while you were elsewhere: found by pirates, or fallen. */
export function expireCases(c: Commander, now: number, inScene: (contract: string) => boolean): string[] {
  const notes: string[] = [];
  for (const k of [...(c.adrift ?? [])]) {
    if (k.held || k.fate || inScene(k.contract)) continue;
    if (now - k.lost > PIRATES_FIND && caseRoll(c, k, 'pirates') < 0.6) notes.push(takenByPirates(c, k.contract, now));
    else if (now - k.lost > ADRIFT_HOLD + ADRIFT_FALL) notes.push(caseLost(c, k.contract));
  }
  return notes;
}

/** Docked where the station crew is holding your case. An honest crew hands it back, for a salvage fee; otherwise, see the incidents. */
export function collectHeld(c: Commander, here: StarSystem): string[] {
  const notes: string[] = [];
  for (const k of [...(c.adrift ?? [])]) {
    if (!k.held || k.galaxy !== here.galaxy || k.system !== here.index) continue;
    if (k.fate === 'police') {
      notes.push(`The station police would like a word about your ${k.label} · see Contracts`);
      continue;
    }
    if (k.fate && k.fate !== 'honest') continue;
    const a = c.contracts?.find((x) => x.id === k.contract);
    const fee = a ? salvageFee(a.pay, c.credits) : 0;
    c.credits = Math.round((c.credits - fee) * 10) / 10;
    recoverCase(c, k.contract);
    notes.push(`The station crew recovered your ${k.label}${fee ? ` · salvage fee ${fee} Cr` : ''} · contract back on`);
  }
  return notes;
}

/** A case fell into the planet (the consequences come later: section 2c, step 2). */
export function caseLost(c: Commander, contract: string, now = Date.now()): string {
  const k = c.adrift?.find((x) => x.contract === contract);
  const a = failCase(c, contract, -4);
  if (!a) return '';
  const where = k ? systemAt(k.galaxy, k.system) : null;
  const after = where ? consequence(c, a, 'planet', where, now) : null;
  return `${COMPANIES[a.company].name}'s ${a.label ?? 'case'} fell towards ${where?.name ?? 'the planet'}: contract failed${after ? ` · ${after}` : ''}`;
}

// --- What was really inside (section 2c, step 2) -------------------------------------

export type Contents = 'benign' | 'pathogen' | 'specimen' | 'munitions';

/** What a special cargo really holds: fixed when it's offered, revealed only if it's opened or falls. */
export function contentsOf(a: { id: string; company: CompanyId }): Contents {
  const r = roll(a.id, 'contents');
  switch (a.company) {
    case 'hexon':
      return r < 0.4 ? 'pathogen' : r < 0.5 ? 'specimen' : 'benign';
    case 'wy':
      return r < 0.35 ? 'specimen' : r < 0.6 ? 'pathogen' : 'benign';
    case 'vorg':
      return 'munitions';
    default:
      return 'benign';
  }
}

const HOUR = 3600_000;

/** Record an event you caused, unless one of yours is already under way there. */
function cause(c: Commander, type: EventType, s: StarSystem, hours: number, why: string, now: number, alongside = false): boolean {
  const caused = (c.caused ?? []).filter((e) => e.end > now - 7 * 24 * HOUR);
  if (!alongside && caused.some((e) => e.galaxy === s.galaxy && e.system === s.index && e.end > now)) return false;
  const e: WorldEvent = { type, galaxy: s.galaxy, system: s.index, start: now, end: now + hours * HOUR, caused: why };
  c.caused = [...caused, e];
  setCausedEvents(c.caused);
  return true;
}

/**
 * The case was opened on a station, or fell to a planet: what was inside
 * decides what happens next. Returns what the commander hears, or null if
 * it was harmless.
 */
export function consequence(c: Commander, a: Contract, where: 'station' | 'planet', s: StarSystem, now: number): string | null {
  const contents = contentsOf(a);
  const label = a.label ?? 'case';
  const name = s.name;
  const msg = (company: CompanyId, from: string, subject: string, body: string) =>
    tell(c, { id: `${a.id}:after`, company, from, subject, body }, now);
  if (contents === 'pathogen') {
    if (!cause(c, 'plague', s, where === 'station' ? 36 : 48, `${label} ${where === 'station' ? `opened at ${name} station` : `fell on ${name}`}`, now)) return null;
    if (where === 'station') cause(c, 'lockdown', s, 6, `${label} opened at ${name} station`, now, true);
    msg('hexon', 'Hexon Holdings', 'Continuity of care', `Hexon Holdings has dispatched medical supplies to ${name}. We trust you will be discreet about the circumstances.`);
    return where === 'station' ? `It was a pathogen. ${name} station is in lockdown, and an outbreak is spreading` : `It was a pathogen. Outbreak on ${name}`;
  }
  if (contents === 'specimen') {
    const ok = where === 'station' ? cause(c, 'lockdown', s, 8, `${label} opened at ${name} station`, now) : cause(c, 'bloom', s, 72, `${label} fell on ${name}`, now);
    if (!ok) return null;
    msg('wy', 'Wexley-Yorozu Science Division', 'We are aware of the incident', where === 'station'
      ? `We are aware of the incident aboard ${name} station. A recovery team is on its way. Please remain where you are.`
      : `Our survey of ${name} will begin shortly. Your cooperation under clause 214 is appreciated.`);
    return where === 'station' ? `Something got loose aboard ${name} station: lockdown, docking suspended` : `Something has taken root on ${name}: a strange bloom is spreading`;
  }
  return null;
}

// --- Incidents: the choices a lost case puts to you ---------------------------------

export type Choice = 'open' | 'refuse' | 'call' | 'pay' | 'find';

/** What each incident asks of you, for the screen. */
export function incidentChoices(k: AdriftCase, pay: number): { choice: Choice; label: string; cost?: number }[] {
  const firm = COMPANIES[k.company].name;
  switch (k.fate) {
    case 'police':
      return [
        { choice: 'open', label: 'Let them open it' },
        { choice: 'refuse', label: 'Refuse: company confidentiality' },
        { choice: 'call', label: `Call ${firm}` },
      ];
    case 'blackmail':
      return [
        { choice: 'pay', label: `Pay ${blackmailPrice(pay).toLocaleString()} Cr`, cost: blackmailPrice(pay) },
        { choice: 'refuse', label: 'Refuse' },
        { choice: 'find', label: 'Find out who it is' },
      ];
    case 'ransom':
      return [
        { choice: 'pay', label: `Pay ${ransomPrice(pay).toLocaleString()} Cr`, cost: ransomPrice(pay) },
        { choice: 'refuse', label: 'Refuse' },
      ];
    default:
      return [];
  }
}

/**
 * Settle an incident. `here` is where you are docked: the police only talk to
 * you at their station. Returns what happened, or null if that isn't a choice here.
 */
export function decide(c: Commander, contract: string, choice: Choice, here: StarSystem): string | null {
  const k = c.adrift?.find((x) => x.contract === contract);
  const a = c.contracts?.find((x) => x.id === contract);
  if (!k || !a) return null;
  const firm = COMPANIES[a.company].name;
  const atStation = k.galaxy === here.galaxy && k.system === here.index;
  if (k.fate === 'police') {
    if (!atStation) return null;
    if (choice === 'open') {
      failCase(c, contract, -6);
      const crime = a.company === 'vorg';
      if (crime) recordCrime(c, 'offender');
      const after = consequence(c, a, 'station', here, Date.now());
      return `They opened it. ${crime ? 'The crates were armed: you are an OFFENDER here. ' : ''}${after ?? `You're free to go; ${firm} is not pleased.`}`;
    }
    if (choice === 'refuse') {
      failCase(c, contract, 1);
      recordCrime(c, 'offender');
      return `The police keep the case and mark you an OFFENDER for obstruction. ${firm} appreciates your silence.`;
    }
    if (choice === 'call') {
      recoverCase(c, contract);
      c.favours = { ...c.favours, [a.company]: (c.favours?.[a.company] ?? 0) + 1 };
      return `${firm}'s lawyers arrive within the hour. The case is released to you. ${firm} will remember the favour.`;
    }
  }
  if (k.fate === 'blackmail') {
    if (choice === 'pay') {
      const price = blackmailPrice(a.pay);
      if (c.credits < price) return `You don't have ${price.toLocaleString()} Cr`;
      c.credits = Math.round((c.credits - price) * 10) / 10;
      k.fate = 'honest';
      k.held = true;
      return atStation ? collectHeld(c, here).join(' · ') || 'Paid.' : `Paid. The ${k.label} will be waiting at ${systemAt(k.galaxy, k.system).name} station`;
    }
    if (choice === 'refuse') {
      failCase(c, contract, -6);
      return `They told ${firm} the ${k.label} was opened. Contract cancelled.`;
    }
    if (choice === 'find') {
      if (!atStation) return null;
      if (caseRoll(c, k, 'find') < 0.6) {
        recoverCase(c, contract);
        return `A word in the back room, and a name. The ${k.label} is back aboard, and someone on the station crew is looking for a new job.`;
      }
      failCase(c, contract, -6);
      return `They heard you were asking. They told ${firm} the ${k.label} was opened. Contract cancelled.`;
    }
  }
  if (k.fate === 'ransom') {
    if (choice === 'pay') {
      const price = ransomPrice(a.pay);
      if (c.credits < price) return `You don't have ${price.toLocaleString()} Cr`;
      c.credits = Math.round((c.credits - price) * 10) / 10;
      k.fate = 'honest';
      k.held = true;
      return atStation ? collectHeld(c, here).join(' · ') || 'Paid.' : `Paid. The pirates say the ${k.label} is waiting at ${systemAt(k.galaxy, k.system).name} station`;
    }
    if (choice === 'refuse') {
      failCase(c, contract, -2);
      return `The pirates keep the ${k.label}. It'll turn up at a fence somewhere. Contract failed.`;
    }
  }
  return null;
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
