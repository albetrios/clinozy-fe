import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import {
  useManufacturerCatalogue,
  useManufacturerList,
  useMedicalSummary,
  useMrCatalogue,
  useMrList,
  usePurchaseOrderList,
  useSaleList,
  useSupplierCatalogue,
  useSupplierList,
} from './useMedicalLists.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetAppFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

describe('useMedicalLists', () => {
  it('reads each tab’s cursor pages', async () => {
    const { result } = renderHook(
      () => ({
        sales: useSaleList({}),
        orders: usePurchaseOrderList({ stage: 'received' }),
        suppliers: useSupplierList({}),
        makers: useManufacturerList({}),
        mrs: useMrList({}),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.sales.rows).toHaveLength(3));
    await waitFor(() => expect(result.current.orders.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.suppliers.rows).toHaveLength(4));
    await waitFor(() => expect(result.current.makers.rows).toHaveLength(6));
    await waitFor(() => expect(result.current.mrs.rows).toHaveLength(3));
    expect(result.current.sales.hasNextPage).toBe(false);
  });

  it('reads the footer figures and the whole lists the filters and pickers use', async () => {
    const { result } = renderHook(
      () => ({
        summary: useMedicalSummary('suppliers', {}),
        makers: useManufacturerCatalogue(),
        suppliers: useSupplierCatalogue(),
        mrs: useMrCatalogue(),
      }),
      { wrapper },
    );
    await waitFor(() =>
      expect(result.current.summary.data).toEqual({ total: 4, payable: 298_000 }),
    );
    await waitFor(() => expect(result.current.makers.data).toHaveLength(6));
    await waitFor(() => expect(result.current.suppliers.data).toHaveLength(4));
    await waitFor(() => expect(result.current.mrs.data).toHaveLength(3));
  });
});
