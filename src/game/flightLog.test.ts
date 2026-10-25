import { describe, expect, it } from 'vitest';
import { BUDGET, EXPIRES, makeRoom, MAX, type LoggedMoment } from './flightLog';

const MB = 1024 * 1024;
const now = Date.UTC(2026, 9, 25, 12);
let n = 0;
const moment = (mb: number, ageHours: number, saved = false): LoggedMoment => ({
  id: `m${n++}`,
  created: now - ageHours * 3600_000,
  title: '',
  description: '',
  tags: [],
  events: [],
  system: 'Lave',
  seconds: 20,
  video: new Blob([new Uint8Array(mb * MB)]),
  poster: null,
  saved,
});

describe('the flight log budget', () => {
  it('fits without clearing anything when there is room', () => {
    expect(makeRoom([moment(5, 1), moment(5, 2)], 5 * MB, now)).toEqual([]);
  });

  it('clears the oldest unkept moments to stay within the budget, never kept ones', () => {
    const kept = moment(60, 100, true);
    const oldest = moment(40, 90);
    const old = moment(40, 80);
    const recent = moment(5, 1);
    expect(makeRoom([recent, old, oldest, kept], 10 * MB, now)).toEqual([oldest.id]);
    expect(BUDGET).toBe(150 * MB);
  });

  it('clears unkept moments after a week, but keeps kept ones', () => {
    const stale = moment(1, EXPIRES / 3600_000 + 1);
    const keptStale = moment(1, EXPIRES / 3600_000 + 1, true);
    expect(makeRoom([stale, keptStale], MB, now)).toEqual([stale.id]);
  });

  it('refuses when everything left is kept', () => {
    expect(makeRoom([moment(149, 1, true)], 5 * MB, now)).toBeNull();
    expect(makeRoom(Array.from({ length: MAX }, () => moment(0, 1, true)), 0, now)).toBeNull();
  });
});
