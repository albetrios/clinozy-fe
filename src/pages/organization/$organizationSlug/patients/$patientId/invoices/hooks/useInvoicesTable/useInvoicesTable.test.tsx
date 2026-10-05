import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listPatientInvoices } from '@/shared/api/clinic/payments-api.ts';
import type { PatientInvoiceRow } from '@/shared/api/clinic/payments-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { useInvoicesTable } from './useInvoicesTable.tsx';

let client: QueryClient;
let rows: PatientInvoiceRow[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rows = await listPatientInvoices(patientRef('Dharti Galani'));
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

const invoice = (seq: number) => {
  const found = rows.find((row) => row.seq === seq);
  if (!found) throw new Error(`no invoice #${seq}`);
  return found;
};

describe('useInvoicesTable (H:4748)', () => {
  it('lays out Invoice · Items · Team · Bill · Paid / due · Status · Date, Team hidden', () => {
    const { result } = renderHook(() => useInvoicesTable(rows), { wrapper });
    const table = result.current;
    expect(table.getAllLeafColumns().map((column) => column.id)).toEqual([
      'invoice',
      'items',
      'team',
      'bill',
      'paid',
      'status',
      'date',
    ]);
    expect(table.getVisibleLeafColumns().map((column) => column.id)).not.toContain(
      'team',
    );
    expect(table.getColumn('items')?.columnDef.meta?.primary).toBe(true);
    expect(table.getColumn('bill')?.columnDef.meta?.align).toBe('end');
  });

  it('folds the number with the type, and the status with its dot', () => {
    const { result } = renderHook(() => useInvoicesTable(rows), { wrapper });
    const lhr = invoice(787);
    expect(result.current.getColumn('invoice')?.columnDef.meta?.foldValue?.(lhr)).toEqual(
      { value: '#787, Clinic', dotClassName: expect.stringMatching(/^bg-tone-/) },
    );
    expect(result.current.getColumn('status')?.columnDef.meta?.foldValue?.(lhr)).toEqual({
      value: 'Due',
      dotClassName: expect.stringMatching(/^bg-tone-blush/),
    });
    expect(result.current.getColumn('items')?.accessorFn?.(lhr, 0)).toBe(
      'LHR Full Face · B4G7',
    );
    expect(result.current.getColumn('bill')?.accessorFn?.(lhr, 0)).toBe('₹4,800');
    expect(result.current.getColumn('team')?.columnDef.meta?.foldValue?.(lhr)).toBeNull();
  });
});
