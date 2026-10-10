import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-records-api.ts', () => ({
  createStockItem: vi.fn(),
  createStockPurchase: vi.fn(),
  createStockVendor: vi.fn(),
  deleteStockItem: vi.fn(),
  deleteStockPurchase: vi.fn(),
  deleteStockVendor: vi.fn(),
  logStockMovement: vi.fn(),
  quickCreateStockItem: vi.fn(),
  restoreStockItem: vi.fn(),
  restoreStockPurchase: vi.fn(),
  restoreStockVendor: vi.fn(),
  revertStockMovement: vi.fn(),
  saveStockCount: vi.fn(),
  updateStockItem: vi.fn(),
  updateStockPurchase: vi.fn(),
  updateStockVendor: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import { paymentQueryKeys } from '@/shared/api/clinic/payments-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  stockItemRow,
  stockMovementRow,
  stockPurchaseRow,
  stockVendorRow,
  TEST_STOCK_ITEM_ID,
  TEST_STOCK_MOVEMENT_ID,
} from '@/tests/utils/stock-doubles.ts';

import { stockQueryKeys } from '../../stock-api.ts';
import {
  createStockVendor,
  deleteStockItem,
  logStockMovement,
  quickCreateStockItem,
  restoreStockItem,
  revertStockMovement,
  saveStockCount,
  updateStockItem,
  updateStockPurchase,
} from '../../stock-records-api.ts';
import {
  useCreateStockVendor,
  useDeleteStockItem,
  useLogStockMovement,
  useQuickCreateStockItem,
  useRestoreStockItem,
  useRevertStockMovement,
  useSaveStockCount,
  useUpdateStockItem,
  useUpdateStockPurchase,
} from './useStockWrites.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The query keys the client was asked to refresh. */
const refreshed = (invalidate: ReturnType<typeof vi.spyOn>) =>
  invalidate.mock.calls.map(
    ([filters]: readonly unknown[]) => (filters as { queryKey: unknown }).queryKey,
  );

/** The action the write was handed: its idempotency key. */
const KEYED = { idempotencyKey: expect.any(String) };

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

