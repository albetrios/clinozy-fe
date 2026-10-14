import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { supplierRow } from '@/tests/utils/medical-doubles.ts';

import { useSupplierColumns } from './useSupplierColumns.tsx';

describe('useSupplierColumns', () => {
  it('lays out the Suppliers columns', () => {
    const { result } = renderHook(() => useSupplierColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'name',
      'manufacturers',
      'orders',
      'payable',
      'ageing',
    ]);
  });

  it('folds what a supplier is owed in rupees and since when; nothing due reads "—"', () => {
    // Ankur Pharma: owed ₹827 for 5 days over two orders — the server's figures.
    const owed = supplierRow();
    const clear = supplierRow({ payable: 0, ageingDays: null, orderCount: 0 });
    const { result } = renderHook(() => useSupplierColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('payable', owed)).toBe('₹827');
    expect(fold('ageing', owed)).toMatchObject({
      value: '5 days',
      dotClassName: 'bg-tone-sage-foreground text-background',
    });
    expect(fold('ageing', supplierRow({ ageingDays: 30 }))).toMatchObject({
      dotClassName: 'bg-tone-blush-foreground text-background',
    });
    expect(fold('orders', owed)).toBe('2 orders');
    expect(fold('payable', clear)).toBe('—');
    expect(fold('ageing', clear)).toBeNull();
    expect(fold('orders', clear)).toBe('No orders');
  });
});
