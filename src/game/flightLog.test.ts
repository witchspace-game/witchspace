import { afterEach, describe, expect, it, vi } from 'vitest';
import { BUDGET, byTrip, EXPIRES, makeRoom, MAX, type LoggedMoment } from './flightLog';

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

describe('the log, trip by trip', () => {
  it('groups moments by the trip they were kept on, newest trip first, and older ones by day', () => {
    const a = { ...moment(1, 1), trip: now - 2 * 3600_000 };
    const b = { ...moment(1, 0.5), trip: now - 2 * 3600_000 };
    const c = { ...moment(1, 30), trip: now - 31 * 3600_000 };
    const old = moment(1, 100); // from before trips were kept
    const trips = byTrip([old, c, a, b]);
    expect(trips.map((t) => t.moments.map((m) => m.id))).toEqual([[b.id, a.id], [c.id], [old.id]]);
  });
});

describe('the flight log when the device misbehaves', () => {
  /** Just enough of IndexedDB: one store, connections that can be dropped, and writes that can be refused at commit. */
  function fakeIdb() {
    const rows = new Map<string, { id: string }>();
    const state = { dead: new Set<object>(), opens: 0, refuseWrites: false, refuseAll: false, latest: null as null | object };
    const later = (f: () => void) => setTimeout(f, 0);
    const open = () => {
      const req: Record<string, unknown> = {};
      state.opens++;
      const conn: Record<string, unknown> = {
        close() {},
        createObjectStore() {},
        transaction(_: string, mode: string) {
          if (state.refuseAll || state.dead.has(conn)) throw new Error('Connection to Indexed Database server lost');
          const tx: Record<string, unknown> = { error: null };
          const act = (result: () => unknown) => {
            const r: Record<string, unknown> = {};
            later(() => {
              if (mode === 'readwrite' && state.refuseWrites) {
                tx.error = new Error('QuotaExceededError');
                return (tx.onabort as () => void)();
              }
              r.result = result();
              (tx.oncomplete as () => void)();
            });
            return r;
          };
          tx.objectStore = () => ({
            getAll: () => act(() => [...rows.values()]),
            put: (m: { id: string }) => act(() => rows.set(m.id, m)),
            delete: (id: string) => act(() => rows.delete(id)),
            get: (id: string) => act(() => rows.get(id)),
          });
          return tx;
        },
      };
      state.latest = conn;
      later(() => {
        req.result = conn;
        (req.onsuccess as () => void)();
      });
      return req;
    };
    return { api: { open }, rows, state };
  }
  const moment = (id: string) => ({ id, created: Date.now(), title: id, description: '', tags: [], events: [], system: 'Lave', seconds: 0, photo: new Blob(['x']), poster: null, saved: false }) as LoggedMoment;

  /** A fresh copy of the module, so each test opens its own connection. */
  async function fresh() {
    vi.resetModules();
    const fake = fakeIdb();
    vi.stubGlobal('indexedDB', fake.api);
    return { fake, log: await import('./flightLog') };
  }
  afterEach(() => vi.unstubAllGlobals());

  it('stores and lists a moment', async () => {
    const { log } = await fresh();
    expect(await log.addMoment(moment('a'))).toBe('stored');
    expect((await log.listMoments()).map((m) => m.id)).toEqual(['a']);
    expect(log.momentsUnreadable).toBe(false);
  });

  it('opens a new connection when the phone has dropped the old one, and nothing is lost', async () => {
    const { fake, log } = await fresh();
    await log.addMoment(moment('a'));
    fake.state.dead.add(fake.state.latest!);
    expect((await log.listMoments()).map((m) => m.id)).toEqual(['a']);
    expect(await log.addMoment(moment('b'))).toBe('stored');
    expect(fake.state.opens).toBe(2);
    expect(log.momentsUnreadable).toBe(false);
  });

  it('says failed, not full, when the device refuses to store, and unreadable, not empty', async () => {
    const { fake, log } = await fresh();
    await log.addMoment(moment('a'));
    fake.state.refuseAll = true;
    expect(await log.addMoment(moment('b'))).toBe('failed');
    expect(await log.listMoments()).toEqual([]);
    expect(log.momentsUnreadable).toBe(true);
    fake.state.refuseAll = false;
    expect((await log.listMoments()).map((m) => m.id)).toEqual(['a']);
    expect(log.momentsUnreadable).toBe(false);
  });

  it('counts a write as failed when it fails at commit, as running out of space does', async () => {
    const { fake, log } = await fresh();
    fake.state.refuseWrites = true;
    expect(await log.addMoment(moment('a'))).toBe('failed');
    expect(fake.rows.size).toBe(0);
  });

  it('says full only when every moment is starred and there is no room', async () => {
    const { log } = await fresh();
    for (let i = 0; i < log.MAX; i++) expect(await log.addMoment({ ...moment(`m${i}`), saved: true })).toBe('stored');
    expect(await log.addMoment(moment('over'))).toBe('full');
  });
});
