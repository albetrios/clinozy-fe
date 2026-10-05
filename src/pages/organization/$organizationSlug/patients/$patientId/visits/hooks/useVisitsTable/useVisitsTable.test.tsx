import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { fetchPatientAppointments } from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useVisitsTable } from './useVisitsTable.tsx';

let client: QueryClient;
let rows: AppointmentRow[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rows = await fetchPatientAppointments(patientRef('Dharti Galani'));
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('useVisitsTable (H:4746)', () => {
  it('lays out ID · When · Offering · Doctor · Status, When the primary, none sortable', () => {
    const { result } = renderHook(() => useVisitsTable(rows), { wrapper });
    const table = result.current;
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual([
      'id',
      'when',
      'offering',
      'doctor',
      'status',
    ]);
    expect(table.getVisibleLeafColumns()).toHaveLength(5);
    expect(table.getAllLeafColumns().every((column) => !column.getCanSort())).toBe(true);
    expect(table.getColumn('when')?.columnDef.meta?.primary).toBe(true);
    expect(table.getColumn('id')?.getCanHide()).toBe(false);
  });

  it('folds the number, the status with its dot, and the doctor to nothing', () => {
    const { result } = renderHook(() => useVisitsTable(rows), { wrapper });
    const [first] = rows;
    if (!first) throw new Error('no visit');
    const fold = (id: string) =>
      result.current.getColumn(id)?.columnDef.meta?.foldValue?.(first);
    expect(fold('id')).toBe(`#${first.seq}`);
    expect(fold('doctor')).toBeNull();
    expect(fold('status')).toMatchObject({
      value: expect.any(String),
      dotClassName: expect.stringMatching(/^bg-tone-/),
    });
  });
});
