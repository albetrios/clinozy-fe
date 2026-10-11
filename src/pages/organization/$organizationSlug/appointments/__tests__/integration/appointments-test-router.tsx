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

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
} from '../../appointments.dialog-search.ts';
import { validateAppointmentsSearch } from '../../appointments.search.ts';
import { AppointmentActionsProvider } from '../../components/AppointmentActions/index.ts';

/** The Appointments page's path in the tests. */
export const APPOINTMENTS_PAGE = '/organization/acme/appointments';

/**
 * The test member's codes on clinozy-be — `useAppAccess` reads the Appointments room's from
 * them: every booking action (read, create, update, delete, and a lead from the contact card),
 * or read only (no Edit, no Create).
 */
export function grantAppAccess(level: 'owner' | 'none' = 'owner') {
  useOrganizationStore.setState({
    permissions: (level === 'owner'
      ? [
          'organization:read',
          'appointment:read',
          'appointment:create',
          'appointment:update',
          'appointment:delete',
          'lead:create',
        ]
      : ['organization:read', 'appointment:read']) as never,
    permissionsResolved: true,
  });
}

/**
 * The Appointments family as `routeTree.tsx` registers it — the page with its
 * search schema and its two dialog routes, which render nothing — with `Page`
 * as the page's component, opened at `url`; plus Today, a room a drawer can
 * close back to — or a cross-room drawer opens over (A-P1), `Today` standing in
 * for its page. The guards and the edit redirect are `routeTree.test.tsx`'s.
 */
export function renderAppointmentsRoutes(
  url: string,
  Page: () => ReactNode,
  {
    Today = () => <p data-testid="today-page">Today</p>,
  }: { Today?: () => ReactNode } = {},
) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const appointments = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/appointments',
    validateSearch: validateAppointmentsSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => appointments,
    path: 'create',
    validateSearch: validateAppointmentCreateSearch,
    component: () => null,
  });
  const appointment = createRoute({
    getParentRoute: () => appointments,
    path: '$appointmentId',
    validateSearch: validateAppointmentSearch,
    component: () => null,
  });
  const today = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/today',
    component: Today,
  });
  const router = createRouter({
    routeTree: root.addChildren([appointments.addChildren([create, appointment]), today]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/**
 * Render one of the room's units on the Appointments page at `url`, inside the
 * room's booking actions and the tooltip provider the page gives it.
 */
export function renderInAppointments(ui: ReactNode, url = APPOINTMENTS_PAGE) {
  return renderAppointmentsRoutes(url, () => (
    <AppointmentActionsProvider>
      <TooltipProvider>{ui}</TooltipProvider>
    </AppointmentActionsProvider>
  ));
}
