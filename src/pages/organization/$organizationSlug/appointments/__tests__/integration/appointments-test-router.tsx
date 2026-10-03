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

import {
  validateAppointmentCreateSearch,
  validateAppointmentSearch,
  validateAppointmentsSearch,
} from '../../appointments.search.ts';

/**
 * The Appointments family as `routeTree.tsx` registers it — the page with its
 * search schema and its two dialog routes, which render nothing — with `Page`
 * as the page's component, opened at `url`; plus Today, a room a drawer can
 * close back to. The guards and the edit redirect are `routeTree.test.tsx`'s.
 */
export function renderAppointmentsRoutes(url: string, Page: () => ReactNode) {
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
    component: () => <p data-testid="today-page">Today</p>,
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
