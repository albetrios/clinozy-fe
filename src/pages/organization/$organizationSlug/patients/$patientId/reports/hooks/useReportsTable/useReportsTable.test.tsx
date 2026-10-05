import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { PatientReport } from '@/shared/api/clinic/clinic-schema.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listPatientReports } from '@/shared/api/clinic/patient-reports-api.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useReportsTable } from './useReportsTable.tsx';

let client: QueryClient;
let rows: PatientReport[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rows = await listPatientReports(patientRef('Dharti Galani'));
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useReportsTable (H:4760)', () => {
  it('lays out Report · Type · Date · Uploaded by, Report the primary', () => {
    const { result } = renderHook(() => useReportsTable(rows), { wrapper });
    expect(result.current.getAllLeafColumns().map((column) => column.id)).toEqual([
      'report',
      'type',
      'date',
      'uploadedBy',
    ]);
    expect(result.current.getVisibleLeafColumns()).toHaveLength(4);
    expect(result.current.getColumn('report')?.columnDef.meta?.primary).toBe(true);
  });

  it('folds the type with its dot and the uploader to nothing', async () => {
    const { result } = renderHook(() => useReportsTable(rows), { wrapper });
    const lab = rows.find((report) => report.type === 'lab');
    if (!lab) throw new Error('no lab report');
    expect(result.current.getColumn('type')?.columnDef.meta?.foldValue?.(lab)).toEqual({
      value: 'Lab',
      dotClassName: expect.stringMatching(/^bg-tone-mint/),
    });
    expect(
      result.current.getColumn('uploadedBy')?.columnDef.meta?.foldValue?.(lab),
    ).toBeNull();
    await waitFor(() =>
      expect(result.current.getColumn('uploadedBy')?.accessorFn?.(lab, 0)).toBe(
        'Riya Shah',
      ),
    );
  });
});
