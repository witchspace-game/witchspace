// Clip pages (docs/design/flight-recorder.md, "Clip pages"): share a moment's
// flight track so a link replays it, and the page's hearts and reports. The
// track only: never the video. Talks to the game's server (server/src/clips.ts).

import { API, sessionToken } from './account';

/** This browser's own id for hearts, the same one the ideas board uses: random, kept locally. */
function voterId(): string {
  try {
    let id = localStorage.getItem('witchspace.voter');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('witchspace.voter', id);
    }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
const headers = (extra: Record<string, string> = {}) => ({ 'X-Voter': voterId(), ...extra });

export interface SharedClip {
  id: string;
  title: string;
  system: string;
  seconds: number;
  hearts: number;
  mine: boolean;
  /** The track, gzipped (ready for readTrack). */
  track: Blob;
}

// Clips already shared from this browser, by moment, so sharing again reuses the link.
const SHARED_KEY = 'witchspace.shared-clips';
const sharedLinks = (): Record<string, string> => {
  try {
    return JSON.parse(localStorage.getItem(SHARED_KEY) ?? '{}');
  } catch {
    return {};
  }
};
export const sharedLink = (moment: string): string | null => sharedLinks()[moment] ?? null;

/** Share a moment's track. Resolves with the clip's link and title, or the reason it couldn't. */
export async function shareTrack(moment: string, track: Blob, seconds: number): Promise<{ url: string; title: string } | { error: string }> {
  const session = sessionToken();
  const res = await fetch(`${API}/clips?seconds=${Math.round(seconds)}`, {
    method: 'POST',
    headers: headers({ 'Content-Type': 'application/octet-stream', ...(session ? { Authorization: `Bearer ${session}` } : {}) }),
    body: track,
  }).catch(() => null);
  const out = (await res?.json().catch(() => null)) as { url?: string; title?: string; error?: string } | null;
  if (!res?.ok || !out?.url) return { error: out?.error ?? "Couldn't reach witchspace.org.uk" };
  try {
    localStorage.setItem(SHARED_KEY, JSON.stringify({ ...sharedLinks(), [moment]: out.url }));
  } catch {
    /* not remembered: sharing again makes a new link */
  }
  return { url: out.url, title: out.title ?? '' };
}

export async function getClip(id: string): Promise<SharedClip | null> {
  const res = await fetch(`${API}/clips/${id}`, { headers: headers() }).catch(() => null);
  if (!res?.ok) return null;
  const c = (await res.json()) as Omit<SharedClip, 'track'> & { track: string };
  const bytes = Uint8Array.from(atob(c.track), (ch) => ch.charCodeAt(0));
  return { ...c, track: new Blob([bytes]) };
}

export async function heartClip(id: string, on: boolean): Promise<{ hearts: number; mine: boolean } | null> {
  const res = await fetch(`${API}/clips/${id}/heart`, { method: 'POST', headers: headers({ 'Content-Type': 'application/json' }), body: JSON.stringify({ on }) }).catch(() => null);
  return res?.ok ? ((await res.json()) as { hearts: number; mine: boolean }) : null;
}

export async function reportClip(id: string): Promise<boolean> {
  const res = await fetch(`${API}/clips/${id}/report`, { method: 'POST', headers: headers() }).catch(() => null);
  return Boolean(res?.ok);
}
