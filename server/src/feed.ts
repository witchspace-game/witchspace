// The live feed (docs/design/live-feed.md): what real commanders have done
// lately, for the home page. Public, so it carries only what's public
// elsewhere: callsigns and firsts (the chart), clips and hearts (their pages)
// and totals. Never emails, account ids or network data.

/** How far back the feed looks, and how many of each kind it keeps. */
export const FEED_WINDOW = 48 * 3600_000;
export const FEED_EACH = 20;
/** A cloud save this recent counts as flying now. */
export const FLYING_NOW = 15 * 60_000;
/** Seconds the edge keeps the feed. */
export const FEED_MAX_AGE = 60;

export interface FirstEvent { kind: 'first'; t: number; callsign: string; galaxy: number; system: number; body: string }
export interface ClipEvent { kind: 'clip'; t: number; id: string; title: string; system: string; hearts: number }
export type FeedEvent = FirstEvent | ClipEvent;
export interface Flying { now: number; today: number }
export interface Feed { events: FeedEvent[]; flying: Flying }

/** Firsts and clips together, newest first, each kind capped. Built field by field so nothing private rides along. */
export function buildFeed(firsts: readonly FirstEvent[], clips: readonly ClipEvent[], flying: Flying): Feed {
  const newest = <T extends FeedEvent>(list: readonly T[]) => [...list].sort((a, b) => b.t - a.t).slice(0, FEED_EACH);
  const events: FeedEvent[] = [
    ...newest(firsts).map((f): FirstEvent => ({ kind: 'first', t: f.t, callsign: f.callsign, galaxy: f.galaxy, system: f.system, body: f.body })),
    ...newest(clips).map((c): ClipEvent => ({ kind: 'clip', t: c.t, id: c.id, title: c.title, system: c.system, hearts: c.hearts })),
  ];
  events.sort((a, b) => b.t - a.t);
  return { events, flying: { now: flying.now, today: flying.today } };
}
