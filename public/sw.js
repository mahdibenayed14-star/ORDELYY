// Cache de l'interface uniquement. Jamais d'API, de commandes serveur ou d'audio.
const ROOT = new URL('./', self.location).href;
const CACHE = `ordely-v10-20261001-${new URL(ROOT).pathname}`;
const FILES = ['index.html', 'assets/styles.css', 'assets/app.js', 'assets/voice.js', 'assets/transport.js',
  'assets/order-engine.js', 'assets/audio-utils.js', 'assets/mic-worklet.js', 'assets/icon.svg', 'demo-data.json', 'manifest.webmanifest'];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES.map(file => new URL(file, ROOT).href))).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('ordely') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(ROOT) || /\/api\/|\/voice(?:\?|$)/.test(url.pathname)) return;
  const relative = url.pathname.slice(new URL(ROOT).pathname.length);
  if (event.request.mode !== 'navigate' && !FILES.includes(relative)) return;
  event.respondWith(fetch(event.request).then(response => {
    if (response.ok) { const copy = response.clone(); event.waitUntil(caches.open(CACHE).then(cache => cache.put(event.request, copy))); }
    return response;
  }).catch(async () => (await caches.match(event.request)) || (event.request.mode === 'navigate' ? await caches.match(new URL('index.html', ROOT)) : Response.error())));
});
