// SAFE-MODE / KILL-SWITCH service worker.
// During the hackathon the SW caused more pain than it solved (cache-first
// + dropped precache made stale pages stick and broke offline). This
// version installs, immediately deletes every cache, unregisters itself,
// and force-reloads any controlled tabs so the next request goes straight
// to the network — no SW, no cache, no dance.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll({ type: 'window' });
    for (const client of clients) {
      try { client.navigate(client.url); } catch (_) {}
    }
  })());
});

// Pass-through fetch in the brief window before unregister completes.
self.addEventListener('fetch', (e) => { e.respondWith(fetch(e.request)); });
