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

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { OFFER_PERMISSIONS } from '../../offers.constants.ts';
import { validateOffersSearch } from '../../offers.search.ts';
import { OffersPage } from '../../OffersPage.tsx';

/** The Offers tab's URL in the harness's organization. */
export const OFFERS_URL = '/organization/acme/offerings/offers';

/** An Owner's or Admin's offer codes: create, change, pause, delete and export. */
const OWNER_CODES: readonly OrganizationPermission[] = [
  OFFER_PERMISSIONS.create,
  OFFER_PERMISSIONS.update,
  OFFER_PERMISSIONS.delete,
  OFFER_PERMISSIONS.export,
];

/** A Counsellor's: create, change and pause — no delete, no export (research §7). */
export const COUNSELLOR_CODES: readonly OrganizationPermission[] = [
  OFFER_PERMISSIONS.create,
  OFFER_PERMISSIONS.update,
];

/** What harness the routes open in. */
export interface OffersRoutesOptions {
  /** The member's offer codes beside `organization:read` (an Owner's by default). */
  codes?: readonly OrganizationPermission[];
  /** A member holding this preset's codes instead of `codes`. */
  role?: 'admin' | 'counsellor';
}

/**
 * The Offers tab as `routeTree.tsx` registers it — the list with its search
 * schema and its two dialog routes (`create`, `$offerId/edit`, rendering
 * nothing) — opened at `url` for the test member (`signInTestMember`:
 * organization `org_test`, slug `acme`) holding `organization:read` and
 * `codes`, as clinozy-be's `my_permissions` would list them. Every other path
 * lands on a catch-all.
 */
export function renderOffersRoutes(
  url: string,
  { codes = OWNER_CODES, role }: OffersRoutesOptions = {},
) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions(role ? [...PRESET_CODES[role]] : ['organization:read', ...codes]);

  const root = createRootRoute({ component: () => <Outlet /> });
  const offers = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/offerings/offers',
    validateSearch: validateOffersSearch,
    component: OffersPage,
  });
  const create = createRoute({
    getParentRoute: () => offers,
    path: 'create',
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => offers,
    path: '$offerId/edit',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([offers.addChildren([create, edit]), elsewhere]),
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
export function resetOffersRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
}
