import { editionById } from '../content/editions';

// How long a yard takes over an order, on its own so the server can read it
// without the rest of the shipyard (server/src/yard.ts). A real yard takes
// months to build a hull (Mark), so it's always building: your deposit buys
// the next hull off the line, and this is the time to finish her to your spec.
// An edition is finished by hand, so it takes longer.

/** Real hours to finish an ordinary order. */
export const PRODUCTION_HOURS = 72;

/** Real hours to finish this order. */
export const productionHours = (o: { edition?: { id: string } }) => (o.edition ? editionById(o.edition.id)?.finishHours : undefined) ?? PRODUCTION_HOURS;
