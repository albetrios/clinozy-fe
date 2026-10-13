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
import type { Role } from '@/shared/api/app/app-schema.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { renderWithProviders } from '@/tests/utils/renderWithProviders.tsx';

import { validateStockCreateSearch } from '../../stock.dialog-search.ts';
import { validateStockSearch } from '../../stock.search.ts';

/** A tab page and the dialog paths under it (each renders nothing, as `routeTree.tsx` has them). */
const TAB_DIALOGS = {
  items: ['create', '$itemId/edit', 'check'],
  purchases: ['create', '$purchaseId/edit'],
  movements: [],
  vendors: ['create', '$vendorId/edit'],
} as const;

/** A Clinic stock tab. */
export type StockTestTab = keyof typeof TAB_DIALOGS;

/**
 * Every code an Owner or Admin holds in the room (api-integration §5.6 Roles) — the
 * harness's member unless a test names others: see, add, change and move stock, delete,
 * export, and pay a bill ("Paid" on a new purchase; "Pay ₹X" through Payments, which also
 * needs `payment:read`).
 */
const STOCK_ADMIN_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'stock_item:read',
  'stock_item:create',
  'stock_item:update',
  'stock_item:delete',
  'stock_item:export',
  'payment:create',
  'payment:read',
];

/** Who the harness signs in: their clinozy-be codes, or a preset's. */
export interface StockTestMember {
  /** The member's codes (the room answers from them); the Admin's by default. */
  permissions?: readonly OrganizationPermission[];
  /** A member holding this preset's codes instead. */
  role?: Role;
}

/** Sign the test member in as `member` says. */
function signInStockMember({ permissions = STOCK_ADMIN_CODES, role }: StockTestMember) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions([...(role ? PRESET_CODES[role] : permissions)]);
}

/** A query client for one test: no retries, nothing cached between tests. */
const testQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } },
  });

/**
 * The Clinic stock family as `routeTree.tsx` registers it — every tab with the
 * room's search schema and its dialog routes, which render nothing — with
 * `pages[tab]` as each tab's component, opened at `url`, for the test member
 * (`signInTestMember`: organization `org_test`, slug `acme` — every stock read
 * and key carries the organization) holding `member.permissions` (the Admin's
 * codes by default), or the `member.role` preset's codes. Every other path
 * lands on a catch-all.
 */
export function renderStockRoutes(
  url: string,
  pages: Partial<Record<StockTestTab, () => ReactNode>>,
  member: StockTestMember = {},
) {
  signInStockMember(member);

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
 * tab's route) for the test member — the Admin's codes, `member.permissions`,
 * or View-as `member.role` — with the router, query client and tooltips the
 * room's shell provides — a drawer's dirty guard reads the router.
 */
export function renderStockDrawer(ui: ReactNode, member: StockTestMember = {}) {
  signInStockMember(member);
  return renderWithProviders(<TooltipProvider>{ui}</TooltipProvider>);
}

/** Put the stores the harness touched back as they were. */
export function resetStockRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
}
