// Change CACHE when the storage format changes. Build version updates replace the running worker.
const VERSION = '__BUILD_VERSION__';
const CACHE = 'game-assets-v1';
self.addEventListener('install', () => { void VERSION; self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key.startsWith('game-assets-') && key !== CACHE) await caches.delete(key);
    // The page's own request starts while this worker wakes up, instead of after.
    await self.registration.navigationPreload?.enable();
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  // The page and stable discovery manifest must always see the current deployment.
  if (request.mode === 'navigate') {
    event.respondWith((async () => (await event.preloadResponse) || fetch(request, {cache:'no-cache'}))());
    return;
  }
  // Everything else outside the fingerprinted folder is served with no-cache, so the browser asks the server itself.
  if (!url.pathname.includes('/assets/fingerprinted/')) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const saved = await cache.match(request);
    if (saved) return saved;
    const response = await fetch(request);
    if (response.ok && response.type !== 'opaque') {
      try { await cache.put(request,response.clone()); } catch { /* Quota exhaustion keeps network loading working. */ }
    }
    return response;
  })());
});
self.addEventListener('message', event => {
  // Files used before registration are already in the HTTP cache. Save only those actually requested.
  if(event.data?.type !== 'remember' || !Array.isArray(event.data.urls)) return;
  event.waitUntil((async () => {
    const cache=await caches.open(CACHE);
    for(const value of event.data.urls) {
      const url=new URL(value,self.location.href);
      if(url.origin!==self.location.origin || !url.pathname.includes('/assets/fingerprinted/')) continue;
      if(await cache.match(url.href)) continue;
      try { const response=await fetch(url.href); if(response.ok) await cache.put(url.href,response); } catch { /* Best effort. */ }
    }
  })());
});
