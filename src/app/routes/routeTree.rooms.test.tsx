import { beforeEach, describe, expect, it, vi } from 'vitest';

import { router } from './routeTree.tsx';

/*
 * The clinic rooms' pages and tabs as `routeTree.tsx` registers them (L-54):
 * through ONE lazily imported module, `room-routes.ts`, so the entry chunk
 * carries one import instead of a preload list per room. Kept apart from
 * `routeTree.test.tsx`: the first test needs a module registry in which
 * nothing has asked for a room yet.
 */

const roomRoutesLoaded = vi.hoisted(() => vi.fn());
const releaseRoomRoutes = vi.hoisted(() => ({ release: () => {} }));
const roomLoads = vi.hoisted(() => ({
  today: vi.fn(),
  leads: vi.fn(),
  sales: vi.fn(),
  items: vi.fn(),
  invoices: vi.fn(),
}));
const shellLoaded = vi.hoisted(() => vi.fn());

vi.mock('./room-routes.ts', async (importOriginal) => {
  roomRoutesLoaded();
  // Held until a test lets it go: the org shell must not wait for it.
  await new Promise<void>((resolve) => (releaseRoomRoutes.release = resolve));
  return importOriginal();
});
vi.mock('@/pages/organization/$organizationSlug/today/today.route.tsx', () => {
  roomLoads.today();
  return { Component: () => null };
});
vi.mock('@/pages/organization/$organizationSlug/leads/leads.route.tsx', () => {
  roomLoads.leads();
  return { Component: () => null };
});
vi.mock('@/pages/organization/$organizationSlug/medical/sales/sales.route.tsx', () => {
  roomLoads.sales();
  return { Component: () => null };
});
vi.mock('@/pages/organization/$organizationSlug/stock/items/items.route.tsx', () => {
  roomLoads.items();
  return { Component: () => null };
});
vi.mock('@/pages/organization/$organizationSlug/invoices/invoices.route.tsx', () => {
  roomLoads.invoices();
  return { Component: () => null };
});
vi.mock('@/pages/organization/$organizationSlug/organization-slug.route.tsx', () => {
  shellLoaded();
  return { Component: () => null };
});
// The signed-in warm-up's other islands, kept light: it warms onboarding first.
vi.mock('@/pages/onboarding/onboarding.route.tsx', () => ({ Component: () => null }));

type LazyRoute = {
  options: {
    component?: { preload?: () => Promise<void> | undefined };
    loader?: () => Promise<unknown> | unknown;
  };
};
const routeOf = (id: string) =>
  (router.routesById as unknown as Record<string, LazyRoute | undefined>)[id];
const SLUG = '/organization/$organizationSlug';

describe('the clinic rooms load through one room-route module (L-54)', () => {
  beforeEach(() => {
    for (const load of Object.values(roomLoads)) load.mockClear();
  });

  it('fetches it only when wanted — and the org shell warms it without waiting on it', async () => {
    // Building the router asks for no room.
    expect(roomRoutesLoaded).not.toHaveBeenCalled();

    // Entering an organization starts it, and the shell's loader resolves
    // while it is still on the way: the shell is never held for the rooms.
    await routeOf(SLUG)?.options.loader?.();
    expect(shellLoaded).toHaveBeenCalledOnce();
    expect(roomRoutesLoaded).toHaveBeenCalledOnce();

    // A room waits for it, then loads its own chunk — and only its own.
    const leads = routeOf(`${SLUG}/leads`)?.options.component?.preload?.();
    releaseRoomRoutes.release();
    await leads;
    expect(roomLoads.leads).toHaveBeenCalledOnce();
    expect(roomLoads.today).not.toHaveBeenCalled();
    expect(roomRoutesLoaded).toHaveBeenCalledOnce();
  });

  it.each([
    [`${SLUG}/today`, 'today'],
    [`${SLUG}/medical/sales`, 'sales'],
    [`${SLUG}/stock/items`, 'items'],
  ] as const)('%s mounts its own room', async (id, room) => {
    await routeOf(id)?.options.component?.preload?.();
    expect(roomLoads[room]).toHaveBeenCalledOnce();
    for (const [other, load] of Object.entries(roomLoads)) {
      if (other !== room) expect(load, other).not.toHaveBeenCalled();
    }
  });

  it('the invoices route warms its host through the module too', async () => {
    await routeOf(`${SLUG}/invoices`)?.options.loader?.();
    expect(roomLoads.invoices).toHaveBeenCalledOnce();
  });

  it('the signed-in warm-up fetches it while the session is being restored', async () => {
    // A fresh registry, and a fresh module behind it: a mock's factory runs
    // once per file, so the earlier tests' load cannot answer for this one.
    const warmed = vi.fn();
    vi.resetModules();
    vi.doMock('./room-routes.ts', async (importOriginal) => {
      warmed();
      return importOriginal();
    });
    const { preloadSignedInShell } = await import('./routeTree.tsx');

    await expect(preloadSignedInShell()).resolves.toBeUndefined();
    expect(warmed).toHaveBeenCalledOnce();
  });
});
