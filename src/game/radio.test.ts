import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { activeEvent, newsArrives } from '../economy/events';
import { withinJumps } from './contracts';
import { newCommander, rollEquipmentDamage, rollFragileDamage } from './commander';
import { beacon, BEACON_GAP, distressReward, FALSE_MEMORY, hailReply, newBeacon, newsInReach, pirateAnswer, tollFor, type BeaconFacts, type HailContext } from './radio';

const lave = systemAt(0, 7);
const ctx = (k: number, more: Partial<HailContext> = {}): HailContext => ({ system: lave, k, status: 'clean', ...more });

describe('hailing', () => {
  it('answers the same way for the same ship and minute', () => {
    expect(hailReply('trader', ctx(4))).toEqual(hailReply('trader', ctx(4)));
    const lines = new Set(Array.from({ length: 40 }, (_, k) => hailReply('police', ctx(k)).text));
    expect(lines.size).toBeGreaterThan(2);
  });

  it('knows your record and whether you are dark', () => {
    expect(hailReply('police', ctx(1, { status: 'fugitive' })).text).toMatch(/surrender/i);
    expect(hailReply('station', ctx(1, { dark: true })).text).toMatch(/transponder/);
    expect(hailReply('station', ctx(1, { dark: true, lawless: true })).text).not.toMatch(/transponder/);
    expect(hailReply('trader', ctx(1, { wronged: true })).text).toMatch(/police|Murderer|logged/);
  });

  it('pirates mostly threaten, and now and then name a price you can pay', () => {
    const answers = Array.from({ length: 200 }, (_, k) => pirateAnswer(ctx(k), 2000, 10_000));
    const deals = answers.filter((a) => a.toll);
    expect(deals.length).toBeGreaterThan(5);
    expect(deals.length).toBeLessThan(80);
    for (const d of deals) expect(d.toll).toBe(tollFor(2000));
    // Never more than you have.
    expect(Array.from({ length: 200 }, (_, k) => pirateAnswer(ctx(k), 2000, 10)).some((a) => a.toll)).toBe(false);
  });
});

describe('distress calls', () => {
  it('pay a little, and the Carriers’ Mutual remembers more', () => {
    expect(distressReward(2, 'hexon')).toEqual({ credits: 140, standing: 1 });
    expect(distressReward(2, 'mutual').standing).toBe(2);
    expect(distressReward(2, 'mutual').credits).toBeGreaterThan(140);
    expect(distressReward(1).standing).toBe(0);
  });
});

describe('news at range', () => {
  it('hears events a jump or two out before the station does', () => {
    // Find a time and place where an event nearby hasn't reached Lave's news yet.
    const near = withinJumps(lave, 2);
    let found = 0;
    for (let h = 0; h < 24 * 30 && !found; h++) {
      const t = Date.UTC(2026, 9, 1) + h * 3600_000;
      for (const n of newsInReach(lave, t)) {
        found++;
        expect(near.some((x) => x.s === n.where)).toBe(true);
        expect(activeEvent(n.where, t)).not.toBeNull();
        expect(newsArrives(n.where, lave, n.event.start)).toBeGreaterThan(t);
        expect(n.line).toMatch(/jumps?/);
      }
    }
    expect(found).toBeGreaterThan(0);
  });
});

describe('the emergency beacon', () => {
  const facts = (f: Partial<BeaconFacts> = {}): BeaconFacts => ({ lawful: true, hostilesNear: true, hull: 1, fuel: 7, nearestLy: 3, canDock: true, system: '0:7', ...f });

  it('brings the police to a real Mayday where there is law', () => {
    expect(beacon(newBeacon(), 'mayday', 0, facts())).toEqual({ kind: 'police' });
    expect(beacon(newBeacon(), 'mayday', 0, facts({ lawful: false }))).toEqual({ kind: 'unanswered' });
  });

  it('is rate-limited', () => {
    const b = newBeacon();
    beacon(b, 'escort', 0, facts());
    expect(beacon(b, 'escort', 3, facts()).kind).toBe('wait');
    expect(beacon(b, 'escort', BEACON_GAP, facts()).kind).toBe('escort');
  });

  it('forgives one false alarm, not two in ten minutes', () => {
    const b = newBeacon();
    const quiet = facts({ hostilesNear: false });
    expect(beacon(b, 'mayday', 0, quiet)).toEqual({ kind: 'false', offence: false });
    expect(beacon(b, 'mayday', 100, quiet)).toEqual({ kind: 'false', offence: true });
    const later = newBeacon();
    beacon(later, 'mayday', 0, quiet);
    expect(beacon(later, 'mayday', FALSE_MEMORY + 1, quiet)).toEqual({ kind: 'false', offence: false });
    // Lawless systems don't care: nobody comes, nobody minds.
    expect(beacon(newBeacon(), 'mayday', 0, facts({ hostilesNear: false, lawful: false })).kind).toBe('unanswered');
  });

  it('hull failing means a hurt hull', () => {
    expect(beacon(newBeacon(), 'hull', 0, facts({ hostilesNear: false, hull: 0.3 })).kind).toBe('escort');
    expect(beacon(newBeacon(), 'hull', 0, facts({ hostilesNear: false, hull: 0.9 })).kind).toBe('false');
  });

  it('out of fuel: a tender only when you can neither jump nor dock, once a system', () => {
    expect(beacon(newBeacon(), 'fuel', 0, facts()).kind).toBe('fuel-ok');
    expect(beacon(newBeacon(), 'fuel', 0, facts({ fuel: 1 })).kind).toBe('dock-for-fuel');
    const b = newBeacon();
    const stuck = facts({ fuel: 1, canDock: false });
    const t = beacon(b, 'fuel', 0, stuck);
    expect(t.kind).toBe('tender');
    if (t.kind === 'tender') {
      expect(1 + t.ly).toBeGreaterThanOrEqual(3);
      expect(t.cost).toBeGreaterThan(0);
    }
    expect(beacon(b, 'fuel', 100, stuck).kind).toBe('tendered');
  });
});

describe('the comms array', () => {
  it('is fragile: a hull hit can take it out even on a sound hull', () => {
    const c = newCommander('modern');
    c.equipment.push('comms-array');
    expect(rollFragileDamage(c, () => 0.99)).toBeNull();
    expect(rollFragileDamage(c, () => 0)?.id).toBe('comms-array');
    expect(c.damaged).toContain('comms-array');
    expect(rollFragileDamage(c, () => 0)).toBeNull(); // already down
    const classic = newCommander('classic');
    classic.equipment.push('comms-array');
    expect(rollFragileDamage(classic, () => 0)).toBeNull();
  });

  it('pirates aim for it', () => {
    const c = newCommander('modern');
    c.equipment.push('ecm', 'fuel-scoops', 'comms-array');
    // The second roll decides whether the aimed-for kit is the one hit.
    const rolls = [0, 0.1, 0.9];
    let i = 0;
    expect(rollEquipmentDamage(c, () => rolls[i++], 'comms-array')?.id).toBe('comms-array');
  });
});
