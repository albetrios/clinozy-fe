import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { matchPrecache } = vi.hoisted(() => ({
  matchPrecache: vi.fn(async (_url: string): Promise<Response | undefined> => undefined),
}));

vi.mock('workbox-precaching', () => ({
  cleanupOutdatedCaches: vi.fn(),
  precacheAndRoute: vi.fn(),
  matchPrecache,
}));
vi.mock('workbox-routing', () => ({ registerRoute: vi.fn() }));
vi.mock('workbox-strategies', () => ({
  CacheFirst: class {},
  StaleWhileRevalidate: class {},
}));
vi.mock('workbox-expiration', () => ({ ExpirationPlugin: class {} }));

const ORIGIN = 'https://app.example.test';

type Listener = (event: unknown) => void;

/** Stubs the worker global the module registers on, and loads it fresh. */
async function loadWorker() {
  const listeners = new Map<string, Listener>();
  const scope = {
    __WB_MANIFEST: [],
    location: { origin: ORIGIN },
    addEventListener: (type: string, listener: Listener) => listeners.set(type, listener),
    skipWaiting: vi.fn(async () => undefined),
    clients: { claim: vi.fn(async () => undefined) },
  };
  vi.stubGlobal('self', scope);
  await import('./sw.ts');
  return { listeners, scope };
}

/** Dispatches a fetch event; resolves with what the worker answered, or undefined if it passed. */
function dispatchFetch(listeners: Map<string, Listener>, mode: RequestMode) {
  const request = { mode, url: `${ORIGIN}/login?redirect=%2F` };
  const respondWith = vi.fn();
  listeners.get('fetch')?.({ request, respondWith });
  const answer = respondWith.mock.calls[0]?.[0] as Promise<Response> | undefined;
  return { request, answer };
}

function precached(entries: Record<string, string>) {
  matchPrecache.mockImplementation(async (url: string) =>
    url in entries ? new Response(entries[url]) : undefined,
  );
}

describe('service worker', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.resetAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  describe('navigations', () => {
    it('answers from the network when it can', async () => {
      const { listeners } = await loadWorker();
      vi.mocked(globalThis.fetch).mockResolvedValue(new Response('deployed shell'));

      const { request, answer } = dispatchFetch(listeners, 'navigate');

      expect(globalThis.fetch).toHaveBeenCalledWith(request);
      await expect(answer?.then((response) => response.text())).resolves.toBe(
        'deployed shell',
      );
      expect(matchPrecache).not.toHaveBeenCalled();
    });

    it('serves the precached app shell when the network fetch fails, not the offline page', async () => {
      const { listeners } = await loadWorker();
      vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));
      precached({ 'index.html': 'precached shell', 'offline.html': 'offline page' });

      const { answer } = dispatchFetch(listeners, 'navigate');

      await expect(answer?.then((response) => response.text())).resolves.toBe(
        'precached shell',
      );
      expect(matchPrecache).toHaveBeenCalledTimes(1);
    });

    it('falls back to the offline page when no shell is cached', async () => {
      const { listeners } = await loadWorker();
      vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));
      precached({ 'offline.html': 'offline page' });

      const { answer } = dispatchFetch(listeners, 'navigate');

      await expect(answer?.then((response) => response.text())).resolves.toBe(
        'offline page',
      );
      expect(matchPrecache.mock.calls.map(([url]) => url)).toEqual([
        'index.html',
        'offline.html',
      ]);
    });

    it('answers 503 when nothing is cached at all', async () => {
      const { listeners } = await loadWorker();
      vi.mocked(globalThis.fetch).mockRejectedValue(new TypeError('Failed to fetch'));

      const { answer } = dispatchFetch(listeners, 'navigate');

      await expect(answer?.then((response) => response.status)).resolves.toBe(503);
    });

    it('leaves every other request to the registered routes', async () => {
      const { listeners } = await loadWorker();

      const { answer } = dispatchFetch(listeners, 'cors');

      expect(answer).toBeUndefined();
      expect(globalThis.fetch).not.toHaveBeenCalled();
    });
  });

  describe('version-update handshake', () => {
    it('activates on a same-origin SKIP_WAITING message', async () => {
      const { listeners, scope } = await loadWorker();
      const waitUntil = vi.fn();

      listeners.get('message')?.({
        origin: ORIGIN,
        data: { type: 'SKIP_WAITING' },
        waitUntil,
      });

      expect(scope.skipWaiting).toHaveBeenCalledTimes(1);
      expect(waitUntil).toHaveBeenCalledTimes(1);
    });

    it('ignores SKIP_WAITING from another origin', async () => {
      const { listeners, scope } = await loadWorker();

      listeners.get('message')?.({
        origin: 'https://elsewhere.example.test',
        data: { type: 'SKIP_WAITING' },
        waitUntil: vi.fn(),
      });

      expect(scope.skipWaiting).not.toHaveBeenCalled();
    });

    it('claims open pages on activate', async () => {
      const { listeners, scope } = await loadWorker();
      const waitUntil = vi.fn();

      listeners.get('activate')?.({ waitUntil });

      expect(scope.clients.claim).toHaveBeenCalledTimes(1);
      expect(waitUntil).toHaveBeenCalledTimes(1);
    });
  });
});
