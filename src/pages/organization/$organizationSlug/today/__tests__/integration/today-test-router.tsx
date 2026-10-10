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

/** Who the harness signs in: View-as a clinic role (the default), or a member by their codes. */
export interface TodayTestMember {
  /** View-as: the clinic access narrows to that role's matrix, and every code reads false. */
  role?: Role;
  /** The member's clinozy-be codes instead of a preview — the work queue answers from them. */
  permissions?: readonly OrganizationPermission[];
  firstName?: string | null;
}

/**
 * Today as `routeTree.tsx` registers it — the page with its search schema —
 * opened at `url` for the test member (`signInTestMember`: organization
 * `org_test`, slug `acme`) previewed as `role` (View-as narrows the clinic
 * access to that role's matrix) or holding `permissions`, greeted as Riya.
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
    .setPermissions([...(permissions ?? ['organization:read'])]);
  useUIStore.setState({ previewRole: permissions ? null : role });

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
    myPermissions: ['organization:read'],
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
