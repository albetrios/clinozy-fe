import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { branchRef } from '@/shared/api/clinic/fixtures/organization.fixtures.ts';
import { staffRef } from '@/shared/api/clinic/fixtures/staff.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import type * as OfferingsApiModule from '@/shared/api/clinic/offerings-api.ts';
import * as preferencesApi from '@/shared/api/clinic/preferences-api.ts';

import { useOfferingsCatalogue } from './useOfferingsCatalogue.ts';

/** Fails the offers read while set — the room's list error. */
const gate = vi.hoisted(() => ({ failing: false }));
vi.mock('@/shared/api/clinic/offerings-api.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof OfferingsApiModule>();
  return {
    ...actual,
    fetchAllOffers: async () => {
      if (gate.failing) throw new Error('connection dropped');
      return actual.fetchAllOffers();
    },
  };
});

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  gate.failing = false;
  resetClinicFixtures();
  preferencesApi.resetPreferencesFixture();
});
afterEach(() => {
  resetClinicFixtures();
});

describe('useOfferingsCatalogue', () => {
  it('reads the whole catalogue, every offer, the branches and the team', async () => {
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    expect(result.current.isPending).toBe(true);
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.offerings).toHaveLength(11);
    expect(result.current.offers).toHaveLength(4);
    await waitFor(() => expect(result.current.isMultiBranch).toBe(true));
    expect(result.current.today).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await waitFor(() =>
      expect(result.current.savedBy(staffRef('RS'))).toMatchObject({
        id: staffRef('RS'),
      }),
    );
    expect(
      result.current.savedBy('00000000-0000-4000-8000-000000000000'),
    ).toBeUndefined();
  });

  it('prices for no single branch until the header names exactly one', async () => {
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.pricingBranchId).toBeNull();
  });

  it('reports a failed read and reads again on refetch', async () => {
    gate.failing = true;
    const { result } = renderHook(() => useOfferingsCatalogue(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    gate.failing = false;
    act(() => result.current.refetch());
    await waitFor(() => expect(result.current.isError).toBe(false));
    expect(result.current.offers).toHaveLength(4);
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
