import { distanceLy, systemAt, type StarSystem } from '../galaxy/generate';
import { stationName } from '../galaxy/stationNames';
import type { Commander } from './commander';
import { board, cannotTake, cargoName, contractWhat, destinationOf, jumpsBetween, nextHop, surveyDone, wyWorks, type ActiveContract, type Contract } from './contracts';
import type { CompanyId } from './companies';
import { worldOf, isSurveyed } from './explore';

// What you're doing and what to do next, for the job strip in flight, and
// which work on a station's board goes your way. As set out in
// docs/design/flight-hud-and-touch.md. Pure: the game draws it.

export const COMPANY_SHORT: Record<CompanyId, string> = { hexon: 'Hexon', vorg: 'Vorg', mutual: 'Mutual', wy: 'W-Y' };

/** The step the strip offers to do for you when tapped. */
export type JobAction = 'course' | 'hyper' | 'dock' | 'survey' | null;

export interface JobStep {
  contract: ActiveContract;
  /** "8 t Medicine → Diso · 2 jumps left · Hexon" */
  line: string;
  /** For a small screen: "Diso · 2 jumps" */
  short?: string;
  /** "Hyperspace to Leesti (H) · 3 jumps to Diso" */
  next: string;
  /** How the deadline looks: fine, last jump, or late. */
  urgency: 'ok' | 'last' | 'late';
  action: JobAction;
  /** For 'course': the system to set course to (the next hop), and where the route ends. */
  hop?: StarSystem;
  end?: StarSystem;
}

const deadline = (a: ActiveContract) =>
  a.jumpsLeft < 0 ? 'late · half pay' : a.jumpsLeft === 0 ? 'last jump' : `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'} left`;

/** Most urgent first: late, then fewest jumps left. Cargo adrift waits for recovery, after the rest. */
export function byUrgency(contracts: ActiveContract[]): ActiveContract[] {
  return [...contracts].sort((a, b) => Number(Boolean(a.adrift)) - Number(Boolean(b.adrift)) || a.jumpsLeft - b.jumpsLeft);
}

/** The way to `end` from `here`: hyperspace on, set course, or refuel first. */
function routeStep(c: Commander, here: StarSystem, end: StarSystem, then = ''): Pick<JobStep, 'next' | 'action' | 'hop' | 'end'> {
  const hop = nextHop(here, end);
  if (!hop) return { next: `${end.name} is out of reach from here · find a route on the chart (G)`, action: null };
  const jumps = jumpsBetween(here, end, 12);
  const rest = hop === end ? then : ` · ${jumps} jumps to ${end.name}${then}`;
  if (distanceLy(here, hop) > c.fuel + 1e-9) return { next: `Refuel first: ${hop.name} is ${distanceLy(here, hop).toFixed(1)} LY${rest}`, action: null };
  if (c.target !== hop.index) return { next: `Set course to ${hop.name} (tap)${rest}`, action: 'course', hop, end };
  return { next: `Hyperspace to ${hop.name} (H)${rest}`, action: 'hyper', hop, end };
}

