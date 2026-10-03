import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useCreateOffer,
  useDeleteOffer,
  useOffer,
  useOffers,
  useRestoreOffer,
  useSetOfferPaused,
  useUpdateOffer,
} from './useOffers.ts';

/** Holds a pause until a test lets it land, so the optimistic flip can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));

vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof OfferingsApiModule>();
  return {
    ...actual,
    setOfferPaused: async (...args: Parameters<typeof actual.setOfferPaused>) => {
      await gate.hold;
      return actual.setOfferPaused(...args);
    },
  };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const NAVRATRI = ref.offer(31);
const MONSOON = ref.offer(28);

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The offers hook beside the write under test, sharing one cache. */
function renderWith<T>(useWrite: () => T) {
  return renderHook(() => ({ list: useOffers(), write: useWrite() }), { wrapper });
}

const pausedOf = (offers: { id: string; paused: boolean }[] | undefined, id: string) =>
  offers?.find((offer) => offer.id === id)?.paused;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  gate.hold = null;
  vi.mocked(notify.success).mockClear();
  vi.mocked(notify.error).mockClear();
  resetClinicFixtures();
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useOffers', () => {
  it('reads every offer into one cache entry', async () => {
    const { result } = renderHook(() => useOffers(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.map((offer) => offer.name)).toEqual([
      'Peel pack + 1 free',
      'Navratri glow',
      'LHR launch · Vesu',
      'Monsoon ₹500 off',
    ]);
  });
});

describe('useOffer', () => {
  it('reads one offer, and stays idle without an id', async () => {
    const { result } = renderHook(() => useOffer(NAVRATRI), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.code).toBe('GLOW20');

    const idle = renderHook(() => useOffer(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateOffer and useUpdateOffer', () => {
  it('creates and says "<name> created · applies automatically"', async () => {
    const { result } = renderWith(() => useCreateOffer());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() =>
      result.current.write.mutateAsync({
        name: 'Diwali glow',
        offeringIds: [ref.offering(274)],
      }),
    );

    expect(notify.success).toHaveBeenCalledWith(
      'Diwali glow created · applies automatically',
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(5));
  });

  it('saves and says "<name> saved"', async () => {
    const { result } = renderHook(() => useUpdateOffer(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ id: NAVRATRI, patch: { note: 'Festival only' } }),
    );
    expect(notify.success).toHaveBeenCalledWith('Navratri glow saved');
  });
});

describe('useSetOfferPaused', () => {
  it('flips the offer at once, then says "Navratri glow paused" / "… running again"', async () => {
    const { result } = renderWith(() => useSetOfferPaused());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    let release: () => void = () => undefined;
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });

    let landed: Promise<unknown> = Promise.resolve();
    act(() => {
      landed = result.current.write.mutateAsync({ id: NAVRATRI, paused: true });
    });
    await waitFor(() => expect(pausedOf(result.current.list.data, NAVRATRI)).toBe(true));
    expect(notify.success).not.toHaveBeenCalled();

    release();
    await act(() => landed);
    expect(notify.success).toHaveBeenCalledWith('Navratri glow paused', {
      id: 'clinic-offer-paused',
    });
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));
    expect(pausedOf(result.current.list.data, NAVRATRI)).toBe(true);

    gate.hold = null;
    await act(() => result.current.write.mutateAsync({ id: NAVRATRI, paused: false }));
    expect(notify.success).toHaveBeenLastCalledWith('Navratri glow running again', {
      id: 'clinic-offer-paused',
    });
  });

  it('flips back and says why when the write fails', async () => {
    const { result } = renderWith(() => useSetOfferPaused());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    // Gone on the server while this screen still shows it.
    await clinicFixtures.offers.remove(MONSOON, 'duplicate', null);

    await act(async () => {
      await result.current.write
        .mutateAsync({ id: MONSOON, paused: true })
        .catch(() => undefined);
    });

    expect(pausedOf(result.current.list.data, MONSOON)).toBe(false);
    expect(notify.error).toHaveBeenCalledTimes(1);
  });
});

describe('useDeleteOffer and useRestoreOffer', () => {
  it('drops the offer at once and brings it back on Undo, both silently', async () => {
    const { result } = renderHook(
      () => ({ list: useOffers(), remove: useDeleteOffer(), restore: useRestoreOffer() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    const ids = () => result.current.list.data?.map((offer) => offer.id) ?? [];

    await act(() =>
      result.current.remove.mutateAsync({
        id: NAVRATRI,
        reason: 'not_needed',
        note: null,
      }),
    );
    await waitFor(() => expect(ids()).not.toContain(NAVRATRI));

    await act(() => result.current.restore.mutateAsync(NAVRATRI));
    await waitFor(() => expect(ids()).toContain(NAVRATRI));
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('puts the offer back and says why when the delete is refused', async () => {
    const { result } = renderWith(() => useDeleteOffer());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.write
        .mutateAsync({ id: NAVRATRI, reason: 'other', note: '  ' })
        .catch(() => undefined);
    });

    expect(result.current.list.data?.map((offer) => offer.id)).toContain(NAVRATRI);
    expect(notify.error).toHaveBeenCalledTimes(1);
  });
});
