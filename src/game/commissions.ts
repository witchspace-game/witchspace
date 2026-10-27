import { shipModules } from '../content/moduleFiles';
import type { ModuleDef } from '../content/types';
import { systemAt } from '../galaxy/generate';
import type { Commander } from './commander';
import { buildsFrom, lineUpOf, type InService, type Yard } from './yards';

// Paid on commission (docs/design/ship-the-titanoboa.md, Mark): Wexley-Yorozu
// pays for good ideas once they're built. When an accepted module is first
// fitted to a Titanoboa, its designer's commander is paid 5,000 Cr, once; an
// accepted revision pays its improver 2,000 Cr when the first build after it
// is fitted. The fee waits until the commander signed in with that callsign
// next docks. Everything comes from the module files and the clock, so every
// game agrees on when a module was first fitted.

export const COMMISSION_FEE = 5000;
export const REVISION_FEE = 2000;
const GALAXIES = 8;
/** How many builds ahead of a date to look for the first fitting: each constructor's next two years or so. */
const LOOKAHEAD = 50;

const dayOf = (d: string) => Date.parse(`${d}T00:00:00Z`);
const sameCallsign = (a: string, b: string) => a.trim().toLocaleUpperCase() === b.trim().toLocaleUpperCase();

/** The community modules in service, in the order they went in. */
export function inService(mods: readonly ModuleDef[] = shipModules): InService[] {
  return mods
    .filter((m) => m.inService)
    .map((m) => ({ id: m.id, zone: m.zone, from: dayOf(m.inService!.from), replaces: m.inService!.replaces, share: m.inService!.share ?? 0.5 }))
    .sort((a, b) => a.from - b.from || a.id.localeCompare(b.id));
}

/** A build's line-up, with the community modules in service. */
export const lineUpFor = (y: Yard, mods: readonly ModuleDef[] = shipModules) => lineUpOf(y, inService(mods));

const fittedCache = new Map<string, Yard | null>();

/** The first build, anywhere, starting at or after `from` that carries the module. */
export function firstFitted(id: string, from: number, mods: readonly ModuleDef[] = shipModules): Yard | null {
  const extras = inService(mods);
  const key = `${id}@${from}:${extras.map((m) => `${m.id}${m.from}${m.replaces}${m.share}`).join()}`;
  if (fittedCache.has(key)) return fittedCache.get(key)!;
  let best: Yard | null = null;
  for (let g = 0; g < GALAXIES; g++) {
    const y = buildsFrom(g, from, LOOKAHEAD).find((b) => lineUpOf(b, extras).includes(id));
    if (y && (!best || y.start < best.start)) best = y;
  }
  fittedCache.set(key, best);
  return best;
}

export interface Commission {
  /** Remembered in the save once paid. */
  key: string;
  module: ModuleDef;
  kind: 'design' | 'revision';
  /** The callsign it's paid to. */
  to: string;
  fee: number;
  /** The build it was first fitted to. */
  yard: Yard;
}

/** Every commission that has fallen due by `now`: modules first fitted, and revisions fitted since. */
export function commissionsFitted(now: number, mods: readonly ModuleDef[] = shipModules): Commission[] {
  const out: Commission[] = [];
  for (const m of mods) {
    if (m.inService) {
      const yard = firstFitted(m.id, dayOf(m.inService.from), mods);
      if (yard && yard.start <= now) out.push({ key: `design:${m.id}`, module: m, kind: 'design', to: m.designer, fee: COMMISSION_FEE, yard });
    }
    (m.revisions ?? []).forEach((r, i) => {
      const yard = firstFitted(m.id, dayOf(r.from), mods);
      if (yard && yard.start <= now) out.push({ key: `revision:${m.id}:${i}`, module: m, kind: 'revision', to: r.by, fee: REVISION_FEE, yard });
    });
  }
  return out;
}

/** What Wexley-Yorozu owes the commander signed in as `callsign`, not yet paid. */
export function commissionsDue(c: Commander, callsign: string | null, now: number, mods: readonly ModuleDef[] = shipModules): Commission[] {
  if (!callsign || c.difficulty !== 'modern') return [];
  return commissionsFitted(now, mods).filter((x) => sameCallsign(x.to, callsign) && !c.commissions?.includes(x.key));
}

/** Pay one: the credits, a note that it's paid, and Wexley-Yorozu's letter. Returns the line to flash. */
export function payCommission(c: Commander, x: Commission, now: number): string {
  c.credits += x.fee;
  c.commissions = [...(c.commissions ?? []), x.key];
  const where = `${systemAt(x.yard.galaxy, x.yard.system).name}${x.yard.galaxy === c.location.galaxy ? '' : ` in Galaxy ${x.yard.galaxy + 1}`}`;
  const fee = `${x.fee.toLocaleString()} Cr`;
  const body =
    x.kind === 'design'
      ? `Your ${x.module.name} has been fitted to the Titanoboa building at ${where}, the first of its kind. As agreed, a commission fee of ${fee} has been paid to your account. The catalogue now reads "Designed by CMDR ${x.to}". The company thanks you for your contribution.`
      : `Your revision of the ${x.module.name} has been fitted to the Titanoboa building at ${where}. As agreed, a revision fee of ${fee} has been paid to your account, and your name is on the module beside its designer's. The company thanks you for your contribution.`;
  c.messages = [{ id: `commission:${x.key}`, company: 'wy' as const, subject: x.kind === 'design' ? 'Commission paid' : 'Revision fee paid', body, at: now }, ...(c.messages ?? [])].slice(0, 20);
  return `Wexley-Yorozu: ${x.kind === 'design' ? 'commission' : 'revision fee'} paid · ${fee} for your ${x.module.name}`;
}

/** The community modules a build was the first to carry (and revisions it first carried): for the yard news. */
export function firstFittingsAt(y: Yard, mods: readonly ModuleDef[] = shipModules): Commission[] {
  return commissionsFitted(y.start, mods).filter((x) => x.yard.galaxy === y.galaxy && x.yard.slot === y.slot && x.yard.build === y.build);
}
