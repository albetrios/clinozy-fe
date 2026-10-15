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
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { SELF } from '@/tests/utils/team-doubles.ts';

import { validateBranchesSearch } from '../../branches.search.ts';

/** The Owner's codes: every branch write the Branches room offers. */
export const BRANCHES_ADMIN_CODES: OrganizationPermission[] = [...PRESET_CODES.owner];

/**
 * The Branches room as `routeTree.tsx` registers it — the list with its search schema and its
 * two dialog routes (New branch, the branch drawer), which render nothing — with `Page` as the
 * list's component, opened at `url`, for a member holding `codes` (the Owner's by default).
 * Every other path lands on a catch-all.
 */
export function renderBranchesRoutes(
  url: string,
  Page: () => ReactNode,
  codes: OrganizationPermission[] = BRANCHES_ADMIN_CODES,
) {
  useOrganizationStore.getState().setOrganization('org_test', 'acme');
  useOrganizationStore.getState().setPermissions(codes);
  useAuthStore.getState().setUser({
    id: SELF.userId,
    email: SELF.email,
    role: 'user',
    name: 'Riya Shah',
  });

  const root = createRootRoute({ component: () => <Outlet /> });
  const branches = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/branches',
    validateSearch: validateBranchesSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => branches,
    path: 'create',
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => branches,
    path: '$branchId/edit',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([branches.addChildren([create, edit]), elsewhere]),
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
export function resetBranchesRoutes() {
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
}
