import { describe, expect, it } from 'vitest';

import {
  isSplitMode,
  nextSplitMode,
  paidSplits,
  splitsModes,
  splitsTotal,
} from './split-rows.ts';

const ROWS = [
  { mode: 'cash' as const, amount: 50_000 },
  { mode: 'upi' as const, amount: 20_000 },
];

describe('the Mode · Amount rows', () => {
  it('reads the rows: their total, their modes once each, the next mode free', () => {
    expect(splitsTotal(ROWS)).toBe(70_000);
    expect(splitsModes(ROWS)).toEqual(['cash', 'upi']);
    expect(splitsModes([{ mode: 'card', amount: 0 }])).toEqual(['card']);
    expect(splitsModes([{ mode: null, amount: 0 }])).toEqual([]);
    expect(nextSplitMode(ROWS)).toBe('card');
    expect(nextSplitMode([...ROWS, { mode: 'card', amount: 1 }])).toBeNull();
  });

  it('sends only the rows with a mode and an amount', () => {
    expect(
      paidSplits([...ROWS, { mode: 'card', amount: 0 }, { mode: null, amount: 5_000 }]),
    ).toEqual(ROWS);
  });

  it('takes Cash, UPI and Card — never Credit, which is only ever a credit’s', () => {
    expect(isSplitMode('upi')).toBe(true);
    expect(isSplitMode('credit')).toBe(false);
  });
});
