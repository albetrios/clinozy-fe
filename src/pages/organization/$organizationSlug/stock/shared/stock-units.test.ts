import { describe, expect, it } from 'vitest';

import {
  STOCK_CATEGORY_VALUES,
  STOCK_MOVEMENT_TYPE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';

import {
  fromMilli,
  lastsDays,
  measuredQuantity,
  purchaseStatus,
  reorderUnits,
  runwayDays,
  runwayFromKey,
  runwayKey,
  runwayOf,
  runwayTone,
  STOCK_CATEGORY_TONES,
  STOCK_MOVEMENT_TONES,
  stockBarPercent,
  stockLevel,
  toMilli,
} from './stock-units.ts';

describe('the stock arithmetic (KICKOFF §6.8 Data)', () => {
  it('stores quantities ×1000', () => {
    expect(toMilli(1.5)).toBe(1500);
    expect(toMilli(0.333_3)).toBe(333);
    expect(fromMilli(2500)).toBe(2.5);
  });

  it('reads the level: Out at 0, Low at or below the minimum, else OK', () => {
    expect(stockLevel(0, 1)).toBe('out');
    expect(stockLevel(1000, 1)).toBe('low');
    expect(stockLevel(1500, 1)).toBe('ok');
    expect(stockLevel(500, 0)).toBe('ok');
  });

  it('fills the bar to stock ÷ maximum, capped', () => {
    expect(stockBarPercent(3000, 10)).toBe(30);
    expect(stockBarPercent(5000, 4)).toBe(100);
    expect(stockBarPercent(1000, 0)).toBe(100);
    expect(stockBarPercent(0, 0)).toBe(0);
  });

  it('measures a stock in its contents: 3 tubes of 30 g are 90 g', () => {
    expect(measuredQuantity(3000, 30_000)).toBe(90);
    expect(measuredQuantity(1500, 50_000)).toBe(75);
    expect(measuredQuantity(3000, null)).toBeNull();
  });

  it('runs the stock out at its weekly use, in days then weeks', () => {
    expect(lastsDays(3000, 500)).toBe(42);
    expect(lastsDays(8000, 300)).toBe(186);
    expect(lastsDays(0, 800)).toBe(0);
    expect(lastsDays(3000, 0)).toBeNull();
    expect(runwayOf(5)).toEqual({ kind: 'days', count: 5 });
    expect(runwayOf(7)).toEqual({ kind: 'days', count: 7 });
    expect(runwayOf(42)).toEqual({ kind: 'weeks', count: 6 });
    expect(runwayOf(186)).toEqual({ kind: 'weeks', count: 27 });
    expect(runwayOf(null)).toEqual({ kind: 'none' });
  });

  it('keys a runway for the Lasts filter and reads it back', () => {
    expect(runwayKey(runwayOf(5))).toBe('d5');
    expect(runwayKey(runwayOf(42))).toBe('w6');
    expect(runwayKey(runwayOf(null))).toBe('none');
    expect(runwayFromKey('w6')).toEqual({ kind: 'weeks', count: 6 });
    expect(runwayFromKey('d0')).toEqual({ kind: 'days', count: 0 });
    expect(runwayFromKey('none')).toEqual({ kind: 'none' });
    expect(runwayFromKey('x6')).toBeNull();
    expect(runwayDays({ kind: 'weeks', count: 3 })).toBe(21);
    expect(runwayDays({ kind: 'days', count: 4 })).toBe(4);
    expect(runwayDays({ kind: 'none' })).toBeNull();
  });

  it('tones the runway: a week blush, three butter, longer sage, no usage plain', () => {
    expect([0, 7, 8, 21, 22].map(runwayTone)).toEqual([
      'blush',
      'blush',
      'butter',
      'butter',
      'sage',
    ]);
    expect(runwayTone(null)).toBeNull();
  });

  it('reorders up to the maximum, at least one', () => {
    expect(reorderUnits(6000, 20)).toBe(14);
    expect(reorderUnits(1500, 4)).toBe(3);
    expect(reorderUnits(20_000, 20)).toBe(1);
  });

  it('settles a purchase: Paid, Partly paid or Unpaid', () => {
    expect(purchaseStatus(171_000, 0)).toBe('unpaid');
    expect(purchaseStatus(120_000, 60_000)).toBe('partly');
    expect(purchaseStatus(275_000, 275_000)).toBe('paid');
    expect(purchaseStatus(10_000, 20_000)).toBe('paid');
  });

  it('tones every category and movement type of the contract, and payments', () => {
    expect(Object.keys(STOCK_CATEGORY_TONES).sort()).toEqual(
      [...STOCK_CATEGORY_VALUES].sort(),
    );
    expect(Object.keys(STOCK_MOVEMENT_TONES).sort()).toEqual(
      [...STOCK_MOVEMENT_TYPE_VALUES, 'payment'].sort(),
    );
  });
});
