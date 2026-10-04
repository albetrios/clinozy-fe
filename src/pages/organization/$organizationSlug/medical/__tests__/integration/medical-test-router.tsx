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
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';

import {
  validateMedicalCreateSearch,
  validateMedicalSearch,
} from '../../medical.search.ts';

/** A tab page and the dialog paths under it (each renders nothing, as `routeTree.tsx` has them). */
const TAB_DIALOGS = {
  sales: ['create', '$saleId', '$saleId/return'],
  medicines: ['create', '$medicineId/edit'],
  purchases: [
    'create',
    '$purchaseOrderId',
    '$purchaseOrderId/edit',
    '$purchaseOrderId/receive',
  ],
  suppliers: ['create', '$supplierId/edit'],
  manufacturers: ['create', '$manufacturerId/edit'],
  mrs: ['create', '$mrId/edit', '$mrId/visits/create'],
  payments: [],
} as const;

/** A Medical tab. */
export type MedicalTestTab = keyof typeof TAB_DIALOGS;

/**
 * The Medical family as `routeTree.tsx` registers it — every tab with the
 * room's search schema and its dialog routes, which render nothing — with
 * `pages[tab]` as each tab's component, opened at `url`, for a member
 * previewed as `role` (View-as narrows the clinic access to that role's
 * matrix). Every other path lands on a catch-all.
 */
export function renderMedicalRoutes(
  url: string,
  pages: Partial<Record<MedicalTestTab, () => ReactNode>>,
  { role = 'admin' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const medical = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/medical',
    component: () => <Outlet />,
  });
  const tabs = (Object.keys(TAB_DIALOGS) as MedicalTestTab[]).map((tab) => {
    const page = createRoute({
      getParentRoute: () => medical,
      path: tab,
      validateSearch: validateMedicalSearch,
      component: pages[tab] ?? (() => <p>{tab} tab</p>),
    });
    const dialogs = TAB_DIALOGS[tab].map((path) =>
      createRoute({
        getParentRoute: () => page,
        path,
        validateSearch: validateMedicalCreateSearch,
        component: () => null,
      }),
    );
    return page.addChildren(dialogs);
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([medical.addChildren(tabs), elsewhere]),
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

/** A query client for one test: no retries, nothing cached between tests. */
const testQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

/**
 * One Medical drawer (or any part of the room outside a tab's route) for a
 * member previewed as `role`, with the router, query client and tooltips the
 * room's shell provides — a drawer's dirty guard reads the router.
 */
export function renderMedicalDrawer(
  ui: ReactNode,
  { role = 'admin' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
  const queryClient = testQueryClient();
  const root = createRootRoute({
    component: () => <TooltipProvider>{ui}</TooltipProvider>,
  });
  const router = createRouter({
    routeTree: root,
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, queryClient, router };
}

/** Put the stores the harness touched back as they were. */
export function resetMedicalRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
