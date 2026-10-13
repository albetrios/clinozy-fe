import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { ref } from '@/shared/api/app/fixtures/refs.fixtures.ts';
import { resetAppFixtures } from '@/shared/api/app/fixtures/world.fixtures.ts';

import { fetchPurchaseOrder } from '../../../shared/medical-api.ts';
import { usePurchaseOrderColumns } from './usePurchaseOrderColumns.tsx';

afterEach(() => resetAppFixtures());

describe('usePurchaseOrderColumns', () => {
  it('lays out the Purchases columns, the Total the phone key and the PO first in the meta', () => {
    const { result } = renderHook(() => usePurchaseOrderColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'seq',
      'supplier',
      'items',
      'date',
      'total',
      'stage',
    ]);
    const meta = (id: string) => result.current.find((column) => column.id === id)?.meta;
    expect(meta('total')).toMatchObject({ priority: 1, align: 'end' });
    expect(meta('seq')).toMatchObject({ priority: 5 });
  });

  it('folds an order into "#431, 1631" and its stage', async () => {
    const order = await fetchPurchaseOrder(ref.purchaseOrder(431));
    const { result } = renderHook(() => usePurchaseOrderColumns());
    const fold = (id: string) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(order);
    expect(fold('seq')).toBe('#431, 1631');
    expect(fold('total')).toBe('₹2,980');
    expect(fold('stage')).toMatchObject({ value: 'Received' });
  });
});
