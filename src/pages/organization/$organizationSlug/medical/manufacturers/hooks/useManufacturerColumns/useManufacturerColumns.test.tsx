import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { manufacturerRow } from '@/tests/utils/medical-doubles.ts';

import type { ManufacturerRow } from '../../../shared/medical-contracts.ts';
import { useManufacturerColumns } from './useManufacturerColumns.tsx';

describe('useManufacturerColumns', () => {
  it('leads with the maker’s pill and counts its medicines, as the server does', () => {
    const { result } = renderHook(() => useManufacturerColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'name',
      'medicines',
      'suppliers',
      'mrs',
    ]);
    expect(result.current[0]?.meta).toMatchObject({ primary: true });
    const fold = (id: string, row: ManufacturerRow) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    expect(fold('medicines', manufacturerRow({ medicineCount: 1 }))).toBe('1 medicine');
    expect(fold('medicines', manufacturerRow())).toBe('14 medicines');
    expect(fold('medicines', manufacturerRow({ medicineCount: 0 }))).toBe('None yet');
    expect(fold('name', manufacturerRow())).toMatchObject({ value: 'SUN PHARMA' });
  });
});
