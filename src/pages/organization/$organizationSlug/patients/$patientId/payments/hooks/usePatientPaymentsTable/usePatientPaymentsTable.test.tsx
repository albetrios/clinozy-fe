import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { LedgerRow } from '@/shared/api/app/payments-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { ledgerRow } from '@/tests/utils/payments-doubles.ts';

import { usePatientPaymentsTable } from './usePatientPaymentsTable.tsx';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Kavya Mehta's PAY-5: ₹150 received in cash and UPI against invoice #5. */
const RECEIPT = ledgerRow();
const ROWS: LedgerRow[] = [RECEIPT];

beforeEach(() => {
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

/** A column's accessor and fold for a row, read through the table. */
function readers() {
  const { result } = renderHook(() => usePatientPaymentsTable(ROWS), { wrapper });
  const column = (id: string) => result.current.getColumn(id);
  return {
    read: (id: string, row: LedgerRow) => column(id)?.accessorFn?.(row, 0),
    fold: (id: string, row: LedgerRow) => column(id)?.columnDef.meta?.foldValue?.(row),
  };
}

describe('usePatientPaymentsTable (H:4751)', () => {
  it('lays out Receipt · When · Invoice · Mode · Amount · By, When the primary', () => {
    const { result } = renderHook(() => usePatientPaymentsTable(ROWS), { wrapper });
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

  it('signs the rupees: "+ ₹150" received, "− ₹100.50" paid back', () => {
    const { read } = readers();
    expect(read('receipt', RECEIPT)).toBe('PAY-5');
    expect(read('amount', RECEIPT)).toBe('+ ₹150');
    expect(
      read('amount', ledgerRow({ direction: 'paid', kind: 'refund', amount: 100.5 })),
    ).toBe('− ₹100.50');
  });

  it('folds the invoice, or nothing without one; the recorder folds to nothing', () => {
    const { read, fold } = readers();
    expect(fold('invoice', RECEIPT)).toBe('#5');
    expect(fold('invoice', ledgerRow({ invoice: null, invoiceId: null }))).toBeNull();
    expect(read('invoice', ledgerRow({ invoice: null, invoiceId: null }))).toBe('');
    expect(read('by', RECEIPT)).toBe('Nisha Shah');
    expect(fold('by', RECEIPT)).toBeNull();
    expect(read('by', ledgerRow({ by: null }))).toBe('');
  });

  it('joins a split’s modes, each once', () => {
    const { read, fold } = readers();
    expect(read('mode', RECEIPT)).toBe('Cash + UPI');
    expect(
      fold(
        'mode',
        ledgerRow({
          splits: [
            { mode: 'upi', amount: 50 },
            { mode: 'upi', amount: 100 },
          ],
        }),
      ),
    ).toMatchObject({ value: 'UPI' });
  });
});
