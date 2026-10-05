import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';

import { medicalQueryKeys } from '../../medical-api.ts';
import {
  useCancelPurchaseOrder,
  useCollectSale,
  useCreatePurchaseOrder,
  usePrescriptionsToFill,
  useReceivePurchaseOrder,
  useReturnExpiringStock,
  useReturnSale,
  useUpdatePurchaseOrder,
  useVoidSale,
} from './useMedicalFlows.ts';

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

/** 10:00 on 3 Oct, clinic time. */
const NOW = new Date('2026-10-03T04:30:00Z');

/** Every write under test, on one query client. */
function useAll() {
  const quiet = { notifyOnError: false } as const;
  return {
    create: useCreatePurchaseOrder(quiet),
    update: useUpdatePurchaseOrder(quiet),
    cancel: useCancelPurchaseOrder(quiet),
    receive: useReceivePurchaseOrder(quiet),
    collect: useCollectSale(quiet),
    returnSale: useReturnSale(quiet),
    voidSale: useVoidSale(quiet),
    returnExpiring: useReturnExpiringStock(quiet),
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
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  vi.useRealTimers();
  resetClinicFixtures();
});

describe('the purchase-order writes', () => {
  it('create, save, receive and cancel, refreshing the room — a receipt also Send payment’s bills', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useAll, { wrapper });
    let created = '';
    await act(async () => {
      const order = await result.current.create.mutateAsync({
        supplierId: ref.supplier(61),
        supplierBillNo: null,
        date: '2026-10-03',
        items: [{ medicineId: ref.medicine(458), qty: 2, free: 0, rate: 44_000 }],
      });
      created = order.id;
    });
    expect(invalidated(spy)).toContainEqual(medicalQueryKeys.all);

    await act(async () => {
      await result.current.update.mutateAsync({
        id: created,
        input: {
          supplierId: ref.supplier(61),
          supplierBillNo: 'T-1',
          date: '2026-10-03',
          items: [{ medicineId: ref.medicine(458), qty: 3, free: 0, rate: 44_000 }],
        },
      });
    });
    expect((await clinicFixtures.purchaseOrders.get(created)).supplierBillNo).toBe('T-1');

    spy.mockClear();
    await act(async () => {
      await result.current.receive.mutateAsync({
        id: created,
        input: { lines: [{ arrived: true, batchNo: 'B-1', expiry: '12/27' }] },
      });
    });
    expect(invalidated(spy)).toContainEqual(paymentQueryKeys.openBills());

    await act(async () => {
      await result.current.cancel.mutateAsync({
        id: ref.purchaseOrder(430),
        reason: 'mistake',
        note: null,
      });
    });
    expect((await clinicFixtures.purchaseOrders.get(ref.purchaseOrder(430))).stage).toBe(
      'cancelled',
    );
  });
});

describe('the sale writes', () => {
  it('collect, return and void, refreshing the ledger and its readers', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      await result.current.collect.mutateAsync(ref.medicalSale(978));
    });
    expect(invalidated(spy)).toContainEqual(paymentQueryKeys.all);

    await act(async () => {
      const back = await result.current.returnSale.mutateAsync({
        saleId: ref.medicalSale(983),
        input: {
          lines: [{ medicineId: ref.medicine(454), batchNo: 'ASC002', qty: 1 }],
          reason: 'unused',
          mode: 'cash',
        },
      });
      expect(back.refunded).toBe(55_000);
    });
  });

  it('voids an unpaid sale', async () => {
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      await result.current.voidSale.mutateAsync({
        id: ref.medicalSale(978),
        reason: 'mistake',
        note: null,
      });
    });
    expect(
      (await clinicFixtures.medicalSales.get(ref.medicalSale(978))).voidedAt,
    ).not.toBeNull();
  });
});

describe('stock back to a supplier, and the prescriptions to fill', () => {
  it('returns expiring stock for a credit', async () => {
    const { result } = renderHook(useAll, { wrapper });
    await act(async () => {
      const credit = await result.current.returnExpiring.mutateAsync({
        medicineId: ref.medicine(456),
        batchNo: '026-312',
        supplierId: ref.supplier(52),
        qty: 1,
      });
      expect(credit).toMatchObject({ qty: 1, credit: 12_300 });
    });
  });

  it('reads the prescriptions to fill only when asked', async () => {
    const idle = renderHook(() => usePrescriptionsToFill(false), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
    const { result } = renderHook(() => usePrescriptionsToFill(), { wrapper });
    await waitFor(() => expect(result.current.data?.[0]?.seq).toBe(501));
  });
});
