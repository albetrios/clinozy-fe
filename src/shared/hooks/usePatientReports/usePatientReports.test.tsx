import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import {
  useCreatePatientReport,
  useDeletePatientReport,
  usePatientReport,
  usePatientReports,
  useRestorePatientReport,
} from './usePatientReports.ts';

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

describe('usePatientReports', () => {
  it('uploads a report and refreshes the list', async () => {
    const { result } = renderHook(
      () => ({ list: usePatientReports(DHARTI), create: useCreatePatientReport() }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    await act(() =>
      result.current.create.mutateAsync({
        patientId: DHARTI,
        type: 'lab',
        name: 'Vitamin D',
        date: '2026-10-03',
        notes: null,
      }),
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(3));
  });

  it('reads one report with who added it; idle without one', async () => {
    const { result } = renderHook(() => usePatientReport(ref.patientReport(1)), {
      wrapper,
    });
    await waitFor(() =>
      expect(result.current.data?.report.name).toBe('CBC + Thyroid profile'),
    );
    const idle = renderHook(() => usePatientReport(''), { wrapper });
    expect(idle.result.current.fetchStatus).toBe('idle');
  });
});

describe('useDeletePatientReport / useRestorePatientReport', () => {
  it('deletes a report with the confirm’s reason and brings it back', async () => {
    const { result } = renderHook(
      () => ({
        list: usePatientReports(DHARTI),
        remove: useDeletePatientReport(),
        restore: useRestorePatientReport(),
      }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
    await act(() =>
      result.current.remove.mutateAsync({
        id: ref.patientReport(2),
        reason: 'duplicate',
        note: null,
      }),
    );
    await waitFor(() => expect(result.current.list.data).toHaveLength(1));
    await act(() => result.current.restore.mutateAsync(ref.patientReport(2)));
    await waitFor(() => expect(result.current.list.data).toHaveLength(2));
  });
});
