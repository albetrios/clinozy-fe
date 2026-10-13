import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import type { ManufacturerRow } from '../../../shared/medical-contracts.ts';
import { useManufacturerColumns } from './useManufacturerColumns.tsx';

const maker = (medicineCount: number) =>
  ({
    id: 'm1',
    name: 'ALVI',
    tone: 'lav',
    medicineCount,
    suppliers: [],
    mrs: [],
  }) as unknown as ManufacturerRow;

describe('useManufacturerColumns', () => {
  it('leads with the maker’s pill and counts its medicines', () => {
    const { result } = renderHook(() => useManufacturerColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'name',
      'medicines',
      'suppliers',
      'mrs',
    ]);
    expect(result.current[0]?.meta).toMatchObject({ primary: true });
    const fold = (row: ManufacturerRow) =>
      result.current.find((column) => column.id === 'medicines')?.meta?.foldValue?.(row);
    expect(fold(maker(1))).toBe('1 medicine');
    expect(fold(maker(2))).toBe('2 medicines');
    expect(fold(maker(0))).toBe('None yet');
  });
});
