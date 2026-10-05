import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import {
  clinicFixtures,
  resetClinicFixtures,
} from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { isNotFound } from '@/shared/errors/HttpError.ts';

import { usePatientFile } from './usePatientFile.ts';

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

describe('usePatientFile', () => {
  it('reads the patient and the rail facts', async () => {
    const { result } = renderHook(() => usePatientFile(DHARTI), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.patient.firstName).toBe('Dharti');
  });

  it('stays idle without an id', () => {
    const { result } = renderHook(() => usePatientFile(undefined), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('fails once on a deleted patient — a 404 is not asked again', async () => {
    await clinicFixtures.patients.remove(DHARTI, 'mistake', null);
    const { result } = renderHook(() => usePatientFile(DHARTI), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(isNotFound(result.current.error)).toBe(true);
    expect(result.current.failureCount).toBe(1);
  });
});
