import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchAllInvoices } from '@/shared/api/clinic/invoices-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  invoiceRecord,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
} from '@/tests/utils/payments-doubles.ts';

import { useCheckoutDues } from './useCheckoutDues.ts';

vi.mock('@/shared/api/clinic/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllInvoices: vi.fn(),
}));
/** Whether the member reads money (`payment:read`), and the header's branches. */
const member = vi.hoisted(() => ({ reads: true, branches: [] as string[] }));
vi.mock('@/shared/hooks/usePaymentAccess/index.ts', () => ({
  usePaymentAccess: () => ({ canRead: member.reads }),
}));
vi.mock('@/shared/hooks/usePreferences/index.ts', () => ({
  usePreferences: () => ({
    preferences: { branchFilter: member.branches },
    isPending: false,
  }),
}));

const TODAY = '2026-10-10';
/** Rhea Shah — another person at checkout. */
const RHEA = 'con_rheashah000000000000';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.mocked(fetchAllInvoices).mockReset();
  member.reads = true;
  member.branches = [TEST_MONEY_BRANCH_ID];
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useCheckoutDues (research-payments G-P17)', () => {
  it('reads today’s open invoices at the header’s branches once, and adds up each person’s due', async () => {
    vi.mocked(fetchAllInvoices).mockResolvedValue([
      invoiceRecord({ due: 100 }),
      invoiceRecord({ id: 'invc_second00000000000000', seq: 9, due: 1400.5 }),
      invoiceRecord({
        id: 'invc_rhea0000000000000000',
        seq: 10,
        contactId: RHEA,
        due: 500,
      }),
      invoiceRecord({ id: 'invc_walkin00000000000000', seq: 11, contactId: null }),
    ]);
    const { result } = renderHook(
      () => useCheckoutDues({ enabled: true, today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.size).toBe(2));
    expect(result.current.get(TEST_MONEY_CONTACT_ID)).toBe(1500.5);
    expect(result.current.get(RHEA)).toBe(500);
    expect(fetchAllInvoices).toHaveBeenCalledTimes(1);
    expect(fetchAllInvoices).toHaveBeenCalledWith({
      status: ['unpaid', 'partial'],
      branchIds: [TEST_MONEY_BRANCH_ID],
      day: TODAY,
    });
  });

  it('reads nothing while the Checkout lane is closed or empty', async () => {
    const { result } = renderHook(
      () => useCheckoutDues({ enabled: false, today: TODAY }),
      { wrapper },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.size).toBe(0);
    expect(fetchAllInvoices).not.toHaveBeenCalled();
  });

  it('reads nothing for a member who does not read money', async () => {
    member.reads = false;
    const { result } = renderHook(
      () => useCheckoutDues({ enabled: true, today: TODAY }),
      { wrapper },
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(result.current.size).toBe(0);
    expect(fetchAllInvoices).not.toHaveBeenCalled();
  });

  it('shows nothing when the read fails — the cards keep their action', async () => {
    vi.mocked(fetchAllInvoices).mockRejectedValue(new Error('offline'));
    const { result } = renderHook(
      () => useCheckoutDues({ enabled: true, today: TODAY }),
      { wrapper },
    );
    await waitFor(() => expect(fetchAllInvoices).toHaveBeenCalled());
    expect(result.current.size).toBe(0);
  });
});
