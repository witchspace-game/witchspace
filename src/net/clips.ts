// Clip pages (docs/design/flight-recorder.md, "Clip pages"): share a moment's
// flight track so a link replays it, and the page's hearts and reports. The
// track only: never the video. Talks to the game's server (server/src/clips.ts).

import { API, sessionToken } from './account';

/** This browser's own id for hearts, the same one the ideas board uses: random, kept locally. */
/** 32 hex characters: crypto.randomUUID is Safari 15.4+, and an older one broke hearts and sharing. */
const freshId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

function voterId(): string {
  try {
    let id = localStorage.getItem('witchspace.voter');
    if (!id) {
      id = freshId();
      localStorage.setItem('witchspace.voter', id);
    }
    return id;
  } catch {
    return freshId();
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
  /** The video the sharer shared (their cockpit clip, an upright cut or a reconstruction), if it went up. */
  video: { url: string; upright: boolean } | null;
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
export async function shareTrack(moment: string, track: Blob, seconds: number, kills = 0): Promise<{ url: string; title: string } | { error: string }> {
  const session = sessionToken();
  const res = await fetch(`${API}/clips?seconds=${Math.round(seconds)}&kills=${kills}`, {
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

/** A clip you put up: from this browser, or your account on any device. */
export interface MyClip {
  id: string;
  url: string;
  title: string;
  system: string;
  created: number;
  hearts: number;
  /** On the site; false once you've taken it down. */
  up: boolean;
  /** Whether it has its own card for link previews yet (putCard). */
  card?: boolean;
  /** Whether its video is up yet (putVideo). */
  video?: boolean;
  /** Its card's picture, for a thumbnail on any device (the moment itself may be on another). */
  image?: string | null;
}

const mineHeaders = () => {
  const session = sessionToken();
  return headers(session ? { Authorization: `Bearer ${session}` } : {});
};

/** Your clips on witchspace.org.uk, newest first; null if the server couldn't be reached. */
export async function myClips(): Promise<MyClip[] | null> {
  const res = await fetch(`${API}/clips/mine`, { headers: mineHeaders() }).catch(() => null);
  if (!res?.ok) return null;
  return ((await res.json()) as { clips: MyClip[] }).clips;
}

/** Take one of your clips down (gone from its page and the live feed), or put it back up. */
export async function takeDownClip(id: string, down = true): Promise<{ ok: true } | { error: string }> {
  const res = await fetch(`${API}/clips/${id}/${down ? 'takedown' : 'putback'}`, { method: 'POST', headers: mineHeaders() }).catch(() => null);
  const out = (await res?.json().catch(() => null)) as { error?: string } | null;
  return res?.ok ? { ok: true } : { error: out?.error ?? "Couldn't reach witchspace.org.uk" };
}

/** Put up a clip's card for link previews (ui/clipCard.ts): yours only, by account or this browser. */
export async function putCard(id: string, jpeg: Blob): Promise<boolean> {
  const res = await fetch(`${API}/clips/${id}/card`, { method: 'POST', headers: { ...mineHeaders(), 'Content-Type': 'image/jpeg' }, body: jpeg }).catch(() => null);
  return Boolean(res?.ok);
}

/** Put up the video the sharer is sharing, beside the clip (theirs only); `kills` is the game's count, for its title. */
export async function putVideo(id: string, video: Blob, upright: boolean, kills: number): Promise<boolean> {
  const res = await fetch(`${API}/clips/${id}/video?upright=${upright ? 1 : 0}&kills=${kills}`, { method: 'POST', headers: { ...mineHeaders(), 'Content-Type': 'video/mp4' }, body: video }).catch(() => null);
  return Boolean(res?.ok);
}

/** A clip's id, from its link. */
export const clipIdOf = (url: string) => url.match(/\/clip\/([a-z0-9]{8,12})/)?.[1] ?? null;
