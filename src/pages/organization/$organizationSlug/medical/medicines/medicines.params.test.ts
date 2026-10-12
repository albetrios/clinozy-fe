import { describe, expect, it } from 'vitest';

import { validateMedicalSearch } from '../medical.search.ts';
import { medicineFilterKey, medicineParamsOf } from './medicines.params.ts';

describe('medicineParamsOf — the Medicines read from the URL', () => {
  it('hands the search and the filters on as the URL holds them, with no sort by default', () => {
    expect(
      medicineParamsOf(
        validateMedicalSearch({
          q: 'glyco',
          stock: 'low',
          expiry: '60',
          created: 'this_month',
        }),
      ),
    ).toEqual({
      q: 'glyco',
      stock: 'low',
      expiry: '60',
      manufacturer: undefined,
      created: 'this_month',
    });
  });

  it('splits a column sort the tab has into its key and order', () => {
    expect(medicineParamsOf({ sort: 'margin:desc' })).toMatchObject({
      sort: 'margin',
      order: 'desc',
    });
    expect(medicineParamsOf({ sort: 'mrp:asc' })).toMatchObject({
      sort: 'mrp',
      order: 'asc',
    });
  });

  it('ignores a sort another Medical tab has — never sending a column Medicines lacks', () => {
    const params = medicineParamsOf({ sort: 'payable:desc' });
    expect(params).not.toHaveProperty('sort');
    expect(params).not.toHaveProperty('order');
  });
});

describe('medicineFilterKey — what shows the skeleton', () => {
  it('changes with a filter, never with a sort', () => {
    const base = medicineParamsOf({ q: 'glyco' });
    expect(medicineFilterKey(medicineParamsOf({ q: 'glyco', sort: 'name:asc' }))).toBe(
      medicineFilterKey(base),
    );
    expect(medicineFilterKey(medicineParamsOf({ q: 'glyco', stock: 'low' }))).not.toBe(
      medicineFilterKey(base),
    );
    expect(
      medicineFilterKey(medicineParamsOf({ q: 'glyco', manufacturer: ['mfr_a'] })),
    ).not.toBe(medicineFilterKey(base));
  });
});
