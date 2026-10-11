import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  supplierBillKey,
  supplierBillRefOf,
} from '@/shared/api/app/payments-contracts.ts';

import { usePayBill } from './usePayBill.ts';

/** The member's payment gates: whether they may record a payment and see the Payments room. */
const access = vi.hoisted(() => ({ resolved: true, canCreate: true, canRead: true }));
vi.mock('@/shared/hooks/usePaymentAccess/index.ts', () => ({
  usePaymentAccess: () => ({
    resolved: access.resolved,
    canRead: access.resolved && access.canRead,
    canCreate: access.resolved && access.canCreate,
    canEdit: false,
    canDelete: false,
    canGiveBack: false,
    canExport: false,
  }),
}));

const PO = 'mpo_0irgmlbrv8akvoipmawa8';
const PURCHASE = 'spur_0irgmlbrv8akvoipmawa8';

/** The room's Pay buttons, and whether they show. */
function Probe() {
  const { canPay, pay } = usePayBill();
  if (!canPay) return <p>no pay</p>;
  return (
    <>
      <button type="button" onClick={() => pay({ kind: 'medical_po', purchaseId: PO })}>
        pay order
      </button>
      <button
        type="button"
        onClick={() => pay({ kind: 'stock_po', purchaseId: PURCHASE })}
      >
        pay purchase
      </button>
    </>
  );
}

/** A room under the organization, and the Payments pay route the hook opens. */
function renderRoom() {
  const root = createRootRoute({ component: () => <Outlet /> });
  const room = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/medical/purchases',
    component: Probe,
  });
  const pay = createRoute({
    getParentRoute: () => root,
    path: '/organization/$organizationSlug/payments/pay',
    validateSearch: (search: Record<string, unknown>) => ({
      bill: typeof search.bill === 'string' ? search.bill : undefined,
    }),
    component: () => <p>send payment</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([room, pay]),
    history: createMemoryHistory({
      initialEntries: ['/organization/acme/medical/purchases'],
    }),
  });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

beforeEach(() => {
  access.resolved = true;
  access.canCreate = true;
  access.canRead = true;
});

describe('supplierBillKey / supplierBillRefOf', () => {
  it('keys a bill by its purchase’s public id, whose prefix names the kind', () => {
    expect(supplierBillKey({ kind: 'medical_po', purchaseId: PO })).toBe(PO);
    expect(supplierBillKey({ kind: 'stock_po', purchaseId: PURCHASE })).toBe(PURCHASE);
    expect(supplierBillRefOf(PO)).toEqual({ kind: 'medical_po', purchaseId: PO });
    expect(supplierBillRefOf(PURCHASE)).toEqual({
      kind: 'stock_po',
      purchaseId: PURCHASE,
    });
    expect(supplierBillRefOf('pay_0irgmlbrv8akvoipmawa8')).toBeNull();
  });
});

describe('usePayBill', () => {
  it('opens Send payment on a Medical PO’s bill', async () => {
    const user = userEvent.setup();
    const router = renderRoom();
    await user.click(await screen.findByRole('button', { name: 'pay order' }));
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/organization/acme/payments/pay'),
    );
    expect(router.state.location.search).toEqual({ bill: PO });
  });

  it('opens Send payment on a Clinic stock purchase’s bill', async () => {
    const user = userEvent.setup();
    const router = renderRoom();
    await user.click(await screen.findByRole('button', { name: 'pay purchase' }));
    await waitFor(() => expect(router.state.location.search).toEqual({ bill: PURCHASE }));
  });

  it('offers nothing without payment:create', async () => {
    access.canCreate = false;
    renderRoom();
    expect(await screen.findByText('no pay')).toBeInTheDocument();
  });

  it('offers nothing without payment:read — Send payment is the Payments room’s (PAY-M3)', async () => {
    access.canRead = false;
    renderRoom();
    expect(await screen.findByText('no pay')).toBeInTheDocument();
  });

  it('offers nothing while access is unresolved', async () => {
    access.resolved = false;
    renderRoom();
    expect(await screen.findByText('no pay')).toBeInTheDocument();
  });
});
