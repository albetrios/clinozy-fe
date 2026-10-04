import { describe, expect, it } from 'vitest';

import {
  branchOrder,
  branchValues,
  matchesPicked,
  presentValuesField,
} from './offerings-filters.ts';

const ADAJAN = 'a0000000-0000-4000-8000-000000000001';
const VESU = 'a0000000-0000-4000-8000-000000000002';

describe('presentValuesField (H:4164)', () => {
  it('offers a section for 2–10 distinct values, fewer than the rows, in the column’s order', () => {
    expect(
      presentValuesField([['b'], ['a'], ['b'], ['a', 'c']], ['a', 'b', 'c', 'd']),
    ).toEqual({ kind: 'options', values: ['a', 'b', 'c'] });
  });

  it('drops a column with one value, or as many values as rows (the Offers tab’s Offer column)', () => {
    expect(presentValuesField([['a'], ['a']], ['a', 'b'])).toBeNull();
    expect(presentValuesField([['a'], ['b']], ['a', 'b'])).toBeNull();
    expect(presentValuesField([], ['a'])).toBeNull();
  });

  it('drops a column with more than ten values', () => {
    const order = Array.from({ length: 11 }, (_, index) => `v${index}`);
    const rows = [...order.map((value) => [value]), ['v0']];
    expect(presentValuesField(rows, order)).toBeNull();
    expect(presentValuesField(rows.slice(1), order.slice(1))).toEqual({
      kind: 'options',
      values: order.slice(1),
    });
  });
});

describe('matchesPicked', () => {
  it('passes everything while nothing is picked, else any shared value', () => {
    expect(matchesPicked(['a'], undefined)).toBe(true);
    expect(matchesPicked([], [])).toBe(true);
    expect(matchesPicked(['a', 'b'], ['b'])).toBe(true);
    expect(matchesPicked(['a'], ['b'])).toBe(false);
    expect(matchesPicked([], ['b'])).toBe(false);
  });
});

describe('branchValues (H:5452)', () => {
  it('reads "All branches" for none, else the open branches it names', () => {
    expect(branchValues([], [ADAJAN, VESU])).toEqual(['all']);
    expect(branchValues([VESU, 'closed'], [ADAJAN, VESU])).toEqual([VESU]);
  });

  it('shows nothing with one open branch', () => {
    expect(branchValues([], [ADAJAN])).toEqual([]);
    expect(branchValues([ADAJAN], [ADAJAN])).toEqual([]);
  });

  it('orders the chips "All branches" first', () => {
    expect(branchOrder([ADAJAN, VESU])).toEqual(['all', ADAJAN, VESU]);
  });
});
