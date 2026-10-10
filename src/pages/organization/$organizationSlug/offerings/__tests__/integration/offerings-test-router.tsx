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

import type { OrganizationPermission } from '@/core/rbac/policies.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { validateOfferingCreateSearch } from '../../offerings.dialog-search.ts';
import { validateOfferingsSearch } from '../../offerings.search.ts';
import { OfferingsPage } from '../../OfferingsPage.tsx';

/** The Offerings tab's URL in the harness's organization. */
export const OFFERINGS_URL = '/organization/acme/offerings';

/**
 * Every code an Owner or Admin holds in the room (research §7) — the harness's member unless a
 * test names others: see, create, edit, delete, export, and see the lowest price.
 */
export const OFFERINGS_ADMIN_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'offering:create',
  'offering:update',
  'offering:delete',
  'offering:export',
  'offering:lower_price:read',
];

/**
 * The Offerings tab as `routeTree.tsx` registers it — its search schema and its
 * two dialog routes (`create`, `$offeringId/edit`, rendering nothing) — opened
 * at `url` for the test member (`signInTestMember`:
 * organization `org_test`, slug `acme` — every offerings read and key carries
 * the organization) holding `permissions` (their clinozy-be codes; the Admin's
 * by default). `role` runs View-as instead: the clinic access narrows to that
 * role's matrix and every code reads false. Every other path (the Offers tab
 * included — its suites have their own harness, `offers-test-router.tsx`) lands
 * on a catch-all.
 */
export function renderOfferingsRoutes(
  url: string,
  {
    permissions = OFFERINGS_ADMIN_CODES,
    role,
  }: { permissions?: readonly OrganizationPermission[]; role?: Role } = {},
) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...permissions]);
  useUIStore.setState({ previewRole: role ?? null });

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
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([offerings.addChildren([create, edit]), elsewhere]),
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
  useOrganizationStore.getState().clearOrganization();
}
