import { distanceLy, systemAt, systemsWithin, type StarSystem } from '../galaxy/generate';
import { COMMODITIES, commodityById } from '../economy/commodities';
import { stationTrades } from '../economy/legality';
import { DANGER_PREMIUM, equilibriumPrice, tradeBalance } from '../economy/market';
import { hash } from '../economy/seed';
import { FUEL_CAPACITY, type Commander } from './commander';
import { COMPANIES, COMPANY_IDS, pickCompany, presence, standingName, workNeeds, type CompanyId, type StandingName } from './companies';
import { bodiesOf, EXPLORER_DOORS, exploreOf, isSurveyed, worldOf } from './explore';

// Company contracts (Modern rules), as set out in
// docs/design/companies-and-contracts.md: carry the company's cargo from here
// to there within so many hyperspace jumps, and get paid on delivery. The
// company supplies the cargo, so you need a hold, not money. Each station's
// board comes from its seed and the clock, the same for every commander.

export interface Contract {
  id: string;
  company: CompanyId;
  good: string;
  /** Tonnes, supplied by the company. */
  qty: number;
  from: { galaxy: number; system: number };
  to: { galaxy: number; system: number };
  /** Hyperspace jumps allowed. */
  jumps: number;
  /** Credits on delivery, on time. */
  pay: number;
  /** Of the pay, how much is the danger bonus (for showing). */
  danger: number;
  rush: boolean;
  /** Standing with the company needed to take it. */
  needs: StandingName;
  /** What the cargo is called, when it isn't a trade good (special assignments). */
  label?: string;
  /** A special assignment (game/assignments.ts). */
  special?: boolean;
  /** A Wexley-Yorozu survey contract: survey the moons at `to`, hand the data in at any W-Y station. No cargo. */
  survey?: boolean;
  /** A Science Division special order (explorers, Pathfinder and up): a survey of a system with a terraforming Candidate. */
  specialOrder?: boolean;
}

/** A contract you've taken, counting down. */
export interface ActiveContract extends Contract {
  jumpsLeft: number;
  /** Special cargo that survived your ship and is adrift, waiting to be recovered (game/assignments.ts). */
  adrift?: boolean;
  /**
   * Accepted over the comms array, not yet collected: the cargo waits at the
   * `from` station. While reserved, `jumpsLeft` counts the jumps left to
   * collect it; on collection it becomes the delivery deadline.
   */
  reserved?: boolean;
}

/** A new board every half hour. */
export const BOARD_SLOT = 30 * 60_000;
export const MAX_ACTIVE = 3;
/** Jumps past the deadline before the company takes its cargo back. */
export const LATE_GRACE = 3;

const ROUTE_HOP = FUEL_CAPACITY;

/** Fewest jumps between two systems in the same galaxy, at most `limit` (a tank's range per jump). */
export function jumpsBetween(a: StarSystem, b: StarSystem, limit = 6): number {
  if (a === b) return 0;
  let frontier = [a];
  const seen = new Set([a.index]);
  for (let n = 1; n <= limit; n++) {
    const next: StarSystem[] = [];
    for (const s of frontier) {
      for (const t of systemsWithin(s, ROUTE_HOP)) {
        if (t === b) return n;
        if (!seen.has(t.index)) {
          seen.add(t.index);
          next.push(t);
        }
      }
    }
    frontier = next;
  }
  return Infinity;
}

/**
 * The first jump on the shortest route from `a` to `b` (each hop within a
 * full tank), or null if `b` is here or out of reach. Among equally short
 * routes, the one with the shortest first hop, so fuel lasts.
 */
export function nextHop(a: StarSystem, b: StarSystem): StarSystem | null {
  if (a === b) return null;
  const first = new Map<number, StarSystem>([[a.index, a]]);
  let frontier = [a];
  for (let n = 1; n <= 12 && frontier.length; n++) {
    const next: StarSystem[] = [];
    for (const s of frontier) {
      for (const t of systemsWithin(s, ROUTE_HOP)) {
        if (first.has(t.index)) continue;
        first.set(t.index, n === 1 ? t : first.get(s.index)!);
        if (t === b) return first.get(t.index)!;
        next.push(t);
      }
    }
    frontier = next;
  }
  return null;
}

