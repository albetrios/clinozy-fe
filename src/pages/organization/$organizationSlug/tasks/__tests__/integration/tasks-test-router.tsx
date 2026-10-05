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

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import { validateTaskCreateSearch } from '../../tasks.dialog-search.ts';
import { validateTasksSearch } from '../../tasks.search.ts';

/**
 * The Tasks family as `routeTree.tsx` registers it — the list with its search
 * schema and its two dialog routes, New task and the task drawer, which render
 * nothing — with `Page` as the list's component, opened at `url`, for a member
 * previewed as `role` (View-as narrows the clinic access to that role's
 * matrix). Every other path lands on a catch-all, so a test can read where a
 * link went.
 */
export function renderTasksRoutes(
  url: string,
  Page: () => ReactNode,
  { role = 'admin' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const tasks = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/tasks',
    validateSearch: validateTasksSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => tasks,
    path: 'create',
    validateSearch: validateTaskCreateSearch,
    component: () => null,
  });
  const task = createRoute({
    getParentRoute: () => tasks,
    path: '$taskId',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([tasks.addChildren([create, task]), elsewhere]),
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
export function resetTasksRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
