import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import { fetchSupplier } from '../../../shared/medical-api.ts';
import { useSupplierColumns } from './useSupplierColumns.tsx';

afterEach(() => resetAppFixtures());

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

  it('folds what a supplier is owed and since when; nothing due reads "—"', async () => {
    const owed = await fetchSupplier(ref.supplier(58));
    const clear = await fetchSupplier(ref.supplier(59));
    const { result } = renderHook(() => useSupplierColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('payable', owed)).toBe('₹2,980');
    expect(fold('ageing', owed)).toMatchObject({
      value: expect.stringMatching(/days?$/),
    });
    expect(fold('orders', owed)).toBe('1 order');
    expect(fold('payable', clear)).toBe('—');
    expect(fold('ageing', clear)).toBeNull();
    expect(fold('orders', clear)).toBe('No orders');
  });
});
