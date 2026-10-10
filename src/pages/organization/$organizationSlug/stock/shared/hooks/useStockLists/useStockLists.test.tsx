import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../stock-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listStockItems: vi.fn(),
  listStockPurchases: vi.fn(),
  listStockMovements: vi.fn(),
  listStockVendors: vi.fn(),
  fetchAllStockItems: vi.fn(),
  fetchAllStockVendors: vi.fn(),
  stockListSummary: vi.fn(),
}));
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import {
  stockItemRow,
  stockMovementRow,
  stockPurchaseRow,
  stockVendorRow,
} from '@/tests/utils/stock-doubles.ts';

import {
  fetchAllStockItems,
  fetchAllStockVendors,
  listStockItems,
  listStockMovements,
  listStockPurchases,
  listStockVendors,
  stockListSummary,
  stockQueryKeys,
} from '../../stock-api.ts';
import {
  useStockItemCatalogue,
  useStockItemList,
  useStockMovementList,
  useStockPurchaseList,
  useStockSummary,
  useStockVendorCatalogue,
  useStockVendorList,
} from './useStockLists.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useStockLists', () => {
  it('reads Items in cursor pages for the params, under the organization', async () => {
    vi.mocked(listStockItems)
      .mockResolvedValueOnce({ rows: [stockItemRow()], next: 'cur_2', total: 2 })
      .mockResolvedValueOnce({
        rows: [stockItemRow({ id: 'sitm_gauze000000000000000' })],
        next: null,
        total: 2,
      });
    const { result } = renderHook(() => useStockItemList({ stock: 'low' }), { wrapper });
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(listStockItems).toHaveBeenCalledWith({ stock: 'low' }, undefined);
    expect(result.current.hasNextPage).toBe(true);
    expect(
      client.getQueryCache().find({
        queryKey: stockQueryKeys.items('org_test', { stock: 'low' }),
      }),
    ).toBeDefined();

    await act(() => result.current.fetchNextPage());
    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(listStockItems).toHaveBeenLastCalledWith({ stock: 'low' }, 'cur_2');
    expect(result.current.hasNextPage).toBe(false);
  });

  it('reads each other tab’s pages', async () => {
    vi.mocked(listStockPurchases).mockResolvedValue({
      rows: [stockPurchaseRow()],
      next: null,
      total: 1,
    });
    vi.mocked(listStockMovements).mockResolvedValue({
      rows: [stockMovementRow()],
      next: null,
      total: 1,
    });
    vi.mocked(listStockVendors).mockResolvedValue({
      rows: [stockVendorRow()],
      next: null,
      total: 1,
    });
    const { result } = renderHook(
      () => ({
        purchases: useStockPurchaseList({ status: ['unpaid'] }),
        movements: useStockMovementList({ type: ['opening'] }),
        vendors: useStockVendorList({ q: 'ankur' }),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.vendors.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.movements.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.purchases.rows).toHaveLength(1));
    expect(listStockPurchases).toHaveBeenCalledWith({ status: ['unpaid'] }, undefined);
    expect(listStockMovements).toHaveBeenCalledWith({ type: ['opening'] }, undefined);
    expect(listStockVendors).toHaveBeenCalledWith({ q: 'ankur' }, undefined);
  });

  it('reads the footer figures and the whole lists', async () => {
    vi.mocked(stockListSummary).mockResolvedValue({ total: 4, due: 2310 });
    vi.mocked(fetchAllStockItems).mockResolvedValue([stockItemRow()]);
    vi.mocked(fetchAllStockVendors).mockResolvedValue([stockVendorRow()]);
    const { result } = renderHook(
      () => ({
        summary: useStockSummary('purchases', { status: ['unpaid'] }),
        items: useStockItemCatalogue(),
        vendors: useStockVendorCatalogue(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.summary.data).toEqual({ total: 4, due: 2310 }),
    );
    expect(stockListSummary).toHaveBeenCalledWith('purchases', { status: ['unpaid'] });
    await waitFor(() => expect(result.current.items.data).toHaveLength(1));
    await waitFor(() => expect(result.current.vendors.data).toHaveLength(1));
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(
      () => ({
        items: useStockItemList({}),
        summary: useStockSummary('movements', {}),
        catalogue: useStockItemCatalogue(),
      }),
      { wrapper },
    );
    expect(listStockItems).not.toHaveBeenCalled();
    expect(stockListSummary).not.toHaveBeenCalled();
    expect(fetchAllStockItems).not.toHaveBeenCalled();
  });
});
