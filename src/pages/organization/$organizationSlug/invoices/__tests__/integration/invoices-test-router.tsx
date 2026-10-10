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
import type { Role } from '@/shared/api/clinic/clinic-schema.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/clinic-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import { validateInvoiceCreateSearch } from '../../invoices.dialog-search.ts';
import { validateInvoiceSearch } from '../../invoices.search.ts';
import { InvoicesLayout } from '../../InvoicesLayout.tsx';

/**
 * Every money code an Owner holds (research-payments §7) — the harness's member unless a test
 * names others: see, bill, change, delete and restore invoices, see the lowest price, add an
 * offering.
 */
const INVOICE_OWNER_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
  'offering:lower_price:read',
  'offering:create',
];

/** Who the harness signs in: their clinozy-be codes, or a preset's. */
export interface InvoiceTestMember {
  /** The member's codes (the drawer answers from them); the Owner's by default. */
  permissions?: readonly OrganizationPermission[];
  /** A member holding this preset's codes instead. */
  role?: Role;
}

/** Sign the test member in to organization `org_test` (slug `acme`) as `member` says. */
function signInInvoiceMember({
  permissions = INVOICE_OWNER_CODES,
  role,
}: InvoiceTestMember = {}) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions([...(role ? PRESET_CODES[role] : permissions)]);
}

/**
 * The invoices island as `routeTree.tsx` registers it — `create`, `$invoiceId` and its `edit`,
 * each rendering nothing — opened at `url` for the test member (`signInInvoiceMember`: the
 * Owner's codes, `permissions`, or a preset `role`'s). `host` stands in for the island's host (a
 * hook's probe); the Payments ledger behind it is a plain page here, and every other path lands
 * on a catch-all that names it — or on `elsewhere`, a room a drawer opens over (A-P1).
 */
export function renderInvoicesRoutes(
  url: string,
  {
    role,
    permissions,
    host = InvoicesLayout,
    elsewhere: Elsewhere = () => <p data-testid="elsewhere">elsewhere</p>,
  }: InvoiceTestMember & { host?: () => ReactNode; elsewhere?: () => ReactNode } = {},
) {
  signInInvoiceMember({ role, permissions });

  const root = createRootRoute({
    component: () => (
      <TooltipProvider>
        <Outlet />
      </TooltipProvider>
    ),
  });
  const Host = host;
  const invoices = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/invoices',
    validateSearch: validateInvoiceSearch,
    component: () => (
      <>
        <p>ledger behind</p>
        <Outlet />
        <Host />
      </>
    ),
  });
  const create = createRoute({
    getParentRoute: () => invoices,
    path: 'create',
    validateSearch: validateInvoiceCreateSearch,
    component: () => null,
  });
  const invoice = createRoute({
    getParentRoute: () => invoices,
    path: '$invoiceId',
    component: () => <Outlet />,
  });
  const edit = createRoute({
    getParentRoute: () => invoice,
    path: 'edit',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: Elsewhere,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      invoices.addChildren([create, invoice.addChildren([edit])]),
      elsewhere,
    ]),
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
export function resetInvoicesRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearOrganization();
}
