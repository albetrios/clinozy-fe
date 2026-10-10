import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(),
  fetchOffering: vi.fn(),
  createOffering: vi.fn(),
  updateOffering: vi.fn(),
  deleteOffering: vi.fn(),
  restoreOffering: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import {
  createOffering,
  deleteOffering,
  fetchAllOfferings,
  fetchOffering,
  offeringQueryKeys,
  offerQueryKeys,
  restoreOffering,
  updateOffering,
} from '@/shared/api/clinic/offerings-api.ts';
import {
  OFFERING_DEFAULTS,
  type OfferingFields,
} from '@/shared/api/clinic/offerings-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { offeringRecord, TEST_OFFERING_ID } from '@/tests/utils/offering-doubles.ts';

import {
  useCreateOffering,
  useDeleteOffering,
  useOffering,
  useOfferings,
  useRestoreOffering,
  useUpdateOffering,
} from './useOfferings.ts';

const FIELDS: OfferingFields = {
  ...OFFERING_DEFAULTS,
  name: 'Research Peel',
  price: 2000,
};

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
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('the catalogue reads', () => {
  it('reads the whole catalogue under the organization', async () => {
    vi.mocked(fetchAllOfferings).mockResolvedValue([offeringRecord()]);
    const { result } = renderHook(() => useOfferings(), { wrapper });
    await waitFor(() => expect(result.current.data).toEqual([offeringRecord()]));
    expect(client.getQueryData(offeringQueryKeys.list('org_test'))).toHaveLength(1);
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useOfferings(), { wrapper });
    expect(fetchAllOfferings).not.toHaveBeenCalled();
  });

  it('reads one offering, and stays idle without an id', async () => {
    vi.mocked(fetchOffering).mockResolvedValue(offeringRecord());
    const { result, rerender } = renderHook(({ id }) => useOffering(id), {
      wrapper,
      initialProps: { id: undefined as string | undefined },
    });
    expect(fetchOffering).not.toHaveBeenCalled();
    rerender({ id: TEST_OFFERING_ID });
    await waitFor(() => expect(result.current.data?.offeringNumber).toBe(5));
    expect(fetchOffering).toHaveBeenCalledWith(TEST_OFFERING_ID);
  });
});

describe('the writes', () => {
  it('creates with the action’s key and "Offering #5 created" — no lowest price without the code', async () => {
    vi.mocked(createOffering).mockResolvedValue(offeringRecord());
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateOffering(), { wrapper });

    await act(() => result.current.mutateAsync({ fields: FIELDS }));

    expect(createOffering).toHaveBeenCalledWith({
      fields: FIELDS,
      canSetLowestPrice: false,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith('Offering #5 created');
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: offeringQueryKeys.all }),
    );
  });

  it('saves with the lowest price when the member holds offering:lower_price:read', async () => {
    useOrganizationStore.getState().setPermissions(['offering:lower_price:read']);
    const record = offeringRecord();
    vi.mocked(updateOffering).mockResolvedValue(record);
    const { result } = renderHook(() => useUpdateOffering(), { wrapper });

    await act(() => result.current.mutateAsync({ record, fields: FIELDS }));

    expect(updateOffering).toHaveBeenCalledWith({
      record,
      fields: FIELDS,
      canSetLowestPrice: true,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith('Offering #5 saved');
  });

  it('takes a deleted offering out of the catalogue at once, refreshes the offers, and restores it', async () => {
    let land: () => void = () => undefined;
    vi.mocked(deleteOffering).mockReturnValue(
      new Promise<void>((resolve) => {
        land = resolve;
      }),
    );
    vi.mocked(restoreOffering).mockResolvedValue(offeringRecord());
    const key = offeringQueryKeys.list('org_test');
    client.setQueryData(key, [offeringRecord()]);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => ({ remove: useDeleteOffering(), restore: useRestoreOffering() }),
      { wrapper },
    );

    let deleting: Promise<void> = Promise.resolve();
    act(() => {
      deleting = result.current.remove.mutateAsync({
        id: TEST_OFFERING_ID,
        reason: 'not_needed',
        note: null,
      });
    });
    await waitFor(() => expect(client.getQueryData(key)).toEqual([]));
    land();
    await act(() => deleting);
    expect(deleteOffering).toHaveBeenCalledWith({
      offeringId: TEST_OFFERING_ID,
      reason: 'not_needed',
      note: null,
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: offerQueryKeys.all }),
    );

    await act(() => result.current.restore.mutateAsync(TEST_OFFERING_ID));
    expect(restoreOffering).toHaveBeenCalledWith(TEST_OFFERING_ID, expect.any(String));
  });

  it('puts the row back when the delete fails', async () => {
    vi.mocked(deleteOffering).mockRejectedValue(new Error('offline'));
    const key = offeringQueryKeys.list('org_test');
    client.setQueryData(key, [offeringRecord()]);
    const { result } = renderHook(() => useDeleteOffering({ notifyOnError: false }), {
      wrapper,
    });
    await act(async () => {
      await result.current
        .mutateAsync({ id: TEST_OFFERING_ID, reason: 'mistake', note: null })
        .catch(() => undefined);
    });
    expect(client.getQueryData(key)).toEqual([offeringRecord()]);
  });
});
