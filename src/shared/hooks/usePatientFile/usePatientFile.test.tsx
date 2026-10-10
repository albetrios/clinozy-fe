import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/shared/api/clinic/patient-file-api.ts', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  fetchPatientFile: vi.fn(),
}));
import { fetchPatientFile } from '@/shared/api/clinic/patient-file-api.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';
import { patientFile, TEST_PATIENT_ID } from '@/tests/utils/patient-doubles.ts';

import { usePatientFile } from './usePatientFile.ts';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => {
  client.clear();
  useOrganizationStore.getState().clearOrganization();
});

describe('usePatientFile', () => {
  it('reads the patient and the rail facts', async () => {
    vi.mocked(fetchPatientFile).mockResolvedValue(patientFile());
    const { result } = renderHook(() => usePatientFile(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(fetchPatientFile).toHaveBeenCalledWith(TEST_PATIENT_ID);
    expect(result.current.data?.patient.firstName).toBe('Priya');
  });

  it('stays idle without an id', () => {
    const { result } = renderHook(() => usePatientFile(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(fetchPatientFile).not.toHaveBeenCalled();
  });

  it('does not retry a patient that is gone', async () => {
    vi.mocked(fetchPatientFile).mockRejectedValue(
      new HttpError('Not found', 404, '/api/v1/app/patients/pat', 'GET'),
    );
    client = new QueryClient();
    const { result } = renderHook(() => usePatientFile(TEST_PATIENT_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(fetchPatientFile).toHaveBeenCalledTimes(1);
  });
});
