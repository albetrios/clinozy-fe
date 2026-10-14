import { describe, expect, it } from 'vitest';

import { validateMedicalSearch } from '../medical.search.ts';
import { mrFilterKey, mrParamsOf, mrSummaryParamsOf } from './mrs.params.ts';

describe('mrs.params (the MRs read from the URL)', () => {
  it('hands the API the search, Created and the Name sort', () => {
    expect(
      mrParamsOf(
        validateMedicalSearch({ q: 'rahul', created: 'last_7', sort: 'name:desc' }),
      ),
    ).toEqual({ q: 'rahul', created: 'last_7', sort: 'name', order: 'desc' });
    expect(mrParamsOf(validateMedicalSearch({ sort: 'payable:asc' }))).toEqual({
      q: undefined,
      created: undefined,
    });
  });

  it('keys the skeleton and the footer by the filters alone — a sort keeps both', () => {
    const plain = mrParamsOf(validateMedicalSearch({ q: 'rahul' }));
    const sorted = mrParamsOf(validateMedicalSearch({ q: 'rahul', sort: 'name:asc' }));
    expect(mrFilterKey(sorted)).toBe(mrFilterKey(plain));
    expect(mrSummaryParamsOf(sorted)).toEqual({ q: 'rahul', created: undefined });
    expect(mrFilterKey(plain)).not.toBe(mrFilterKey({ q: 'ravi' }));
  });
});
