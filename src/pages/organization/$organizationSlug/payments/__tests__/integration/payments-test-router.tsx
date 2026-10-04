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

import {
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
  validatePaymentsSearch,
} from '../../payments.search.ts';
import { PaymentsPage } from '../../PaymentsPage.tsx';
import { validatePendingSearch } from '../../pending/pending.search.ts';
import { PendingPage } from '../../pending/PendingPage.tsx';

/**
 * The Payments family as `routeTree.tsx` registers it — the ledger with its
 * dialog routes (Receive, Pay, an entry's edit, Day close) and Pending with
 * its own (Add pending, Edit pending), each rendering nothing — opened at
 * `url`, for a member previewed as `role` (View-as narrows the clinic access
 * to that role's matrix). `ledger` and `pending` stand in for the two pages (a
 * hook's probe). Every other path lands on a catch-all.
 */
export function renderPaymentsRoutes(
  url: string,
  {
    role = 'admin',
    ledger = PaymentsPage,
    pending: pendingPage = PendingPage,
  }: { role?: Role; ledger?: () => ReactNode; pending?: () => ReactNode } = {},
) {
  useOrganizationStore.getState().setPermissions(['organization:read']);
  useUIStore.setState({ previewRole: role });

  const root = createRootRoute({ component: () => <Outlet /> });
  const payments = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/payments',
    validateSearch: validatePaymentsSearch,
    component: ledger,
  });
  const receive = createRoute({
    getParentRoute: () => payments,
    path: 'receive',
    validateSearch: validatePaymentReceiveSearch,
    component: () => null,
  });
  const pay = createRoute({
    getParentRoute: () => payments,
    path: 'pay',
    validateSearch: validatePaymentPaySearch,
    component: () => null,
  });
  const edit = createRoute({
    getParentRoute: () => payments,
    path: '$paymentId/edit',
    component: () => null,
  });
  const dayClose = createRoute({
    getParentRoute: () => payments,
    path: 'day-close',
    validateSearch: validateDayCloseSearch,
    component: () => null,
  });
  const pending = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/payments/pending',
    validateSearch: validatePendingSearch,
    component: pendingPage,
  });
  const pendingCreate = createRoute({
    getParentRoute: () => pending,
    path: 'create',
    component: () => null,
  });
  const creditEdit = createRoute({
    getParentRoute: () => pending,
    path: '$creditId/edit',
    component: () => null,
  });
  const elsewhere = createRoute({
    getParentRoute: () => root,
    path: '$',
    component: () => <p>elsewhere</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([
      payments.addChildren([receive, pay, edit, dayClose]),
      pending.addChildren([pendingCreate, creditEdit]),
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
export function resetPaymentsRoutes() {
  useUIStore.setState({ previewRole: null });
  useOrganizationStore.getState().clearPermissions();
}
