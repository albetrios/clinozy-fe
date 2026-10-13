import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { stockVendorRow } from '@/tests/utils/stock-doubles.ts';

import { useStockVendorColumns } from './useStockVendorColumns.tsx';

describe('useStockVendorColumns', () => {
  it('lays out the Vendors columns: Vendor and Payable sort, Purchases does not', () => {
    const { result } = renderHook(() => useStockVendorColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'name',
      'purchases',
      'payable',
    ]);
    const sortable = (id: string) =>
      result.current.find((column) => column.id === id)?.enableSorting !== false;
    expect(sortable('name')).toBe(true);
    expect(sortable('payable')).toBe(true);
    expect(sortable('purchases')).toBe(false);
  });

  it('folds the server’s purchase count and what is owed in rupees; nothing reads "—"', () => {
    const owed = stockVendorRow({ payable: 1710.5, purchaseCount: 1 });
    const none = stockVendorRow({ payable: 0, purchaseCount: 0 });
    const { result } = renderHook(() => useStockVendorColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('purchases', owed)).toBe('1 purchase');
    expect(fold('payable', owed)).toBe('₹1,710.50');
    expect(fold('purchases', stockVendorRow())).toBe('2 purchases');
    expect(fold('purchases', none)).toBe('No purchases');
    expect(fold('payable', none)).toBe('—');
  });
});
