import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  validateOfferingCreateSearch,
  validateOfferingsSearch,
} from '../../offerings.search.ts';
import { OfferingsPage } from '../../OfferingsPage.tsx';
import { validateOffersSearch } from '../../offers/offers.search.ts';
import { OffersPage } from '../../offers/OffersPage.tsx';

/** The Offerings tab's URL in the harness's organization. */
export const OFFERINGS_URL = '/organization/acme/offerings';

/** The Offers tab's URL in the harness's organization. */
export const OFFERS_URL = '/organization/acme/offerings/offers';

/**
 * The Offerings family as `routeTree.tsx` registers it — the Offerings tab
 * with its two dialog routes (`create`, `$offeringId/edit`, rendering
 * nothing) and, beside it, the Offers tab, each with its search schema —
 * opened at `url` for a member previewed as `role` (View-as narrows the
 * clinic access to that role's matrix). Every other path lands on a catch-all.
 */
export function renderOfferingsRoutes(
  url: string,
  { role = 'admin' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const offerings = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings',
    validateSearch: validateOfferingsSearch,
    component: OfferingsPage,
  });
  const create = createRoute({
    getParentRoute: () => offerings,
    path: 'create',
    validateSearch: validateOfferingCreateSearch,
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => offerings,
    path: '$offeringId/edit',
    component: () => null,
  });
  const offers = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings/offers',
    validateSearch: validateOffersSearch,
    component: OffersPage,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      offerings.addChildren([create, edit]),
      offers,
      elsewhere,
    ]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Put the stores the harness touched back as they were. */
export function resetOfferingsRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
