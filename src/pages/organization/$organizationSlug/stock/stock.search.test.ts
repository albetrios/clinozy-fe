import { describe, expect, it } from 'vitest';

import {
  STOCK_CATEGORY_VALUES,
  STOCK_MOVEMENT_TYPE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';

import {
  STOCK_CATEGORIES,
  STOCK_MOVEMENT_KINDS,
  STOCK_PURCHASE_STATUSES,
  validateStockCreateSearch,
  validateStockSearch,
} from './stock.search.ts';

const ID = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';

describe('stock.search.ts (the entry chunk’s reader)', () => {
  it('keeps every tab’s valid keys and drops the rest', () => {
    expect(
      validateStockSearch({
        q: '  gloves ',
        stock: 'low',
        category: 'masks,peels,lotions',
        lasts: ['d5', 'w6', 'none', 'x9'],
        status: 'unpaid',
        vendor: ID,
        type: 'used,payment,sold',
        item: 'nope',
        sort: 'lasts:desc',
        created: 'last_7',
      }),
    ).toEqual({
      q: 'gloves',
      stock: 'low',
      category: ['masks', 'peels'],
      lasts: ['d5', 'w6', 'none'],
      status: ['unpaid'],
      vendor: ID,
      type: ['used', 'payment'],
      item: undefined,
      sort: 'lasts:desc',
      created: 'last_7',
    });
    expect(validateStockSearch({ stock: 'all', sort: 'margin:asc' })).toMatchObject({
      stock: undefined,
      sort: undefined,
    });
  });

  it('reads the dialog prefills', () => {
    expect(validateStockCreateSearch({ reorder: 'low', name: ' Cotton rolls ' })).toEqual(
      {
        reorder: 'low',
        name: 'Cotton rolls',
      },
    );
    expect(validateStockCreateSearch({ reorder: 'all', name: 'x'.repeat(121) })).toEqual({
      reorder: undefined,
      name: undefined,
    });
  });

  it('pins the filter values to the contract (the reader cannot import the schema)', () => {
    expect(STOCK_CATEGORIES).toEqual(STOCK_CATEGORY_VALUES);
    expect(STOCK_MOVEMENT_KINDS).toEqual([...STOCK_MOVEMENT_TYPE_VALUES, 'payment']);
    expect(STOCK_PURCHASE_STATUSES).toEqual(['paid', 'partly', 'unpaid']);
  });
});
