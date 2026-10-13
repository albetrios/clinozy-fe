import { describe, expect, it } from 'vitest';

import { PO_STAGE_VALUES, STOCK_CATEGORY_VALUES } from '@/shared/api/app/app-schema.ts';

import {
  MEDICINE_EXPIRY_FILTERS,
  PURCHASE_STAGES,
  SALE_STATUSES,
  validateMedicalSearch,
} from '../medical.search.ts';
import {
  nextVisitTone,
  PURCHASE_STAGE_TONES,
  SALE_STATUS_TONES,
  supplierAgeingTone,
} from './medical-tones.ts';

// A public id as clinozy-be sends it (`<prefix>_<21 [a-z0-9]>`); a UUID is dropped.
const ID = 'mfr_sunpharma000000000000';

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
        payable: 'owed',
        suppliers: [ID],
        mrs: '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d',
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
      payable: 'owed',
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

  it('pins the filter values to the contract (the reader cannot import the schema)', () => {
    expect([...PURCHASE_STAGES, 'cancelled'].sort()).toEqual([...PO_STAGE_VALUES].sort());
    expect(SALE_STATUSES).toEqual(['unpaid', 'paid', 'returned']);
    expect(MEDICINE_EXPIRY_FILTERS).toEqual(['30', '60', '90']);
    expect(STOCK_CATEGORY_VALUES).toContain('consumables');
  });
});

describe('the family’s rules', () => {
  it('tones the stages, statuses, ageing and next visits', () => {
    expect(PURCHASE_STAGE_TONES).toMatchObject({
      ordered: 'sky',
      received: 'butter',
      paid: 'sage',
    });
    expect(SALE_STATUS_TONES).toEqual({ paid: 'sage', unpaid: 'blush' });
    expect([3, 7, 30].map(supplierAgeingTone)).toEqual(['sage', 'butter', 'blush']);
    expect(nextVisitTone({ visitOverdue: true })).toBe('blush');
    expect(nextVisitTone({ visitOverdue: false })).toBe('sky');
  });
});
