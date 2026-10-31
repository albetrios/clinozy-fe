/// <reference lib="webworker" />
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  matchPrecache,
  precacheAndRoute,
} from 'workbox-precaching';
import { registerRoute } from 'workbox-routing';
import { CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';

declare const self: ServiceWorkerGlobalScope;

// Clean old caches on SW update
cleanupOutdatedCaches();

// The manifest is the app shell alone, chosen at build time (`plugins/app-shell-precache.ts`,
// F-8) — the heavy deferred chunks (Sentry, PostHog, the Settings and command-palette trees)
// are never in it, so nothing is filtered here.
precacheAndRoute(self.__WB_MANIFEST);

// Version-update handshake (core/version/check.ts): index.html is precached, so
// while an OLD worker controls the page a plain reload re-serves the OLD shell
// and a newly installed worker would wait until every tab closes. The page
// messages the WAITING worker at a safe moment (idle / user-approved "Refresh
// now") instead of an unconditional skipWaiting() that could swap builds
// mid-task; claim on activate so the follow-up reload is served from the NEW
// precache immediately.
self.addEventListener('message', (event) => {
  // Only same-origin pages can hold a reference to this worker, but verify the
  // sender's origin anyway (defense-in-depth; CodeQL js/missing-origin-check).
  if (event.origin !== self.location.origin) return;
  if ((event.data as { type?: string } | null)?.type === 'SKIP_WAITING') {
    event.waitUntil(self.skipWaiting());
  }
});
self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Lazy JS/CSS chunks — cache on first navigation, reuse on repeat visits
registerRoute(
  ({ request, url }) =>
    url.origin === self.location.origin &&
    (request.destination === 'script' || request.destination === 'style'),
  new StaleWhileRevalidate({
    cacheName: 'app-assets',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 80,
        maxAgeSeconds: 7 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Cache fonts with CacheFirst
registerRoute(
  /^https:\/\/.*\.(woff2|ttf|otf)$/,
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 20,
        maxAgeSeconds: 365 * 24 * 60 * 60,
      }),
    ],
  }),
);

// Navigations go to the network first, so a deep link always gets the deployed
// shell. A failed fetch is not proof of being offline — a stale DNS answer after
// a record change, a captive portal or a TLS failure reject it while the device
// is online — so the fallback is the precached app shell, the same index.html a
// precached `/` is served from. It boots without the network and owns every
// outcome: the splash's offline hold (AppSplashSlot) when the device reports no
// connection, the OfflineIndicator after boot, real errors and retries
// otherwise. offline.html is the last resort, for a worker with no shell cached.
// Precache entries live under revisioned cache keys, so they are looked up with
// matchPrecache — a plain caches.match('/offline.html') never hits.
async function navigationFallback(): Promise<Response> {
  return (
    (await matchPrecache('index.html')) ??
    (await matchPrecache('offline.html')) ??
    new Response('Offline', { status: 503 })
  );
}

self.addEventListener('fetch', (event) => {
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(navigationFallback));
  }
});
