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
import type { Role } from '@/shared/api/app/app-schema.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES, previewPreset } from '@/tests/utils/app-preset-codes.ts';
import { SELF } from '@/tests/utils/team-doubles.ts';

import { validateUserEditSearch } from '../../users.dialog-search.ts';
import { validateRolesSearch, validateUsersSearch } from '../../users.search.ts';

/** The Owner's codes: every member and role write the Users room offers. */
export const USERS_ADMIN_CODES: OrganizationPermission[] = [...PRESET_CODES.owner];

/** What a harness run is set up with besides the Team's component. */
interface UsersRoutesOptions {
  /** The member's clinozy-be codes. */
  codes?: OrganizationPermission[];
  /** A preset to preview (View-as) — its codes already read. */
  previewRole?: Role | null;
  /** The Roles & access page's component (`/users/roles`); a marker by default. */
  Roles?: () => ReactNode;
}

/**
 * The Users family as `routeTree.tsx` registers it — the Team with its search
 * schema and its two dialog routes, which render nothing, and Roles & access
 * beside it — with `Page` as the Team's
 * component, opened at `url`, for a member holding `codes` (the Owner's by
 * default) — previewing the `previewRole` preset when given. Every other path
 * lands on a catch-all.
 */
export function renderUsersRoutes(
  url: string,
  Page: () => ReactNode,
  {
    codes = USERS_ADMIN_CODES,
    previewRole = null,
    Roles = () => <p>roles page</p>,
  }: UsersRoutesOptions = {},
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
  const users = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/users',
    validateSearch: validateUsersSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => users,
    path: 'create',
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => users,
    path: '$userId/edit',
    validateSearch: validateUserEditSearch,
    component: () => null,
  });
  const roles = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/users/roles',
    validateSearch: validateRolesSearch,
    component: Roles,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([users.addChildren([create, edit]), roles, elsewhere]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  if (previewRole) previewPreset(queryClient, previewRole);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Put the stores the harness touched back as they were. */
export function resetUsersRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
}
