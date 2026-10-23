import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { systemAt } from '../galaxy/generate';
import { newCommander } from './commander';
import { board, SPECIAL_ORDER_PAY, wyWorks } from './contracts';
import { courierPoiOf, courierRumour, courierSystem, EXPLORER_DOORS, exploreOf, explorerRank, RANK_NEWS, rankReached, trailTip } from './explore';
import { equipmentForSale } from './law';
import { routeAround } from './surveyPilot';

const NOW = Date.UTC(2026, 9, 23, 12);
const explorer = (points: number) => {
  const c = newCommander('modern');
  exploreOf(c).points = points;
  return c;
};

describe("the explorer's road", () => {
  it('says what each door opens, on reaching it', () => {
    for (const points of Object.values(EXPLORER_DOORS)) expect(RANK_NEWS[explorerRank(points)]).toBeTruthy();
    expect(rankReached(99, 100)).toBe('Pathfinder');
    expect(rankReached(100, 120)).toBeNull();
  });

  it('sells the autopilots only to explorers of rank, and never the prototype', () => {
    const lave = systemAt(0, 7);
    const hiTech = [...Array(256).keys()].map((i) => systemAt(0, i)).find((s) => s.techLevel >= 10)!;
    const ids = (points: number) => equipmentForSale(explorer(points), hiTech).map((e) => e.id);
    expect(ids(0)).not.toContain('survey-autopilot');
    expect(ids(100)).toContain('survey-autopilot');
    expect(ids(100)).not.toContain('route-autopilot');
    expect(ids(600)).toContain('route-autopilot');
    expect(ids(5000)).not.toContain('wisp');
    expect(equipmentForSale(explorer(5000), lave).map((e) => e.id)).not.toContain('wisp');
  });

  it('gives Pathfinders special orders at Wexley-Yorozu stations, for Candidate systems at better pay', () => {
    const wy = [...Array(256).keys()].map((i) => systemAt(0, i)).filter(wyWorks);
    let seen = 0;
    for (const s of wy) {
      expect(board(explorer(0), s, NOW).some((o) => o.specialOrder)).toBe(false);
      const order = board(explorer(100), s, NOW).find((o) => o.specialOrder);
      if (!order) continue;
      seen++;
      expect(order.survey).toBe(true);
      expect(order.pay).toBeGreaterThan(120 * SPECIAL_ORDER_PAY - 1);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('tips Trailblazers off about the nearest trail not yet started', () => {
    const lave = systemAt(0, 7);
    expect(trailTip(explorer(249), lave)).toBeNull();
    const tip = trailTip(explorer(250), lave);
    expect(tip?.title).toBeTruthy();
  });

  it('hides the lost courier until you are a Trailblazer, and rumours it when near', () => {
    for (let g = 0; g < 8; g++) {
      const at = courierSystem(g);
      expect(courierPoiOf(explorer(249), at)).toBeNull();
      const poi = courierPoiOf(explorer(250), at)!;
      expect(poi.prize).toBe('wisp');
      expect(courierRumour(explorer(250), at)).toContain('this very system');
    }
    const c = explorer(250);
    c.equipment.push('wisp');
    expect(courierRumour(c, courierSystem(0))).toBeNull();
  });
});

describe('the survey autopilot', () => {
  const planet = { centre: new THREE.Vector3(), radius: 1000 };
  it('flies straight when the planet is not in the way', () => {
    const to = new THREE.Vector3(5000, 0, 0);
    expect(routeAround(new THREE.Vector3(5000, 5000, 0), to, planet)).toBe(to);
  });
  it('bends round the planet when it is', () => {
    const via = routeAround(new THREE.Vector3(-5000, 10, 0), new THREE.Vector3(5000, 0, 0), planet);
    expect(via.length()).toBeGreaterThan(1300);
  });
});
