// Letting the trading companies contact you: phone and desktop notifications
// (Web Push, via public/sw.js) and email. Both are opt-in and in character;
// the server side is in server/src/accounts.ts and contact.ts.

import { getContact, setContact } from './account';

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

/** Ask permission and subscribe this device. Throws with a reason the player can read. */
export async function enablePush(): Promise<void> {
  if (!pushSupported()) throw new Error(needsHomeScreen() ? 'On iPhone, add Witchspace to your Home Screen first, then switch this on there' : 'This browser can’t show notifications');
  const { key } = await getContact();
  if (!key) throw new Error('Notifications aren’t set up on the server yet');
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new Error('Notifications are blocked: allow them in your browser’s settings');
  const reg = await registration();
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: fromBase64Url(key) }));
  await setContact({ push: { endpoint: sub.endpoint } });
}

export async function disablePush(): Promise<void> {
  if (pushSupported()) {
    const reg = await navigator.serviceWorker.getRegistration('/sw.js');
    await (await reg?.pushManager.getSubscription())?.unsubscribe();
  }
  await setContact({ push: null });
}

export const setEmailContact = (on: boolean) => setContact({ email: on });
export { getContact };
