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
    expect(rankReached(EXPLORER_DOORS.pathfinder - 1, EXPLORER_DOORS.pathfinder)).toBe('Pathfinder');
    expect(rankReached(EXPLORER_DOORS.pathfinder, EXPLORER_DOORS.pathfinder + 20)).toBeNull();
    expect(explorerRank(EXPLORER_DOORS.voyager)).toBe('Voyager');
  });

  it('sells the autopilots only to explorers of rank, and never the prototype', () => {
    const lave = systemAt(0, 7);
    const hiTech = [...Array(256).keys()].map((i) => systemAt(0, i)).find((s) => s.techLevel >= 10)!;
    const ids = (points: number) => equipmentForSale(explorer(points), hiTech).map((e) => e.id);
    expect(ids(0)).not.toContain('survey-autopilot');
    expect(ids(EXPLORER_DOORS.pathfinder - 1)).not.toContain('survey-autopilot');
    expect(ids(EXPLORER_DOORS.pathfinder)).toContain('survey-autopilot');
    expect(ids(EXPLORER_DOORS.trailblazer)).not.toContain('route-autopilot');
    expect(ids(EXPLORER_DOORS.pioneer)).toContain('route-autopilot');
    expect(ids(EXPLORER_DOORS.voyager)).not.toContain('wisp');
    expect(equipmentForSale(explorer(EXPLORER_DOORS.voyager), lave).map((e) => e.id)).not.toContain('wisp');
  });

  it('gives Pathfinders special orders at Wexley-Yorozu stations, for Candidate systems at better pay', () => {
    const wy = [...Array(256).keys()].map((i) => systemAt(0, i)).filter(wyWorks);
    let seen = 0;
    for (const s of wy) {
      expect(board(explorer(0), s, NOW).some((o) => o.specialOrder)).toBe(false);
      const order = board(explorer(EXPLORER_DOORS.pathfinder), s, NOW).find((o) => o.specialOrder);
      if (!order) continue;
      seen++;
      expect(order.survey).toBe(true);
      expect(order.pay).toBeGreaterThan(120 * SPECIAL_ORDER_PAY - 1);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('tips Trailblazers off about the nearest trail not yet started', () => {
    const lave = systemAt(0, 7);
    expect(trailTip(explorer(EXPLORER_DOORS.trailblazer - 1), lave)).toBeNull();
    const tip = trailTip(explorer(EXPLORER_DOORS.trailblazer), lave);
    expect(tip?.title).toBeTruthy();
  });

  it('hides the lost courier until you are a Pioneer, and rumours it when near', () => {
    const pioneer = EXPLORER_DOORS.pioneer;
    for (let g = 0; g < 8; g++) {
      const at = courierSystem(g);
      expect(courierPoiOf(explorer(pioneer - 1), at)).toBeNull();
      const poi = courierPoiOf(explorer(pioneer), at)!;
      expect(poi.prize).toBe('wisp');
      expect(courierRumour(explorer(pioneer), at)).toContain('this very system');
    }
    const c = explorer(pioneer);
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