/** Systems from 1 to `max` jumps away, with their jump counts. */
export function withinJumps(from: StarSystem, max: number): { s: StarSystem; n: number }[] {
  const out: { s: StarSystem; n: number }[] = [];
  let frontier = [from];
  const seen = new Set([from.index]);
  for (let n = 1; n <= max; n++) {
    const next: StarSystem[] = [];
    for (const s of frontier) {
      for (const t of systemsWithin(s, ROUTE_HOP)) {
        if (seen.has(t.index)) continue;
        seen.add(t.index);
        next.push(t);
        out.push({ s: t, n });
      }
    }
    frontier = next;
  }
  return out;
}

const key = (s: { galaxy: number; system: number }) => `${s.galaxy}:${s.system}`;
const at = (s: StarSystem) => ({ galaxy: s.galaxy, system: s.index });
const placeOf = (p: { galaxy: number; system: number }) => systemAt(p.galaxy, p.system);

/** The standing a cargo of this value calls for. */
function needsFor(value: number): StandingName {
  return value < 400 ? 'Casual' : value < 1500 ? 'Contractor' : value < 5000 ? 'Trusted' : 'Preferred';
}

/**
 * The contracts on offer at a station at time `now`, best first. The same for
 * everyone; `c` only decides legality (a licence) and hides the ones you've taken.
 */
export function board(c: Commander, here: StarSystem, now: number): Contract[] {
  const slot = Math.floor(now / BOARD_SLOT);
  const r = (salt: number, k: number) => hash(here, 9000 + (slot % 100_000) * 7 + salt, k);
  const near = withinJumps(here, 3);
  const offers: Contract[] = [];
  const count = 4 + Math.floor(r(0, 0) * 3);
  for (let k = 0; k < count; k++) {
    const company = pickCompany(here, r(1, k));
    // Every company keeps a starter job on the board: its first offer here is small enough for anyone.
    const starter = !offers.some((o) => o.company === company && o.needs === 'Casual');
    const o = offerFrom(c, here, near, company, (salt) => r(salt, k), starter, `${here.galaxy}:${here.index}:${slot}:${k}`);
    if (o) offers.push(o);
  }
  // Wexley-Yorozu stations usually have a survey to offer too.
  if (wyWorks(here) && r(10, 0) < 0.75) {
    const o = surveyOffer(here, near, (salt) => r(salt, 0), `survey:${here.galaxy}:${here.index}:${slot}`);
    if (o) offers.push(o);
  }
  // Pathfinders get the Science Division's special orders too.
  if (wyWorks(here) && c.difficulty === 'modern' && exploreOf(c).points >= EXPLORER_DOORS.pathfinder) {
    const o = surveyOffer(here, near, (salt) => r(salt + 20, 0), `order:${here.galaxy}:${here.index}:${slot}`, true);
    if (o) offers.push(o);
  }
  return offers.filter((o) => !c.contracts?.some((a) => a.id === o.id) && !c.contractsDone?.includes(o.id)).sort((a, b) => b.pay - a.pay);
}

/** On top of the pay for a commander's first job with the company that recruited them. */
export const SIGNING_BONUS = 60;

/**
 * A company's welcome: a starter job from it at this station, whether or not
 * it's on the board, for a commander who came in answer to its advert
 * (witchspace.org.uk/careers/, /play/?company=…). One per board.
 */
export function welcome(c: Commander, here: StarSystem, company: CompanyId, now: number): Contract | null {
  const slot = Math.floor(now / BOARD_SLOT);
  const id = `welcome:${company}:${here.galaxy}:${here.index}:${slot}`;
  if (c.contracts?.some((a) => a.id === id) || c.contractsDone?.includes(id)) return null;
  const o = offerFrom(c, here, withinJumps(here, 3), company, (salt) => hash(here, 9500 + (slot % 100_000) * 7 + salt, COMPANY_IDS.indexOf(company)), true, id);
  // Not a rush job, and a signing bonus on top.
  return o && { ...o, rush: false, jumps: o.jumps + (o.rush ? 2 : 0), pay: o.pay + SIGNING_BONUS };
}

