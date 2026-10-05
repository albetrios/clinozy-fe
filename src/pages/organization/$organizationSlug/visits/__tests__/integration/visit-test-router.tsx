import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useLocation,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { meContextQueryKey } from '@/shared/tenancy/me-context.ts';

import { validateVisitSearch } from '../../visits.search.ts';

/** The visit of a floor booking (by its seq), as Today's lanes link it. */
export function visitPath(appointmentSeq: number, tab?: string): string {
  const query = tab ? `?tab=${tab}` : '';
  return `/organization/acme/visits/${ref.visit(appointmentSeq)}${query}`;
}

/**
 * The Visit sheet as `routeTree.tsx` registers it — its page with the `tab`
 * schema — opened at `url` for a member previewed as `role` (View-as narrows
 * the clinic access to that role's matrix). Every other path lands on a
 * catch-all that shows where it went.
 */
export function renderVisitRoute(
  url: string,
  Page: () => ReactNode,
  { role = 'owner' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const visit = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/visits/$visitId',
    validateSearch: validateVisitSearch,
    component: Page,
  });
  // Where a link went: every other path lands here and shows itself.
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: function Elsewhere() {
      const location = useLocation();
      return <p data-testid="elsewhere">{location.href}</p>;
    },
  });
  const router = createRouter({
    routeTree: root.addChildren([visit, elsewhere]),
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
      firstName: 'Riya',
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
export function resetVisitRoute() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
