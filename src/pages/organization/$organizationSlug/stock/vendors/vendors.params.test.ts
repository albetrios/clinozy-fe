import { describe, expect, it } from 'vitest';

import { validateStockSearch } from '../stock.search.ts';
import { vendorFilterKey, vendorParamsOf } from './vendors.params.ts';

describe('vendors.params (the Vendors read from the URL)', () => {
  it('hands the API the search and a Vendor or Payable sort', () => {
    expect(
      vendorParamsOf(validateStockSearch({ q: 'ankur', sort: 'payable:desc' })),
    ).toEqual({ q: 'ankur', sort: 'payable', order: 'desc' });
    expect(vendorParamsOf(validateStockSearch({ sort: 'name:asc' }))).toEqual({
      q: undefined,
      sort: 'name',
      order: 'asc',
    });
  });

  it('drops a sort the API does not take on vendors', () => {
    expect(vendorParamsOf(validateStockSearch({ sort: 'purchases:asc' }))).toEqual({
      q: undefined,
    });
  });

  it('keys the skeleton by the search alone — a sort keeps the rows', () => {
    const search = vendorParamsOf(validateStockSearch({ q: 'ankur' }));
    const sorted = vendorParamsOf(
      validateStockSearch({ q: 'ankur', sort: 'payable:asc' }),
    );
    expect(vendorFilterKey(sorted)).toBe(vendorFilterKey(search));
    expect(vendorFilterKey(search)).not.toBe(vendorFilterKey({ q: 'ibreia' }));
  });
});
