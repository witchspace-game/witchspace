// Your account, in the browser: sign in with an email link, keep your
// callsign, and sync your commander to the cloud so any device can carry on.
// The server side is server/src/accounts.ts. Signing in is optional: the game
// works as before without it.

import type { Commander } from '../game/commander';

export const API: string = import.meta.env.VITE_SPACE_HTTP ?? (import.meta.env.DEV ? 'http://127.0.0.1:8787' : 'https://space.witchspace.org.uk');

const SESSION_KEY = 'witchspace.session';
const SYNC_KEY = 'witchspace.syncedAt'; // the server's version of the save this device last had
const SAVE_DELAY = 3000; // ms: saves are gathered up and sent a few seconds after the last change

export interface Account {
  id: string;
  email: string;
  callsign: string | null;
}

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string | null) => {
    try {
      if (v === null) localStorage.removeItem(k);
      else localStorage.setItem(k, v);
    } catch {
      // Storage blocked: signed in for this visit only.
    }
  },
};

let session = store.get(SESSION_KEY);
let account: Account | null = null;
let saveTimer = 0;
let pending: Commander | null = null;

export const signedIn = () => Boolean(session && account);
export const currentAccount = () => account;
/** The session token, for shared space to prove who you are. */
export const sessionToken = () => session ?? undefined;

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(session ? { Authorization: `Bearer ${session}` } : {}), ...(init.headers ?? {}) },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.status === 401 && session) forget();
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Something went wrong'), { status: res.status, data });
  return data;
}

function forget() {
  session = null;
  account = null;
  store.set(SESSION_KEY, null);
  store.set(SYNC_KEY, null);
}

/** Ask for a sign-in link. In local development the link comes back instead of an email. */
export function requestLink(email: string, turnstile: string) {
  return call<{ sent: boolean; devLink?: string }>('/auth/request', { method: 'POST', body: JSON.stringify({ email, turnstile }) });
}

/** If the page was opened from a sign-in link, finish signing in. Returns the account, or null. */
export async function completeSignInFromUrl(): Promise<Account | null> {
  const url = new URL(location.href);
  const token = url.searchParams.get('signin');
  if (!token) return null;
  // Take the token out of the address bar straight away: it works once, and shouldn't be shared.
  url.searchParams.delete('signin');
  history.replaceState(null, '', url.pathname + url.search + url.hash);
  const r = await call<{ session: string; account: Account }>('/auth/verify', { method: 'POST', body: JSON.stringify({ token }) });
  session = r.session;
  account = r.account;
  store.set(SESSION_KEY, session);
  store.set(SYNC_KEY, null); // a new device: nothing synced yet
  return account;
}

/** On start: if we have a session, who is it? Null if signed out or the session has ended. */
export async function refresh(): Promise<{ account: Account; saveUpdated: number | null } | null> {
  if (!session) return null;
  try {
    const r = await call<{ account: Account; saveUpdated: number | null }>('/me');
    account = r.account;
    return r;
  } catch {
    return null;
  }
}

export async function setCallsign(callsign: string): Promise<string> {
  const r = await call<{ callsign: string }>('/me/callsign', { method: 'POST', body: JSON.stringify({ callsign }) });
  if (account) account.callsign = r.callsign;
  return r.callsign;
}

export async function signOut() {
  try {
    await call('/auth/signout', { method: 'POST', body: '{}' });
  } finally {
    forget();
  }
}

export async function deleteAccount() {
  await call('/me', { method: 'DELETE' });
  forget();
}

// --- The cloud save --------------------------------------------------------------

export const syncedAt = () => Number(store.get(SYNC_KEY)) || null;

export async function fetchSave(): Promise<{ data: Commander | null; updated: number | null }> {
  return call('/me/save');
}

/** Send a save now. A conflict means another device saved since we last synced. */
export async function pushSave(c: Commander): Promise<'saved' | 'conflict'> {
  try {
    const base = syncedAt();
    const r = await call<{ updated: number }>('/me/save', { method: 'PUT', body: JSON.stringify({ data: c, updated: Date.now(), ...(base ? { base } : {}) }) });
    store.set(SYNC_KEY, String(r.updated));
    return 'saved';
  } catch (e) {
    if ((e as { status?: number }).status === 409) return 'conflict';
    throw e;
  }
}

/** Remember that this device now has the server's save from `updated`. */
export const markSynced = (updated: number | null) => store.set(SYNC_KEY, updated ? String(updated) : null);

/** Called on every local save: send it to the cloud a few seconds after things settle. */
export function queueSave(c: Commander, onConflict: () => void) {
  if (!signedIn()) return;
  pending = c;
  clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    const c = pending;
    pending = null;
    if (!c) return;
    try {
      if ((await pushSave(c)) === 'conflict') onConflict();
    } catch {
      // Offline or the server's busy: the next save will try again.
    }
  }, SAVE_DELAY);
}