/** One offer from a company at this station, or null if it has nothing to carry from here. */
function offerFrom(c: Commander, here: StarSystem, near: { s: StarSystem; n: number }[], company: CompanyId, r: (salt: number) => number, starter: boolean, id: string): Contract | null {
  const firm = COMPANIES[company];
  // A good the company carries, that this world makes and the station trades openly.
  const carries = (g: string) => commodityById(g)?.unit === 't' && stationTrades(c, here, g);
  let goods = firm.goods.filter((g) => carries(g) && tradeBalance(here, g) > -0.2);
  // Where its usual goods aren't made, a company carries whatever the world exports.
  if (!goods.length) goods = COMMODITIES.filter((x) => !x.modernOnly || c.difficulty === 'modern').map((x) => x.id).filter((g) => carries(g) && tradeBalance(here, g) > 0.2);
  if (!goods.length) return null;
  const good = goods[Math.floor(r(2) * goods.length)];
  // Somewhere that needs it, preferring importers.
  const dests = near.filter(({ s }) => stationTrades(c, s, good));
  if (!dests.length) return null;
  const importers = dests.filter(({ s }) => tradeBalance(s, good) < -0.1);
  const pool = importers.length ? importers : dests;
  const { s: dest, n: minJumps } = pool[Math.floor(r(3) * pool.length)];
  const rush = r(4) < 0.25;
  let qty = 3 + Math.floor(r(5) * 14);
  const gi = COMMODITIES.findIndex((x) => x.id === good);
  const priceHere = equilibriumPrice(here, COMMODITIES[gi], gi);
  const priceThere = equilibriumPrice(dest, COMMODITIES[gi], gi);
  if (starter) qty = Math.max(1, Math.min(qty, Math.floor(399 / priceHere)));
  const ly = distanceLy(here, dest);
  // About two thirds of what an independent would make on the run, plus a
  // carriage fee by distance: you risk none of your own money.
  const base = Math.max(30, qty * (Math.max(0, priceThere - priceHere) * 0.65 + 3 + ly * 0.6));
  const danger = Math.round(base * DANGER_PREMIUM[dest.government] * 1.5);
  const pay = Math.round(base * (rush ? 1.4 : 1)) + danger;
  return { id, company, good, qty, from: at(here), to: at(dest), jumps: minJumps + (rush ? 0 : 2), pay, danger, rush, needs: needsFor(qty * priceHere) };
}

/** Where Wexley-Yorozu does business: survey contracts are offered and handed in there. */
export const wyWorks = (s: StarSystem) => presence(s).wy > 0.5;

/** Survey pay: a base, per moon, and per jump out. */
export const SURVEY_PAY = { base: 120, moon: 90, jump: 70 } as const;

/** Special orders pay this much more than an ordinary survey. */
export const SPECIAL_ORDER_PAY = 1.75;

/** A survey of the moons of a system two or three jumps out; a special order is one with a terraforming Candidate. */
function surveyOffer(here: StarSystem, near: { s: StarSystem; n: number }[], r: (salt: number) => number, id: string, special = false): Contract | null {
  const candidate = (s: StarSystem) => bodiesOf(s).some((b) => b.grade === 'Candidate');
  const targets = near.filter(({ s, n }) => (special ? n >= 1 && candidate(s) : n >= 2) && worldOf(s).moons.length > 0);
  if (!targets.length) return null;
  const { s: dest, n } = targets[Math.floor(r(11) * targets.length)];
  const moons = worldOf(dest).moons.length;
  const pay = SURVEY_PAY.base + SURVEY_PAY.moon * moons + SURVEY_PAY.jump * n;
  return {
    id,
    company: 'wy',
    good: 'survey',
    label: special ? 'Special order: moon surveys' : moons === 1 ? 'Moon survey' : 'Moon surveys',
    survey: true,
    ...(special ? { specialOrder: true } : {}),
    qty: 0,
    from: at(here),
    to: at(dest),
    jumps: n + 2,
    pay: Math.round(pay * (special ? SPECIAL_ORDER_PAY : 1)),
    danger: 0,
    rush: false,
    needs: 'Casual',
  };
}

/** Have you surveyed every moon the contract asks for? */
export function surveyDone(c: Commander, a: Contract): boolean {
  const s = placeOf(a.to);
  return worldOf(s).moons.every((_, i) => isSurveyed(c, s, `moon${i}`));
}

