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
}

export const momentBytes = (m: LoggedMoment) => (m.video?.size ?? 0) + (m.photo?.size ?? 0) + (m.poster?.size ?? 0);

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
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return opening;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Newest first, with expired unkept moments cleared. */
export async function listMoments(): Promise<LoggedMoment[]> {
  try {
    const all = await run<LoggedMoment[]>('readonly', (s) => s.getAll());
    const now = Date.now();
    const expired = all.filter((m) => !m.saved && now - m.created > EXPIRES);
    for (const m of expired) await deleteMoment(m.id);
    return all.filter((m) => !expired.includes(m)).sort((a, b) => b.created - a.created);
  } catch {
    return []; // private browsing, storage blocked: the log is just empty
  }
}

/** Add a moment, making room if the log is full. Returns false if it couldn't be stored. */
export async function addMoment(m: LoggedMoment): Promise<boolean> {
  try {
    await db();
    const room = makeRoom(await listMoments(), momentBytes(m), Date.now());
    if (!room) return false; // everything is kept: no room
    for (const id of room) await deleteMoment(id);
    await run('readwrite', (s) => s.put(m));
    return true;
  } catch {
    return false;
  }
}

export async function setSaved(id: string, saved: boolean) {
  const m = await run<LoggedMoment | undefined>('readonly', (s) => s.get(id));
  if (m) await run('readwrite', (s) => s.put({ ...m, saved }));
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
