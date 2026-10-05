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

import { supplierBillKey } from '@/shared/api/clinic/payments-contracts.ts';

import { usePayBill } from './usePayBill.ts';

/** The member's access: whether Payments Create is granted. */
const access = vi.hoisted(() => ({ isResolved: true, canCreate: true }));
vi.mock('@/shared/hooks/useClinicAccess/index.ts', () => ({
  useClinicAccess: () => ({
    isResolved: access.isResolved,
    can: (section: string, action: string) =>
      section === 'payments' && action === 'create' && access.canCreate,
  }),
}));

const PO = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';
const PURCHASE = '6f1e2d3c-4b5a-4c9d-8e7f-0a1b2c3d4e5f';

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
  access.isResolved = true;
  access.canCreate = true;
});

describe('supplierBillKey', () => {
  it('keys a Medical PO as md: and a Clinic stock purchase as is:', () => {
    expect(supplierBillKey({ kind: 'medical_po', purchaseId: PO })).toBe(`md:${PO}`);
    expect(supplierBillKey({ kind: 'stock_po', purchaseId: PURCHASE })).toBe(
      `is:${PURCHASE}`,
    );
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
    expect(router.state.location.search).toEqual({ bill: `md:${PO}` });
  });

  it('opens Send payment on a Clinic stock purchase’s bill', async () => {
    const user = userEvent.setup();
    const router = renderRoom();
    await user.click(await screen.findByRole('button', { name: 'pay purchase' }));
    await waitFor(() =>
      expect(router.state.location.search).toEqual({ bill: `is:${PURCHASE}` }),
    );
  });

  it('offers nothing without Payments Create', async () => {
    access.canCreate = false;
    renderRoom();
    expect(await screen.findByText('no pay')).toBeInTheDocument();
  });

  it('offers nothing while access is unresolved', async () => {
    access.isResolved = false;
    renderRoom();
    expect(await screen.findByText('no pay')).toBeInTheDocument();
  });
});
