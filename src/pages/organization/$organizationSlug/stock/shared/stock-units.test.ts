import { describe, expect, it } from 'vitest';

import { STOCK_CATEGORY_VALUES } from '@/shared/api/app/app-schema.ts';

import { STOCK_MOVEMENT_KINDS, STOCK_PURCHASE_STATUSES } from '../stock.search.ts';
import {
  fromMilli,
  measuredQuantity,
  reorderUnits,
  runwayOf,
  runwayTone,
  STOCK_CATEGORY_TONES,
  STOCK_MOVEMENT_TONES,
  STOCK_PURCHASE_STATUS_TONES,
  stockBarPercent,
  toMilli,
} from './stock-units.ts';

describe('the stock arithmetic (KICKOFF §6.8 Data)', () => {
  it('stores quantities ×1000', () => {
    expect(toMilli(1.5)).toBe(1500);
    expect(toMilli(0.333_3)).toBe(333);
    expect(fromMilli(2500)).toBe(2.5);
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

  it('says the server’s runway in days, then weeks', () => {
    expect(runwayOf(0)).toEqual({ kind: 'days', count: 0 });
    expect(runwayOf(5)).toEqual({ kind: 'days', count: 5 });
    expect(runwayOf(7)).toEqual({ kind: 'days', count: 7 });
    expect(runwayOf(42)).toEqual({ kind: 'weeks', count: 6 });
    expect(runwayOf(186)).toEqual({ kind: 'weeks', count: 27 });
    expect(runwayOf(null)).toEqual({ kind: 'none' });
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

  it('tones every category, movement type and purchase status the API has', () => {
    expect(Object.keys(STOCK_CATEGORY_TONES).sort()).toEqual(
      [...STOCK_CATEGORY_VALUES].sort(),
    );
    expect(Object.keys(STOCK_MOVEMENT_TONES)).toEqual([...STOCK_MOVEMENT_KINDS]);
    expect(Object.keys(STOCK_PURCHASE_STATUS_TONES)).toEqual([
      ...STOCK_PURCHASE_STATUSES,
    ]);
    expect(STOCK_MOVEMENT_TONES.opening).toBe('mint');
  });
});
