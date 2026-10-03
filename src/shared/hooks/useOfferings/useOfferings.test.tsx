import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useCreateOffering,
  useDeleteOffering,
  useOffering,
  useOfferings,
  useRestoreOffering,
  useUpdateOffering,
} from './useOfferings.ts';

/** Holds a delete until a test lets it land, so the optimistic patch can be seen. */
const gate = vi.hoisted(() => ({ hold: null as Promise<void> | null }));

vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof OfferingsApiModule>();
  return {
    ...actual,
    deleteOffering: async (...args: Parameters<typeof actual.deleteOffering>) => {
      await gate.hold;
      return actual.deleteOffering(...args);
    },
  };
});
vi.mock('@/shared/notify/index.ts', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** The catalogue hook beside the write under test, sharing one cache. */
function renderWith<T>(useWrite: () => T) {
  return renderHook(() => ({ list: useOfferings(), write: useWrite() }), { wrapper });
}

const seqsOf = (rows: { seq: number }[] | undefined) => rows?.map((row) => row.seq) ?? [];

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

describe('useOfferings', () => {
  it('reads the whole catalogue into one cache entry', async () => {
    const { result } = renderHook(() => useOfferings(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(11);
    expect(result.current.data?.[0]).toMatchObject({ seq: 274, offerPrice: 120000 });
  });
});

describe('useOffering', () => {
  it('reads one offering, and stays idle without an id', async () => {
    const { result } = renderHook(() => useOffering(ref.offering(268)), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('LHR Full Face · B4G7');

    const idle = renderHook(() => useOffering(undefined), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('useCreateOffering', () => {
  it('creates, says "Offering #275 created" and refreshes the catalogue', async () => {
    const { result } = renderWith(() => useCreateOffering());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() =>
      result.current.write.mutateAsync({ name: 'Hydra facial', price: 250000 }),
    );

    expect(notify.success).toHaveBeenCalledWith('Offering #275 created');
    await waitFor(() => expect(seqsOf(result.current.list.data)).toContain(275));
  });

  it('takes the caller’s message — the stacked "New offering" says its own', async () => {
    const { result } = renderHook(
      () =>
        useCreateOffering({
          successMessage: (offering) => `Offering ${offering.name} added`,
        }),
      { wrapper },
    );
    await act(() => result.current.mutateAsync({ name: 'Hydra facial', price: 250000 }));
    expect(notify.success).toHaveBeenCalledWith('Offering Hydra facial added');
  });

  it('surfaces a refused create and stores nothing', async () => {
    const { result } = renderHook(() => useCreateOffering(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ name: 'Back Peeling', price: 1000 })
        .catch(() => undefined);
    });
    expect(notify.error).toHaveBeenCalledWith(
      'An offering with this name already exists',
    );
    expect(notify.success).not.toHaveBeenCalled();
  });
});

describe('useUpdateOffering', () => {
  it('saves, says "Offering #273 saved" and refreshes the catalogue', async () => {
    const { result } = renderWith(() => useUpdateOffering());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(() =>
      result.current.write.mutateAsync({ id: ref.offering(273), patch: { sessions: 8 } }),
    );

    expect(notify.success).toHaveBeenCalledWith('Offering #273 saved');
    await waitFor(() =>
      expect(result.current.list.data?.find((row) => row.seq === 273)?.sessions).toBe(8),
    );
  });
});

describe('useDeleteOffering', () => {
  it('drops the row at once, keeps it gone once the delete lands, and raises no toast of its own', async () => {
    const { result } = renderWith(() => useDeleteOffering());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    let release: () => void = () => undefined;
    gate.hold = new Promise((resolve) => {
      release = resolve;
    });

    let landed: Promise<unknown> = Promise.resolve();
    act(() => {
      landed = result.current.write.mutateAsync({
        id: ref.offering(272),
        reason: 'duplicate',
        note: null,
      });
    });
    await waitFor(() => expect(seqsOf(result.current.list.data)).not.toContain(272));

    release();
    await act(() => landed);
    await waitFor(() => expect(result.current.list.isFetching).toBe(false));
    expect(seqsOf(result.current.list.data)).not.toContain(272);
    expect(notify.success).not.toHaveBeenCalled();
  });

  it('puts the row back and says why when the delete is refused', async () => {
    const { result } = renderWith(() => useDeleteOffering());
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));

    await act(async () => {
      await result.current.write
        .mutateAsync({ id: ref.offering(272), reason: 'other', note: null })
        .catch(() => undefined);
    });

    expect(seqsOf(result.current.list.data)).toContain(272);
    expect(notify.error).toHaveBeenCalledTimes(1);
  });
});

describe('useRestoreOffering', () => {
  it('brings a deleted offering back into the catalogue, silently', async () => {
    const { result } = renderHook(
      () => ({
        list: useOfferings(),
        remove: useDeleteOffering(),
        restore: useRestoreOffering(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.isSuccess).toBe(true));
    await act(() =>
      result.current.remove.mutateAsync({
        id: ref.offering(270),
        reason: 'mistake',
        note: null,
      }),
    );
    await waitFor(() => expect(seqsOf(result.current.list.data)).not.toContain(270));

    await act(() => result.current.restore.mutateAsync(ref.offering(270)));

    await waitFor(() => expect(seqsOf(result.current.list.data)).toContain(270));
    expect(notify.success).not.toHaveBeenCalled();
  });
});
