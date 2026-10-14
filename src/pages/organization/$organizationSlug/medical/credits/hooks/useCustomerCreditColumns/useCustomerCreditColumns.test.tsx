import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { creditRow } from '@/tests/utils/payments-doubles.ts';

import { useCustomerCreditColumns } from './useCustomerCreditColumns.tsx';

describe('useCustomerCreditColumns', () => {
  it('lays out the "With customers" columns, none sortable', () => {
    const { result } = renderHook(() => useCustomerCreditColumns());
    expect(result.current.map((column) => column.id)).toEqual([
      'who',
      'way',
      'amount',
      'left',
      'state',
      'since',
    ]);
    expect(result.current.every((column) => column.enableSorting === false)).toBe(true);
  });

  it('folds a credit into its meta line — which way, rupees, what is left', () => {
    const { result } = renderHook(() => useCustomerCreditColumns());
    const fold = (id: string, credit = creditRow()) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(credit);
    expect(fold('way')).toBe('We give back');
    expect(fold('amount')).toBe('₹80');
    expect(fold('left')).toBe('₹30');
    expect(fold('state')).toMatchObject({ value: 'Open' });
    expect(fold('since')).toMatch(/\d/);
  });

  it('shows nothing left once a credit is used', () => {
    const { result } = renderHook(() => useCustomerCreditColumns());
    const used = creditRow({ settled: 80, left: 0, status: 'used' });
    const fold = (id: string) =>
      result.current.find((column) => column.id === id)?.meta?.foldValue?.(used);
    expect(fold('left')).toBeNull();
    expect(fold('state')).toMatchObject({ value: 'Used' });
  });
});
