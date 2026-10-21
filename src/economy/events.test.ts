import { describe, expect, it } from 'vitest';
import { distanceLy, galaxy } from '../galaxy/generate';
import { activeEvent, eventShare, eventsAt, EVENT_KINDS, newsArrives, newsAt } from './events';
import { freshMarket, priceAt } from './market';

const NOW = 1_800_000_000_000;
const DAY = 24 * 3600_000;
const systems = galaxy(0);

describe('world events', () => {
  it('happen now and then, the same for everyone', () => {
    let active = 0;
    let samples = 0;
    for (const s of systems.slice(0, 80)) {
      for (let t = NOW; t < NOW + 10 * DAY; t += 3 * 3600_000) {
        samples++;
        if (activeEvent(s, t)) active++;
      }
    }
    expect(active / samples).toBeGreaterThan(0.04);
    expect(active / samples).toBeLessThan(0.2);
    expect(eventsAt(systems[7], NOW, NOW + 10 * DAY)).toEqual(eventsAt(systems[7], NOW, NOW + 10 * DAY));
  });

  it('move the market: a famine makes food scarce and dear', () => {
    let found = false;
    for (const s of systems) {
      const famine = eventsAt(s, NOW, NOW + 30 * DAY).find((e) => e.type === 'famine' && e.end - e.start > 3 * 3600_000);
      if (!famine) continue;
      const mid = (famine.start + famine.end) / 2;
      expect(eventShare(s, 'food', mid, false)).toBeLessThanOrEqual(EVENT_KINDS.famine.effects.food * 0.99);
      const state = freshMarket(s, mid);
      expect(priceAt(s, state, 'food', mid)).toBeGreaterThan(priceAt(s, state, 'food', famine.start - 3600_000) * 1.2);
      found = true;
      break;
    }
    expect(found).toBe(true);
  });

  it('send news at the speed of ships: nearer worlds hear sooner', () => {
    const here = systems[7];
    const near = systems.filter((s) => s !== here).sort((a, b) => distanceLy(here, a) - distanceLy(here, b));
    expect(newsArrives(near[0], here, NOW)).toBeLessThan(newsArrives(near[10], here, NOW));
    expect(newsArrives(here, here, NOW)).toBe(NOW);
  });

  it('only report news that has arrived', () => {
    const here = systems[7];
    for (const n of newsAt(here, NOW + 3 * DAY)) expect(n.heard).toBeLessThanOrEqual(NOW + 3 * DAY);
  });

  it('echo news of a shortage nearby: traders start buying what is wanted, after they hear', () => {
    for (const s of systems.slice(0, 120)) {
      const e = eventsAt(s, NOW, NOW + 20 * DAY).find((x) => x.type === 'famine' && x.end - x.start > 5 * 3600_000);
      if (!e) continue;
      const neighbour = systems.find((n) => n !== s && distanceLy(n, s) < 6 && !activeEvent(n, e.start + 4 * 3600_000));
      if (!neighbour) continue;
      const heard = newsArrives(s, neighbour, e.start);
      if (heard + 1800_000 > e.end) continue;
      expect(eventShare(neighbour, 'food', heard - 60_000, false)).toBeGreaterThanOrEqual(eventShare(neighbour, 'food', heard + 1800_000, false));
      expect(eventShare(neighbour, 'food', heard + 1800_000, false)).toBeLessThan(0);
      return;
    }
    throw new Error('no famine with a neighbour found');
  });
});
