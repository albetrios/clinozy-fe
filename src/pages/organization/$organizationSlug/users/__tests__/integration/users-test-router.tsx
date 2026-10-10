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
import { PRESET_ROLE_NAMES } from '@/shared/api/clinic/access-contracts.ts';
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import type { Member, RoleSummary } from '@/shared/api/organization-contracts.ts';
import { useAuthStore } from '@/shared/store/useAuthStore/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES, previewPreset } from '@/tests/utils/clinic-preset-codes.ts';

import { validateBranchesSearch } from '../../branches/branches.search.ts';
import { validateUserEditSearch } from '../../users.dialog-search.ts';
import { validateRolesSearch, validateUsersSearch } from '../../users.search.ts';

/** The Owner's codes: every member, role and branch write the Users room offers. */
export const USERS_ADMIN_CODES: OrganizationPermission[] = [...PRESET_CODES.owner];

/** A public id: the prefix and 21 characters, as clinozy-be makes them. */
const publicId = (prefix: string, key: string) =>
  `${prefix}_${key
    .replaceAll(/[^a-z0-9]/g, '')
    .padEnd(21, '0')
    .slice(0, 21)}`;

/** A clinozy-be role, as `listRoles` maps it. */
export function platformRole(
  key: string,
  name: string,
  isSystem: boolean,
  overrides: Partial<RoleSummary> = {},
): RoleSummary {
  return {
    id: publicId('rol', key),
    name,
    description: '',
    permissions: [],
    memberCount: 0,
    isSystem,
    isLocked: false,
    tone: 'sky',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** A preset role, named as clinozy-be provisions it. */
const preset = (role: Role, overrides: Partial<RoleSummary> = {}) =>
  platformRole(role, PRESET_ROLE_NAMES[role], true, overrides);

/** The roles a clinic is provisioned with (Owner and Admin locked), and one custom role. */
export const PLATFORM_ROLES = {
  owner: preset('owner', { isLocked: true, tone: 'slate' }),
  admin: preset('admin', { isLocked: true, tone: 'plum' }),
  doctor: preset('doctor', { tone: 'sky' }),
  therapist: preset('therapist', { tone: 'butter' }),
  front_desk: preset('front_desk', { tone: 'mint' }),
  counsellor: preset('counsellor', { tone: 'peach' }),
  pharmacist: preset('pharmacist', { tone: 'blush' }),
  accountant: preset('accountant', { tone: 'sage' }),
  marketing: preset('marketing', { tone: 'lav' }),
  senior: platformRole('senior', 'Senior desk', false, {
    tone: 'lime',
    description: 'Runs the desk on weekends',
  }),
};

/** A clinozy-be membership, as `listMembers` maps it. */
export function member(
  key: string,
  email: string,
  roles: RoleSummary | readonly RoleSummary[] = PLATFORM_ROLES.front_desk,
  overrides: Partial<Member> = {},
): Member {
  const roleIds = (Array.isArray(roles) ? roles : [roles]).map(
    (role: RoleSummary) => role.id,
  );
  return {
    id: publicId('mem', key),
    userId: `usr_${key}`,
    name: email,
    email,
    status: 'active',
    roleIds,
    roleId: roleIds[0] ?? '',
    isOwner: roleIds.includes(PLATFORM_ROLES.owner.id),
    joinedAt: '2026-09-01T10:00:00.000Z',
    invitation: null,
    staffNumber: 1,
    phone: null,
    tone: 'sky',
    branchIds: [],
    workingDays: ['mon', 'tue', 'wed', 'thu', 'fri', 'sat'],
    workStartsAt: '10:00',
    workEndsAt: '19:00',
    commissionPercent: 0,
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    ...overrides,
  };
}

/** The signed-in member of the harness: Riya (#12). */
export const SELF = { userId: 'usr_riya', email: 'riya@cresence.skin' };

/** What a harness run is set up with besides the Team's component. */
interface UsersRoutesOptions {
  /** The member's clinozy-be codes. */
  codes?: OrganizationPermission[];
  /** A preset to preview (View-as) — its codes already read. */
  previewRole?: Role | null;
  /** The Roles & access page's component (`/users/roles`); a marker by default. */
  Roles?: () => ReactNode;
  /** The Branches page's component (`/users/branches`); a marker by default. */
  Branches?: () => ReactNode;
}

/**
 * The Users family as `routeTree.tsx` registers it — the Team with its search
 * schema and its two dialog routes, which render nothing, and Roles & access
 * and Branches (with its own two) beside it — with `Page` as the Team's
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
