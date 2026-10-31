// galaxy_now: a system as it is right now, worked out the way the game works it out, from the
// seed and the clock (Marketing, with Mark's yes: "calculated, not simulated", in a form anyone can
// try). The event on the world, the news that has reached it, the ships due in and out on the
// timetable, any Wexley-Yorozu yard and its stage, and its market: what it imports and exports, and
// what's dear or cheap today. Public news only: nothing about any commander. The market is as it
// stands before anyone's own trades.

import { activeEvent, EVENT_KINDS, newsAt } from '../economy/events';
import { equilibriumPrice, freshMarket, quoteModern, tradeBalance } from '../economy/market';
import { COMMODITIES } from '../economy/commodities';
import { systemAt, GOVERNMENTS, ECONOMIES, type StarSystem } from '../galaxy/generate';
import { stationName } from '../galaxy/stationNames';
import { COMPANIES } from '../game/companies';
import { cargoWords, voyages } from '../game/traffic';
import { stageInfo, yardAt, yardsNear } from '../game/yards';

/** How far ahead the timetable looks. */
const AHEAD_MS = 30 * 60_000;
const MAX_SHIPS = 10;
const MAX_NEWS = 6;

const minutes = (ms: number) => Math.max(0, Math.round(ms / 60_000));
const when = (ms: number) => (ms < 90 * 60_000 ? `${minutes(ms)} min` : `${Math.round(ms / 3600_000)} h`);
/** A good counts as dear (or cheap) today this far over (or under) its usual price here. */
const UNUSUAL = 0.12;

/** `hullName` turns a ship id into its name (the MCP server's fleet). */
export function galaxyNow(s: StarSystem, now: number, hullName: (id: string) => string = (id) => id) {
  const event = activeEvent(s, now);
  const yard = yardAt(s, now);
  const quotes = quoteModern(s, freshMarket(s, now)).filter((q) => q.commodity.baseSupply > 0);
  const vsUsual = quotes.map((q) => ({ q, r: q.price / equilibriumPrice(s, q.commodity, COMMODITIES.indexOf(q.commodity)) - 1 }));
  const balance = (sign: 1 | -1) =>
    quotes
      .map((q) => ({ name: q.commodity.name, b: tradeBalance(s, q.commodity.id) * sign }))
      .filter((x) => x.b > 0.3)
      .sort((a, b) => b.b - a.b)
      .slice(0, 5)
      .map((x) => x.name);
  const unusual = (sign: 1 | -1) =>
    vsUsual
      .filter((x) => x.r * sign > UNUSUAL)
      .sort((a, b) => (b.r - a.r) * sign)
      .slice(0, 5)
      .map((x) => ({ good: x.q.commodity.name, price: `${x.q.price} Cr`, vsUsual: `${x.r > 0 ? '+' : '−'}${Math.round(Math.abs(x.r) * 100)}%` }));
  return {
    system: s.name,
    galaxy: s.galaxy + 1,
    station: stationName(s).name,
    government: GOVERNMENTS[s.government],
    economy: ECONOMIES[s.economy],
    techLevel: s.techLevel,
    at: new Date(now).toISOString(),
    event: event
      ? { name: EVENT_KINDS[event.type].name, headline: EVENT_KINDS[event.type].headline(s.name), wanted: EVENT_KINDS[event.type].wanted, endsIn: when(event.end - now) }
      : null,
    news: newsAt(s, now)
      .filter((n) => n.where !== s)
      .slice(0, MAX_NEWS)
      .map((n) => ({ headline: EVENT_KINDS[n.event.type].headline(n.where.name), distanceLy: Math.round(n.distance * 10) / 10, heard: `${when(now - n.heard)} ago`, mayBeOver: now > n.event.end })),
    timetable: voyages(s, now, now + AHEAD_MS)
      .slice(0, MAX_SHIPS)
      .map((v) => ({
        in: when(v.at - now),
        ship: v.name,
        hull: hullName(v.hull),
        company: v.company ? COMPANIES[v.company].name : 'independent',
        ...(v.leg === 'in' ? { arriving: true, from: systemAt(s.galaxy, v.other).name } : { departing: true, to: systemAt(s.galaxy, v.other).name }),
        ...(v.to === 'titan' ? { for: 'the Wexley-Yorozu yard' } : {}),
        ...(v.relief ? { relief: EVENT_KINDS[v.relief].name } : {}),
        cargo: cargoWords(v.cargo),
        ...(v.escorts ? { escorts: v.escorts } : {}),
      })),
    yard: yard ? { stage: stageInfo(yard.stage).name, through: `${Math.round(yard.progress * 100)}%`, news: stageInfo(yard.stage).news } : null,
    yardsNearby: yardsNear(s, now)
      .filter((n) => n.where !== s)
      .slice(0, 3)
      .map((n) => ({ system: n.where.name, distanceLy: Math.round(n.distance * 10) / 10, stage: stageInfo(n.yard.stage).name })),
    market: {
      imports: balance(-1),
      exports: balance(1),
      dearToday: unusual(1),
      cheapToday: unusual(-1),
      note: "The station's market before any commander's own trades: other traders, events and supply chains included, the same for everyone. Dear and cheap are against the usual price here.",
    },
  };
}
