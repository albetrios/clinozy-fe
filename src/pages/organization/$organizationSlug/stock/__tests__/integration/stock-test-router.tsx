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
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { validateStockCreateSearch, validateStockSearch } from '../../stock.search.ts';

/** A tab page and the dialog paths under it (each renders nothing, as `routeTree.tsx` has them). */
const TAB_DIALOGS = {
  items: ['create', '$itemId/edit', 'check'],
  purchases: ['create', '$purchaseId/edit'],
  movements: [],
  vendors: ['create', '$vendorId/edit'],
} as const;

/** A Clinic stock tab. */
export type StockTestTab = keyof typeof TAB_DIALOGS;

/** A query client for one test: no retries, nothing cached between tests. */
const testQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

/**
 * The Clinic stock family as `routeTree.tsx` registers it — every tab with the
 * room's search schema and its dialog routes, which render nothing — with
 * `pages[tab]` as each tab's component, opened at `url`, for a member
 * previewed as `role` (View-as narrows the clinic access to that role's
 * matrix). Every other path lands on a catch-all.
 */
export function renderStockRoutes(
  url: string,
  pages: Partial<Record<StockTestTab, () => ReactNode>>,
  { role = 'admin' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({
    component: () => (
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    ),
  });
  const stock = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/stock',
    component: () => <Outlet />,
  });
  const tabs = (Object.keys(TAB_DIALOGS) as StockTestTab[]).map((tab) => {
    const page = createRoute({
      getParentRoute: () => stock,
      path: tab,
      validateSearch: validateStockSearch,
      component: pages[tab] ?? (() => <p>{tab} tab</p>),
    });
    const dialogs = TAB_DIALOGS[tab].map((path) =>
      createRoute({
        getParentRoute: () => page,
        path,
        validateSearch: validateStockCreateSearch,
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
    routeTree: root.addChildren([stock.addChildren(tabs), elsewhere]),
    history: createMemoryHistory({ initialEntries: [url] }),
  });
  const queryClient = testQueryClient();
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...view, router, queryClient };
}

/**
 * One Clinic stock drawer, popover or confirm (any part of the room outside a
 * tab's route) for a member previewed as `role`, with the router, query client
 * and tooltips the room's shell provides — a drawer's dirty guard reads the
 * router.
 */
export function renderStockDrawer(
  ui: ReactNode,
  { role = 'admin' }: { role?: Role } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });
  return renderWithProviders(<TooltipProvider>{ui}</TooltipProvider>);
}

/** Put the stores the harness touched back as they were. */
export function resetStockRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
