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
import type { ClinicRoleKey } from '@/shared/api/clinic/access-contracts.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { validateBranchesSearch } from '../../branches/branches.search.ts';
import {
  validateRolesSearch,
  validateUserEditSearch,
  validateUsersSearch,
} from '../../users.search.ts';

/** Every code the Users room maps (D17): read, invite, manage members and roles. */
export const USERS_ADMIN_CODES: OrganizationPermission[] = [
  'organization:read',
  'membership:read',
  'membership:manage',
  'invitation:manage',
  'role:read',
  'role:manage',
];

/** A clinozy-be role, as `listRoles` maps it. */
export function platformRole(key: string, name: string, isSystem: boolean): RoleSummary {
  return {
    id: `rol_${key.padEnd(21, 'a')}`,
    name,
    description: '',
    permissions: [],
    memberCount: 0,
    isSystem,
  };
}

/** The roles a TEAM organisation is provisioned with today, and one custom role. */
export const PLATFORM_ROLES = {
  owner: platformRole('owner', 'Owner', true),
  admin: platformRole('admin', 'Admin', true),
  member: platformRole('member', 'Member', true),
  viewer: platformRole('viewer', 'Viewer', true),
  senior: platformRole('senior', 'Senior desk', false),
};

/** A clinozy-be membership, as `listMembers` maps it. */
export function member(
  key: string,
  email: string,
  role: RoleSummary = PLATFORM_ROLES.member,
  overrides: Partial<Member> = {},
): Member {
  return {
    id: `mbr_${key}`,
    userId: `usr_${key}`,
    name: email,
    email,
    role: role === PLATFORM_ROLES.owner ? 'owner' : 'member',
    roleId: role.id,
    roleName: role.name,
    status: 'active',
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    ...overrides,
  };
}

/** The signed-in member of the harness: Riya (#12) on the seeded profiles. */
export const SELF = { userId: 'usr_riya', email: 'riya@cresence.skin' };

/** What a harness run is set up with besides the Team's component. */
interface UsersRoutesOptions {
  /** The member's clinozy-be codes. */
  codes?: OrganizationPermission[];
  /** A role to preview (View-as) — a contract role or a custom role's id. */
  previewRole?: ClinicRoleKey | null;
  /** The Roles & access page's component (`/users/roles`); a marker by default. */
  Roles?: () => ReactNode;
  /** The Branches page's component (`/users/branches`); a marker by default. */
  Branches?: () => ReactNode;
}

/**
 * The Users family as `routeTree.tsx` registers it — the Team with its search
 * schema and its two dialog routes, which render nothing, and Roles & access
 * and Branches (with its own two) beside it — with `Page` as the Team's
 * component, opened at `url`, for a
 * member holding `codes` (or, with `previewRole`, previewing that role). Every
 * other path lands on a catch-all.
 */
export function renderUsersRoutes(
  url: string,
  Page: () => ReactNode,
  {
    codes = USERS_ADMIN_CODES,
    previewRole = null,
    Roles = () => <p>roles page</p>,
    Branches = () => <p>branches page</p>,
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
  useUIStore.setState({ previewRole });

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
  const branches = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/users/branches',
    validateSearch: validateBranchesSearch,
    component: Branches,
  });
  const branchCreate = createRoute({
    getParentRoute: () => branches,
    path: 'create',
    component: () => null,
  });
  const branchEdit = createRoute({
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
    routeTree: root.addChildren([
      users.addChildren([create, edit]),
      roles,
      branches.addChildren([branchCreate, branchEdit]),
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
export function resetUsersRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
  useAuthStore.getState().clearAuth();
}
