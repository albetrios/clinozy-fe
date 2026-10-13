import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import { fetchMedicalSale } from '../../../shared/medical-api.ts';
import { useSaleColumns } from './useSaleColumns.tsx';

afterEach(() => resetAppFixtures());

describe('useSaleColumns', () => {
  it('lays out the Sales columns with Margin hidden', () => {
    const { result } = renderHook(() => useSaleColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'customer',
      'medicines',
      'bill',
      'margin',
      'status',
      'when',
    ]);
    expect(result.current.find((column) => column.id === 'margin')?.meta).toMatchObject({
      defaultHidden: true,
      track: '100px',
    });
  });

  it('folds a sale into its meta line', async () => {
    const sale = await fetchMedicalSale(ref.medicalSale(978));
    const { result } = renderHook(() => useSaleColumns());
    const fold = (id: string) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(sale);
    expect(fold('seq')).toBe('#978');
    expect(fold('bill')).toBe('₹563');
    expect(fold('status')).toMatchObject({ value: 'Unpaid' });
    expect(fold('when')).toMatch(/\d/);
  });
});
