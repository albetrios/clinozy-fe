import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchAllOfferings: vi.fn(),
  fetchAllOffers: vi.fn(),
}));
import { branchRef } from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { fetchAllOfferings, fetchAllOffers } from '@/shared/api/clinic/offerings-api.ts';
import * as preferencesApi from '@/shared/api/clinic/preferences-api.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { offeringRecord, offerRecord } from '@/tests/utils/offering-doubles.ts';

import { useOfferingsCatalogue } from './useOfferingsCatalogue.ts';

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  vi.mocked(fetchAllOfferings).mockResolvedValue([offeringRecord()]);
  vi.mocked(fetchAllOffers).mockResolvedValue([
    offerRecord(),
    offerRecord({ id: 'ofr_ztlz67deab7f5yeztz3kl', status: 'ended' }),
  ]);
});
afterEach(() => {
  useOrganizationStore.getState().clearOrganization();
});

describe('useOfferingsCatalogue', () => {
  it('reads the whole catalogue, every offer in the server’s order, and the branches', async () => {
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.offerings).toEqual([offeringRecord()]);
    expect(result.current.offers.map((offer) => offer.status)).toEqual(['live', 'ended']);
    await waitFor(() => expect(result.current.isMultiBranch).toBe(true));
    expect(result.current.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.current).not.toHaveProperty('savedBy');
  });

  it('prices for no single branch until the header names exactly one', async () => {
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.pricingBranchId).toBeNull();
  });

  it('reports a failed read and reads again on refetch', async () => {
    vi.mocked(fetchAllOffers).mockRejectedValueOnce(new Error('connection dropped'));
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.offers).toHaveLength(2);
  });

  it('names the pricing branch the header picks alone', async () => {
    const vesu = branchRef('Vesu');
    const spy = vi.spyOn(preferencesApi, 'fetchMyPreferences').mockResolvedValue({
      ...preferencesApi.DEFAULT_CLINIC_PREFERENCES,
      branchFilter: [vesu],
    });
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    await waitFor(() => expect(result.current.pricingBranchId).toBe(vesu));
    spy.mockRestore();
  });
});
