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
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { meContextQueryKey } from '@/shared/tenancy/me-context.ts';
import { PRESET_CODES, presetMyRoles } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { validateTodaySearch } from '../../today.search.ts';

/** Today's path in the tests' organization. */
export const TODAY_PATH = '/organization/acme/today';

/** A front desk member's codes on Today: the floor's moves and bookings, and the work queue's. */
export const TODAY_FRONT_DESK_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'appointment:read',
  'appointment:create',
  'appointment:update',
  'lead:read',
  'lead:create',
  'lead:update',
  'contact_activity:create',
  'task:read',
  'task:update',
];

/** Who the harness signs in: a member holding a preset's codes (the default), or these codes. */
export interface TodayTestMember {
  /** A member who holds this preset — its codes, and its name on me/context (Today's focus). */
  role?: Role;
  /** The member's clinozy-be codes instead of a preset's — no role on me/context. */
  permissions?: readonly OrganizationPermission[];
  firstName?: string | null;
}

/**
 * Today as `routeTree.tsx` registers it — the page with its search schema —
 * opened at `url` for the test member (`signInTestMember`: organization
 * `org_test`, slug `acme`) holding `role`'s preset codes or `permissions`, greeted as Riya.
 * Every other path lands on a catch-all, so a test can read where a link went.
 */
export function renderTodayRoute(
  url: string,
  Page: () => ReactNode,
  { role = 'front_desk', permissions, firstName = 'Riya' }: TodayTestMember = {},
) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions([...(permissions ?? PRESET_CODES[role])]);

  const root = createRootRoute({ component: () => <Outlet /> });
  const today = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/today',
    validateSearch: validateTodaySearch,
    component: Page,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([today, elsewhere]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  queryClient.setQueryDefaults(meContextQueryKey, {
    staleTime: Number.POSITIVE_INFINITY,
  });
  queryClient.setQueryData(meContextQueryKey, {
    user: {
      id: '00000000-0000-4000-8000-000000000001',
      email: 'riya@cresence.test',
      isEmailVerified: true,
      isMfaEnabled: false,
      firstName,
      lastName: 'Shah',
    },
    activeOrganization: null,
    membershipId: null,
    myPermissions: ['organization:read'],
    myRoles: permissions ? [] : presetMyRoles(role),
    globalRole: 'user',
    deploymentFlags: {
      personalOrganizationsEnabled: false,
      teamOrganizationsEnabled: true,
    },
    personalOrganizationId: null,
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/** Put the stores the harness touched back as they were. */
export function resetTodayRoute() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
}
