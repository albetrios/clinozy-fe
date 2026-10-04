import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { fetchStockPurchase } from '../../../shared/stock-api.ts';
import { useStockPurchaseColumns } from './useStockPurchaseColumns.tsx';

afterEach(() => resetClinicFixtures());

describe('useStockPurchaseColumns', () => {
  it('lays out the Purchases columns with the Invoice hidden', () => {
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
    expect(
      result.current.find((column) => column.id === 'billNo')?.meta?.defaultHidden,
    ).toBe(true);
  });

  it('folds the bill, what is due ("—" when nothing) and the status', async () => {
    const unpaid = await fetchStockPurchase(ref.stockPurchase(15));
    const paid = await fetchStockPurchase(ref.stockPurchase(14));
    const { result } = renderHook(() => useStockPurchaseColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('seq', unpaid)).toBe('#15');
    expect(fold('billNo', unpaid)).toBe('CX-118');
    expect(fold('bill', unpaid)).toBe('₹1,710');
    expect(fold('due', unpaid)).toBe('₹1,710');
    expect(fold('status', unpaid)).toMatchObject({ value: 'Unpaid' });
    expect(fold('date', unpaid)).toMatch(/\d{4}$/);
    expect(fold('due', paid)).toBe('—');
    expect(fold('status', paid)).toMatchObject({ value: 'Paid' });
  });
});
