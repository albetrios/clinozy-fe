import { describe, expect, it } from 'vitest';

import {
  GENDER_VALUES,
  PATIENT_CONVERSION_VALUES,
  PATIENT_STATUS_VALUES,
  PATIENT_TYPE_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';
import {
  PATIENT_SORT_KEYS,
  PATIENT_VIEW_VALUES,
} from '@/shared/api/clinic/patients-contracts.ts';
import { roomFilterValues } from '@/shared/components/RoomToolbar/RoomFilters/room-filters.ts';

import { PATIENT_FILTER_FIELDS } from './patients.constants.ts';
import {
  PATIENT_FILTER_VALUES,
  PATIENT_VIEWS,
  validatePatientsSearch,
} from './patients.search.ts';

describe('the contract’s values, declared for the entry chunk', () => {
  it('match the contract’s enums and the plan’s views and sorts', () => {
    expect(PATIENT_VIEWS).toEqual(PATIENT_VIEW_VALUES);
    expect(PATIENT_FILTER_VALUES.gender).toEqual(GENDER_VALUES);
    expect(PATIENT_FILTER_VALUES.types).toEqual(PATIENT_TYPE_VALUES);
    expect(PATIENT_FILTER_VALUES.status).toEqual(PATIENT_STATUS_VALUES);
    expect(PATIENT_FILTER_VALUES.conversion).toEqual(PATIENT_CONVERSION_VALUES);
    expect(validatePatientsSearch({ sort: 'updated:desc' }).sort).toBe('updated:desc');
    for (const key of PATIENT_SORT_KEYS) {
      expect(validatePatientsSearch({ sort: `${key}:asc` }).sort).toBe(`${key}:asc`);
    }
  });
});

describe('validatePatientsSearch (S:30)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validatePatientsSearch({
        view: 'dues',
        q: '  #3508 ',
        types: 'aesthetic,lhr',
        status: ['vip', 'regular'],
        gender: ['female'],
        conversion: 'converted',
        created: 'last_7',
        followUp: '2026-10-01..2026-10-31',
        sort: 'due:desc',
      }),
    ).toEqual({
      view: 'dues',
      q: '#3508',
      types: ['aesthetic', 'lhr'],
      status: ['vip', 'regular'],
      gender: ['female'],
      conversion: ['converted'],
      created: 'last_7',
      followUp: '2026-10-01..2026-10-31',
      sort: 'due:desc',
    });
  });

  it('drops what it can’t hold — never an error', () => {
    expect(
      validatePatientsSearch({
        view: 'everyone',
        q: '',
        types: ['dermatology'],
        status: 'retired',
        created: 'last_year',
        followUp: '2026-10-31..2026-10-01',
        sort: 'phone:asc',
      }),
    ).toEqual({
      view: undefined,
      q: undefined,
      types: undefined,
      status: undefined,
      gender: undefined,
      conversion: undefined,
      created: undefined,
      followUp: undefined,
      sort: undefined,
    });
    expect(validatePatientsSearch({ q: 'x'.repeat(120) }).q).toHaveLength(80);
  });

  it('is the shape the Filters popover reads and writes', () => {
    const search = validatePatientsSearch({ gender: 'female', types: 'aesthetic' });
    expect(roomFilterValues(PATIENT_FILTER_FIELDS, search)).toEqual({
      gender: ['female'],
      types: ['aesthetic'],
    });
    expect(Object.keys(PATIENT_FILTER_FIELDS)).toEqual([
      'gender',
      'types',
      'status',
      'conversion',
      'created',
      'followUp',
    ]);
  });
});
