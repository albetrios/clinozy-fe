import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useStockFacets,
  useStockItemList,
  useStockMovementList,
  useStockPurchaseList,
  useStockSummary,
  useStockVendorList,
} from './useStockLists.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe('useStockLists', () => {
  it('reads each tab’s cursor pages', async () => {
    const { result } = renderHook(
      () => ({
        items: useStockItemList({ stock: 'low' }),
        purchases: useStockPurchaseList({}),
        movements: useStockMovementList({ type: ['payment'] }),
        vendors: useStockVendorList({}),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.items.rows).toHaveLength(2));
    await waitFor(() => expect(result.current.purchases.rows).toHaveLength(4));
    await waitFor(() => expect(result.current.movements.rows).toHaveLength(3));
    await waitFor(() => expect(result.current.vendors.rows).toHaveLength(5));
    expect(result.current.items.hasNextPage).toBe(false);
  });

  it('reads the footer figures and the automatic sections’ values', async () => {
    const { result } = renderHook(
      () => ({
        summary: useStockSummary('purchases', {}),
        facets: useStockFacets('purchases'),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.summary.data).toEqual({ total: 4, due: 231_000 }),
    );
    await waitFor(() => expect(result.current.facets.data?.rows).toBe(4));
  });
});
