import { describe, expect, it } from 'vitest';

import type { ApiData } from '@/core/http/api.ts';
import { STOCK_CATEGORY_VALUES } from '@/shared/api/app/app-schema.ts';

import {
  STOCK_CATEGORIES,
  STOCK_MOVEMENT_KINDS,
  STOCK_PURCHASE_STATUSES,
  validateStockSearch,
} from './stock.search.ts';

const VENDOR_ID = 'svnd_623kwx45qfoq9tzih9dek';
const ITEM_ID = 'sitm_bel5zuxfn7u84qklvcc0e';

type ApiMovementType = NonNullable<
  NonNullable<ApiData<'/app/stock-item-movements', 'get'>>[number]['type']
>;
type ApiPaymentStatus = NonNullable<
  NonNullable<ApiData<'/app/stock-purchases', 'get'>>[number]['payment_status']
>;

/** Every value of the API's enums, each once — a value the API adds fails to compile here. */
const API_MOVEMENT_TYPES: Record<ApiMovementType, true> = {
  opening: true,
  received: true,
  used: true,
  damaged: true,
  returned: true,
  adjust: true,
  reverted: true,
};
const API_PAYMENT_STATUSES: Record<ApiPaymentStatus, true> = {
  paid: true,
  partial: true,
  unpaid: true,
};

const sorted = (values: readonly string[]) =>
  [...values].sort((a, b) => a.localeCompare(b));

describe('stock.search.ts (the entry chunk’s reader)', () => {
  it('keeps every tab’s valid keys and drops the rest', () => {
    expect(
      validateStockSearch({
        q: '  gloves ',
        stock: 'low',
        category: 'masks,peels,lotions',
        lasts: ['d5', 'w6'],
        status: 'unpaid,partly,partial',
        vendor: VENDOR_ID,
        type: 'used,opening,payment,sold',
        item: ITEM_ID,
        sort: 'lasts:desc',
        created: 'last_7',
      }),
    ).toEqual({
      q: 'gloves',
      stock: 'low',
      category: ['masks', 'peels'],
      status: ['unpaid', 'partial'],
      vendor: VENDOR_ID,
      type: ['used', 'opening'],
      item: ITEM_ID,
      sort: 'lasts:desc',
      created: 'last_7',
    });
    expect(
      validateStockSearch({ stock: 'all', sort: 'margin:asc', created: 'never' }),
    ).toMatchObject({ stock: undefined, sort: undefined, created: undefined });
  });

  it('takes clinozy-be’s public ids, not the fixtures’ uuids', () => {
    expect(
      validateStockSearch({
        vendor: '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d',
        item: 'sitm_short',
      }),
    ).toMatchObject({ vendor: undefined, item: undefined });
  });

  it('drops the sorts the API does not have (purchases by supplier) and keeps vendors by payable', () => {
    expect(validateStockSearch({ sort: 'vendor:asc' }).sort).toBeUndefined();
    expect(validateStockSearch({ sort: 'payable:desc' }).sort).toBe('payable:desc');
    expect(validateStockSearch({ sort: 'due:desc' }).sort).toBe('due:desc');
  });

  it('pins the filter values to the API (the reader cannot import the schema)', () => {
    expect(STOCK_CATEGORIES).toEqual(STOCK_CATEGORY_VALUES);
    expect(sorted(STOCK_MOVEMENT_KINDS)).toEqual(sorted(Object.keys(API_MOVEMENT_TYPES)));
    expect(sorted(STOCK_PURCHASE_STATUSES)).toEqual(
      sorted(Object.keys(API_PAYMENT_STATUSES)),
    );
  });
});