/** What a contract is, in a line: "4 t Food" or "Moon surveys of Riedquat". */
export const contractWhat = (a: Contract) => (a.survey ? `${cargoName(a)} of ${placeOf(a.to).name}` : `${a.qty} t ${cargoName(a)}`);

export const standing = (c: Commander, id: CompanyId) => c.standing?.[id] ?? 0;

export interface CompanyLog {
  delivered: number;
  late: number;
  failed: number;
  special: number;
}

export const logOf = (c: Commander, id: CompanyId): CompanyLog => c.companyLog?.[id] ?? { delivered: 0, late: 0, failed: 0, special: 0 };

export function logContract(c: Commander, id: CompanyId, what: keyof CompanyLog) {
  const log = { ...logOf(c, id) };
  log[what] += 1;
  c.companyLog = { ...c.companyLog, [id]: log };
}

/** What the cargo is called on screen. */
export const cargoName = (a: Contract) => a.label ?? commodityById(a.good)?.name ?? a.good;

export function addStanding(c: Commander, id: CompanyId, points: number) {
  c.standing = { ...c.standing, [id]: Math.max(-20, standing(c, id) + points) };
}

const DAY = 24 * 3600_000;

/** Companies forget, slowly: standing below zero creeps back a point a day. */
export function forgive(c: Commander, now: number) {
  if (c.forgiven === undefined) {
    c.forgiven = now;
    return;
  }
  const days = Math.floor((now - c.forgiven) / DAY);
  if (days < 1) return;
  c.forgiven += days * DAY;
  for (const [id, points] of Object.entries(c.standing ?? {})) if (points < 0) c.standing![id as CompanyId] = Math.min(0, points + days);
}

/** What it costs to be taken back as Unreliable: 150 Cr for each point below that. */
export const amendsCost = (points: number) => (points < -5 ? 150 * (-5 - points) : 0);

/** Pay compensation: back to Unreliable, to earn the rest. Returns what happened, or why not. */
export function makeAmends(c: Commander, id: CompanyId): string {
  const cost = amendsCost(standing(c, id));
  if (!cost) return '';
  if (c.credits < cost) return `${COMPANIES[id].name} wants ${cost.toLocaleString()} Cr in compensation`;
  c.credits = Math.round((c.credits - cost) * 10) / 10;
  c.standing = { ...c.standing, [id]: -5 };
  return `${COMPANIES[id].name} accepts your ${cost.toLocaleString()} Cr. You're Unreliable now: deliver on time and they'll come round.`;
}

/** Why you can't take a contract, or null if you can. */
export function cannotTake(c: Commander, o: Contract, freeTonnes: number): string | null {
  if (c.difficulty !== 'modern') return 'Contracts are for Modern rules';
  if ((c.contracts?.length ?? 0) >= MAX_ACTIVE) return `You can carry ${MAX_ACTIVE} contracts at once`;
  const points = standing(c, o.company);
  if (points < workNeeds(o.needs))
    return standingName(points) === 'Blacklisted' ? `${COMPANIES[o.company].name} won't work with you: you're Blacklisted` : `Needs ${o.needs} standing with ${COMPANIES[o.company].name} (you're ${standingName(points)})`;
  if (o.qty > freeTonnes + 1e-9) return `Needs ${o.qty} t free in the hold`;
  return null;
}

export function take(c: Commander, o: Contract, freeTonnes: number): string | null {
  const why = cannotTake(c, o, freeTonnes);
  if (why) return why;
  c.contracts = [...(c.contracts ?? []), { ...o, jumpsLeft: o.jumps }];
  return null;
}

export function finish(c: Commander, id: string) {
  c.contracts = (c.contracts ?? []).filter((a) => a.id !== id);
  c.contractsDone = [...(c.contractsDone ?? []), id].slice(-60);
}

/** Give up a contract: the company takes its cargo back, and remembers. */
export function abandon(c: Commander, id: string): string {
  const a = c.contracts?.find((x) => x.id === id);
  if (!a) return '';
  finish(c, id);
  addStanding(c, a.company, -3);
  logContract(c, a.company, 'failed');
  return `Contract abandoned · ${COMPANIES[a.company].name} will remember`;
}

