import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/app/patients-fixture-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatient: vi.fn(),
}));
import {
  fetchPatient,
  fixturePatientQueryKeys,
} from '@/shared/api/app/patients-fixture-api.ts';
import type { PatientRow } from '@/shared/api/app/patients-fixture-contracts.ts';

import { useFixturePatient } from './useFixturePatients.ts';

let client: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('the fixture patient the fixture rooms still read', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  });

  it('reads one fixture patient, and stays idle without an id', async () => {
    const dharti = { id: 'patient-dharti', seq: 3508 } as PatientRow;
    vi.mocked(fetchPatient).mockResolvedValue(dharti);
    const { result, rerender } = renderHook(({ id }) => useFixturePatient(id), {
      wrapper,
      initialProps: { id: undefined as string | undefined },
    });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchPatient).not.toHaveBeenCalled();

    rerender({ id: 'patient-dharti' });

    await waitFor(() => expect(result.current.data).toEqual(dharti));
    expect(fetchPatient).toHaveBeenCalledWith('patient-dharti');
  });

  it('caches under the fixture patients’ own keys, apart from clinozy-be’s', async () => {
    vi.mocked(fetchPatient).mockResolvedValue({ id: 'patient-raam' } as PatientRow);
    const { result } = renderHook(() => useFixturePatient('patient-raam'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(client.getQueryData(fixturePatientQueryKeys.detail('patient-raam'))).toEqual({
      id: 'patient-raam',
    });
    expect(fixturePatientQueryKeys.detail('patient-raam').slice(0, 2)).toEqual([
      'app',
      'fixture-patients',
    ]);
  });
});
