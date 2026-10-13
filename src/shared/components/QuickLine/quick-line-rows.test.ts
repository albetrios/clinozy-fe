import { describe, expect, it } from 'vitest';

import {
  quickLineCount,
  withQuickLineRow,
  withSteppedQuickLineRow,
} from './quick-line-rows.ts';

interface Row {
  item: string | null;
  qty: number;
}

const blank = (): Row => ({ item: null, qty: 1 });
const isBlank = (row: Row) => row.item === null;
const rules = (item: string, extra: { blank?: () => Row; max?: number } = {}) => ({
  isBlank,
  holds: (row: Row) => row.item === item,
  newRow: (): Row => ({ item, qty: 5 }),
  ...extra,
});

describe('quick-line rows (H:5058 `addI` / `step`)', () => {
  it('fills the first blank row, or comes last', () => {
    expect(withQuickLineRow([blank(), blank()], { item: 'a', qty: 2 }, isBlank)).toEqual([
      { item: 'a', qty: 2 },
      blank(),
    ]);
    expect(
      withQuickLineRow([{ item: 'a', qty: 2 }], { item: 'b', qty: 1 }, isBlank),
    ).toEqual([
      { item: 'a', qty: 2 },
      { item: 'b', qty: 1 },
    ]);
  });

  it('adds an item no row holds with its new row; "−" on it changes nothing', () => {
    expect(withSteppedQuickLineRow([blank()], 1, rules('a'))).toEqual([
      { item: 'a', qty: 5 },
    ]);
    expect(withSteppedQuickLineRow([blank()], -1, rules('a'))).toEqual([blank()]);
  });

  it('counts one more or one fewer on the first row holding it, held to the cap', () => {
    const rows: Row[] = [
      { item: 'a', qty: 3 },
      { item: 'a', qty: 1 },
    ];
    expect(withSteppedQuickLineRow(rows, 1, rules('a'))[0]).toEqual({
      item: 'a',
      qty: 4,
    });
    expect(withSteppedQuickLineRow(rows, -1, rules('a'))[0]).toEqual({
      item: 'a',
      qty: 2,
    });
    expect(withSteppedQuickLineRow(rows, 1, rules('a', { max: 3 }))[0]).toEqual({
      item: 'a',
      qty: 3,
    });
    expect(quickLineCount(rows, rules('a').holds)).toBe(4);
    expect(quickLineCount(rows, rules('b').holds)).toBe(0);
  });

  it('drops the row at none, keeping a blank one only when the table asks to', () => {
    const one: Row[] = [{ item: 'a', qty: 1 }];
    expect(withSteppedQuickLineRow(one, -1, rules('a'))).toEqual([]);
    expect(withSteppedQuickLineRow(one, -1, rules('a', { blank }))).toEqual([blank()]);
    expect(
      withSteppedQuickLineRow([{ item: 'b', qty: 2 }, ...one], -1, rules('a', { blank })),
    ).toEqual([{ item: 'b', qty: 2 }]);
  });
});
