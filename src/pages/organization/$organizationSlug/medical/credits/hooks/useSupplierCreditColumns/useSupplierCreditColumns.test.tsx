import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { supplierCreditRow } from '@/tests/utils/medical-doubles.ts';

import { useSupplierCreditColumns } from './useSupplierCreditColumns.tsx';

describe('useSupplierCreditColumns', () => {
  it('lays out the "From suppliers" columns, none sortable', () => {
    const { result } = renderHook(() => useSupplierCreditColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'credit',
      'supplier',
      'packs',
      'amount',
      'applied',
      'state',
      'since',
    ]);
    expect(result.current.every((column) => column.enableSorting === false)).toBe(true);
  });

  it('folds a credit into its meta line — rupees, packs, the state', () => {
    const { result } = renderHook(() => useSupplierCreditColumns());
    const fold = (id: string, credit = supplierCreditRow()) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(credit);
    expect(fold('packs')).toBe('2 packs');
    expect(fold('amount')).toBe('₹840');
    expect(fold('applied')).toBeNull();
    expect(fold('state')).toMatchObject({ value: 'Open' });
    expect(fold('since')).toMatch(/\d/);
  });

  it('reads Adjusted with what was set off once the supplier’s orders took it', () => {
    const { result } = renderHook(() => useSupplierCreditColumns());
    const adjusted = supplierCreditRow({ applied: 840, status: 'adjusted' });
    const fold = (id: string) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(adjusted);
    expect(fold('applied')).toBe('₹840');
    expect(fold('state')).toMatchObject({ value: 'Adjusted' });
  });
});
