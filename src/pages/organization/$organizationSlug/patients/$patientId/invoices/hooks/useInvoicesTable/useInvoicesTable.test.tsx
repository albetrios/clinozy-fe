import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { InvoiceRecord } from '@/shared/api/clinic/invoices-contracts.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';
import { invoiceRecord } from '@/tests/utils/payments-doubles.ts';

import { useInvoicesTable } from './useInvoicesTable.tsx';

let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) {
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

/** Kavya Mehta's consultation #5 (₹500, ₹400 paid, ₹100 due) and a clinic invoice paid in full. */
const CONSULTATION = invoiceRecord();
const LHR = invoiceRecord({
  id: 'invc_lhrfullface0000000000',
  seq: 6,
  type: 'clinic',
  items: [
    {
      ...invoiceRecord().items[0]!,
      id: 'iitm_lhr00000000000000000',
      name: 'LHR Full Face',
    },
    {
      ...invoiceRecord().items[0]!,
      id: 'iitm_peel0000000000000000',
      name: 'Research Peel',
    },
  ],
  total: 4800.5,
  paid: 4800.5,
  due: 0,
  status: 'paid',
  remark: null,
});
const ROWS: InvoiceRecord[] = [LHR, CONSULTATION];

beforeEach(() => {
  useDevicePrefsStore.setState({ hiddenColumns: {} });
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});
afterEach(() => client.clear());

/** A column's accessor and fold for a row, read through the table. */
function readers() {
  const { result } = renderHook(() => useInvoicesTable(ROWS), { wrapper });
  const column = (id: string) => result.current.getColumn(id);
  return {
    read: (id: string, row: InvoiceRecord) => column(id)?.accessorFn?.(row, 0),
    fold: (id: string, row: InvoiceRecord) =>
      column(id)?.columnDef.meta?.foldValue?.(row),
  };
}

describe('useInvoicesTable (H:4748)', () => {
  it('lays out Invoice · Items · Team · Bill · Paid / due · Status · Date, Team hidden', () => {
    const { result } = renderHook(() => useInvoicesTable(ROWS), { wrapper });
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

  it('folds the number with the type, and the server’s status with its dot', () => {
    const { read, fold } = readers();
    expect(fold('invoice', CONSULTATION)).toEqual({
      value: '#5, Consultation',
      dotClassName: expect.stringMatching(/^bg-tone-/),
    });
    expect(fold('status', CONSULTATION)).toEqual({
      value: 'Partly paid',
      dotClassName: expect.stringMatching(/^bg-tone-butter/),
    });
    expect(fold('status', LHR)).toMatchObject({ value: 'Paid' });
    expect(fold('team', CONSULTATION)).toBeNull();
    expect(read('items', LHR)).toBe('LHR Full Face, Research Peel');
  });

  it('reads the bill and what is paid in rupees as the API sends them', () => {
    const { read } = readers();
    expect(read('bill', CONSULTATION)).toBe('₹500');
    expect(read('paid', CONSULTATION)).toBe('₹400');
    expect(read('bill', LHR)).toBe('₹4,800.50');
  });
});
