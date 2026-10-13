import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import i18n from '@/lib/i18n/i18n.ts';
import { stockPurchaseRow } from '@/tests/utils/stock-doubles.ts';

import { STOCK_KEYS, STOCK_NS } from '../../../stock.constants.ts';
import { useStockPurchaseColumns } from './useStockPurchaseColumns.tsx';

describe('useStockPurchaseColumns', () => {
  it('lays out the Purchases columns with the Invoice hidden; the Supplier does not sort', () => {
    const { result } = renderHook(() => useStockPurchaseColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'vendor',
      'billNo',
      'date',
      'bill',
      'due',
      'status',
    ]);
    const column = (id: string) => result.current.find((entry) => entry.id === id);
    expect(column('billNo')?.meta?.defaultHidden).toBe(true);
    expect(column('vendor')?.enableSorting).toBe(false);
    expect(column('seq')?.enableSorting).not.toBe(false);
    expect(column('bill')?.enableSorting).not.toBe(false);
    expect(column('due')?.enableSorting).not.toBe(false);
  });

  it('folds the server’s bill and due in rupees ("—" when nothing is due) and the status', () => {
    const unpaid = stockPurchaseRow({
      seq: 15,
      billNo: 'CX-118',
      bill: 1710,
      paid: 0,
      due: 1710,
      status: 'unpaid',
    });
    const partial = stockPurchaseRow();
    const paid = stockPurchaseRow({ paid: 2392.5, due: 0, status: 'paid' });
    const { result } = renderHook(() => useStockPurchaseColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('seq', unpaid)).toBe('#15');
    expect(fold('billNo', unpaid)).toBe('CX-118');
    expect(fold('bill', unpaid)).toBe('₹1,710');
    expect(fold('due', unpaid)).toBe('₹1,710');
    expect(fold('status', unpaid)).toMatchObject({ value: 'Unpaid' });
    expect(fold('date', unpaid)).toMatch(/2026/);
    expect(fold('bill', partial)).toBe('₹2,392.50');
    expect(fold('due', partial)).toBe('₹1,500');
    expect(fold('status', partial)).toMatchObject({
      value: i18n.t(STOCK_KEYS.purchases.statuses.partial, { ns: STOCK_NS }),
    });
    expect(fold('due', paid)).toBe('—');
    expect(fold('status', paid)).toMatchObject({ value: 'Paid' });
  });
});
