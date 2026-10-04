import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { fetchStockItem } from '../../../shared/stock-api.ts';
import { useStockItemColumns } from './useStockItemColumns.tsx';

afterEach(() => resetClinicFixtures());

describe('useStockItemColumns', () => {
  it('lays out the Items columns, the Supplier hidden and the Category the phone key', () => {
    const { result } = renderHook(() => useStockItemColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'name',
      'category',
      'stock',
      'lasts',
      'vendor',
    ]);
    const meta = (id: string) => result.current.find((column) => column.id === id)?.meta;
    expect(meta('vendor')?.defaultHidden).toBe(true);
    expect(meta('category')?.priority).toBe(1);
    expect(meta('name')?.primary).toBe(true);
  });

  it('folds the id, category, stock line, runway and supplier', async () => {
    const soframycin = await fetchStockItem(ref.stockItem(167));
    const dTan = await fetchStockItem(ref.stockItem(161));
    const { result } = renderHook(() => useStockItemColumns());
    const fold = (id: string, row: unknown) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('seq', soframycin)).toBe('#167');
    expect(fold('category', soframycin)).toEqual({
      value: 'Creams & Serums',
      dotClassName: expect.stringContaining('sky'),
    });
    expect(fold('stock', soframycin)).toMatchObject({ value: '3 tube · 90 g · OK' });
    expect(fold('lasts', soframycin)).toMatchObject({ value: '~6 weeks' });
    expect(fold('vendor', soframycin)).toBe('Ankur Pharma');
    expect(fold('stock', dTan)).toMatchObject({ value: '0 pack · 0 pcs · Out' });
    expect(fold('lasts', dTan)).toMatchObject({ value: '~0 days' });
    expect(fold('vendor', dTan)).toBeNull();
  });
});
