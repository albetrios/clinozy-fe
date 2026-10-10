import { describe, expect, it } from 'vitest';

import { offerRecord } from '@/tests/utils/offering-doubles.ts';

import {
  codeOf,
  emptyOfferForm,
  KIND_START_VALUES,
  missingOfferFields,
  OFFER_FORM_LIMITS,
  offerFieldsOf,
  offerFormOf,
  type OfferFormValues,
  offerProblem,
  offerValueOf,
} from './offer-form.ts';

const form = (values: Partial<OfferFormValues> = {}): OfferFormValues => ({
  ...emptyOfferForm(),
  ...values,
});

describe('emptyOfferForm (offerings.md:316)', () => {
  it('starts "% off" at 10, blush, every branch, no dates, Live', () => {
    expect(emptyOfferForm()).toEqual({
      name: '',
      code: '',
      kind: 'percent',
      value: '10',
      tone: 'blush',
      offeringIds: [],
      branchIds: [],
      startsOn: null,
      endsOn: null,
      note: '',
      live: true,
    });
  });
});

describe('the value in the API’s unit', () => {
  it('reads percent and sessions as whole numbers, money as rupees to the paisa', () => {
    expect(offerValueOf({ kind: 'percent', value: '20' })).toBe(20);
    expect(offerValueOf({ kind: 'extra', value: '2' })).toBe(2);
    expect(offerValueOf({ kind: 'amount', value: '500' })).toBe(500);
    expect(offerValueOf({ kind: 'amount', value: '100.5' })).toBeCloseTo(100.5, 2);
    expect(offerValueOf({ kind: 'fixed', value: '3999.55' })).toBeCloseTo(3999.55, 2);
    expect(offerValueOf({ kind: 'fixed', value: '' })).toBe(0);
  });

  it('round-trips a saved offer through the form, a rupee value as typed', () => {
    const offers = [
      offerRecord(),
      offerRecord({ kind: 'amount', value: 100.5, code: 'P0PROBE' }),
      offerRecord({
        kind: 'extra',
        value: 50,
        code: null,
        isActive: false,
        status: 'paused',
        startsOn: '2026-12-01',
        endsOn: '2026-12-31',
        note: 'Winter',
      }),
    ];
    for (const offer of offers) {
      expect(offerFieldsOf(offerFormOf(offer))).toEqual({
        name: offer.name,
        code: offer.code,
        kind: offer.kind,
        value: offer.value,
        tone: offer.tone,
        offeringIds: offer.offeringIds,
        branchIds: offer.branchIds,
        startsOn: offer.startsOn,
        endsOn: offer.endsOn,
        isActive: offer.isActive,
        note: offer.note,
      });
    }
    expect(offerFormOf(offerRecord({ kind: 'amount', value: 100.5 })).value).toBe(
      '100.5',
    );
    expect(offerFormOf(offerRecord({ isActive: false })).live).toBe(false);
  });

  it('starts each kind at the design’s value: 10 · 500 · nothing · 1 (H:5512)', () => {
    expect(KIND_START_VALUES).toEqual({
      percent: '10',
      amount: '500',
      fixed: '',
      extra: '1',
    });
  });
});

describe('offerFieldsOf', () => {
  it('sends the code or none, the note trimmed, Paused as not active', () => {
    expect(
      offerFieldsOf(form({ name: ' Diwali glow ', note: '  ', live: false })),
    ).toMatchObject({
      name: 'Diwali glow',
      code: null,
      note: null,
      isActive: false,
    });
  });
});

describe('the form’s limits — the API’s where they differ from the design', () => {
  it('takes a note of 280 and up to 99 free sessions (`/app/offers`)', () => {
    expect(OFFER_FORM_LIMITS.note).toBe(280);
    expect(OFFER_FORM_LIMITS.extraSessions).toBe(99);
  });
});

describe('codeOf (H:5511)', () => {
  it('upper-cases, keeps letters and digits only and 12 characters', () => {
    expect(codeOf('glow 20')).toBe('GLOW20');
    expect(codeOf('diwali-25!')).toBe('DIWALI25');
    expect(codeOf('a very long code here')).toBe('AVERYLONGCOD');
  });
});

describe('missingOfferFields', () => {
  it('names an empty Name and no offering', () => {
    expect(missingOfferFields(form())).toEqual(['name', 'offeringIds']);
    expect(missingOfferFields(form({ name: 'Glow', offeringIds: ['off_one'] }))).toEqual(
      [],
    );
  });
});

describe('offerProblem (H:5521)', () => {
  it('refuses a value of nothing for its kind', () => {
    expect(offerProblem(form({ kind: 'fixed', value: '' }))).toEqual({
      field: 'value',
      rule: 'value',
    });
    expect(offerProblem(form({ kind: 'percent', value: '0' }))).toEqual({
      field: 'value',
      rule: 'value',
    });
  });

  it('refuses an end before the start, and lets open dates through', () => {
    expect(offerProblem(form({ startsOn: '2026-10-10', endsOn: '2026-10-01' }))).toEqual({
      field: 'endsOn',
      rule: 'endsBeforeStart',
    });
    expect(offerProblem(form({ startsOn: '2026-10-10', endsOn: null }))).toBeNull();
    expect(
      offerProblem(form({ startsOn: '2026-10-01', endsOn: '2026-10-01' })),
    ).toBeNull();
  });
});