/** After a hyperspace jump: deadlines count down; long-overdue cargo is reclaimed. */
export function afterJump(c: Commander, now = Date.now()): string[] {
  const notes: string[] = [];
  for (const a of [...(c.contracts ?? [])]) {
    a.jumpsLeft -= 1;
    if (a.reserved) {
      notes.push(...reservationAfterJump(c, a, now));
      continue;
    }
    const to = placeOf(a.to).name;
    if (a.jumpsLeft === 0) {
      notes.push(`${cargoName(a)} for ${to}: last jump`);
      notice(c, a, 'last', 'One jump left', `Your ${contractWhat(a)} is due ${a.survey ? 'at a Wexley-Yorozu station' : `at ${to}`} by your next jump. After that it's late, for half pay.`, now);
    }
    if (a.jumpsLeft === -1) notice(c, a, 'late', 'Running late', `Your ${contractWhat(a)} is late: half pay on delivery. In ${LATE_GRACE} more jumps we ${a.survey ? 'cancel it' : 'take it back'}.`, now);
    if (a.jumpsLeft < -LATE_GRACE) {
      finish(c, a.id);
      addStanding(c, a.company, -3);
      logContract(c, a.company, 'failed');
      notes.push(`${COMPANIES[a.company].name} has reclaimed its ${cargoName(a)}: contract failed`);
      notice(c, a, 'reclaimed', a.survey ? 'Survey cancelled' : 'Cargo reclaimed', a.survey ? `You were ${LATE_GRACE} jumps past the deadline for our ${contractWhat(a)}. Contract cancelled.` : `You were ${LATE_GRACE} jumps past the deadline, so we've taken back our ${a.qty} t ${cargoName(a)} for ${to}. Contract cancelled.`, now);
    }
  }
  return notes;
}

/**
 * A note from the company that lasts: it goes in the Messages on the
 * Contracts tab, so it isn't missed mid-flight.
 */
function notice(c: Commander, a: Contract, kind: string, subject: string, body: string, now: number) {
  const id = `${a.id}:${kind}`;
  if (c.messages?.some((m) => m.id === id)) return;
  c.messages = [{ id, company: a.company, subject, body, at: now }, ...(c.messages ?? [])].slice(0, 20);
}

