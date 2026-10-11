import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOffers: vi.fn(),
  fetchOffer: vi.fn(),
  createOffer: vi.fn(),
  updateOffer: vi.fn(),
  setOfferActive: vi.fn(),
  deleteOffer: vi.fn(),
  restoreOffer: vi.fn(),
}));
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn(), undo: vi.fn() },
}));
import {
  createOffer,
  deleteOffer,
  fetchAllOffers,
  fetchOffer,
  offerQueryKeys,
  restoreOffer,
  setOfferActive,
  updateOffer,
} from '@/shared/api/app/offerings-api.ts';
import {
  OFFER_DEFAULTS,
  type OfferFields,
  type OfferRecord,
} from '@/shared/api/app/offerings-contracts.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/app-shell-doubles.ts';
import {
  offerRecord,
  TEST_OFFER_ID,
  TEST_OFFERING_ID,
} from '@/tests/utils/offering-doubles.ts';

import {
  useCreateOffer,
  useDeleteOffer,
  useOffer,
  useOffers,
  useRestoreOffer,
  useSetOfferActive,
  useUpdateOffer,
} from './useOffers.ts';

const FIELDS: OfferFields = {
  ...OFFER_DEFAULTS,
  name: 'Research Diwali glow',
  offeringIds: [TEST_OFFERING_ID],
};
const LIST = offerQueryKeys.list('org_test');

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** A write that lands when the test says so. */
function held<T>(value: T) {
  let land: () => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    land = () => resolve(value);
  });
  return { promise, land: () => land() };
}

const cachedOffer = () => client.getQueryData<OfferRecord[]>(LIST)?.[0];

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

describe('the offers reads', () => {
  it('reads every offer under the organization, and one by id', async () => {
    vi.mocked(fetchAllOffers).mockResolvedValue([offerRecord()]);
    vi.mocked(fetchOffer).mockResolvedValue(offerRecord());
    const { result } = renderHook(
      () => ({ list: useOffers(), one: useOffer(TEST_OFFER_ID) }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    await waitFor(() => expect(result.current.one.data?.status).toBe('live'));
    expect(fetchOffer).toHaveBeenCalledWith(TEST_OFFER_ID);
  });

  it('waits for an organization', () => {
    useOrganizationStore.getState().clearOrganization();
    renderHook(() => useOffers(), { wrapper });
    expect(fetchAllOffers).not.toHaveBeenCalled();
  });
});

describe('the writes', () => {
  it('creates and saves with the action’s key, naming the offer in the toast', async () => {
    const record = offerRecord();
    vi.mocked(createOffer).mockResolvedValue(record);
    vi.mocked(updateOffer).mockResolvedValue(record);
    const { result } = renderHook(
      () => ({ create: useCreateOffer(), update: useUpdateOffer() }),
      { wrapper },
    );

    await act(() => result.current.create.mutateAsync({ fields: FIELDS }));
    await act(() => result.current.update.mutateAsync({ record, fields: FIELDS }));

    expect(createOffer).toHaveBeenCalledWith({
      fields: FIELDS,
      idempotencyKey: expect.any(String),
    });
    expect(updateOffer).toHaveBeenCalledWith({
      record,
      fields: FIELDS,
      idempotencyKey: expect.any(String),
    });
    expect(notify.success).toHaveBeenCalledWith(
      'Research Diwali glow created · applies automatically',
    );
    expect(notify.success).toHaveBeenCalledWith('Research Diwali glow saved');
  });

  it('pauses at once, then reads the server’s answer into the row', async () => {
    const paused = offerRecord({ isActive: false, status: 'paused', updatedAt: 'later' });
    const write = held(paused);
    vi.mocked(setOfferActive).mockReturnValue(write.promise);
    client.setQueryData(LIST, [offerRecord()]);
    const { result } = renderHook(() => useSetOfferActive(), { wrapper });

    let pausing: Promise<OfferRecord> = Promise.resolve(paused);
    act(() => {
      pausing = result.current.mutateAsync({ id: TEST_OFFER_ID, isActive: false });
    });
    await waitFor(() =>
      expect(cachedOffer()).toMatchObject({ isActive: false, status: 'paused' }),
    );
    write.land();
    await act(() => pausing);

    expect(setOfferActive).toHaveBeenCalledWith({
      offerId: TEST_OFFER_ID,
      isActive: false,
      idempotencyKey: expect.any(String),
    });
    expect(cachedOffer()?.updatedAt).toBe('later');
    expect(notify.success).toHaveBeenCalledWith('Research Diwali glow paused', {
      id: 'app-offer-paused',
    });
  });

  it('resumes with the status the server works out, and flips back when the write fails', async () => {
    client.setQueryData(LIST, [offerRecord({ isActive: false, status: 'paused' })]);
    vi.mocked(setOfferActive).mockResolvedValueOnce(
      offerRecord({ isActive: true, status: 'scheduled' }),
    );
    const onSuccess = vi.fn();
    const { result } = renderHook(() => useSetOfferActive({ onSuccess }), { wrapper });

    await act(() => result.current.mutateAsync({ id: TEST_OFFER_ID, isActive: true }));
    expect(cachedOffer()).toMatchObject({ isActive: true, status: 'scheduled' });
    expect(onSuccess).toHaveBeenCalledTimes(1);

    vi.mocked(setOfferActive).mockRejectedValueOnce(new Error('offline'));
    await act(async () => {
      await result.current
        .mutateAsync({ id: TEST_OFFER_ID, isActive: false })
        .catch(() => undefined);
    });
    expect(cachedOffer()).toMatchObject({ isActive: true, status: 'scheduled' });
  });

  it('takes a deleted offer out at once and restores it with the Undo’s key', async () => {
    const write = held(undefined);
    vi.mocked(deleteOffer).mockReturnValue(write.promise);
    vi.mocked(restoreOffer).mockResolvedValue(offerRecord());
    client.setQueryData(LIST, [offerRecord()]);
    const { result } = renderHook(
      () => ({ remove: useDeleteOffer(), restore: useRestoreOffer() }),
      { wrapper },
    );

    let deleting: Promise<void> = Promise.resolve();
    act(() => {
      deleting = result.current.remove.mutateAsync({
        id: TEST_OFFER_ID,
        reason: 'duplicate',
        note: null,
      });
    });
    await waitFor(() => expect(client.getQueryData(LIST)).toEqual([]));
    write.land();
    await act(() => deleting);
    expect(deleteOffer).toHaveBeenCalledWith({
      offerId: TEST_OFFER_ID,
      reason: 'duplicate',
      note: null,
    });

    await act(() => result.current.restore.mutateAsync(TEST_OFFER_ID));
    expect(restoreOffer).toHaveBeenCalledWith(TEST_OFFER_ID, expect.any(String));
  });
});
