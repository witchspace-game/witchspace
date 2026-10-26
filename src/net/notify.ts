// Letting the trading companies contact you: phone and desktop notifications
// (Web Push, via public/sw.js) and email. Both are opt-in and in character;
// the server side is in server/src/accounts.ts and contact.ts.

import { getContact as fetchContact, setContact, type Contact } from './account';

export const isIos = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes('Macintosh') && navigator.maxTouchPoints > 1);
const standalone = () =>
  (navigator as Navigator & { standalone?: boolean }).standalone === true || matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches;

/** Can this browser show our notifications? On iPhone, only from the Home Screen app. */
export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
export const needsHomeScreen = () => isIos && !standalone();

const fromBase64Url = (s: string) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4));
  return Uint8Array.from(b, (ch) => ch.charCodeAt(0));
};

async function registration() {
  return navigator.serviceWorker.register('/sw.js');
}

// Every device you switch on gets the notifications (Mark): each is known to the
// server by its push address, and switching one off leaves the others alone.

/** This device's push address, if it has one. */
async function subscription() {
  if (!pushSupported()) return null;
  const reg = await navigator.serviceWorker.getRegistration('/sw.js');
  return (await reg?.pushManager.getSubscription()) ?? null;
}

async function sha256(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** How you can be reached, with `push` meaning this device. */
export async function getContact() {
  const sub = await subscription().catch(() => null);
  return fetchContact(sub ? await sha256(sub.endpoint) : 'none');
}

/** Ask permission and subscribe this device. Throws with a reason the player can read. */
export async function enablePush(): Promise<Contact> {
  if (!pushSupported()) throw new Error(needsHomeScreen() ? 'On iPhone, add Witchspace to your Home Screen first, then switch this on there' : 'This browser can’t show notifications');
  const { key } = await getContact();
  if (!key) throw new Error('Notifications aren’t set up on the server yet');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked: allow them in your browser’s settings');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) }));
  return setContact({ push: { endpoint: sub.endpoint } });
}

/** Stop notifications on this device only. */
export async function disablePush(): Promise<Contact> {
  const sub = await subscription();
  const out = await setContact(sub ? { unpush: { endpoint: sub.endpoint } } : {});
  await sub?.unsubscribe();
  return out;
}

export const setEmailContact = (on: boolean) => setContact({ email: on });
