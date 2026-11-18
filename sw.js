/* Vitalis — service worker gerado no build.
   Estratégias:
   - precache do app shell completo (versão única por hash de conteúdo)
   - navegação: rede primeiro, cache como queda (offline real)
   - assets: cache primeiro, com atualização em segundo plano
*/
const VERSION = '40f0b0e3a6';
const BUILD_TIME = '2026-11-18T13:29:29.019Z';
const PRECACHE = `vitalis-precache-${VERSION}`;
const RUNTIME = `vitalis-runtime-${VERSION}`;
const PRECACHE_MANIFEST = [
  "./.nojekyll",
  "./assets/index-BfEuka9e.css",
  "./assets/index-zvykdj0h.js",
  "./assets/three-BP1gOCGl.js",
  "./favicon.svg",
  "./icons/apple-touch-icon-180.png",
  "./icons/favicon-64.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./index.html",
  "./manifest.webmanifest"
];
const OFFLINE_TIMEOUT = 4000;

const shouldIgnore = (url) =>
  url.origin !== self.location.origin ||
  url.pathname.endsWith('/sw.js') ||
  url.protocol !== 'http:' && url.protocol !== 'https:';

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PRECACHE);
      // addAll é atômico: se um arquivo falhar, o install falha e não publicamos cache quebrado.
      await cache.addAll(PRECACHE_MANIFEST.map((path) => new Request(path, { cache: 'reload' })));
    })(),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('vitalis-') && key !== PRECACHE && key !== RUNTIME)
          .map((key) => caches.delete(key)),
      );
      if (self.registration.navigationPreload) {
        try {
          await self.registration.navigationPreload.disable();
        } catch {
          /* opcional */
        }
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING' || event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data === 'PING') {
    event.source?.postMessage({ type: 'PONG', version: VERSION, buildTime: BUILD_TIME });
  }
});

async function networkWithTimeout(request) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OFFLINE_TIMEOUT);
  try {
    const response = await fetch(request, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function handleNavigation(request) {
  try {
    const response = await networkWithTimeout(request);
    if (response && response.ok) return response;
    throw new Error(`HTTP ${response?.status}`);
  } catch {
    const cache = await caches.open(PRECACHE);
    const shell = new URL('index.html', self.registration.scope).href;
    return (
      (await cache.match(shell, { ignoreSearch: true })) ||
      (await cache.match(new URL('./', self.registration.scope).href, { ignoreSearch: true })) ||
      new Response(
        '<!doctype html><meta charset="utf-8"><title>Vitalis offline</title><body style="font-family:system-ui;background:#070b16;color:#eef4ff;display:grid;place-items:center;height:100vh;margin:0"><p>Sem conexão e sem cache disponível. Abra o app uma vez online.</p></body>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
      )
    );
  }
}

async function cacheFirst(request, event) {
  const precache = await caches.open(PRECACHE);
  const cached = await precache.match(request, { ignoreSearch: true });
  if (cached) return cached;

  const runtime = await caches.open(RUNTIME);
  const runtimeCached = await runtime.match(request);
  if (runtimeCached) return runtimeCached;

  try {
    const response = await fetch(request);
    if (response && response.ok && response.type === 'basic') {
      const copy = response.clone();
      event.waitUntil(runtime.put(request, copy));
    }
    return response;
  } catch {
    return new Response('', { status: 504, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (shouldIgnore(url)) return;

  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (
    ['script', 'style', 'image', 'font', 'manifest'].includes(request.destination) ||
    url.pathname.endsWith('.json') ||
    url.pathname.endsWith('.webmanifest') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js')
  ) {
    event.respondWith(cacheFirst(request, event));
  }
});
