import { describe, expect, it } from 'vitest';

import {
  PO_STAGE_VALUES,
  STOCK_CATEGORY_VALUES,
} from '@/shared/api/clinic/clinic-schema.ts';

import {
  MEDICINE_EXPIRY_FILTERS,
  PURCHASE_STAGES,
  SALE_STATUSES,
  validateMedicalCreateSearch,
  validateMedicalSearch,
} from '../medical.search.ts';
import { filtersOf, recordSection } from './medical-filters.ts';
import { sortParamsOf } from './medical-params.ts';
import {
  nextVisitTone,
  PURCHASE_STAGE_TONES,
  SALE_STATUS_TONES,
  supplierAgeingTone,
} from './medical-tones.ts';

const ID = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';

describe('medical.search.ts (the entry chunk’s reader)', () => {
  it('keeps every tab’s valid keys and drops the rest', () => {
    expect(
      validateMedicalSearch({
        q: '  azel ',
        status: 'unpaid',
        stock: 'low',
        expiry: 30,
        stage: 'received',
        manufacturer: `${ID},nope`,
        suppliers: [ID],
        mrs: 'x',
        sort: 'bill:desc',
        created: 'last_7',
      }),
    ).toEqual({
      q: 'azel',
      status: 'unpaid',
      stock: 'low',
      expiry: '30',
      stage: 'received',
      manufacturer: [ID],
      suppliers: [ID],
      mrs: undefined,
      sort: 'bill:desc',
      created: 'last_7',
    });
    expect(validateMedicalSearch({ stage: 'cancelled', sort: 'bill:up' })).toMatchObject({
      stage: undefined,
      sort: undefined,
    });
  });

  it('reads the dialog prefills', () => {
    expect(
      validateMedicalCreateSearch({ name: 'Azel', supplier: ID, reorder: 'low' }),
    ).toEqual({
      name: 'Azel',
      supplier: ID,
      reorder: 'low',
      prescription: undefined,
      customer: undefined,
    });
    expect(validateMedicalCreateSearch({ supplier: 'x', reorder: 'all' })).toMatchObject({
      supplier: undefined,
      reorder: undefined,
    });
  });

  it('pins the filter values to the contract (the reader cannot import the schema)', () => {
    expect([...PURCHASE_STAGES, 'cancelled'].sort()).toEqual([...PO_STAGE_VALUES].sort());
    expect(SALE_STATUSES).toEqual(['unpaid', 'returned']);
    expect(MEDICINE_EXPIRY_FILTERS).toEqual(['30', '60', '90']);
    expect(STOCK_CATEGORY_VALUES).toContain('consumables');
  });
});

describe('the family’s rules', () => {
  it('reads a tab’s own sort keys only', () => {
    expect(sortParamsOf('bill:desc', ['seq', 'bill'])).toEqual({
      sort: 'bill',
      order: 'desc',
    });
    expect(sortParamsOf('bill:asc', ['name'])).toEqual({});
    expect(sortParamsOf(undefined, ['name'])).toEqual({});
  });

  it('shows an automatic section for 2 to 10 records, then Created', () => {
    const makers = [
      { id: 'a', name: 'ALVI', tone: 'lav' as const },
      { id: 'b', name: 'DERM', tone: 'sky' as const },
    ];
    expect(recordSection('Manufacturer', makers.slice(0, 1))).toBeNull();
    const section = recordSection('Manufacturer', makers);
    expect(section?.field).toEqual({ kind: 'options', values: ['a', 'b'] });
    expect(section?.copy.options.a).toEqual({ label: 'ALVI', tone: 'lav' });
    const { fields, copy } = filtersOf({ manufacturer: section, mrs: null });
    expect(Object.keys(fields)).toEqual(['manufacturer', 'created']);
    expect(Object.keys(copy)).toEqual(['manufacturer']);
  });

  it('tones the stages, statuses, ageing and next visits', () => {
    expect(PURCHASE_STAGE_TONES).toMatchObject({
      ordered: 'sky',
      received: 'butter',
      paid: 'sage',
    });
    expect(SALE_STATUS_TONES).toEqual({ paid: 'sage', unpaid: 'blush' });
    expect([3, 7, 30].map(supplierAgeingTone)).toEqual(['sage', 'butter', 'blush']);
    expect(nextVisitTone('2026-10-03', '2026-10-04')).toBe('blush');
    expect(nextVisitTone('2026-10-04', '2026-10-04')).toBe('sky');
  });
});