describe('useStockWrites', () => {
  it('a stock change carries its action’s key and refreshes the room, not the bills', async () => {
    vi.mocked(logStockMovement).mockResolvedValue(stockMovementRow());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useLogStockMovement(), { wrapper });
    const input = {
      itemId: TEST_STOCK_ITEM_ID,
      type: 'used' as const,
      quantityMilli: 500,
      usedFor: 'LHR',
      note: null,
    };
    const movement = await act(() => result.current.mutateAsync(input));
    expect(logStockMovement).toHaveBeenCalledWith({ input, ...KEYED });
    expect(movement.afterMilli).toBe(2500);
    expect(refreshed(invalidate)).toEqual([stockQueryKeys.all]);
  });

  it('a revert — the Undo of a use too — carries the item, the movement and the reason', async () => {
    vi.mocked(revertStockMovement).mockResolvedValue(
      stockMovementRow({ kind: 'reverted' }),
    );
    const { result } = renderHook(() => useRevertStockMovement(), { wrapper });
    const input = {
      itemId: TEST_STOCK_ITEM_ID,
      movementId: TEST_STOCK_MOVEMENT_ID,
      reason: 'mistake' as const,
      note: null,
    };
    await act(() => result.current.mutateAsync(input));
    expect(revertStockMovement).toHaveBeenCalledWith({ input, ...KEYED });
  });

  it('a purchase or a vendor write also refreshes the bills Send payment offers', async () => {
    vi.mocked(createStockVendor).mockResolvedValue(stockVendorRow());
    vi.mocked(updateStockPurchase).mockResolvedValue(stockPurchaseRow());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ vendor: useCreateStockVendor(), purchase: useUpdateStockPurchase() }),
      { wrapper },
    );
    await act(() => result.current.vendor.mutateAsync({ name: 'Ankit', phone: null }));
    expect(createStockVendor).toHaveBeenCalledWith({
      input: { name: 'Ankit', phone: null },
      ...KEYED,
    });
    expect(refreshed(invalidate)).toEqual([
      stockQueryKeys.all,
      paymentQueryKeys.openBills(),
    ]);

    invalidate.mockClear();
    const record = stockPurchaseRow();
    const input = {
      vendorId: record.vendorId,
      billNo: null,
      date: record.date,
      bill: 2400,
    };
    await act(() => result.current.purchase.mutateAsync({ record, input }));
    expect(updateStockPurchase).toHaveBeenCalledWith({ record, input, ...KEYED });
    expect(refreshed(invalidate)).toEqual([
      stockQueryKeys.all,
      paymentQueryKeys.openBills(),
    ]);
  });

  it('an item save hands over the record as read; a quick item and a Stock check theirs', async () => {
    vi.mocked(updateStockItem).mockResolvedValue(stockItemRow({ minQty: 2 }));
    vi.mocked(quickCreateStockItem).mockResolvedValue(stockItemRow({ name: 'Cotton' }));
    vi.mocked(saveStockCount).mockResolvedValue({ id: 'scnt_x', changed: 1 });
    const { result } = renderHook(
      () => ({
        update: useUpdateStockItem(),
        quick: useQuickCreateStockItem(),
        count: useSaveStockCount(),
      }),
      { wrapper },
    );
    const record = stockItemRow();
    const input = { ...record, minQty: 2 };
    await act(() => result.current.update.mutateAsync({ record, input }));
    expect(updateStockItem).toHaveBeenCalledWith({ record, input, ...KEYED });
    await act(() => result.current.quick.mutateAsync({ name: 'Cotton' }));
    expect(quickCreateStockItem).toHaveBeenCalledWith({
      input: { name: 'Cotton' },
      ...KEYED,
    });
    const lines = [{ itemId: TEST_STOCK_ITEM_ID, countedMilli: 2000 }];
    expect(await act(() => result.current.count.mutateAsync({ lines }))).toEqual({
      id: 'scnt_x',
      changed: 1,
    });
    expect(saveStockCount).toHaveBeenCalledWith({ input: { lines }, ...KEYED });
  });

  it('a delete takes the row out of the list at once, and puts it back if it fails', async () => {
    const listKey = stockQueryKeys.items('org_test', {});
    const gauze = stockItemRow({ id: 'sitm_gauze000000000000000', name: 'Gauze swabs' });
    client.setQueryData(listKey, {
      pages: [{ rows: [stockItemRow(), gauze], next: null, hasMore: false }],
      pageParams: [undefined],
    });
    const rowsNow = () =>
      (
        client.getQueryData(listKey) as { pages: { rows: { id: string }[] }[] }
      ).pages[0]?.rows.map((row) => row.id);
    const pending: { reject?: (error: Error) => void } = {};
    vi.mocked(deleteStockItem).mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          pending.reject = reject;
        }),
    );
    const { result } = renderHook(() => useDeleteStockItem({ notifyOnError: false }), {
      wrapper,
    });
    act(() => {
      result.current.mutate({ id: TEST_STOCK_ITEM_ID, reason: 'mistake', note: null });
    });
    await waitFor(() => expect(rowsNow()).toEqual([gauze.id]));
    expect(deleteStockItem).toHaveBeenCalledWith({
      id: TEST_STOCK_ITEM_ID,
      reason: 'mistake',
      note: null,
    });
    act(() => pending.reject?.(new Error('item_has_stock')));
    await waitFor(() => expect(rowsNow()).toEqual([TEST_STOCK_ITEM_ID, gauze.id]));
  });

  it('a delete refreshes the lists, not the deleted record’s own read; Undo restores with a key', async () => {
    vi.mocked(deleteStockItem).mockResolvedValue(undefined);
    vi.mocked(restoreStockItem).mockResolvedValue(stockItemRow());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ remove: useDeleteStockItem(), restore: useRestoreStockItem() }),
      { wrapper },
    );
    await act(() =>
      result.current.remove.mutateAsync({
        id: TEST_STOCK_ITEM_ID,
        reason: 'mistake',
        note: null,
      }),
    );
    const keys = refreshed(invalidate);
    expect(keys).toContainEqual(stockQueryKeys.itemLists('org_test'));
    expect(keys).toContainEqual(stockQueryKeys.catalogues('org_test'));
    expect(keys).not.toContainEqual(stockQueryKeys.all);
    await act(() => result.current.restore.mutateAsync(TEST_STOCK_ITEM_ID));
    expect(restoreStockItem).toHaveBeenCalledWith(TEST_STOCK_ITEM_ID, expect.any(String));
  });
});
