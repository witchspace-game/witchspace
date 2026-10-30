// Shared space's budget (Mark, 30 October 2026: "can i protect it so it doesnt get abused or i get a
// stupid bill i cant pay?"). Cloudflare has no hard spending cap, so the server keeps its own: each
// system room reports how long it was busy and how many messages it took, and the day's cost is
// worked out from Cloudflare's published Durable Objects prices. Near the day's budget no new ship
// joins; at it, everyone flies solo until midnight (UTC). Single-player is never limited.
// The budget and an off switch are set from the admin key, with no deploy (Mark: "it may go viral!").

/** Dollars a day for shared space (Mark). Raise it for a busy day with POST /admin/space. */
export const SPACE_BUDGET = 3;
/** New ships stop joining at this share of the budget, so the day ends at it, not past it. */
export const JOIN_SHARE = 0.9;
/** Cloudflare's prices: a busy room bills 128 MB of duration ($12.50 a million GB-s), and a request for every 20 incoming messages ($0.15 a million). */
export const PRICE = { perSecond: (0.125 * 12.5) / 1e6, perMessage: 0.15 / 1e6 / 20 };
/** Systems one account, or one network, may join in an hour: a fast pilot jumps about once a minute. */
export const ROOMS_PER_HOUR = { account: 60, network: 150 };
/** A room's report covers at most this long, however long since the last (a room that slept and woke). */
export const MAX_REPORT_SECONDS = 120;
/** How often a busy room reports. */
export const REPORT_EVERY_MS = 60_000;

export const costOf = (seconds: number, messages: number) => seconds * PRICE.perSecond + messages * PRICE.perMessage;
export const dayOf = (t: number) => new Date(t).toISOString().slice(0, 10);

export interface SpaceDay {
  off: boolean;
  budget: number;
  cost: number;
}

/** What a commander is told when they can't join, or null to let them in. */
export function refusal(day: SpaceDay, rooms: { account: number; network: number }): string | null {
  if (day.off) return 'Shared space is resting for now';
  if (day.cost >= day.budget * JOIN_SHARE) return 'Shared space is busy today';
  if (rooms.account >= ROOMS_PER_HOUR.account || rooms.network >= ROOMS_PER_HOUR.network) return 'Shared space · a lot of systems this hour';
  return null;
}

/** Everyone out: switched off, or the day's budget spent. */
export const stopAll = (day: SpaceDay) => day.off || day.cost >= day.budget;
