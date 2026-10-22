// Witchspace's service worker: only for notifications. When a trading company
// gets in touch, our server sends an empty push; we ask it what to say and
// show it. No caching, no offline: the game always loads fresh.

const API = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1' ? 'http://127.0.0.1:8787' : 'https://space.witchspace.org.uk';

async function sha256(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let msg = { title: 'Witchspace', body: 'Someone would like a word, Commander.', url: '/play/' };
      try {
        const sub = await self.registration.pushManager.getSubscription();
        if (sub) {
          const res = await fetch(`${API}/push/latest?e=${await sha256(sub.endpoint)}`);
          if (res.ok) msg = await res.json();
        }
      } catch {
        // Show the default: a notification must always appear.
      }
      await self.registration.showNotification(msg.title, { body: msg.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: msg.url }, tag: 'witchspace-contact' });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url ?? '/play/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const game = open.find((c) => c.url.includes('/play'));
      if (game) return game.focus();
      return self.clients.openWindow(url);
    })(),
  );
});
