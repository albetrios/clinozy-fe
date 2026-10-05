import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useAddPatientPackage,
  useConsumePackageSession,
  usePackageOfferings,
  usePatientPackages,
} from './usePatientPackages.ts';

const DHARTI = patientRef('Dharti Galani');
let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  resetClinicFixtures();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('usePatientPackages', () => {
  it('adds a package from a multi-session offering and refreshes the list', async () => {
    const { result } = renderHook(
      () => ({
        list: usePatientPackages(DHARTI),
        offerings: usePackageOfferings(),
        add: useAddPatientPackage(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    await waitFor(() => expect(result.current.offerings.data?.length).toBeGreaterThan(0));
    const offeringId = result.current.offerings.data?.[0]?.id ?? '';
    await act(() => result.current.add.mutateAsync({ patientId: DHARTI, offeringId }));
    await waitFor(() => expect(result.current.list.data).toHaveLength(3));
    expect(result.current.list.data?.filter((row) => !row.invoiced)).toHaveLength(1);
  });

  it('stays idle without a patient', () => {
    const { result } = renderHook(() => usePatientPackages(''), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });
});

describe('useConsumePackageSession', () => {
  it('uses a session by hand, and refuses one when none is left', async () => {
    const lhr = ref.patientPackage(1);
    const { result } = renderHook(
      () => ({ list: usePatientPackages(DHARTI), use: useConsumePackageSession() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    const saved = await act(() => result.current.use.mutateAsync(lhr));
    expect(saved).toMatchObject({ sessionsUsed: 2, sessionsTotal: 7 });
    await waitFor(() =>
      expect(
        result.current.list.data?.find((row) => row.package.id === lhr)?.package
          .sessionsUsed,
      ).toBe(2),
    );
    for (let used = 2; used < 7; used += 1) {
      await act(() => result.current.use.mutateAsync(lhr));
    }
    await expect(result.current.use.mutateAsync(lhr)).rejects.toMatchObject({
      status: 409,
    });
  });
});
