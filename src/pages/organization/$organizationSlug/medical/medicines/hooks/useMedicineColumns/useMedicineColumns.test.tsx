import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { medicineRow } from '@/tests/utils/medical-doubles.ts';

import { useMedicineColumns } from './useMedicineColumns.tsx';

describe('useMedicineColumns', () => {
  it('lays out the Medicines columns, Best rate hidden, the ids the URL sorts by', () => {
    const { result } = renderHook(() => useMedicineColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'name',
      'manufacturer',
      'stock',
      'expiry',
      'mrp',
      'bestRate',
      'margin',
    ]);
    expect(result.current.map((column) => column.meta?.track)).toEqual([
      '64px',
      'minmax(220px,1.6fr)',
      '110px',
      '150px',
      '150px',
      '100px',
      '150px',
      '80px',
    ]);
    expect(result.current.find((column) => column.id === 'bestRate')?.meta).toMatchObject(
      { defaultHidden: true },
    );
  });

  it('folds a row into the meta line the phone reads — the API’s rupees and stock level', () => {
    const row = medicineRow();
    const { result } = renderHook(() => useMedicineColumns());
    const fold = (id: string, original: unknown = row) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(original);
    // A bar cell folds as plain words, without a dot (H:4116).
    expect(fold('stock')).toBe('12 in stock · OK');
    expect(fold('stock', medicineRow({ stock: 2, stockLevel: 'low' }))).toBe(
      '2 in stock · Low',
    );
    expect(fold('expiry')).toMatchObject({ value: expect.stringContaining('026-312') });
    expect(fold('margin')).toBe('35%');
    expect(fold('mrp')).toBe('₹650');
    expect(fold('bestRate')).toBe('₹420');
    expect(fold('expiry', medicineRow({ nearest: null }))).toBe('No stock');
  });
});
