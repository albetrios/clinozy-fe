import { describe, expect, it } from 'vitest';

import {
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
  it('match the contract’s enums, views and sorts — no Gender filter', () => {
    expect(PATIENT_VIEWS).toEqual(PATIENT_VIEW_VALUES);
    expect(PATIENT_VIEWS).toEqual(['all', 'follow', 'recall']);
    expect(Object.keys(PATIENT_FILTER_VALUES)).toEqual(['types', 'status', 'conversion']);
    expect(PATIENT_FILTER_VALUES.types).toEqual(PATIENT_TYPE_VALUES);
    expect(PATIENT_FILTER_VALUES.status).toEqual(PATIENT_STATUS_VALUES);
    expect(PATIENT_FILTER_VALUES.conversion).toEqual(PATIENT_CONVERSION_VALUES);
    for (const key of PATIENT_SORT_KEYS) {
      expect(validatePatientsSearch({ sort: `${key}:asc` }).sort).toBe(`${key}:asc`);
      expect(validatePatientsSearch({ sort: `${key}:desc` }).sort).toBe(`${key}:desc`);
    }
  });
});

describe('validatePatientsSearch (S:30)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validatePatientsSearch({
        view: 'follow',
        q: '  #3508 ',
        types: 'aesthetic,lhr',
        status: 'vip',
        conversion: 'converted',
        created: 'last_7',
        followUp: '2026-10-01..2026-10-31',
        sort: 'followUp:desc',
      }),
    ).toEqual({
      view: 'follow',
      q: '#3508',
      types: ['aesthetic', 'lhr'],
      status: 'vip',
      conversion: 'converted',
      created: 'last_7',
      followUp: '2026-10-01..2026-10-31',
      sort: 'followUp:desc',
    });
  });

  it('drops what it can’t hold — never an error', () => {
    expect(
      validatePatientsSearch({
        view: 'everyone',
        q: '',
        types: ['dermatology'],
        status: 'retired',
        conversion: 'maybe',
        created: 'last_year',
        followUp: '2026-10-31..2026-10-01',
        sort: 'phone:asc',
      }),
    ).toEqual({
      view: undefined,
      q: undefined,
      types: undefined,
      status: undefined,
      conversion: undefined,
      created: undefined,
      followUp: undefined,
      sort: undefined,
    });
    expect(validatePatientsSearch({ q: 'x'.repeat(120) }).q).toHaveLength(80);
  });

  it('drops the views, filters and sorts the API cannot read', () => {
    const search = validatePatientsSearch({
      view: 'dues',
      gender: 'female',
      status: ['vip', 'regular'],
      followUp: 'not_set',
      sort: 'updated:desc',
    });
    expect(search.view).toBeUndefined();
    expect(search).not.toHaveProperty('gender');
    expect(search.status).toBeUndefined();
    expect(search.followUp).toBeUndefined();
    expect(search.sort).toBeUndefined();
    expect(validatePatientsSearch({ view: 'today' }).view).toBeUndefined();
    expect(validatePatientsSearch({ sort: 'due:desc' }).sort).toBeUndefined();
  });

  it('is the shape the Filters popover reads and writes', () => {
    const search = validatePatientsSearch({
      types: 'aesthetic',
      status: 'new',
      followUp: 'today',
    });
    expect(roomFilterValues(PATIENT_FILTER_FIELDS, { ...search })).toEqual({
      types: ['aesthetic'],
      status: ['new'],
      followUp: ['today'],
    });
    expect(Object.keys(PATIENT_FILTER_FIELDS)).toEqual([
      'types',
      'status',
      'conversion',
      'created',
      'followUp',
    ]);
  });
});
