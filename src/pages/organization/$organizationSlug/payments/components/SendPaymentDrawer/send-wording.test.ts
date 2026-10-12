import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { withoutBidiMarks } from '@/tests/utils/bidi-marks.ts';

import { useBillAge, useBillLabel } from './send-wording.ts';

describe('useBillAge — a bill’s age on its sub line and chip', () => {
  it('counts the days pending, one and many', () => {
    const age = renderHook(() => useBillAge()).result.current;
    expect(age(1)).toBe('1 day pending');
    expect(age(8)).toBe('8 days pending');
  });

  it('reads a bill from today — or one dated ahead — as "Today", never "0 days"', () => {
    const age = renderHook(() => useBillAge()).result.current;
    expect(age(0)).toBe('Today');
    expect(age(-2)).toBe('Today');
  });
});

describe('useBillLabel — a bill by its order and supplier', () => {
  it('names a Medical order and a stock purchase apart', () => {
    const label = renderHook(() => useBillLabel()).result.current;
    expect(
      withoutBidiMarks(
        label({
          kind: 'medical_po',
          seq: 431,
          supplierName: 'Shree Ramdev Medical Agency',
        }),
      ),
    ).toBe('Medical PO #431 · Shree Ramdev Medical Agency');
    expect(
      withoutBidiMarks(
        label({ kind: 'stock_po', seq: 16, supplierName: 'Ankur Pharma' }),
      ),
    ).toBe('Stock PO #16 · Ankur Pharma');
  });
});
