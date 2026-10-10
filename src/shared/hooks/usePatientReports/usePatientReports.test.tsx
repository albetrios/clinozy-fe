import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type * as ReportsApiModule from '@/shared/api/clinic/patient-reports-api.ts';
import {
  createPatientReport,
  deletePatientReport,
  listPatientReports,
  restorePatientReport,
} from '@/shared/api/clinic/patient-reports-api.ts';
import type { PatientReport } from '@/shared/api/clinic/patient-reports-contracts.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';
import { signInTestMember } from '@/tests/utils/clinic-shell-doubles.ts';

import {
  useCreatePatientReport,
  useDeletePatientReport,
  usePatientReports,
  useRestorePatientReport,
} from './usePatientReports.ts';

vi.mock('@/shared/api/clinic/patient-reports-api.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof ReportsApiModule>()),
  listPatientReports: vi.fn(),
  createPatientReport: vi.fn(),
  deletePatientReport: vi.fn(),
  restorePatientReport: vi.fn(),
}));

const PATIENT_ID = 'pat_priya0000000000000000';

const REPORT: PatientReport = {
  id: 'prep_cbc00000000000000000',
  patientId: PATIENT_ID,
  type: 'lab',
  name: 'CBC',
  date: '2026-10-05',
  fileKeys: [],
  notes: null,
  createdAt: '2026-10-05T06:00:00.000Z',
  updatedAt: '2026-10-05T06:00:00.000Z',
};

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    client,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    ),
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  signInTestMember();
});
afterEach(() => useOrganizationStore.getState().clearOrganization());

describe('usePatientReports', () => {
  it('reads every report, or the newest few, with the server’s total', async () => {
    vi.mocked(listPatientReports).mockResolvedValue({ reports: [REPORT], total: 4 });
    const { wrapper: Wrapper } = wrapper();
    const all = renderHook(() => usePatientReports(PATIENT_ID), { wrapper: Wrapper });
    const latest = renderHook(() => usePatientReports(PATIENT_ID, { limit: 3 }), {
      wrapper: Wrapper,
    });

    await waitFor(() => expect(all.result.current.data?.total).toBe(4));
    await waitFor(() => expect(latest.result.current.isSuccess).toBe(true));
    expect(listPatientReports).toHaveBeenCalledWith(PATIENT_ID, {});
    expect(listPatientReports).toHaveBeenCalledWith(PATIENT_ID, { limit: 3 });
  });

  it('waits for a patient and its gate', () => {
    const { wrapper: Wrapper } = wrapper();
    renderHook(() => usePatientReports(''), { wrapper: Wrapper });
    renderHook(() => usePatientReports(PATIENT_ID, { enabled: false }), {
      wrapper: Wrapper,
    });
    expect(listPatientReports).not.toHaveBeenCalled();
  });
});

describe('the report writes', () => {
  it('creates, deletes and restores with the action’s key, refreshing the reports', async () => {
    vi.mocked(createPatientReport).mockResolvedValueOnce(REPORT);
    vi.mocked(deletePatientReport).mockResolvedValueOnce();
    vi.mocked(restorePatientReport).mockResolvedValueOnce(REPORT);
    const { wrapper: Wrapper, client } = wrapper();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const create = renderHook(() => useCreatePatientReport(), { wrapper: Wrapper });
    const remove = renderHook(() => useDeletePatientReport(), { wrapper: Wrapper });
    const restore = renderHook(() => useRestorePatientReport(), { wrapper: Wrapper });
    const input = { type: 'lab' as const, name: 'CBC', date: '2026-10-05', notes: null };

    await act(() => create.result.current.mutateAsync({ patientId: PATIENT_ID, input }));
    await act(() =>
      remove.result.current.mutateAsync({
        report: REPORT,
        reason: 'duplicate',
        note: null,
      }),
    );
    await act(() => restore.result.current.mutateAsync(REPORT));

    expect(createPatientReport).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      input,
      idempotencyKey: expect.any(String),
    });
    expect(deletePatientReport).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      reportId: REPORT.id,
      reason: 'duplicate',
      note: null,
    });
    expect(restorePatientReport).toHaveBeenCalledWith({
      patientId: PATIENT_ID,
      reportId: REPORT.id,
      idempotencyKey: expect.any(String),
    });
    expect(invalidate).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ['clinic', 'patients', 'reports'] }),
    );
  });
});
