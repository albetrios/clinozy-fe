import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/credits-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPendingCredits: vi.fn(),
  fetchCredit: vi.fn(),
  createCredit: vi.fn(),
  updateCredit: vi.fn(),
  deleteCredit: vi.fn(),
  restoreCredit: vi.fn(),
  settleCredit: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import {
  createCredit,
  creditQueryKeys,
  deleteCredit,
  fetchCredit,
  listPendingCredits,
  restoreCredit,
  settleCredit,
  updateCredit,
} from '@/shared/api/app/credits-api.ts';
import type { CreditInput } from '@/shared/api/app/credits-contracts.ts';
import { invoiceQueryKeys } from '@/shared/api/app/invoices-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  creditRow,
  TEST_CREDIT_ID,
  TEST_INVOICE_ID,
  TEST_MONEY_CONTACT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  useCreateCredit,
  useCredit,
  useCreditList,
  useDeleteCredit,
  useRestoreCredit,
  useSettleCredit,
  useUpdateCredit,
} from './useCredits.ts';

const INPUT: CreditInput = {
  direction: 'give',
  contactId: TEST_MONEY_CONTACT_ID,
  partyName: 'Kavya Mehta',
  amount: 80,
  reasonKey: 'overpaid',
  invoiceId: TEST_INVOICE_ID,
  settleBy: null,
  note: null,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('the reads', () => {
  it('reads Pending in cursor pages and one credit, under the organization', async () => {
    vi.mocked(listPendingCredits).mockResolvedValue({
      rows: [creditRow()],
      next: null,
      total: 1,
    });
    vi.mocked(fetchCredit).mockResolvedValue(creditRow());
    const { result } = renderHook(
      () => ({
        list: useCreditList({ status: ['open'] }),
        one: useCredit(TEST_CREDIT_ID),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.one.data?.seq).toBe(1));
    expect(listPendingCredits).toHaveBeenCalledWith({ status: ['open'] }, undefined);
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useCreditList({}), { wrapper });
    expect(listPendingCredits).not.toHaveBeenCalled();
  });
});

describe('the writes', () => {
  it('adds, changes and settles with the action’s key, refreshing the money reads', async () => {
    vi.mocked(createCredit).mockResolvedValue(creditRow());
    vi.mocked(updateCredit).mockResolvedValue(creditRow());
    vi.mocked(settleCredit).mockResolvedValue({
      credit: creditRow(),
      amount: 30,
      paymentSeq: 7,
      invoiceSeq: 5,
      creditNoteSeq: null,
    });
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        add: useCreateCredit(),
        edit: useUpdateCredit(),
        settle: useSettleCredit(),
      }),
      { wrapper },
    );

    await act(() => result.current.add.mutateAsync(INPUT));
    expect(createCredit).toHaveBeenCalledWith({
      input: INPUT,
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: invoiceQueryKeys.all }),
    );

    const credit = creditRow();
    await act(() => result.current.edit.mutateAsync({ credit, input: INPUT }));
    expect(updateCredit).toHaveBeenCalledWith({
      credit,
      input: INPUT,
      idempotencyKey: expect.any(String),
    });

    const settlement = {
      action: 'use_on_bill' as const,
      invoiceId: TEST_INVOICE_ID,
      amount: 30,
    };
    await act(() => result.current.settle.mutateAsync({ credit, settlement }));
    expect(settleCredit).toHaveBeenCalledWith({
      credit,
      settlement,
      idempotencyKey: expect.any(String),
    });
  });

  it('takes a deleted credit out of every Pending page at once, puts it back with restore', async () => {
    let land: () => void = () => undefined;
    vi.mocked(deleteCredit).mockReturnValue(
      new Promise<void>((resolve) => {
        land = resolve;
      }),
    );
    vi.mocked(restoreCredit).mockResolvedValue(creditRow());
    const key = creditQueryKeys.list('org_test', {});
    client.setQueryData(key, {
      pages: [{ rows: [creditRow()], next: null, hasMore: false }],
      pageParams: [null],
    });
    const { result } = renderHook(
      () => ({ remove: useDeleteCredit(), restore: useRestoreCredit() }),
      { wrapper },
    );

    let deleting: Promise<void> = Promise.resolve();
    act(() => {
      deleting = result.current.remove.mutateAsync({
        id: TEST_CREDIT_ID,
        reason: 'duplicate',
        note: null,
      });
    });
    await waitFor(() =>
      expect(
        client.getQueryData<{ pages: { rows: unknown[] }[] }>(key)?.pages[0]?.rows,
      ).toEqual([]),
    );
    land();
    await act(() => deleting);
    expect(deleteCredit).toHaveBeenCalledWith({
      creditId: TEST_CREDIT_ID,
      reason: 'duplicate',
      note: null,
    });

    await act(() => result.current.restore.mutateAsync(TEST_CREDIT_ID));
    expect(restoreCredit).toHaveBeenCalledWith(TEST_CREDIT_ID, expect.any(String));
  });
});
