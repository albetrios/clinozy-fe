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

import { validateOffersSearch } from '../../offers.search.ts';
import { type OffersDialogRoute, useOffersDialogRoute } from './useOffersDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

const OFFERS = '/organization/acme/offerings/offers';

/** What the hook answered, minus the record itself (its name stands in). */
function summary(route: OffersDialogRoute) {
  if (route.kind !== 'edit') return route;
  return { kind: route.kind, offerId: route.offerId, name: route.offer?.name };
}

/** Renders the hook's answer as JSON for the tests to read. */
function Probe() {
  const { dialog } = useOffersDialogRoute();
  return <output data-testid="probe">{JSON.stringify(summary(dialog))}</output>;
}

/** The hook's latest answer. */
function seen(): unknown {
  return JSON.parse(screen.getByTestId('probe').textContent ?? 'null');
}

/** The Offers tab and its two dialog routes, the probe on the list page. */
function renderRoutes(url: string, role: 'admin' | 'counsellor' = 'admin') {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
  const root = createRootRoute({ component: () => <Outlet /> });
  const list = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings/offers',
    validateSearch: validateOffersSearch,
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
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => list,
    path: '$offerId/edit',
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

describe('useOffersDialogRoute', () => {
  it('opens nothing on the list itself', async () => {
    renderRoutes(OFFERS);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('opens New offer (S:102)', async () => {
    renderRoutes(`${OFFERS}/create`);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'create' });
  });

  it('opens the offer’s drawer and resolves the offer, for a viewer too (S:103)', async () => {
    const id = ref.offer(31);
    renderRoutes(`${OFFERS}/${id}/edit`, 'counsellor');
    await waitFor(() =>
      expect(seen()).toEqual({ kind: 'edit', offerId: id, name: 'Navratri glow' }),
    );
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('sends an unknown id back to the list, its filters kept (S:115)', async () => {
    const { router } = renderRoutes(`${OFFERS}/${ref.offer(1)}/edit?status=live`);
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS));
    expect(router.state.location.search).toMatchObject({ status: ['live'] });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Offer not found · it may have been deleted',
    );
  });

  it('refuses a create link to a role that cannot price offers (Q-U8)', async () => {
    const { router } = renderRoutes(`${OFFERS}/create`, 'counsellor');
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS));
    expect(notifyMock.info).toHaveBeenCalledTimes(1);
    expect(seen()).toEqual({ kind: 'none' });
  });
});
