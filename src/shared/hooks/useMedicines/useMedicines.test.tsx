import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { medicineQueryKeys } from '@/shared/api/clinic/medicines-api.ts';

import {
  useMedicine,
  useMedicineCatalogue,
  useMedicineList,
  useSetNearExpiryDiscount,
} from './useMedicines.ts';

vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});
afterEach(() => client.clear());

describe('useMedicines', () => {
  it('reads the list, the catalogue and one medicine', async () => {
    const { result } = renderHook(
      () => ({
        list: useMedicineList({ stock: 'low' }),
        catalogue: useMedicineCatalogue(),
        one: useMedicine(ref.medicine(458)),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.rows).toHaveLength(3));
    await waitFor(() => expect(result.current.catalogue.data).toHaveLength(9));
    await waitFor(() =>
      expect(result.current.one.data?.name).toBe('Uncap Smooth Anti Acne PM Gel'),
    );
  });

  it('writes the near-expiry discount and refreshes every medicine read', async () => {
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useSetNearExpiryDiscount(), { wrapper });
    await act(() => result.current.mutateAsync({ ids: [ref.medicine(456)], pct: 20 }));
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: medicineQueryKeys.all }),
    );
  });
});
