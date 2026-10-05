import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/clinic/fixtures/refs.fixtures.ts';
import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';
import { fetchMedicine } from '@/shared/api/clinic/medicines-api.ts';

import { useMedicineColumns } from './useMedicineColumns.tsx';

afterEach(() => resetClinicFixtures());

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

  it('folds a row into the meta line the phone reads', async () => {
    const row = await fetchMedicine(ref.medicine(458));
    const { result } = renderHook(() => useMedicineColumns());
    const fold = (id: string) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(row);
    // A bar cell folds as plain words, without a dot (H:4116).
    expect(fold('stock')).toBe('8 in stock · OK');
    expect(fold('expiry')).toMatchObject({ value: expect.stringContaining('CSH26044') });
    expect(fold('margin')).toBe('32%');
    expect(fold('mrp')).toBe('₹650');
  });
});
