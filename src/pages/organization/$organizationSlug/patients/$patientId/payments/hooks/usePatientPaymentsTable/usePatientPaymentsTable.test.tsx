import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from '@/shared/api/clinic/fixtures/patients.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { listPatientPayments } from '@/shared/api/clinic/payments-api.ts';
import type { LedgerRow } from '@/shared/api/clinic/payments-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import { usePatientPaymentsTable } from './usePatientPaymentsTable.tsx';

let client: QueryClient;
let rows: LedgerRow[] = [];
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

beforeEach(async () => {
  resetClinicFixtures();
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  rows = await listPatientPayments(patientRef('Dharti Galani'));
});
afterEach(() => {
  client.clear();
  resetClinicFixtures();
});

/** Her receipt, as a split or a refund would leave it. */
const receipt = (changes: Partial<LedgerRow> = {}): LedgerRow => {
  const [first] = rows;
  if (!first) throw new Error('no receipt');
  return { ...first, ...changes };
};

describe('usePatientPaymentsTable (H:4751)', () => {
  it('lays out Receipt · When · Invoice · Mode · Amount · By, When the primary', () => {
    const { result } = renderHook(() => usePatientPaymentsTable(rows), { wrapper });
    expect(result.current.getAllLeafColumns().map((column) => column.id)).toEqual([
      'receipt',
      'when',
      'invoice',
      'mode',
      'amount',
      'by',
    ]);
    expect(result.current.getColumn('when')?.columnDef.meta?.primary).toBe(true);
    expect(result.current.getColumn('amount')?.columnDef.meta?.align).toBe('end');
  });

  /** A column's accessor and fold for a row, read through the table. */
  function readers() {
    const { result } = renderHook(() => usePatientPaymentsTable(rows), { wrapper });
    const column = (id: string) => result.current.getColumn(id);
    return {
      read: (id: string, row: LedgerRow) => column(id)?.accessorFn?.(row, 0),
      fold: (id: string, row: LedgerRow) => column(id)?.columnDef.meta?.foldValue?.(row),
    };
  }

  it('signs the amount: "+ ₹9,000" received, "− ₹500" paid back', () => {
    const { read } = readers();
    expect(read('receipt', receipt())).toBe('PAY-5505');
    expect(read('amount', receipt())).toBe('+ ₹9,000');
    expect(read('amount', receipt({ direction: 'paid', amount: 50_000 }))).toBe('− ₹500');
  });

  it('folds the invoice, or nothing without one; the recorder folds to nothing', () => {
    const { read, fold } = readers();
    expect(fold('invoice', receipt())).toBe('#782');
    expect(fold('invoice', receipt({ invoice: null }))).toBeNull();
    expect(read('invoice', receipt({ invoice: null }))).toBe('');
    expect(fold('by', receipt())).toBeNull();
    expect(read('by', receipt({ by: null }))).toBe('');
  });

  it('joins a split’s modes, each once', () => {
    const { read, fold } = readers();
    const split = receipt({
      splits: [
        { mode: 'cash', amount: 400_000 },
        { mode: 'upi', amount: 500_000 },
      ],
    });
    expect(read('mode', split)).toBe('Cash + UPI');
    expect(fold('mode', split)).toMatchObject({ value: 'Cash + UPI' });
  });
});
