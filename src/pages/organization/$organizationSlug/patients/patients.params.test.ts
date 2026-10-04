import { describe, expect, it } from 'vitest';

import { patientListParamsOf } from './patients.params.ts';
import { validatePatientsSearch } from './patients.search.ts';

describe('patientListParamsOf', () => {
  it('applies the All view and splits the sort for the list read', () => {
    expect(patientListParamsOf({})).toMatchObject({ view: 'all', sort: undefined });
    expect(
      patientListParamsOf(
        validatePatientsSearch({ view: 'follow', sort: 'followUp:desc' }),
      ),
    ).toMatchObject({ view: 'follow', sort: 'followUp', order: 'desc' });
  });
});
