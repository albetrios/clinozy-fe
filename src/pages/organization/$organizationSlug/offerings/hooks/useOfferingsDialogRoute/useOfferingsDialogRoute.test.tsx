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

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { validateOfferingCreateSearch } from '../../offerings.dialog-search.ts';
import { validateOfferingsSearch } from '../../offerings.search.ts';
import {
  type OfferingsDialogRoute,
  useOfferingsDialogRoute,
} from './useOfferingsDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

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

/** The Offerings tab and its two dialog routes, the probe on the list page. */
function renderRoutes(url: string, role: 'admin' | 'counsellor' = 'admin') {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
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

beforeEach(() => {
  notifyMock.info.mockReset();
  resetClinicFixtures();
});
afterEach(() => {
  resetClinicFixtures();
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
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

  it('opens the offering’s drawer and resolves the offering (S:100)', async () => {
    const id = ref.offering(270);
    renderRoutes(`${OFFERINGS}/${id}/edit`, 'counsellor');
    await waitFor(() =>
      expect(seen()).toEqual({ kind: 'edit', offeringId: id, name: 'Corn Removal' }),
    );
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('sends an unknown id back to the list, its search kept (S:115)', async () => {
    const { router } = renderRoutes(`${OFFERINGS}/${ref.offering(1)}/edit?q=peel`);
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS));
    expect(router.state.location.search).toMatchObject({ q: 'peel' });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Offering not found · it may have been deleted',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('refuses a create link to a role without Create, once', async () => {
    const { router } = renderRoutes(`${OFFERINGS}/create?name=Peel`, 'counsellor');
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERINGS));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(router.state.location.search).not.toHaveProperty('name');
    expect(seen()).toEqual({ kind: 'none' });
  });
});
