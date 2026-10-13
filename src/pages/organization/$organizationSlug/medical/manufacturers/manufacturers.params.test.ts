import { describe, expect, it } from 'vitest';

import { TEST_MR_ID, TEST_SUPPLIER_ID } from '@/tests/utils/medical-doubles.ts';

import { validateMedicalSearch } from '../medical.search.ts';
import {
  manufacturerFilterKey,
  manufacturerParamsOf,
  manufacturerSummaryParamsOf,
} from './manufacturers.params.ts';

describe('manufacturers.params (the Manufacturers read from the URL)', () => {
  it('hands the API one supplier and one MR — the first the URL holds — and the Name sort', () => {
    expect(
      manufacturerParamsOf(
        validateMedicalSearch({
          q: 'sun',
          suppliers: [TEST_SUPPLIER_ID, 'sup_other000000000000000000'],
          mrs: TEST_MR_ID,
          sort: 'name:desc',
        }),
      ),
    ).toEqual({
      q: 'sun',
      supplier: TEST_SUPPLIER_ID,
      mr: TEST_MR_ID,
      created: undefined,
      sort: 'name',
      order: 'desc',
    });
    expect(manufacturerParamsOf(validateMedicalSearch({ sort: 'payable:asc' }))).toEqual({
      q: undefined,
      supplier: undefined,
      mr: undefined,
      created: undefined,
    });
  });

  it('keys the skeleton and the footer by the filters alone — a sort keeps both', () => {
    const plain = manufacturerParamsOf(validateMedicalSearch({ mrs: TEST_MR_ID }));
    const sorted = manufacturerParamsOf(
      validateMedicalSearch({ mrs: TEST_MR_ID, sort: 'name:asc' }),
    );
    expect(manufacturerFilterKey(sorted)).toBe(manufacturerFilterKey(plain));
    expect(manufacturerSummaryParamsOf(sorted)).toEqual(
      manufacturerSummaryParamsOf(plain),
    );
    expect(manufacturerFilterKey(plain)).not.toBe(manufacturerFilterKey({}));
  });
});
