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

import type { Role } from '@/shared/api/app/app-schema.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import { validateMedicalCreateSearch } from '../../medical.dialog-search.ts';
import {
  validateMedicalCreditsSearch,
  validateMedicalPaymentsSearch,
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
  credits: [],
} as const;

/** A Medical tab. */
export type MedicalTestTab = keyof typeof TAB_DIALOGS;

/** The eight tabs in the tab row's order. */
export const MEDICAL_TEST_TABS = Object.keys(TAB_DIALOGS) as MedicalTestTab[];

/** Each tab's search schema, as `routeTree.tsx` has it. */
const TAB_SEARCH: Partial<
  Record<MedicalTestTab, (search: Record<string, unknown>) => object>
> = {
  payments: validateMedicalPaymentsSearch,
  credits: validateMedicalCreditsSearch,
};

/** A member of `acme` holding the `role` preset's codes — the room's live reads need the organization. */
function signInAs(role: Role) {
  signInTestMember();
  useOrganizationStore.getState().setPermissions([...PRESET_CODES[role]]);
}

/**
 * The Medical family as `routeTree.tsx` registers it — every tab with the
 * room's search schema and its dialog routes, which render nothing — with
 * `pages[tab]` as each tab's component, opened at `url`, for a member of
 * `acme` holding the `role` preset's codes, under the tooltips the app's shell
 * provides (a drawer's buttons carry them). Every other path lands on a
 * catch-all.
 */
export function renderMedicalRoutes(
  url: string,
  pages: Partial<Record<MedicalTestTab, () => ReactNode>>,
  { role = 'admin' }: { role?: Role } = {},
) {
  signInAs(role);

  const root = createRootRoute({
    component: () => (
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    ),
  });
  const medical = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/medical',
    component: () => <Outlet />,
  });
  const tabs = MEDICAL_TEST_TABS.map((tab) => {
    const page = createRoute({
      getParentRoute: () => medical,
      path: tab,
      validateSearch: TAB_SEARCH[tab] ?? validateMedicalSearch,
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
 * member of `acme` holding the `role` preset's codes, with the router, query client and
 * tooltips the room's shell provides — a drawer's dirty guard reads the router.
 */
export function renderMedicalDrawer(
  ui: ReactNode,
  { role = 'admin' }: { role?: Role } = {},
) {
  signInAs(role);
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
  useOrganizationStore.getState().clearOrganization();
}
