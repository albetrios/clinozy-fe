import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/offerings-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchFixtureOfferings: vi.fn(),
  fetchFixtureOffers: vi.fn(),
  createFixtureOffering: vi.fn(),
}));
import {
  createFixtureOffering,
  fetchFixtureOfferings,
  fetchFixtureOffers,
  fixtureOfferingQueryKeys,
} from '@/shared/api/clinic/offerings-fixture-api.ts';
import type {
  OfferingRecord,
  OfferRecord,
} from '@/shared/api/clinic/offerings-fixture-contracts.ts';

import {
  useCreateFixtureOffering,
  useFixtureOfferings,
  useFixtureOffers,
} from './useFixtureOfferings.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

const corn = { id: 'offering-270', seq: 270, name: 'Corn Removal' } as OfferingRecord;

beforeEach(() => {
  vi.resetAllMocks();
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
});

describe('the fixture catalogue the fixture rooms still read', () => {
  it('reads the fixture offerings and offers under their own keys, apart from clinozy-be’s', async () => {
    vi.mocked(fetchFixtureOfferings).mockResolvedValue([corn]);
    vi.mocked(fetchFixtureOffers).mockResolvedValue([{ id: 'offer-28' } as OfferRecord]);
    const { result } = renderHook(
      () => ({ offerings: useFixtureOfferings(), offers: useFixtureOffers() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.offerings.data).toEqual([corn]));
    await waitFor(() => expect(result.current.offers.data).toHaveLength(1));
    expect(client.getQueryData(fixtureOfferingQueryKeys.offerings())).toEqual([corn]);
    expect(fixtureOfferingQueryKeys.all).toEqual(['clinic', 'fixture-offerings']);
  });

  it('creates a fixture offering and refreshes the fixture catalogue', async () => {
    vi.mocked(createFixtureOffering).mockResolvedValue(corn);
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateFixtureOffering(), { wrapper });
    await act(() => result.current.mutateAsync({ name: 'Corn Removal', price: 100_000 }));
    expect(createFixtureOffering).toHaveBeenCalledWith({
      name: 'Corn Removal',
      price: 100_000,
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: fixtureOfferingQueryKeys.all }),
    );
  });
});
