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

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import type * as OfferingsApiModule from '@/shared/api/app/offerings-api.ts';
import { fetchOffer } from '@/shared/api/app/offerings-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { offerRecord, TEST_OFFER_ID } from '@/tests/utils/offering-doubles.ts';

import { validateOffersSearch } from '../../offers.search.ts';
import { type OffersDialogRoute, useOffersDialogRoute } from './useOffersDialogRoute.ts';

const { notifyMock } = vi.hoisted(() => ({ notifyMock: { info: vi.fn() } }));
vi.mock('@/shared/notify/index.ts', () => ({ notify: notifyMock }));

vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof OfferingsApiModule>()),
  fetchOffer: vi.fn(),
}));

const OFFERS = '/organization/acme/offerings/offers';

/** What the hook answered, minus the record itself (its name stands in). */
function summary(route: OffersDialogRoute) {
  if (route.kind !== 'edit') return route;
  return {
    kind: route.kind,
    offerId: route.offerId,
    name: route.offer?.name,
    failed: route.failed,
  };
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
function renderRoutes(
  url: string,
  {
    codes = ['offering:create', 'offering:update'],
  }: {
    codes?: OrganizationPermission[];
  } = {},
) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions(['organization:read', ...codes]);
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
  vi.mocked(fetchOffer).mockReset();
  vi.mocked(fetchOffer).mockImplementation(async (offerId) => {
    if (offerId === TEST_OFFER_ID) return offerRecord();
    throw new HttpError('HTTP 404', 404, `/api/v1/app/offers/${offerId}`, 'GET', {
      error: { code: 'not_found', detail: 'Offer not found' },
    });
  });
});
afterEach(() => {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
});

describe('useOffersDialogRoute', () => {
  it('opens nothing on the list itself', async () => {
    renderRoutes(OFFERS);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'none' });
  });

  it('opens New offer with `offering:create` (S:102)', async () => {
    renderRoutes(`${OFFERS}/create`);
    await screen.findByTestId('probe');
    expect(seen()).toEqual({ kind: 'create' });
  });

  it('reads the offer by its public id and opens it, for a viewer too (S:103)', async () => {
    renderRoutes(`${OFFERS}/${TEST_OFFER_ID}/edit`, { codes: [] });
    await waitFor(() =>
      expect(seen()).toEqual({
        kind: 'edit',
        offerId: TEST_OFFER_ID,
        name: 'Research Diwali glow',
        failed: false,
      }),
    );
    expect(fetchOffer).toHaveBeenCalledWith(TEST_OFFER_ID);
    expect(notifyMock.info).not.toHaveBeenCalled();
  });

  it('sends a deleted offer back to the list, its filters kept (404, S:115)', async () => {
    const { router } = renderRoutes(
      `${OFFERS}/ofr_gonegonegonegonegone00/edit?status=live`,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS));
    expect(router.state.location.search).toMatchObject({ status: ['live'] });
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Offer not found · it may have been deleted',
    );
  });

  it('sends an id that is no public id back without asking the API', async () => {
    const { router } = renderRoutes(
      `${OFFERS}/3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f/edit`,
    );
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS));
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'Offer not found · it may have been deleted',
    );
    expect(fetchOffer).not.toHaveBeenCalled();
  });

  it('turns a create link away without `offering:create`', async () => {
    const { router } = renderRoutes(`${OFFERS}/create`, { codes: ['offering:update'] });
    await waitFor(() => expect(router.state.location.pathname).toBe(OFFERS));
    expect(notifyMock.info).toHaveBeenCalledExactlyOnceWith(
      'You do not have permission to perform this action.',
    );
    expect(seen()).toEqual({ kind: 'none' });
  });
});
