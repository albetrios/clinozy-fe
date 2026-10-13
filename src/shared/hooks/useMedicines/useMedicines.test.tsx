import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/medicines-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  listMedicines: vi.fn(),
  fetchAllMedicines: vi.fn(),
  fetchMedicine: vi.fn(),
  setNearExpiryDiscount: vi.fn(),
  setNearExpiryDiscountWithin: vi.fn(),
  deleteMedicine: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));

import {
  deleteMedicine,
  fetchAllMedicines,
  fetchMedicine,
  listMedicines,
  MEDICAL_ROOM_QUERY_KEY,
  medicineQueryKeys,
  setNearExpiryDiscount,
  setNearExpiryDiscountWithin,
} from '@/shared/api/app/medicines-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import { medicineRow, TEST_MEDICINE_ID } from '@/tests/utils/medical-doubles.ts';

import {
  useDeleteMedicine,
  useMedicine,
  useMedicineCatalogue,
  useMedicineList,
  useSetNearExpiryDiscount,
  useSetNearExpiryDiscountWithin,
} from './useMedicines.ts';

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
  vi.mocked(listMedicines).mockResolvedValue({
    rows: [medicineRow()],
    next: null,
    total: 1,
  });
  vi.mocked(fetchAllMedicines).mockResolvedValue([medicineRow()]);
  vi.mocked(fetchMedicine).mockResolvedValue(medicineRow());
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('useMedicines', () => {
  it('reads the list, the catalogue and one medicine, under the organization', async () => {
    const { result } = renderHook(
      () => ({
        list: useMedicineList({ stock: 'low' }),
        catalogue: useMedicineCatalogue(),
        one: useMedicine(TEST_MEDICINE_ID),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    await waitFor(() => expect(result.current.catalogue.data).toHaveLength(1));
    await waitFor(() => expect(result.current.one.data?.name).toBe('Azelaic gel 15g'));
    expect(listMedicines).toHaveBeenCalledWith({ stock: 'low' }, undefined);
    expect(
      client.getQueryData(medicineQueryKeys.detail('org_test', TEST_MEDICINE_ID)),
    ).toEqual(medicineRow());
  });

  it('leaves the catalogue unread while it is not enabled (a clinic invoice)', async () => {
    const { result } = renderHook(() => useMedicineCatalogue({ enabled: false }), {
      wrapper,
    });
    await act(async () => {});
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchAllMedicines).not.toHaveBeenCalled();
  });

  it('the near-expiry writes refresh every medicine read and the room', async () => {
    vi.mocked(setNearExpiryDiscount).mockResolvedValue([medicineRow()]);
    vi.mocked(setNearExpiryDiscountWithin).mockResolvedValue(3);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ one: useSetNearExpiryDiscount(), all: useSetNearExpiryDiscountWithin() }),
      { wrapper },
    );
    await act(() =>
      result.current.one.mutateAsync({ medicines: [medicineRow()], pct: 20 }),
    );
    expect(vi.mocked(setNearExpiryDiscount).mock.calls[0]?.slice(0, 2)).toEqual([
      [medicineRow()],
      20,
    ]);
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: medicineQueryKeys.all }),
    );
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: MEDICAL_ROOM_QUERY_KEY }),
    );
    let count = 0;
    await act(async () => {
      count = await result.current.all.mutateAsync({ expiringWithinDays: 30, pct: 20 });
    });
    expect(count).toBe(3);
  });

  it('a delete leaves the list at once', async () => {
    vi.mocked(deleteMedicine).mockResolvedValue(undefined);
    const { result } = renderHook(
      () => ({ list: useMedicineList({}), remove: useDeleteMedicine() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.rows).toHaveLength(1));
    await act(() =>
      result.current.remove.mutateAsync({
        id: TEST_MEDICINE_ID,
        reason: 'mistake',
        note: null,
      }),
    );
    expect(deleteMedicine).toHaveBeenCalledWith(TEST_MEDICINE_ID, 'mistake', null);
  });
});
