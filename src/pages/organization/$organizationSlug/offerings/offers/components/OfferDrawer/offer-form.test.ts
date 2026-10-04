import { describe, expect, it } from 'vitest';

import { offerSeed } from '@/shared/api/clinic/fixtures/offerings.fixtures.ts';
import type { OfferRecord } from '@/shared/api/clinic/offerings-contracts.ts';

import {
  codeOf,
  emptyOfferForm,
  KIND_START_VALUES,
  missingOfferFields,
  offerFormOf,
  type OfferFormValues,
  offerInputOf,
  offerProblem,
  offerValueOf,
} from './offer-form.ts';

const TODAY = '2026-09-27';

/** A seeded offer by its name. */
function seeded(name: string): OfferRecord {
  const offer = offerSeed(TODAY).find((record) => record.name === name);
  if (!offer) throw new Error(`no offer ${name}`);
  return offer;
}

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

describe('the value in its kind’s unit', () => {
  it('reads percent and sessions as whole numbers, money as paise', () => {
    expect(offerValueOf({ kind: 'percent', value: '20' })).toBe(20);
    expect(offerValueOf({ kind: 'extra', value: '2' })).toBe(2);
    expect(offerValueOf({ kind: 'amount', value: '500' })).toBe(50_000);
    expect(offerValueOf({ kind: 'fixed', value: '3999.5' })).toBe(399_950);
    expect(offerValueOf({ kind: 'fixed', value: '' })).toBe(0);
  });

  it('round-trips a saved offer through the form', () => {
    for (const name of ['Navratri glow', 'LHR launch · Vesu', 'Peel pack + 1 free']) {
      const offer = seeded(name);
      expect(offerInputOf(offerFormOf(offer))).toMatchObject({
        name: offer.name,
        code: offer.code,
        kind: offer.kind,
        value: offer.value,
        offeringIds: offer.offeringIds,
        branchIds: offer.branchIds,
        startsOn: offer.startsOn,
        endsOn: offer.endsOn,
        paused: offer.paused,
      });
    }
    expect(offerFormOf(seeded('LHR launch · Vesu')).value).toBe('3999');
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

describe('offerInputOf', () => {
  it('sends the code or none, the note trimmed, Paused as paused', () => {
    expect(
      offerInputOf(form({ name: ' Diwali glow ', note: '  ', live: false })),
    ).toMatchObject({
      name: 'Diwali glow',
      code: null,
      note: null,
      paused: true,
    });
  });
});

describe('codeOf (H:5511)', () => {
  it('upper-cases, strips spaces and keeps 12 characters', () => {
    expect(codeOf('glow 20')).toBe('GLOW20');
    expect(codeOf('a very long code here')).toBe('AVERYLONGCOD');
  });
});

describe('missingOfferFields', () => {
  it('names an empty Name and no offering', () => {
    expect(missingOfferFields(form())).toEqual(['name', 'offeringIds']);
    expect(missingOfferFields(form({ name: 'Glow', offeringIds: ['o1'] }))).toEqual([]);
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
