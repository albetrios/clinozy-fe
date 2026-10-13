import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import { fetchOffering } from '@/shared/api/app/offerings-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  OFFERING_IDS,
  type OfferingsTabWorld,
} from '../../__tests__/integration/offerings-tab-test-data.ts';
import { OFFERINGS_ADMIN_CODES } from '../../__tests__/integration/offerings-test-router.tsx';
import { validateOfferingCreateSearch } from '../../offerings.dialog-search.ts';
import { validateOfferingsSearch } from '../../offerings.search.ts';
import {
  type OfferingsDialogRoute,
  useOfferingsDialogRoute,
} from './useOfferingsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const world = vi.hoisted(() => ({}) as OfferingsTabWorld);
vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => {
  const { offeringsApiDouble } =
    await import('../../__tests__/integration/offerings-tab-test-data.ts');
  return {
    ...(await importOriginal<typeof OfferingsApiModule>()),
    ...offeringsApiDouble(world),
  };
});

const OFFERINGS = '/organization/acme/offerings';

/** What the hook answered, minus the record itself (its name stands in). */
function summary(route: OfferingsDialogRoute) {
  if (route.kind !== 'edit') return route;
  return { kind: route.kind, offeringId: route.offeringId, name: route.offering?.name };
}

/** Renders the hook's answer as JSON for the tests to read. */
function Probe() {
  const { dialog } = useOfferingsDialogRoute();
  return <output data-testid="probe">{JSON.stringify(summary(dialog))}</output>;
}

/** The hook's latest answer. */
function seen(): unknown {
  return JSON.parse(screen.getByTestId('probe').textContent ?? 'null');
}

/** The Offerings tab and its two dialog routes, the probe on the list page, for a member holding `permissions`. */
function renderRoutes(
  url: string,
  permissions: readonly OrganizationPermission[] = OFFERINGS_ADMIN_CODES,
) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...permissions]);
  const root = createRootRoute({ component: () => <Outlet /> });
  const list = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings',
    validateSearch: validateOfferingsSearch,
    component: () => (
      <>
        <Probe />
        <Outlet />
      </>
    ),
  });
  const create = createRoute({
    getParentRoute: () => list,
    path: 'create',
    validateSearch: validateOfferingCreateSearch,
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => list,
    path: '$offeringId/edit',
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([list.addChildren([create, edit])]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { router };
}

beforeEach(async () => {
  notifyMock.info.mockReset();
  vi.mocked(fetchOffering).mockClear();
  const { seededOfferingsTabWorld } =
    await import('../../__tests__/integration/offerings-tab-test-data.ts');
  Object.assign(world, seededOfferingsTabWorld());
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useOfferingsDialogRoute', () => {
  it('opens nothing on the list itself', async () => {
    renderRoutes(OFFERINGS);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('opens New offering with the URL’s name (S:99)', async () => {
    renderRoutes(`${OFFERINGS}/create?name=Hydra%20facial`);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'create', prefill: { name: 'Hydra facial' } });
  });

  it('reads the offering by its public id and opens its drawer, view only for a reader (S:100)', async () => {
    const id = OFFERING_IDS.sunscreen;
    renderRoutes(`${OFFERINGS}/${id}/edit`, ['organization:read']);
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'edit',
        offeringId: id,
        name: 'Sunscreen SPF 50',
      }),
    );
    expect(fetchOffering).toHaveBeenCalledWith(id);
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('sends an id the API answers 404 back to the list, its search kept (S:115)', async () => {
    const gone = 'off_deletedlongago0000099';
    const { router } = renderRoutes(`${OFFERINGS}/${gone}/edit?q=peel`);
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS));
    expect(router.state.location.search).toMatchObject({ q: 'peel' });
    expect(fetchOffering).toHaveBeenCalledWith(gone);
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Offering not found · it may have been deleted',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('never reads an id that is no public id (an old link) — it goes back the same way', async () => {
    const { router } = renderRoutes(
      `${OFFERINGS}/3f2a8c1e-1111-4111-8111-111111111111/edit`,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS));
    expect(fetchOffering).not.toHaveBeenCalled();
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Offering not found · it may have been deleted',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('refuses a create link to a member without `offering:create`, once', async () => {
    const { router } = renderRoutes(`${OFFERINGS}/create?name=Peel`, [
      'organization:read',
      'offering:update',
    ]);
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(router.state.location.search).not.toHaveProperty('name');
    expect(seen()).toEqual({ kind: 'none' });
  });
});
