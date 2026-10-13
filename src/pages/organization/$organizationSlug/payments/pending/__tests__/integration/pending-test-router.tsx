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
import type { ReactNode } from 'react';

import type { OrganizationPermission } from '@/core/types/permissions.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import { validatePendingSearch } from '../../pending.search.ts';
import { PendingPage } from '../../PendingPage.tsx';

/** Every code the Pending tab answers to: read it, record money, change and delete a credit. */
const PENDING_MONEY_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
  'contact:read',
];

/**
 * Payments › Pending as `routeTree.tsx` registers it — the page with its search schema and its
 * two dialog routes (Add pending, Edit pending), each rendering nothing — opened at `url` for the
 * test member (`signInTestMember`: organization `org_test`, slug `acme`) holding `codes`, with
 * no View-as: the gates are the member's own `payment:*` codes. `Page` stands in for the page
 * (a hook's probe). Every other path — the ledger, Day close — lands on a catch-all.
 */
export function renderPendingRoutes(
  url: string,
  {
    Page = PendingPage,
    codes = PENDING_MONEY_CODES,
  }: { Page?: () => ReactNode; codes?: readonly OrganizationPermission[] } = {},
) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...codes]);
  useUIStore.setState({ previewRole: null });

  const root = createRootRoute({ component: () => <Outlet /> });
  const pending = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/payments/pending',
    validateSearch: validatePendingSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => pending,
    path: 'create',
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => pending,
    path: '$creditId/edit',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([pending.addChildren([create, edit]), elsewhere]),
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
export function resetPendingRoutes() {
  useOrganizationStore.getState().clearPermissions();
  useOrganizationStore.getState().clearOrganization();
}
