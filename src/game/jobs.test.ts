import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander } from './commander';
import { board, destinationOf, nextHop, take, type ActiveContract } from './contracts';
import { byUrgency, jobStrip, routeWork, stepFor } from './jobs';

const lave = systemAt(0, 7);
const NOW = Date.UTC(2026, 9, 22, 12);

function withDelivery() {
  const c = newCommander('modern');
  const o = board(c, lave, NOW).find((x) => x.needs === 'Casual' && !x.survey)!;
  expect(take(c, o, 20)).toBeNull();
  return { c, a: c.contracts![0], to: destinationOf(o) };
}

describe('the job strip', () => {
  it('says nothing without a contract', () => {
    expect(jobStrip(newCommander('modern'), lave)).toBeNull();
  });

  it('names the job, the deadline and the company, and the next hop', () => {
    const { c, a, to } = withDelivery();
    const strip = jobStrip(c, lave)!;
    expect(strip.step.line).toContain(`→ ${to.name}`);
    expect(strip.step.line).toMatch(/jumps? left/);
    const hop = nextHop(lave, to)!;
    c.target = null;
    expect(stepFor(c, lave, a)).toMatchObject({ action: 'course', hop });
    c.target = hop.index;
    expect(stepFor(c, lave, a).next).toContain(`Hyperspace to ${hop.name}`);
  });

  it('says dock once you are there', () => {
    const { c, a, to } = withDelivery();
    expect(stepFor(c, to, a)).toMatchObject({ action: 'dock' });
  });

  it('asks for fuel when the tank will not reach', () => {
    const { c, a } = withDelivery();
    c.fuel = 0;
    expect(stepFor(c, lave, a).next).toMatch(/^Refuel first/);
  });

  it('puts the late and the last jump first', () => {
    const a = { jumpsLeft: 3 } as ActiveContract;
    const b = { jumpsLeft: -1 } as ActiveContract;
    const d = { jumpsLeft: 0 } as ActiveContract;
    expect(byUrgency([a, b, d])).toEqual([b, d, a]);
  });
});

describe('work on your route', () => {
  it('only while you hold a delivery', () => {
    expect(routeWork(newCommander('modern'), lave, board(newCommander('modern'), lave, NOW), 20)).toBeNull();
  });

  it('offers only work that goes your way and that you can take', () => {
    const { c, to } = withDelivery();
    // Look for fitting work at the next hop's board over a day of boards: there's usually some.
    const hop = nextHop(lave, to) ?? to;
    let found = 0;
    for (let h = 0; h < 48; h++) {
      const offers = board(c, hop, NOW + h * 30 * 60_000);
      const fit = routeWork(c, hop, offers, 20);
      if (!fit) continue;
      found++;
      expect(fit.offer.survey).toBeFalsy();
      expect(offers).toContain(fit.offer);
      // The radio and the website say how long it's up, from the same times.
      expect(fit.offer.posted).toBeTypeOf('number');
      expect(fit.offer.until).toBeGreaterThan(NOW + h * 30 * 60_000);
      expect(fit.why).toMatch(/same drop|one jump past|on your way/);
    }
    expect(found).toBeGreaterThan(0);
  });
});