/** What to do next for one contract, from `here`. */
export function stepFor(c: Commander, here: StarSystem, a: ActiveContract): JobStep {
  const to = destinationOf(a);
  const urgency = a.jumpsLeft < 0 ? 'late' : a.jumpsLeft === 0 ? 'last' : 'ok';
  const who = COMPANY_SHORT[a.company];
  if (a.reserved) {
    // Accepted over the comms array: collect it first.
    const from = systemAt(a.from.galaxy, a.from.system);
    const left = a.jumpsLeft === 0 ? 'collect before you jump' : `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'} to collect`;
    const line = `Collect ${contractWhat(a)} at ${from.name} · ${left} · ${who}`;
    if (from === here) return { contract: a, line, next: `Dock at ${stationName(here).name} to collect it`, urgency: a.jumpsLeft === 0 ? 'last' : 'ok', action: 'dock' };
    return { contract: a, line, urgency: a.jumpsLeft === 0 ? 'last' : 'ok', ...routeStep(c, here, from, ' to collect it') };
  }
  if (a.adrift) {
    const k = c.adrift?.find((x) => x.contract === a.id);
    const where = k ? systemAt(k.galaxy, k.system) : null;
    const line = `${cargoName(a)} adrift · ${who}`;
    if (!where || k?.held) return { contract: a, line, next: k?.held ? `Held at ${where?.name ?? 'a station'}: see Messages` : 'Recover it where you lost it', urgency, action: null };
    if (where === here) return { contract: a, line, next: `Recover it: it's beaconing in ${here.name}`, urgency, action: null };
    return { contract: a, line, urgency, ...routeStep(c, here, where, ' to recover it') };
  }
  if (a.survey) {
    const moons = worldOf(to).moons.length;
    const done = worldOf(to).moons.filter((_, i) => isSurveyed(c, to, `moon${i}`)).length;
    const line = `Survey ${to.name}'s moons · ${done} of ${moons} · ${deadline(a)} · ${who}`;
    if (surveyDone(c, a)) {
      if (wyWorks(here)) return { contract: a, line, next: `Dock at ${stationName(here).name} to hand it in`, urgency, action: 'dock' };
      return { contract: a, line, next: 'Hand it in at any Wexley-Yorozu station', urgency, action: null };
    }
    if (to === here) return { contract: a, line, next: `Survey the moons here: ${moons - done} to go`, urgency, action: 'survey' };
    return { contract: a, line, urgency, ...routeStep(c, here, to, ', then survey its moons') };
  }
  const line = `${contractWhat(a)} → ${to.name} · ${deadline(a)} · ${who}`;
  if (to === here) return { contract: a, line, next: `Dock at ${stationName(here).name} to deliver`, urgency, action: 'dock' };
  return { contract: a, line, urgency, ...routeStep(c, here, to) };
}

const shortDeadline = (a: ActiveContract) => (a.jumpsLeft < 0 ? 'late' : a.jumpsLeft === 0 ? 'last jump' : `${a.jumpsLeft} jump${a.jumpsLeft === 1 ? '' : 's'}`);

/** The strip: the most urgent contract's step, and how many others there are. */
export function jobStrip(c: Commander, here: StarSystem): { step: JobStep; more: number; all: JobStep[] } | null {
  const contracts = byUrgency(c.contracts ?? []);
  if (!contracts.length) return null;
  const all = contracts.map((a) => ({ ...stepFor(c, here, a), short: a.reserved ? `Collect · ${systemAt(a.from.galaxy, a.from.system).name}` : `${a.adrift ? 'Recover case' : destinationOf(a).name} · ${a.adrift ? 'adrift' : shortDeadline(a)}` }));
  return { step: all[0], more: all.length - 1, all };
}

/**
 * Work on a station's board that goes your way: the best-paying offer you can
 * take whose destination is one of yours, a jump from one, or on the way to
 * one (at most a jump longer). Only while you hold a delivery. Surveys aren't
 * offered this way.
 */
export function routeWork(c: Commander, here: StarSystem, offers: Contract[], freeTonnes: number): { offer: Contract; why: string } | null {
  const drops = (c.contracts ?? []).filter((a) => !a.survey && !a.adrift).map(destinationOf);
  if (!drops.length) return null;
  let best: { offer: Contract; why: string } | null = null;
  for (const o of offers) {
    if (o.survey || cannotTake(c, o, freeTonnes)) continue;
    const to = destinationOf(o);
    if (to === here) continue;
    let why = '';
    for (const d of drops) {
      if (to === d) why = 'same drop as yours';
      else if (jumpsBetween(d, to, 1) === 1) why ||= `one jump past your drop at ${d.name}`;
      else if (jumpsBetween(here, to, 6) + jumpsBetween(to, d, 6) <= jumpsBetween(here, d, 6) + 1) why ||= `on your way to ${d.name}`;
    }
    if (why && (!best || o.pay > best.offer.pay)) best = { offer: o, why };
  }
  return best;
}

/**
 * With a working comms array, the companies reach you in flight: work on
 * your route from the station here and from the one at your next jump. One
 * offer from each at most, with where it's waiting.
 */
export function workInReach(c: Commander, here: StarSystem, next: StarSystem | null, now: number, freeTonnes: number): { offer: Contract; why: string; at: StarSystem }[] {
  const out: { offer: Contract; why: string; at: StarSystem }[] = [];
  for (const at of next && next !== here ? [here, next] : [here]) {
    const fit = routeWork(c, at, board(c, at, now), freeTonnes);
    if (fit) out.push({ ...fit, at });
  }
  return out;
}
