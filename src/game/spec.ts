import { shipById } from '../content/ships';
import { checkSpec, type Spec } from './shipyard';

// A ship specced on the site's configurator, waiting for the next shipyard you
// dock at (docs/design/ship-configurator.md). The site writes it to this
// browser and, if you're signed in, to your account; the game takes the deposit.

export const SPEC_KEY = 'witchspace.spec.v1';

/** A spec from outside the game, made safe, or null. */
export const validSpec = (spec: unknown): Spec | null => checkSpec(spec, shipById);

export interface WaitingSpec {
  spec: Spec;
  at: number;
}

/** The spec this browser holds, if it's still a good one. */
export function localSpec(): WaitingSpec | null {
  try {
    const raw = JSON.parse(localStorage.getItem(SPEC_KEY) ?? 'null') as { spec?: unknown; at?: unknown } | null;
    const spec = validSpec(raw?.spec);
    return spec && typeof raw?.at === 'number' ? { spec, at: raw.at } : null;
  } catch {
    return null;
  }
}

/** The newer of this browser's and the account's. */
export const newerSpec = (a: WaitingSpec | null, b: WaitingSpec | null) => (!a ? b : !b ? a : a.at >= b.at ? a : b);

export function clearLocalSpec() {
  try {
    localStorage.removeItem(SPEC_KEY);
  } catch {
    /* private window: nothing kept, nothing to clear */
  }
}
