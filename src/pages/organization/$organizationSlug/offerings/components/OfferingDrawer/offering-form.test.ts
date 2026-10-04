import { describe, expect, it } from 'vitest';

import { offeringSeed } from '@/shared/api/clinic/fixtures/offerings.fixtures.ts';
import type { OfferingRecord } from '@/shared/api/clinic/offerings-contracts.ts';

import {
  emptyOfferingForm,
  missingOfferingFields,
  OFFERING_QUICK_FILLS,
  offeringFormOf,
  type OfferingFormValues,
  offeringInputOf,
  offeringPriceProblem,
  offeringPricesOf,
  splitSearchTerms,
} from './offering-form.ts';

const TODAY = '2026-10-03';

/** A seeded offering by its display number. */
function seeded(seq: number): OfferingRecord {
  const offering = offeringSeed(TODAY).find((record) => record.seq === seq);
  if (!offering) throw new Error(`no offering #${seq}`);
  return offering;
}

const form = (values: Partial<OfferingFormValues> = {}): OfferingFormValues => ({
  ...emptyOfferingForm(),
  ...values,
});

describe('emptyOfferingForm (offerings.md:315)', () => {
  it('starts Treatment, sage, 1 session, 30 min, no validity, GST 0 exclusive, Active', () => {
    expect(emptyOfferingForm()).toEqual({
      name: '',
      category: 'treatment',
      tone: 'sage',
      branchIds: [],
      price: '',
      offerPrice: '',
      sessions: 1,
      gstPct: '',
      gstInclusive: false,
      minPrice: '',
      durationMin: 30,
      validityDays: 0,
      searchTerms: '',
      description: '',
      active: true,
    });
  });

  it('takes the prefill’s name, trimmed to the form’s 60 characters', () => {
    expect(emptyOfferingForm({ name: '  Hydra facial ' }).name).toBe('Hydra facial');
    expect(emptyOfferingForm({ name: 'x'.repeat(120) }).name).toHaveLength(60);
  });
});

describe('offeringFormOf', () => {
  it('reads a saved offering back as the fields show it — rupees, terms, an empty GST', () => {
    const peel = seeded(273);
    const values = offeringFormOf(peel);
    expect(values.name).toBe(peel.name);
    expect(values.price).toBe(String(peel.price / 100));
    expect(values.offerPrice).toBe(
      peel.offerPrice === null ? '' : String(peel.offerPrice / 100),
    );
    expect(values.gstPct).toBe(peel.gstPct === 0 ? '' : String(peel.gstPct));
    expect(values.searchTerms).toBe(peel.searchTerms.join(', '));
    expect(offeringInputOf(values)).toMatchObject({
      name: peel.name,
      price: peel.price,
      sessions: peel.sessions,
      category: peel.category,
    });
  });
});

describe('offeringInputOf', () => {
  it('sends money in paise, at least one session and the terms split on commas', () => {
    const input = offeringInputOf(
      form({
        name: '  LHR Full Face ',
        price: '1500',
        offerPrice: '1200.5',
        minPrice: '1000',
        sessions: 0,
        gstPct: '18',
        searchTerms: 'laser, , face ,hair removal',
        description: '   ',
      }),
    );
    expect(input).toMatchObject({
      name: 'LHR Full Face',
      price: 150_000,
      offerPrice: 120_050,
      minPrice: 100_000,
      sessions: 1,
      gstPct: 18,
      searchTerms: ['laser', 'face', 'hair removal'],
      description: null,
    });
  });

  it('bills the list price when the offer price is empty or not below it (offerings.md:66)', () => {
    expect(
      offeringPricesOf(form({ price: '1500', offerPrice: '' })).offerPrice,
    ).toBeNull();
    expect(
      offeringPricesOf(form({ price: '1500', offerPrice: '1500' })).offerPrice,
    ).toBeNull();
    expect(
      offeringPricesOf(form({ price: '1500', offerPrice: '0' })).offerPrice,
    ).toBeNull();
  });
});

describe('splitSearchTerms', () => {
  it('drops blanks and trims each term', () => {
    expect(splitSearchTerms(' laser,face ,, ')).toEqual(['laser', 'face']);
    expect(splitSearchTerms('')).toEqual([]);
  });
});

describe('missingOfferingFields (H:3852)', () => {
  it('names an empty Name and a Price of 0 or nothing', () => {
    expect(missingOfferingFields(form())).toEqual(['name', 'price']);
    expect(missingOfferingFields(form({ name: ' ', price: '0' }))).toEqual([
      'name',
      'price',
    ]);
    expect(missingOfferingFields(form({ name: 'Peel', price: '900' }))).toEqual([]);
  });
});

describe('offeringPriceProblem (H:5507)', () => {
  it('refuses an offer price above the price', () => {
    expect(offeringPriceProblem(form({ price: '1000', offerPrice: '1200' }))).toEqual({
      field: 'offerPrice',
      rule: 'offerAbovePrice',
    });
  });

  it('refuses a lowest price above what is billed — the offer price, else the price', () => {
    expect(
      offeringPriceProblem(form({ price: '1000', offerPrice: '800', minPrice: '900' })),
    ).toEqual({ field: 'minPrice', rule: 'floorAboveOffer' });
    expect(offeringPriceProblem(form({ price: '1000', minPrice: '1100' }))).toEqual({
      field: 'minPrice',
      rule: 'floorAboveOffer',
    });
  });

  it('lets a consistent set through', () => {
    expect(
      offeringPriceProblem(form({ price: '1000', offerPrice: '800', minPrice: '700' })),
    ).toBeNull();
    expect(offeringPriceProblem(form({ price: '1000' }))).toBeNull();
  });
});

describe('OFFERING_QUICK_FILLS (offerings.md:240)', () => {
  it('prefills each preset as the design does', () => {
    const fills = Object.fromEntries(
      OFFERING_QUICK_FILLS.map((fill) => [fill.id, { tone: fill.tone, ...fill.values }]),
    );
    expect(fills).toEqual({
      single: {
        tone: 'sage',
        category: 'treatment',
        sessions: 1,
        validityDays: 0,
        durationMin: 30,
      },
      pack: {
        tone: 'lav',
        category: 'package',
        sessions: 6,
        validityDays: 180,
        durationMin: 45,
      },
      lhr: {
        tone: 'blush',
        category: 'lhr',
        sessions: 10,
        validityDays: 365,
        durationMin: 60,
      },
      consultation: {
        tone: 'sky',
        category: 'consultation',
        sessions: 1,
        validityDays: 0,
        durationMin: 20,
      },
    });
  });
});
