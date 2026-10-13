import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/payments-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listLedger: vi.fn(),
  fetchPayment: vi.fn(),
  listPaymentEdits: vi.fn(),
  listPatientPayments: vi.fn(),
  listOpenSupplierBills: vi.fn(),
  receivePayment: vi.fn(),
  payExpense: vi.fn(),
  updatePayment: vi.fn(),
  deletePayment: vi.fn(),
  restorePayment: vi.fn(),
  reversePayment: vi.fn(),
}));
vi.mock('@/shared/api/app/invoices-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listOpenInvoices: vi.fn(),
  fetchAllInvoices: vi.fn(),
}));
const access = vi.hoisted(() => ({ codes: new Set<string>(), isResolved: true }));
vi.mock('@/shared/hooks/useAppAccess/index.ts', () => ({
  useAppAccess: () => ({
    isResolved: access.isResolved,
    canCode: (code: string) => access.codes.has(code),
  }),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import { creditQueryKeys } from '@/shared/api/app/credits-api.ts';
import {
  fetchAllInvoices,
  invoiceQueryKeys,
  listOpenInvoices,
} from '@/shared/api/app/invoices-api.ts';
import { patientQueryKeys } from '@/shared/api/app/patients-api.ts';
import {
  deletePayment,
  fetchPayment,
  listLedger,
  listOpenSupplierBills,
  listPatientPayments,
  listPaymentEdits,
  payExpense,
  paymentQueryKeys,
  receivePayment,
  restorePayment,
  reversePayment,
  updatePayment,
} from '@/shared/api/app/payments-api.ts';
import type { ReceivePaymentInput } from '@/shared/api/app/payments-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  invoiceRecord,
  ledgerRow,
  TEST_INVOICE_ID,
  TEST_MONEY_BRANCH_ID,
  TEST_MONEY_CONTACT_ID,
  TEST_MONEY_PATIENT_ID,
  TEST_PAYMENT_ID,
} from '@/tests/utils/payments-doubles.ts';

import {
  MONEY_WRITE_KEYS,
  useContactInvoices,
  useDeletePayment,
  useLedgerList,
  useOpenInvoices,
  useOpenSupplierBills,
  usePatientPayments,
  usePayExpense,
  usePayment,
  usePaymentEdits,
  useReceivePayment,
  useRestorePayment,
  useReversePayment,
  useUpdatePayment,
} from './usePayments.ts';

const RECEIPT: ReceivePaymentInput = {
  branchId: TEST_MONEY_BRANCH_ID,
  contactId: TEST_MONEY_CONTACT_ID,
  invoiceId: TEST_INVOICE_ID,
  splits: [{ mode: 'cash', amount: 100 }],
  reference: null,
  note: null,
};

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  access.codes = new Set();
  access.isResolved = true;
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('MONEY_WRITE_KEYS', () => {
  it('refreshes the ledger, credits, invoices and every patient read', () => {
    expect(MONEY_WRITE_KEYS).toEqual(
      expect.arrayContaining([
        paymentQueryKeys.all,
        creditQueryKeys.all,
        invoiceQueryKeys.all,
        patientQueryKeys.all,
      ]),
    );
  });
});

describe('the reads', () => {
  it('reads the ledger in cursor pages, under the organization', async () => {
    vi.mocked(listLedger)
      .mockResolvedValueOnce({ rows: [ledgerRow()], next: 'cur_2', total: 2 })
      .mockResolvedValueOnce({
        rows: [ledgerRow({ id: 'pay_other000000000000000', seq: 4 })],
        next: null,
        total: 2,
      });
    const { result } = renderHook(() => useLedgerList({ direction: 'received' }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(listLedger).toHaveBeenCalledWith({ direction: 'received' }, undefined);
    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(listLedger).toHaveBeenLastCalledWith({ direction: 'received' }, 'cur_2');
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useLedgerList({}), { wrapper });
    expect(listLedger).not.toHaveBeenCalled();
  });

  it('reads one entry and its edit log, idle without an id', async () => {
    vi.mocked(fetchPayment).mockResolvedValue(ledgerRow());
    vi.mocked(listPaymentEdits).mockResolvedValue([]);
    const { result, rerender } = renderHook(
      ({ id }) => ({ entry: usePayment(id), edits: usePaymentEdits(id) }),
      { wrapper, initialProps: { id: undefined as string | undefined } },
    );
    expect(fetchPayment).not.toHaveBeenCalled();

    rerender({ id: TEST_PAYMENT_ID });
    await waitFor(() => expect(result.current.entry.data?.seq).toBe(5));
    await waitFor(() => expect(result.current.edits.data).toEqual([]));
    expect(listPaymentEdits).toHaveBeenCalledWith(TEST_PAYMENT_ID);
  });

  it('reads a patient’s open invoices and their entries; a contact’s invoices', async () => {
    vi.mocked(listOpenInvoices).mockResolvedValue([invoiceRecord()]);
    vi.mocked(fetchAllInvoices).mockResolvedValue([invoiceRecord()]);
    vi.mocked(listPatientPayments).mockResolvedValue([ledgerRow()]);
    const { result } = renderHook(
      () => ({
        open: useOpenInvoices(TEST_MONEY_PATIENT_ID),
        contact: useContactInvoices(TEST_MONEY_CONTACT_ID),
        payments: usePatientPayments(TEST_MONEY_PATIENT_ID),
        idle: useOpenInvoices(null),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.payments.data).toHaveLength(1));
    await waitFor(() => expect(result.current.contact.data).toHaveLength(1));
    expect(result.current.open.data).toEqual([invoiceRecord()]);
    expect(listOpenInvoices).toHaveBeenCalledTimes(1);
    expect(fetchAllInvoices).toHaveBeenCalledWith({ contactId: TEST_MONEY_CONTACT_ID });
    expect(result.current.idle.fetchStatus).toBe('idle');
  });

  it('reads the supplier bills the member may read', async () => {
    access.codes = new Set(['stock_item:read']);
    vi.mocked(listOpenSupplierBills).mockResolvedValue([]);
    const { result } = renderHook(() => useOpenSupplierBills(), { wrapper });

    await waitFor(() => expect(result.current.data).toEqual([]));
    expect(listOpenSupplierBills).toHaveBeenCalledWith({ stock: true, medical: false });
  });
});

describe('the writes', () => {
  it('receives, pays and changes with the action’s key, refreshing every money read', async () => {
    vi.mocked(receivePayment).mockResolvedValue(ledgerRow());
    vi.mocked(payExpense).mockResolvedValue(ledgerRow({ kind: 'expense' }));
    vi.mocked(updatePayment).mockResolvedValue(ledgerRow());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({
        receive: useReceivePayment(),
        pay: usePayExpense(),
        update: useUpdatePayment(),
      }),
      { wrapper },
    );

    await act(() => result.current.receive.mutateAsync(RECEIPT));
    expect(receivePayment).toHaveBeenCalledWith({
      input: RECEIPT,
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: invoiceQueryKeys.all }),
    );

    const expense = {
      branchId: TEST_MONEY_BRANCH_ID,
      bill: null,
      expenseCategory: 'misc' as const,
      payeeName: 'Tea',
      amount: 120,
      mode: 'cash' as const,
      paidOn: '2026-10-10',
      note: null,
      attachmentKeys: [],
    };
    await act(() => result.current.pay.mutateAsync(expense));
    expect(payExpense).toHaveBeenCalledWith({
      input: expense,
      idempotencyKey: expect.any(String),
    });

    const record = ledgerRow();
    await act(() =>
      result.current.update.mutateAsync({ record, patch: { note: 'Moved' } }),
    );
    expect(updatePayment).toHaveBeenCalledWith({
      record,
      patch: { note: 'Moved' },
      idempotencyKey: expect.any(String),
    });
  });

  it('takes a deleted entry out of every ledger page at once, puts it back with restore', async () => {
    let land: () => void = () => undefined;
    vi.mocked(deletePayment).mockReturnValue(
      new Promise<void>((resolve) => {
        land = resolve;
      }),
    );
    vi.mocked(restorePayment).mockResolvedValue(ledgerRow());
    const key = paymentQueryKeys.list('org_test', {});
    client.setQueryData(key, {
      pages: [{ rows: [ledgerRow()], next: null, hasMore: false }],
      pageParams: [null],
    });
    const { result } = renderHook(
      () => ({ remove: useDeletePayment(), restore: useRestorePayment() }),
      { wrapper },
    );

    let deleting: Promise<void> = Promise.resolve();
    act(() => {
      deleting = result.current.remove.mutateAsync({
        id: TEST_PAYMENT_ID,
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
    expect(deletePayment).toHaveBeenCalledWith({
      paymentId: TEST_PAYMENT_ID,
      reason: 'duplicate',
      note: null,
    });

    await act(() => result.current.restore.mutateAsync(TEST_PAYMENT_ID));
    expect(restorePayment).toHaveBeenCalledWith(TEST_PAYMENT_ID, expect.any(String));
  });

  it('reverses a settled entry with why', async () => {
    vi.mocked(reversePayment).mockResolvedValue(ledgerRow({ kind: 'reversal' }));
    const { result } = renderHook(() => useReversePayment(), { wrapper });

    await act(() =>
      result.current.mutateAsync({ id: TEST_PAYMENT_ID, reason: 'Wrong patient' }),
    );

    expect(reversePayment).toHaveBeenCalledWith({
      paymentId: TEST_PAYMENT_ID,
      reason: 'Wrong patient',
      paidAt: undefined,
      idempotencyKey: expect.any(String),
    });
  });
});
