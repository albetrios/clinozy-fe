import { describe, expect, it } from 'vitest';

import { validateStockSearch } from '../stock.search.ts';
import { purchaseFilterKey, purchaseParamsOf } from './purchases.params.ts';

const VENDOR = 'svnd_cranix000000000000000';

describe('purchaseParamsOf', () => {
  it('reads the search, statuses, one supplier, Created and the API’s sorts', () => {
    const search = validateStockSearch({
      q: 'INV',
      status: ['unpaid', 'partial'],
      vendor: VENDOR,
      created: 'today',
      sort: 'bill:desc',
    });
    expect(purchaseParamsOf(search)).toEqual({
      q: 'INV',
      status: ['unpaid', 'partial'],
      vendor: VENDOR,
      created: 'today',
      sort: 'bill',
      order: 'desc',
    });
    expect(purchaseParamsOf(validateStockSearch({ sort: 'seq:asc' }))).toMatchObject({
      sort: 'seq',
      order: 'asc',
    });
  });

  it('drops a sort the API does not take — by supplier, or another tab’s', () => {
    for (const sort of ['vendor:asc', 'name:asc', 'payable:desc']) {
      const params = purchaseParamsOf(validateStockSearch({ sort }));
      expect(params.sort).toBeUndefined();
      expect(params.order).toBeUndefined();
    }
  });

  it('keys the filters, not the sort — a sort keeps the rows on screen', () => {
    const base = purchaseParamsOf(validateStockSearch({ status: ['paid'] }));
    const sorted = purchaseParamsOf(
      validateStockSearch({ status: ['paid'], sort: 'due:asc' }),
    );
    expect(purchaseFilterKey(sorted)).toBe(purchaseFilterKey(base));
    expect(purchaseFilterKey(base)).not.toBe(
      purchaseFilterKey(purchaseParamsOf(validateStockSearch({ vendor: VENDOR }))),
    );
  });
});
