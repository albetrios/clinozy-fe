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
import type { i18n as I18n } from 'i18next';
import type { ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';

import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  validatePatientCreateSearch,
  validatePatientsSearch,
} from '../../patients.search.ts';

/**
 * The Patients family as `routeTree.tsx` registers it — the list with its
 * search schema and its New patient dialog route, which renders nothing — with
 * `Page` as the list's component, opened at `url`, for a member previewed as
 * `role` (View-as narrows the clinic access to that role's matrix). Every
 * other path lands on a catch-all, so a test can read where a row action went.
 * The guards are `routeTree.test.tsx`'s. `i18n` swaps the suite's instance —
 * which holds every namespace — for one holding only what the route loads.
 */
export function renderPatientsRoutes(
  url: string,
  Page: () => ReactNode,
  { role = 'admin', i18n }: { role?: Role; i18n?: I18n } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const patients = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/patients',
    validateSearch: validatePatientsSearch,
    component: Page,
  });
  const create = createRoute({
    getParentRoute: () => patients,
    path: 'create',
    validateSearch: validatePatientCreateSearch,
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([patients.addChildren([create]), elsewhere]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const app = (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  );
  const view = render(i18n ? <I18nextProvider i18n={i18n}>{app}</I18nextProvider> : app);
  return { ...view, router, queryClient };
}

/** Put the stores the harness touched back as they were. */
export function resetPatientsRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
