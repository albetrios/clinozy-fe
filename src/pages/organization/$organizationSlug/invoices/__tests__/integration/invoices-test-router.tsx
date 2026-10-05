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

import { validateInvoiceCreateSearch } from '../../invoices.dialog-search.ts';
import { validateInvoiceSearch } from '../../invoices.search.ts';
import { InvoicesLayout } from '../../InvoicesLayout.tsx';

/**
 * The invoices island as `routeTree.tsx` registers it — `create`,
 * `$invoiceId` and its `edit`, each rendering nothing — opened at `url` for a
 * member previewed as `role`. `host` stands in for the island's host (a
 * hook's probe); the Payments ledger behind it is a plain page here, and
 * every other path lands on a catch-all that names it.
 */
export function renderInvoicesRoutes(
  url: string,
  { role = 'admin', host = InvoicesLayout }: { role?: Role; host?: () => ReactNode } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
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
    component: () => <p data-testid="elsewhere">elsewhere</p>,
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
  useOrganizationStore.getState().clearPermissions();
}
