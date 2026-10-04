import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { fetchStockVendor } from '../../../shared/stock-api.ts';
import { useStockVendorColumns } from './useStockVendorColumns.tsx';

afterEach(() => resetClinicFixtures());

describe('useStockVendorColumns', () => {
  it('lays out the Vendors columns', () => {
    const { result } = renderHook(() => useStockVendorColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'name',
      'purchases',
      'payable',
    ]);
  });

  it('folds the purchases and what the vendor is owed; nothing reads "—"', async () => {
    const owed = await fetchStockVendor(ref.stockVendor(2));
    const none = await fetchStockVendor(ref.stockVendor(4));
    const { result } = renderHook(() => useStockVendorColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('purchases', owed)).toBe('1 purchase');
    expect(fold('payable', owed)).toBe('₹1,710');
    expect(fold('purchases', none)).toBe('No purchases');
    expect(fold('payable', none)).toBe('—');
  });
});
