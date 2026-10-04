import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';

import { stockQueryKeys } from '../../stock-api.ts';
import {
  useCreateStockVendor,
  useLogStockMovement,
  useQuickCreateStockItem,
  useSaveStockCount,
  useUpdateStockPurchase,
} from './useStockWrites.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The query keys the client was asked to refresh. */
const refreshed = (invalidate: ReturnType<typeof vi.spyOn>) =>
  invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useStockWrites (KICKOFF §6.8)', () => {
  it('a stock change refreshes the room, not the bills', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useLogStockMovement(), { wrapper });
    const { item } = await act(() =>
      result.current.mutateAsync({
        itemId: ref.stockItem(167),
        type: 'used',
        quantityMilli: 1000,
        usedFor: null,
        note: null,
      }),
    );
    expect(item.qtyMilli).toBe(2000);
    expect(refreshed(invalidate)).toEqual([stockQueryKeys.all]);
  });

  it('a purchase or a vendor write also refreshes the bills Send payment offers', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ vendor: useCreateStockVendor(), purchase: useUpdateStockPurchase() }),
      { wrapper },
    );
    await act(() => result.current.vendor.mutateAsync({ name: 'Ankit', phone: null }));
    expect(refreshed(invalidate)).toEqual([
      stockQueryKeys.all,
      paymentQueryKeys.openBills(),
    ]);

    invalidate.mockClear();
    const [purchase] = clinicFixtures.stockPurchases.snapshot(
      (row) => row.id === ref.stockPurchase(15),
    );
    if (!purchase) throw new Error('no purchase #15');
    await act(() =>
      result.current.purchase.mutateAsync({
        id: purchase.id,
        patch: { ...purchase, paid: purchase.bill },
      }),
    );
    expect(refreshed(invalidate)).toEqual([
      stockQueryKeys.all,
      paymentQueryKeys.openBills(),
    ]);
  });

  it('a quick item and a Stock check write through to the world', async () => {
    const { result } = renderHook(
      () => ({ quick: useQuickCreateStockItem(), count: useSaveStockCount() }),
      { wrapper },
    );
    const item = await act(() => result.current.quick.mutateAsync({ name: 'Cotton' }));
    expect(item).toMatchObject({ unit: 'piece', maxQty: 5 });
    const saved = await act(() =>
      result.current.count.mutateAsync({
        lines: [{ itemId: ref.stockItem(167), countedMilli: 2000 }],
      }),
    );
    expect(saved).toEqual({ changed: 1 });
  });
});
