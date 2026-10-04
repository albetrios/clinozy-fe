import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { branchQueryKeys } from '@/shared/api/clinic/branches-api.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { staffQueryKeys } from '@/shared/api/clinic/users-api.ts';

import { useRemoveBranch, useSaveBranch } from './useBranchWrites.ts';

function setUp() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return { wrapper, invalidate };
}

function branchNamed(name: string) {
  const branch = clinicFixtures.branches.snapshot((row) => row.name === name)[0];
  if (!branch) throw new Error(`no branch ${name}`);
  return branch;
}

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('the branch writes', () => {
  it('saves a branch and refreshes every branch read and the staff profiles', async () => {
    const { wrapper, invalidate } = setUp();
    const { result } = renderHook(() => useSaveBranch(), { wrapper });
    const vesu = branchNamed('Vesu');
    await act(() =>
      result.current.mutateAsync({
        id: vesu.id,
        input: {
          name: 'Vesu',
          tone: vesu.tone,
          isMain: false,
          active: false,
          addressLine1: vesu.addressLine1,
          addressLine2: vesu.addressLine2,
          area: vesu.area,
          city: vesu.city,
          state: vesu.state,
          pin: vesu.pin,
          phone: vesu.phone,
          email: vesu.email,
          gstNumber: vesu.gstNumber,
          workingDays: vesu.workingDays,
          opensAt: vesu.opensAt,
          closesAt: vesu.closesAt,
          defaultDoctorId: null,
          defaultDeskId: null,
          defaultTherapistId: null,
          defaultPharmacistId: null,
        },
        team: { add: [], remove: [] },
      }),
    );
    expect(branchNamed('Vesu').active).toBe(false);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: branchQueryKeys.all });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: staffQueryKeys.all });
  });

  it('removes a branch with the reason picked', async () => {
    const { wrapper } = setUp();
    const { result } = renderHook(() => useRemoveBranch(), { wrapper });
    const varachha = branchNamed('Varachha');
    await act(() =>
      result.current.mutateAsync({ id: varachha.id, reason: 'duplicate', note: null }),
    );
    expect(clinicFixtures.branches.snapshot().map((branch) => branch.name)).not.toContain(
      'Varachha',
    );
  });
});
