// News lines for the map and the station (moved from main.ts): a system's latest news as heard here,
// how long ago, and news of traders being picked off near a system.

import { distanceLy, systemAt, type StarSystem } from '../galaxy/generate';
import { EVENT_KINDS, newsArrives, newsOf } from '../economy/events';
import type { Commander } from './commander';

export const ago = (ms: number) => {
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60} min`;
};

/** A line for the galaxy map: the latest news of a system that has reached here. */
export function newsLine(s: StarSystem, here: StarSystem): string | null {
  const n = newsOf(s, here, Date.now());
  if (!n) return null;
  const over = Date.now() > n.event.end;
  return `${EVENT_KINDS[n.event.type].name}${over ? ' (may be over)' : ''} · heard ${ago(Date.now() - n.heard)} ago`;
}

/**
 * News of traders being picked off: three or more deliveries lost near one
 * system within two hours. It spreads like any other news.
 */
export function attackNews(c: Commander, here: StarSystem, now: number) {
  const out: { where: StarSystem; distance: number; heard: number; lost: number }[] = [];
  for (const [key, market] of Object.entries(c.markets)) {
    const recent = (market.lost ?? []).filter((l) => l.t <= now && l.t > now - 2 * 3600_000);
    if (recent.length < 3) continue;
    const [g, i] = key.split(':').map(Number);
    if (g !== here.galaxy) continue;
    const where = systemAt(g, i);
    const distance = distanceLy(where, here);
    if (distance > 25) continue;
    const heard = newsArrives(where, here, recent[2].t);
    if (heard <= now) out.push({ where, distance, heard, lost: recent.length });
  }
  return out;
}
