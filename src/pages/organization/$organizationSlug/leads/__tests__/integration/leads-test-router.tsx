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

import { validateLeadCreateSearch } from '../../leads.dialog-search.ts';
import { validateLeadsSearch } from '../../leads.search.ts';

/**
 * The Leads family as `routeTree.tsx` registers it — the list with its search
 * schema and its two dialog routes, which render nothing — with `Page` as the
 * list's component, opened at `url`. The guards and the edit redirect are
 * `routeTree.test.tsx`'s.
 */
export function renderLeadsRoutes(url: string, Page: () => ReactNode) {
  const root = createRootRoute({ component: () => <Outlet /> });
  const leads = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/leads',
    validateSearch: validateLeadsSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => leads,
    path: 'create',
    validateSearch: validateLeadCreateSearch,
    component: () => null,
  });
  const lead = createRoute({
    getParentRoute: () => leads,
    path: '$leadId',
    component: () => null,
  });
  const router = createRouter({
    routeTree: root.addChildren([leads.addChildren([create, lead])]),
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
