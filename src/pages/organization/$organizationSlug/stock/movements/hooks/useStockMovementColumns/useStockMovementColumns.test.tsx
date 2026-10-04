import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { resetClinicFixtures } from '@/shared/api/clinic/fixtures/world.fixtures.ts';

import { listStockMovements } from '../../../shared/stock-api.ts';
import type { StockMovementRow } from '../../../shared/stock-contracts.ts';
import { useStockMovementColumns } from './useStockMovementColumns.tsx';

afterEach(() => resetClinicFixtures());

describe('useStockMovementColumns', () => {
  it('lays out the Movements columns, none of them sortable', () => {
    const { result } = renderHook(() => useStockMovementColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'type',
      'party',
      'when',
      'by',
      'change',
    ]);
    expect(result.current.every((column) => column.enableSorting === false)).toBe(true);
  });

  it('folds a use and a payment: type, party, who and the signed change', async () => {
    const { items } = await listStockMovements();
    const used = items[0];
    const payment = items.find((row) => row.kind === 'payment');
    const { result } = renderHook(() => useStockMovementColumns());
    const column = (id: string) => result.current.find((entry) => entry.id === id);
    const fold = (id: string, row: unknown) => column(id)?.meta?.foldValue?.(row);
    expect(fold('type', used)).toMatchObject({ value: 'Used' });
    expect(fold('change', used)).toBe('− 1 tube');
    // Folded on a tablet, left off the phone's meta line.
    expect(fold('by', used)).toEqual({ value: 'Kiran P.', quiet: true });
    expect(fold('type', payment)).toMatchObject({ value: 'Payment' });
    expect(fold('change', payment)).toBe('− ₹600');
    if (!payment) throw new Error('no payment row');
    const party = column('party') as
      { accessorFn?: (row: StockMovementRow, index: number) => unknown } | undefined;
    expect(party?.accessorFn?.(payment, 0)).toBe('Shivam Water');
  });
});
