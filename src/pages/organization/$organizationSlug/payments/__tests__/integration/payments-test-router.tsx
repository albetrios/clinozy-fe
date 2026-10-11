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
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { useUIStore } from '@/shared/store/useUIStore/index.ts';
import { PRESET_CODES } from '@/tests/utils/app-preset-codes.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';

import {
  validateDayCloseSearch,
  validatePaymentPaySearch,
  validatePaymentReceiveSearch,
} from '../../payments.dialog-search.ts';
import { validatePaymentsSearch } from '../../payments.search.ts';
import { PaymentsPage } from '../../PaymentsPage.tsx';
import { validatePendingSearch } from '../../pending/pending.search.ts';
import { PendingPage } from '../../pending/PendingPage.tsx';

/**
 * Every code an Owner holds in the ledger (research §7): see, receive and send, change, delete
 * and reverse, export — and read Clinic stock's bills.
 */
export const PAYMENTS_OWNER_CODES: readonly OrganizationPermission[] = [
  'organization:read',
  'payment:read',
  'payment:create',
  'payment:update',
  'payment:delete',
  'payment:export',
  'stock_item:read',
  'contact:read',
];

/** Who the harness signs in, and the pages it mounts. */
export interface PaymentsRoutesOptions {
  /** A member holding this preset's codes — Admin's by default, unless `permissions` is given. */
  role?: Role;
  /** The member's own clinozy-be codes instead of View-as — how the room on the API answers. */
  permissions?: readonly OrganizationPermission[];
  /** The ledger's component (a hook's probe stands in). */
  ledger?: () => ReactNode;
  /** Pending's component. */
  pending?: () => ReactNode;
}

/**
 * The Payments family as `routeTree.tsx` registers it — the ledger with its
 * dialog routes (Receive, Pay, an entry's edit, Day close) and Pending with
 * its own (Add pending, Edit pending), each rendering nothing — opened at
 * `url`, for the test member (`signInTestMember`: organization `org_test`, slug
 * `acme` — every money read and key carries the organization) holding
 * `permissions`, or the `role` preset's codes. `ledger` and `pending` stand in
 * for the two pages (a hook's probe). Every other path lands on a catch-all.
 */
export function renderPaymentsRoutes(
  url: string,
  {
    role,
    permissions,
    ledger = PaymentsPage,
    pending: pendingPage = PendingPage,
  }: PaymentsRoutesOptions = {},
) {
  signInTestMember();
  useOrganizationStore
    .getState()
    .setPermissions([
      ...(permissions && !role ? permissions : PRESET_CODES[role ?? 'admin']),
    ]);

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
  useOrganizationStore.getState().clearOrganization();
}
