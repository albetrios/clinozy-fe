import { describe, expect, it } from 'vitest';

import { patientListParamsOf } from './patients.params.ts';
import { validatePatientsSearch } from './patients.search.ts';

describe('patientListParamsOf', () => {
  it('applies the All view and splits the sort for the list read', () => {
    expect(patientListParamsOf({})).toMatchObject({
      view: 'all',
      sort: undefined,
      order: undefined,
    });
    expect(
      patientListParamsOf(
        validatePatientsSearch({ view: 'follow', sort: 'followUp:desc' }),
      ),
    ).toMatchObject({ view: 'follow', sort: 'followUp', order: 'desc' });
    expect(
      patientListParamsOf(validatePatientsSearch({ sort: 'seq:asc' })),
    ).toMatchObject({ sort: 'seq', order: 'asc' });
  });

  it('hands the search and the filters on as the URL holds them — one status, one conversion', () => {
    expect(
      patientListParamsOf(
        validatePatientsSearch({
          view: 'recall',
          q: 'shah',
          types: 'aesthetic,lhr',
          status: 'regular',
          conversion: 'converted',
          created: 'this_month',
          followUp: 'overdue',
        }),
      ),
    ).toEqual({
      view: 'recall',
      q: 'shah',
      types: ['aesthetic', 'lhr'],
      status: 'regular',
      conversion: 'converted',
      created: 'this_month',
      followUp: 'overdue',
      sort: undefined,
      order: undefined,
    });
  });
});
