import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listPatientPrescriptions } from '@/shared/api/clinic/prescriptions-api.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { usePrescriptionsTable } from './usePrescriptionsTable.tsx';

let client: QueryClient;
let rows: Prescription[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rows = await listPatientPrescriptions(patientRef('Dharti Galani'));
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

describe('usePrescriptionsTable (H:4753)', () => {
  it('lays out ID · Date · Medicines · Notes · Doctor · Updated, Notes and Updated hidden', () => {
    const { result } = renderHook(() => usePrescriptionsTable(rows), { wrapper });
    const table = result.current;
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual([
      'id',
      'date',
      'medicines',
      'notes',
      'doctor',
      'updated',
    ]);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).toEqual([
      'id',
      'date',
      'medicines',
      'doctor',
    ]);
    expect(table.getColumn('date')?.columnDef.meta?.primary).toBe(true);
    expect(table.getColumn('medicines')?.columnDef.meta?.track).toBe('minmax(240px,2fr)');
  });

  it('reads the medicines, the notes and the doctor; the people fold to nothing', async () => {
    const { result } = renderHook(() => usePrescriptionsTable(rows), { wrapper });
    const [rx] = rows;
    if (!rx) throw new Error('no prescription');
    const column = (id: string) => result.current.getColumn(id);
    expect(column('medicines')?.accessorFn?.(rx, 0)).toBe('Sunscreen SPF 50');
    expect(column('notes')?.accessorFn?.(rx, 0)).toEqual(expect.any(String));
    expect(column('id')?.columnDef.meta?.foldValue?.(rx)).toBe('#497');
    expect(column('doctor')?.columnDef.meta?.foldValue?.(rx)).toBeNull();
    expect(column('updated')?.columnDef.meta?.foldValue?.(rx)).toBeNull();
    await waitFor(() =>
      expect(result.current.getColumn('doctor')?.accessorFn?.(rx, 0)).toMatch(/^Dr\. /),
    );
  });
});
