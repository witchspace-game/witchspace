// The flight log: the clips and photos the flight recorder kept, on this
// device (IndexedDB), never uploaded. It has a budget (BUDGET bytes, MAX
// moments): when full, the oldest moment you haven't marked Keep makes room,
// and unkept moments go by themselves after a week. Moments you keep stay
// until you delete them.

import type { MomentEvent } from './moments';

export const MAX = 60;
export const BUDGET = 150 * 1024 * 1024;
/** Unkept moments older than this are cleared. */
export const EXPIRES = 7 * 24 * 3600 * 1000;

export interface LoggedMoment {
  id: string;
  created: number;
  title: string;
  description: string;
  tags: string[];
  events: MomentEvent[];
  system: string;
  seconds: number;
  /** A clip (MP4), or a photo: one of the two. */
  video?: Blob;
  photo?: Blob;
  poster: Blob | null;
  /** Marked Keep: never cleared to make room. */
  saved: boolean;
  /** The kill cam's track (game/track.ts), gzipped: kept with a death, so the fight can be watched from outside. */
  track?: Blob;
  /** When the trip it was kept on began (the launch), so the log can show it trip by trip. */
  trip?: number;
}

export interface Trip {
  /** The launch (or, for moments from before trips were kept, the day). */
  start: number;
  moments: LoggedMoment[];
}

/** Moments, newest first, grouped by the trip they were kept on; older moments with no trip, by day. */
export function byTrip(moments: LoggedMoment[]): Trip[] {
  const trips = new Map<number, LoggedMoment[]>();
  for (const m of [...moments].sort((a, b) => b.created - a.created)) {
    const start = m.trip ?? new Date(m.created).setHours(0, 0, 0, 0);
    trips.set(start, [...(trips.get(start) ?? []), m]);
  }
  return [...trips].map(([start, ms]) => ({ start, moments: ms })).sort((a, b) => b.moments[0].created - a.moments[0].created);
}

export const momentBytes = (m: LoggedMoment) => (m.video?.size ?? 0) + (m.photo?.size ?? 0) + (m.poster?.size ?? 0) + (m.track?.size ?? 0);

/** Which moments to clear, oldest unkept first, so `incoming` more bytes (and one more moment) fit; null if they can't. */
export function makeRoom(all: LoggedMoment[], incoming: number, now: number): string[] | null {
  const gone = all.filter((m) => !m.saved && now - m.created > EXPIRES);
  const left = all.filter((m) => !gone.includes(m));
  const spare = left.filter((m) => !m.saved).sort((a, b) => a.created - b.created);
  let used = left.reduce((n, m) => n + momentBytes(m), 0) + incoming;
  let count = left.length + 1;
  while ((used > BUDGET || count > MAX) && spare.length) {
    const m = spare.shift()!;
    gone.push(m);
    used -= momentBytes(m);
    count--;
  }
  return used > BUDGET || count > MAX ? null : gone.map((m) => m.id);
}

const DB = 'witchspace-flight-log';
const STORE = 'moments';
let opening: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  opening ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'id' });
    req.onsuccess = () => {
      // A phone can drop the connection while the game's in the background: the next use opens a new one.
      req.result.onclose = () => (opening = null);
      resolve(req.result);
    };
    req.onerror = () => {
      opening = null;
      reject(req.error);
    };
  });
  return opening;
}

function once<T>(d: IDBDatabase, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    // Done when the transaction is, not the request: running out of space shows only as the transaction failing.
    tx.oncomplete = () => resolve(req.result);
    tx.onabort = () => reject(tx.error ?? req.error);
    tx.onerror = () => reject(tx.error ?? req.error);
  });
}

/** One try, and one more on a new connection: a connection the phone dropped fails however often it's used. */
async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  try {
    return await once(await db(), mode, fn);
  } catch {
    (await opening?.catch(() => null))?.close();
    opening = null;
    return once(await db(), mode, fn);
  }
}

async function readMoments(): Promise<LoggedMoment[]> {
  const all = await run<LoggedMoment[]>('readonly', (s) => s.getAll());
  const now = Date.now();
  const expired = all.filter((m) => !m.saved && now - m.created > EXPIRES);
  for (const m of expired) await deleteMoment(m.id);
  return all.filter((m) => !expired.includes(m)).sort((a, b) => b.created - a.created);
}

/** The last read failed: the log may not really be empty (Mark, 2 November 2026: an empty log, and told it was full). */
export let momentsUnreadable = false;

/** Newest first, with expired unkept moments cleared. */
export async function listMoments(): Promise<LoggedMoment[]> {
  try {
    const all = await readMoments();
    momentsUnreadable = false;
    return all;
  } catch {
    momentsUnreadable = true;
    return []; // private browsing, storage blocked: nothing to show
  }
}

/** Add a moment, making room if the log is full. `full` only when it really is; `failed` when the device wouldn't store it. */
export async function addMoment(m: LoggedMoment): Promise<'stored' | 'full' | 'failed'> {
  try {
    const room = makeRoom(await readMoments(), momentBytes(m), Date.now());
    if (!room) return 'full'; // everything is starred: no room
    for (const id of room) await deleteMoment(id);
    await run('readwrite', (s) => s.put(m));
    return 'stored';
  } catch {
    return 'failed';
  }
}

export async function setSaved(id: string, saved: boolean) {
  const m = await run<LoggedMoment | undefined>('readonly', (s) => s.get(id));
  if (m) await run('readwrite', (s) => s.put({ ...m, saved }));
}

/** Keep the kill cam's track with a moment (a death, once the explosion has played out). */
export async function attachTrack(id: string, track: Blob) {
  const m = await run<LoggedMoment | undefined>('readonly', (s) => s.get(id));
  if (m) await run('readwrite', (s) => s.put({ ...m, track }));
}

export async function deleteMoment(id: string) {
  await run('readwrite', (s) => s.delete(id));
}

/** Clear everything not marked Keep. */
export async function clearUnkept() {
  for (const m of await listMoments()) if (!m.saved) await deleteMoment(m.id);
}

export async function getMoment(id: string): Promise<LoggedMoment | undefined> {
  return run<LoggedMoment | undefined>('readonly', (s) => s.get(id));
}
