import { describe, expect, it } from 'vitest';

import { TEST_MAKER_ID } from '@/tests/utils/medical-doubles.ts';

import { validateMedicalSearch } from '../medical.search.ts';
import {
  supplierFilterKey,
  supplierParamsOf,
  supplierSummaryParamsOf,
} from './suppliers.params.ts';

describe('suppliers.params (the Suppliers read from the URL)', () => {
  it('hands the API one manufacturer, "owed something" and a Supplier or Payable sort', () => {
    expect(
      supplierParamsOf(
        validateMedicalSearch({
          q: 'ankur',
          manufacturer: TEST_MAKER_ID,
          payable: 'owed',
          sort: 'payable:desc',
        }),
      ),
    ).toEqual({
      q: 'ankur',
      manufacturer: TEST_MAKER_ID,
      hasPayable: true,
      created: undefined,
      sort: 'payable',
      order: 'desc',
    });
  });

  it('drops a sort, a payable value or an id the API does not take', () => {
    expect(
      supplierParamsOf(
        validateMedicalSearch({ sort: 'orders:asc', payable: 'all', manufacturer: 'x' }),
      ),
    ).toEqual({
      q: undefined,
      manufacturer: undefined,
      hasPayable: undefined,
      created: undefined,
    });
  });

  it('keys the skeleton and the footer by the filters alone — a sort keeps both', () => {
    const plain = supplierParamsOf(
      validateMedicalSearch({ q: 'ankur', payable: 'owed' }),
    );
    const sorted = supplierParamsOf(
      validateMedicalSearch({ q: 'ankur', payable: 'owed', sort: 'name:asc' }),
    );
    expect(supplierFilterKey(sorted)).toBe(supplierFilterKey(plain));
    expect(supplierSummaryParamsOf(sorted)).toEqual(supplierSummaryParamsOf(plain));
    expect(supplierFilterKey(plain)).not.toBe(supplierFilterKey({ q: 'ankur' }));
  });
});