/** Docked: deliver whatever is due here. Returns what happened, for the player. */
export function deliver(c: Commander, here: StarSystem, now = Date.now()): string[] {
  const notes: string[] = [];
  for (const a of [...(c.contracts ?? [])]) {
    if (a.reserved) continue; // still waiting to be collected
    if (a.survey) {
      // Handed in at any Wexley-Yorozu station, once every moon is surveyed. W-Y keeps the data.
      if (!wyWorks(here) || !surveyDone(c, a)) continue;
      const target = placeOf(a.to);
      const e = exploreOf(c);
      e.data = e.data.filter((d) => !(d.galaxy === target.galaxy && d.system === target.index && d.body.startsWith('moon')));
    } else if (key(a.to) !== key(at(here))) continue;
    const late = a.jumpsLeft < 0;
    const pay = late ? Math.round(a.pay / 2) : a.pay;
    c.credits = Math.round((c.credits + pay) * 10) / 10;
    const before = standingName(standing(c, a.company));
    addStanding(c, a.company, late ? 0 : a.special ? 3 : 1 + (a.rush || a.danger > 0 ? 1 : 0));
    logContract(c, a.company, late ? 'late' : a.special ? 'special' : 'delivered');
    finish(c, a.id);
    const after = standingName(standing(c, a.company));
    notice(c, a, 'delivered', a.survey ? 'Survey received' : 'Delivered, with thanks', `Your ${contractWhat(a)} ${a.survey ? 'was handed in' : `reached ${placeOf(a.to).name}`}${late ? ' late' : ''}: ${pay.toLocaleString()} Cr paid.${after !== before ? ` You're ${after} with us now.` : ''}`, now);
    notes.push(`${COMPANIES[a.company].name} · ${contractWhat(a)} ${a.survey ? 'handed in' : 'delivered'}${late ? ' late' : ''} · ${pay.toLocaleString()} Cr` + (after !== before ? ` · now ${after}` : ''));
  }
  return notes;
}

/** Ship lost: the company's cargo with it. Special cargo survives, adrift (see game/assignments.ts). */
export function loseContracts(c: Commander): string[] {
  const lost = (c.contracts ?? []).filter((a) => !a.special && !a.survey && !a.reserved); // surveys aren't cargo, nor is cargo not yet loaded
  for (const a of lost) {
    finish(c, a.id);
    addStanding(c, a.company, -2);
    logContract(c, a.company, 'failed');
    notice(c, a, 'lost', 'Cargo lost', `Our ${a.qty} t ${cargoName(a)} for ${placeOf(a.to).name} was lost with your ship. Contract cancelled.`, Date.now());
  }
  return lost.map((a) => `${COMPANIES[a.company].name}'s ${cargoName(a)} lost with your ship`);
}

export const destinationOf = (a: Contract) => placeOf(a.to);

// --- Accepted over the comms array (docs/design/radio-and-comms.md) -----------------
//
// With a working array, an offer can be accepted in flight. It's reserved:
// yours, counting towards the three you can hold and needing the standing it
// always needed, but the cargo waits at the station that posted it. Hold
// space is checked when you collect it there. Collect it within
// COLLECT_JUMPS jumps, or it counts as abandoned.

/** Jumps you have to collect a reserved contract. */
export const COLLECT_JUMPS = 2;

/** Why you can't accept an offer over the array, or null if you can. Hold space waits for collection. */
export const cannotReserve = (c: Commander, o: Contract): string | null => (o.survey || o.special ? 'Collect this one at the station' : cannotTake(c, o, Infinity));

/** Accept an offer over the array. Returns why not, or null. */
export function reserve(c: Commander, o: Contract): string | null {
  const why = cannotReserve(c, o);
  if (why) return why;
  if (c.contracts?.some((a) => a.id === o.id) || c.contractsDone?.includes(o.id)) return 'Already taken';
  c.contracts = [...(c.contracts ?? []), { ...o, jumpsLeft: COLLECT_JUMPS, reserved: true }];
  return null;
}

/** Tonnes of reserved cargo waiting at stations: room you'll need when you collect it. */
export const reservedTonnes = (c: Commander) => (c.contracts ?? []).reduce((t, a) => t + (a.reserved ? a.qty : 0), 0);

/**
 * Docked: load whatever is reserved for you here, if it fits. Returns what
 * happened, for the player, including what didn't fit and how much room it needs.
 */
export function collect(c: Commander, here: StarSystem, freeTonnes: number, now = Date.now()): string[] {
  const notes: string[] = [];
  let free = freeTonnes;
  for (const a of c.contracts ?? []) {
    if (!a.reserved || key(a.from) !== key(at(here))) continue;
    const name = COMPANIES[a.company].name;
    if (a.qty > free + 1e-9) {
      notes.push(`${name} is holding ${contractWhat(a)} for you: make ${+(a.qty - free).toFixed(1)} t more room to load it`);
      continue;
    }
    free -= a.qty;
    delete a.reserved;
    a.jumpsLeft = a.jumps;
    notes.push(`${name} · ${contractWhat(a)} loaded for ${placeOf(a.to).name} · ${a.jumps} jumps`);
    notice(c, a, 'collected', 'Loaded, as agreed', `Your ${contractWhat(a)} is aboard. Deliver it to ${placeOf(a.to).name} within ${a.jumps} jumps.`, now);
  }
  return notes;
}

/** A jump with a contract still waiting to be collected: a warning, then it lapses. */
function reservationAfterJump(c: Commander, a: ActiveContract, now: number): string[] {
  const where = `${placeOf(a.from).name}`;
  if (a.jumpsLeft === 0) {
    notice(c, a, 'collect-last', 'Waiting for you', `We're holding ${contractWhat(a)} for you at ${where}. Collect it before your next jump, or we'll give the work to someone else.`, now);
    return [`${contractWhat(a)} waiting at ${where}: collect it before your next jump`];
  }
  if (a.jumpsLeft >= 0) return [];
  finish(c, a.id);
  addStanding(c, a.company, -3);
  logContract(c, a.company, 'failed');
  notice(c, a, 'lapsed', 'Work given to someone else', `You never collected ${contractWhat(a)} at ${where}, so we gave it to another hauler. We'll count it as abandoned.`, now);
  return [`${COMPANIES[a.company].name} gave your ${cargoName(a)} at ${where} to someone else: counted as abandoned`];
}
