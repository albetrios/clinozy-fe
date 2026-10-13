import { describe, expect, it } from 'vitest';

import { stockItemListQuery } from '../shared/stock-api.ts';
import { validateStockSearch } from '../stock.search.ts';
import { itemFilterKey, itemParamsOf, LASTS_DAYS_TO } from './items.params.ts';

const TODAY = '2026-10-10';

describe('items.params (the Items read from the URL)', () => {
  it('reads a Lasts tier as one upper bound: a week, or three weeks', () => {
    expect(LASTS_DAYS_TO).toEqual({ week: 7, three_weeks: 21 });
    expect(itemParamsOf(validateStockSearch({ lasts: 'week' })).lastsDaysTo).toBe(7);
    expect(itemParamsOf(validateStockSearch({ lasts: 'three_weeks' })).lastsDaysTo).toBe(
      21,
    );
    // The fixtures' exact runways (`d5`, `w6`) are gone — no filter.
    expect(
      itemParamsOf(validateStockSearch({ lasts: 'd5' })).lastsDaysTo,
    ).toBeUndefined();
  });

  it('hands the API the search, Low stock, the tier, the categories, Created and the sort', () => {
    const params = itemParamsOf(
      validateStockSearch({
        q: ' gloves ',
        stock: 'low',
        lasts: 'week',
        category: 'masks,peels',
        created: 'last_7',
        sort: 'lasts:asc',
      }),
    );
    expect(params).toEqual({
      q: 'gloves',
      stock: 'low',
      lastsDaysTo: 7,
      category: ['masks', 'peels'],
      created: 'last_7',
      sort: 'lasts',
      order: 'asc',
    });
    expect(stockItemListQuery(params, TODAY)).toMatchObject({
      q: 'gloves',
      stock_level: 'low,out',
      lasts_days_to: 7,
      category: 'masks,peels',
      sort: 'lasts_days',
      order: 'asc',
    });
  });

  it('keys the filters — a tier change shows the skeleton, a sort keeps the rows', () => {
    const week = itemParamsOf(validateStockSearch({ lasts: 'week' }));
    const threeWeeks = itemParamsOf(validateStockSearch({ lasts: 'three_weeks' }));
    const sorted = itemParamsOf(
      validateStockSearch({ lasts: 'week', sort: 'name:desc' }),
    );
    expect(itemFilterKey(week)).not.toBe(itemFilterKey(threeWeeks));
    expect(itemFilterKey(week)).toBe(itemFilterKey(sorted));
  });
});
