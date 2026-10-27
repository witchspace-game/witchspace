// Witchspace's service worker: notifications, and the flight log's clips.
// When a trading company gets in touch, our server sends an empty push; we
// ask it what to say and show it. No caching, no offline: the game always
// loads fresh.
//
// Clips: an iPhone's player wants a video from an address it can ask for a
// piece at a time, and in a Home Screen app it won't play one from memory
// ("the player said unsupported", Mark's screenshot). So /flight-log/clip/<id>
// serves a clip straight from the flight log's database, with byte ranges.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

const CLIP_PATH = '/flight-log/clip/';

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.pathname.startsWith(CLIP_PATH)) return; // everything else: the network, as ever
  event.respondWith(clip(event.request, decodeURIComponent(url.pathname.slice(CLIP_PATH.length))));
});

/** A moment's video from the flight log (src/game/flightLog.ts: database witchspace-flight-log, store moments). */
function storedVideo(id) {
  return new Promise((resolve) => {
    const open = indexedDB.open('witchspace-flight-log', 1);
    open.onerror = () => resolve(null);
    open.onupgradeneeded = () => open.result.createObjectStore('moments', { keyPath: 'id' });
    open.onsuccess = () => {
      try {
        const get = open.result.transaction('moments', 'readonly').objectStore('moments').get(id);
        get.onsuccess = () => resolve(get.result && get.result.video ? get.result.video : null);
        get.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    };
  });
}

async function clip(request, id) {
  const video = await storedVideo(id);
  if (!video) return new Response('No such clip', { status: 404 });
  const size = video.size;
  const type = video.type || 'video/mp4';
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get('Range') || '');
  if (!range) return new Response(video, { headers: { 'Content-Type': type, 'Content-Length': String(size), 'Accept-Ranges': 'bytes' } });
  let start = range[1] ? Number(range[1]) : size - Number(range[2] || 0);
  let end = range[1] && range[2] ? Number(range[2]) : size - 1;
  start = Math.max(0, Math.min(start, size - 1));
  end = Math.min(Math.max(end, start), size - 1);
  return new Response(video.slice(start, end + 1, type), {
    status: 206,
    headers: { 'Content-Type': type, 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${size}`, 'Accept-Ranges': 'bytes' },
  });
}

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
      await self.registration.showNotification(msg.title, { body: msg.body, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url: msg.url }, tag: 'witchspace-contact', renotify: true });
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
