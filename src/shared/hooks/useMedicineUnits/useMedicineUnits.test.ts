import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useMedicineUnits } from './useMedicineUnits.ts';

const units = () => renderHook(() => useMedicineUnits()).result.current;

describe('useMedicineUnits (change-pharmacy-record-fields D5)', () => {
  it('reads a loose-selling medicine’s units as packs and the loose rest', () => {
    expect(units().packs(34, 10)).toBe('3 packs + 4');
    expect(units().packs(14, 10)).toBe('1 pack + 4');
    expect(units().packs(30, 10)).toBe('3 packs');
    expect(units().packs(10, 10)).toBe('1 pack');
    expect(units().packs(4, 10)).toBe('4 loose');
    expect(units().inStock(34, 10)).toBe('3 packs + 4 in stock');
    expect(units().packEquivalent(12, 10)).toBe('= 1 pack + 2');
    expect(units().perPack(10)).toBe('10 per pack');
  });

  it('leaves a medicine sold in whole packs to the screen’s own words', () => {
    expect(units().packs(34, 1)).toBeNull();
    expect(units().inStock(34, 1)).toBeNull();
    expect(units().packEquivalent(3, 1)).toBeNull();
    expect(units().perPack(1)).toBeNull();
  });

  it('names a line’s pack and HSN code, its unit price and a count of packs', () => {
    expect(units().details({ pack: '1*10', hsnCode: '3004' })).toBe('1*10 · HSN 3004');
    expect(units().details({ pack: null, hsnCode: '3004' })).toBe('HSN 3004');
    expect(units().details({ pack: ' ', hsnCode: null })).toBe('');
    expect(units().unitPrice('₹12.55')).toBe('₹12.55 a unit');
    expect(units().packCount(2)).toBe('2 packs');
  });
});
