import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../medical-records-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  createPurchaseOrder: vi.fn(),
  updatePurchaseOrder: vi.fn(),
  cancelPurchaseOrder: vi.fn(),
  receivePurchaseOrder: vi.fn(),
  createSale: vi.fn(),
  collectSale: vi.fn(),
  returnSale: vi.fn(),
  voidSale: vi.fn(),
  createSupplierCredit: vi.fn(),
  voidSupplierCredit: vi.fn(),
}));
vi.mock('../../medical-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listPrescriptionsToFill: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
    undo: vi.fn(),
    dismiss: vi.fn(),
  },
  TOAST_DURATION_MS: { default: 5200, error: 9000, undo: 10_000 },
}));

import { creditQueryKeys } from '@/shared/api/app/credits-api.ts';
import { medicineQueryKeys } from '@/shared/api/app/medicines-api.ts';
import { paymentQueryKeys } from '@/shared/api/app/payments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  paidSaleRow,
  prescriptionToFill,
  purchaseOrderRow,
  saleRow,
  supplierCreditRow,
  TEST_BATCH_ID,
  TEST_MEDICINE_ID,
  TEST_SALE_INVOICE_ITEM_ID,
  TEST_SUPPLIER_CREDIT_ID,
  TEST_SUPPLIER_ID,
} from '@/tests/utils/medical-doubles.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import { listPrescriptionsToFill, medicalQueryKeys } from '../../medical-api.ts';
import {
  cancelPurchaseOrder,
  collectSale,
  createPurchaseOrder,
  createSupplierCredit,
  receivePurchaseOrder,
  returnSale,
  voidSale,
  voidSupplierCredit,
} from '../../medical-records-api.ts';
import {
  useCancelPurchaseOrder,
  useCollectSale,
  useCreatePurchaseOrder,
  usePrescriptionsToFill,
  useReceivePurchaseOrder,
  useReturnExpiringStock,
  useReturnSale,
  useVoidSale,
  useVoidSupplierCredit,
} from './useMedicalFlows.ts';

/** Every write under test, on one query client. */
function useAll() {
  const quiet = { notifyOnError: false } as const;
  return {
    create: useCreatePurchaseOrder(quiet),
    cancel: useCancelPurchaseOrder(quiet),
    receive: useReceivePurchaseOrder(quiet),
    collect: useCollectSale(quiet),
    returnSale: useReturnSale(quiet),
    voidSale: useVoidSale(quiet),
    returnExpiring: useReturnExpiringStock(quiet),
    voidCredit: useVoidSupplierCredit(quiet),
  };
}

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The query keys the client was asked to refresh. */
function invalidated(spy: ReturnType<typeof vi.spyOn>): unknown[] {
  return spy.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);
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

describe('the purchase-order writes', () => {
  it('each carries its own idempotency key and refreshes the room and its medicines', async () => {
    vi.mocked(createPurchaseOrder).mockResolvedValue(purchaseOrderRow());
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useAll, { wrapper });
    const input = {
      supplierId: TEST_SUPPLIER_ID,
      supplierBillNo: null,
      date: '2026-10-10',
      items: [{ medicineId: TEST_MEDICINE_ID, qty: 2, free: 0, rate: 420 }],
    };
    await act(() => result.current.create.mutateAsync(input));
    const sent = vi.mocked(createPurchaseOrder).mock.calls[0]?.[0];
    expect(sent?.input).toEqual(input);
    expect(sent?.idempotencyKey).toEqual(expect.any(String));
    expect(invalidated(spy)).toContainEqual(medicalQueryKeys.all);
    expect(invalidated(spy)).toContainEqual(medicineQueryKeys.all);
  });

  it('a receipt refreshes the bills Send payment offers; a cancel sends why', async () => {
    vi.mocked(receivePurchaseOrder).mockResolvedValue(purchaseOrderRow());
    vi.mocked(cancelPurchaseOrder).mockResolvedValue(undefined);
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useAll, { wrapper });
    await act(() =>
      result.current.receive.mutateAsync({
        id: purchaseOrderRow().id,
        input: { lines: [] },
      }),
    );
    expect(invalidated(spy)).toContainEqual(paymentQueryKeys.openBills());
    await act(() =>
      result.current.cancel.mutateAsync({
        id: purchaseOrderRow().id,
        reason: 'price_changed',
        note: null,
      }),
    );
    expect(cancelPurchaseOrder).toHaveBeenCalledWith(
      purchaseOrderRow().id,
      'price_changed',
      null,
    );
  });
});

describe('the sale writes', () => {
  it('collect, return and void refresh the ledger, its readers and the credits', async () => {
    vi.mocked(collectSale).mockResolvedValue(ledgerRow());
    vi.mocked(returnSale).mockResolvedValue(paidSaleRow());
    vi.mocked(voidSale).mockResolvedValue(undefined);
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useAll, { wrapper });
    await act(() => result.current.collect.mutateAsync({ sale: saleRow(), mode: 'upi' }));
    expect(vi.mocked(collectSale).mock.calls[0]?.[0]).toMatchObject({
      sale: saleRow(),
      mode: 'upi',
      idempotencyKey: expect.any(String),
    });
    expect(invalidated(spy)).toContainEqual(paymentQueryKeys.all);
    expect(invalidated(spy)).toContainEqual(creditQueryKeys.all);

    const back = {
      lines: [{ invoiceItemId: TEST_SALE_INVOICE_ITEM_ID, qty: 1 }],
      reason: 'unused' as const,
      mode: 'credit' as const,
      note: null,
    };
    await act(() =>
      result.current.returnSale.mutateAsync({ saleId: paidSaleRow().id, input: back }),
    );
    expect(vi.mocked(returnSale).mock.calls[0]?.[0]).toMatchObject({
      id: paidSaleRow().id,
      input: back,
    });

    await act(() =>
      result.current.voidSale.mutateAsync({
        id: saleRow().id,
        reason: 'wrong_items',
        note: null,
      }),
    );
    expect(voidSale).toHaveBeenCalledWith(saleRow().id, 'wrong_items', null);
  });
});

describe('stock back to a supplier, and the prescriptions to fill', () => {
  it('returns expiring stock for a credit, and voids one', async () => {
    vi.mocked(createSupplierCredit).mockResolvedValue(supplierCreditRow());
    vi.mocked(voidSupplierCredit).mockResolvedValue(undefined);
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      const credit = await result.current.returnExpiring.mutateAsync({
        supplierId: TEST_SUPPLIER_ID,
        batchId: TEST_BATCH_ID,
        qty: 2,
      });
      expect(credit).toMatchObject({ qty: 2, amount: 840 });
    });
    await act(() =>
      result.current.voidCredit.mutateAsync({
        supplierId: TEST_SUPPLIER_ID,
        creditId: TEST_SUPPLIER_CREDIT_ID,
        reason: 'supplier_refused',
        note: null,
      }),
    );
    expect(voidSupplierCredit).toHaveBeenCalledWith({
      supplierId: TEST_SUPPLIER_ID,
      creditId: TEST_SUPPLIER_CREDIT_ID,
      reason: 'supplier_refused',
      note: null,
    });
  });

  it('reads the prescriptions to fill only when asked', async () => {
    vi.mocked(listPrescriptionsToFill).mockResolvedValue([prescriptionToFill()]);
    const idle = renderHook(() => usePrescriptionsToFill(false), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    const { result } = renderHook(() => usePrescriptionsToFill(), { wrapper });
    await waitFor(() => expect(result.current.data?.[0]?.seq).toBe(58));
  });
});
