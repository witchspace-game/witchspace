// The flight log: the moments the flight recorder kept, on this device
// (IndexedDB), never uploaded. Up to MAX; when full, the oldest moment you
// haven't marked Keep makes room. Moments you keep stay until you delete them.

import type { MomentEvent } from './moments';

export const MAX = 20;

export interface LoggedMoment {
  id: string;
  created: number;
  title: string;
  description: string;
  tags: string[];
  events: MomentEvent[];
  system: string;
  seconds: number;
  video: Blob;
  poster: Blob | null;
  /** Marked Keep: never pushed out to make room. */
  saved: boolean;
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

/** Newest first. */
export async function listMoments(): Promise<LoggedMoment[]> {
  try {
    const all = await run<LoggedMoment[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.created - a.created);
  } catch {
    return []; // private browsing, storage blocked: the log is just empty
  }
}

/** Add a moment, making room if the log is full. Returns false if it couldn't be stored. */
export async function addMoment(m: LoggedMoment): Promise<boolean> {
  try {
    const all = await listMoments();
    const spare = all.filter((x) => !x.saved).sort((a, b) => a.created - b.created);
    for (let over = all.length + 1 - MAX; over > 0 && spare.length; over--) await deleteMoment(spare.shift()!.id);
    if (all.length + 1 - MAX > 0 && !spare.length && all.filter((x) => x.saved).length >= MAX) return false; // all kept: no room
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

export async function getMoment(id: string): Promise<LoggedMoment | undefined> {
  return run<LoggedMoment | undefined>('readonly', (s) => s.get(id));
}
