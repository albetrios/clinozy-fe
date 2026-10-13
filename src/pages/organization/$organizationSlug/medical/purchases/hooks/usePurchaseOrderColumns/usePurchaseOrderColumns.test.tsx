import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { purchaseOrderRow } from '@/tests/utils/medical-doubles.ts';

import { usePurchaseOrderColumns } from './usePurchaseOrderColumns.tsx';

describe('usePurchaseOrderColumns', () => {
  it('lays out the Purchases columns, the Total the phone key and the PO first in the meta', () => {
    const { result } = renderHook(() => usePurchaseOrderColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'supplier',
      'items',
      'date',
      'total',
      'stage',
    ]);
    const meta = (id: string) => result.current.find((column) => column.id === id)?.meta;
    expect(meta('total')).toMatchObject({ priority: 1, align: 'end' });
    expect(meta('seq')).toMatchObject({ priority: 5 });
    // The API sorts by PO, Date and Total only.
    const sortable = result.current.filter((column) => column.enableSorting !== false);
    expect(sortable.map((column) => column.id)).toEqual(['seq', 'date', 'total']);
  });

  it('folds an order into "#431, T-82370" and its stage — the API’s rupees', () => {
    const order = purchaseOrderRow();
    const { result } = renderHook(() => usePurchaseOrderColumns());
    const fold = (id: string) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(order);
    expect(fold('seq')).toBe('#431, T-82370');
    expect(fold('total')).toBe('₹4,236');
    expect(fold('stage')).toMatchObject({ value: 'Received' });
  });
});
