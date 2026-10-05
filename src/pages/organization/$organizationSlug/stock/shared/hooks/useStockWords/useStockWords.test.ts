import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';

import type { StockMovementRow } from '../../stock-contracts.ts';
import { useStockWords } from './useStockWords.ts';

const TUBE = { unit: 'tube', sizePerUnit: 30_000, measureUnit: 'g' } as const;
const PACK = { unit: 'pack', sizePerUnit: null, measureUnit: null } as const;

const words = () => renderHook(() => useStockWords()).result.current;

const used = (deltaMilli: number, reverted = false): StockMovementRow => ({
  id: 'm1',
  kind: 'used',
  movement: {} as never,
  item: { id: 'i1', name: 'Soframycin 30 gm', ...TUBE },
  note: null,
  at: new Date().toISOString(),
  by: null,
  deltaMilli,
  reverted,
});

describe('useStockWords', () => {
  it('says a stock in units and in its contents, with its level', () => {
    const w = words();
    expect(w.quantity(TUBE, 3000)).toBe('3 tube · 90 g');
    expect(w.quantity(TUBE, 2500)).toBe('2.5 tube · 75 g');
    expect(w.quantity(PACK, 14_000)).toBe('14 pack');
    expect(w.stock({ ...TUBE, qtyMilli: 3000, minQty: 1 })).toEqual({
      level: 'ok',
      tone: 'sage',
      label: '3 tube · 90 g · OK',
    });
    expect(w.stock({ ...PACK, qtyMilli: 0, minQty: 1 }).label).toBe('0 pack · Out');
  });

  it('writes the Item sub line, with the contents when the item has them', () => {
    const w = words();
    expect(w.itemSub({ ...TUBE, usagePerWeekMilli: 500 })).toBe(
      'per tube of 30 g · uses ~0.5/week',
    );
    expect(w.itemSub({ ...PACK, usagePerWeekMilli: 2000 })).toBe(
      'per pack · uses ~2/week',
    );
  });

  it('names the runway in days, then weeks, or no usage', () => {
    const w = words();
    expect(w.runway(5)).toEqual({ label: '~5 days', tone: 'blush', key: 'd5' });
    expect(w.runway(1).label).toBe('~1 day');
    expect(w.runway(42)).toEqual({ label: '~6 weeks', tone: 'sage', key: 'w6' });
    expect(w.runway(null)).toEqual({ label: 'No usage', tone: null, key: 'none' });
    expect(w.runwayChip({ kind: 'weeks', count: 3 })).toEqual({
      label: '~3 weeks',
      tone: 'butter',
    });
  });

  it('names the categories, statuses and types in their tones', () => {
    const w = words();
    expect(w.category('creams_serums')).toEqual({
      label: 'Creams & Serums',
      tone: 'sky',
    });
    expect(w.status('partly')).toEqual({ label: 'Partly paid', tone: 'butter' });
    expect(w.movementType('payment')).toEqual({ label: 'Payment', tone: 'sky' });
    expect(w.unit('litre')).toBe('litre');
    expect(w.measure('pcs')).toBe('pcs');
  });

  it('signs a movement’s change, and a payment in rupees', () => {
    const w = words();
    expect(w.change(used(-1000))).toBe('− 1 tube');
    expect(w.change({ ...used(24_000), kind: 'received' })).toBe('+ 24 tube');
    expect(w.change(used(0))).toBe('0 tube');
    expect(
      w.change({
        id: 'p',
        kind: 'payment',
        purchase: { id: 'x', seq: 16, billNo: 'SW-77' },
        vendorName: 'Shivam Water',
        date: '2026-09-25',
        createdAt: '2026-09-25T06:30:00.000Z',
        by: null,
        amount: 60_000,
      }),
    ).toBe('− ₹600');
  });

  it('dates a movement by the rooms’ one time rule, bills with their year', () => {
    const w = words();
    // The movements show days alone: today by name too, no time.
    expect(w.when(new Date().toISOString())).toBe('Today');
    expect(w.when(new Date(Date.now() - 86_400_000).toISOString())).toBe('Yesterday');
    expect(w.day(clinicToday())).toBe('Today');
    // The viewer's locale orders it ("Sep 22, 2026" in en-US); the year is always there.
    expect(w.billDate('2026-09-22')).toMatch(/^(?=.*22)(?=.*Sep)(?=.*2026)/);
    expect(w.billDate(clinicToday())).toContain(clinicToday().slice(0, 4));
  });
});
