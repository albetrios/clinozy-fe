import { describe, expect, it } from 'vitest';

import { offeringRecord } from '@/tests/utils/offering-doubles.ts';

import {
  emptyOfferingForm,
  gstPercentOf,
  missingOfferingFields,
  OFFERING_QUICK_FILLS,
  offeringFieldsOf,
  offeringFormOf,
  type OfferingFormValues,
  offeringPriceProblem,
  offeringPricesOf,
  rupeesOfText,
  splitSearchTerms,
} from './offering-form.ts';

const form = (values: Partial<OfferingFormValues> = {}): OfferingFormValues => ({
  ...emptyOfferingForm(),
  ...values,
});

const SEES_FLOOR = { canSeeFloor: true };
const NO_FLOOR = { canSeeFloor: false };

describe('emptyOfferingForm (offerings.md:315)', () => {
  it('starts Treatment, sage, 1 session, 30 min, no validity, no GST rate picked, exclusive, Active', () => {
    expect(emptyOfferingForm()).toEqual({
      name: '',
      category: 'treatment',
      tone: 'sage',
      branchIds: [],
      price: '',
      offerPrice: '',
      sessions: 1,
      gstPercent: '',
      isGstInclusive: false,
      minPrice: '',
      durationMinutes: 30,
      validityDays: 0,
      searchTerms: '',
      description: '',
      isActive: true,
    });
  });

  it('takes the prefill’s name, trimmed to the form’s 60 characters', () => {
    expect(emptyOfferingForm({ name: '  Hydra facial ' }).name).toBe('Hydra facial');
    expect(emptyOfferingForm({ name: 'x'.repeat(120) }).name).toHaveLength(60);
  });
});

describe('offeringFormOf', () => {
  it('reads a saved offering back as the fields show it — rupees, its GST chip, its terms', () => {
    expect(offeringFormOf(offeringRecord({ price: 2000.5, isActive: false }))).toEqual({
      name: 'Research Peel',
      category: 'treatment',
      tone: 'sage',
      branchIds: ['brn_thsaog1i8bv6m9rd9ucoy'],
      price: '2000.5',
      offerPrice: '1800',
      sessions: 1,
      gstPercent: '18',
      isGstInclusive: false,
      minPrice: '1500',
      durationMinutes: 30,
      validityDays: 0,
      searchTerms: 'chemical, glow',
      description: 'Research row (offerings room brief)',
      isActive: false,
    });
  });

  it('reads a lowest price the member cannot see (null) as empty, and a 0% rate as its chip', () => {
    const values = offeringFormOf(
      offeringRecord({ minPrice: null, offerPrice: null, gstPercent: 0 }),
    );
    expect(values).toMatchObject({ minPrice: '', offerPrice: '', gstPercent: '0' });
  });
});

describe('rupeesOfText', () => {
  it('reads typed rupees to the paisa; empty is 0', () => {
    expect(rupeesOfText('1200.5')).toBeCloseTo(1200.5, 2);
    expect(rupeesOfText('0.1')).toBeCloseTo(0.1, 2);
    expect(rupeesOfText('')).toBe(0);
  });
});

describe('gstPercentOf', () => {
  it('reads a chip as the API’s rate, and none while nothing is picked', () => {
    expect(gstPercentOf('18')).toBe(18);
    expect(gstPercentOf('0')).toBe(0);
    expect(gstPercentOf('')).toBeNull();
    expect(gstPercentOf('7')).toBeNull();
  });
});

describe('offeringFieldsOf', () => {
  it('sends rupees, at least one session, five minutes, the terms split on commas', () => {
    const fields = offeringFieldsOf(
      form({
        name: '  LHR Full Face ',
        price: '1500',
        offerPrice: '1200.5',
        minPrice: '1000',
        sessions: 0,
        durationMinutes: 0,
        gstPercent: '18',
        isGstInclusive: true,
        searchTerms: 'laser, , face ,hair removal',
        description: '   ',
        isActive: false,
      }),
      SEES_FLOOR,
    );
    expect(fields).toEqual({
      name: 'LHR Full Face',
      category: 'treatment',
      tone: 'sage',
      branchIds: [],
      price: 1500,
      offerPrice: 1200.5,
      minPrice: 1000,
      sessions: 1,
      gstPercent: 18,
      isGstInclusive: true,
      durationMin: 5,
      validityDays: 0,
      searchTerms: ['laser', 'face', 'hair removal'],
      description: null,
      isActive: false,
    });
  });

  it('leaves the GST rate to the server while no chip is picked', () => {
    expect(offeringFieldsOf(form({ price: '500' }), SEES_FLOOR).gstPercent).toBeNull();
  });

  it('never names the lowest price for a member without offering:lower_price:read (gap 6)', () => {
    expect(
      offeringFieldsOf(form({ price: '1500', minPrice: '1000' }), NO_FLOOR).minPrice,
    ).toBeNull();
    // A member who sees it and empties it removes the floor (0 = none).
    expect(offeringFieldsOf(form({ price: '1500' }), SEES_FLOOR).minPrice).toBe(0);
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
    expect(missingOfferingFields(form({ name: 'Peel', price: '0.5' }))).toEqual([]);
  });
});

describe('offeringPriceProblem (H:5507, the API’s min ≤ offer ≤ price)', () => {
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
      rule: 'floorAbovePrice',
    });
    // An offer price equal to the price bills the list price: the floor is weighed against it.
    expect(
      offeringPriceProblem(form({ price: '1000', offerPrice: '1000', minPrice: '1100' })),
    ).toEqual({ field: 'minPrice', rule: 'floorAbovePrice' });
  });

  it('lets a consistent set through', () => {
    expect(
      offeringPriceProblem(form({ price: '1000', offerPrice: '800', minPrice: '800' })),
    ).toBeNull();
    expect(offeringPriceProblem(form({ price: '1000' }))).toBeNull();
  });
});

describe('OFFERING_QUICK_FILLS (offerings.md:240)', () => {
  it('prefills each preset as the design does — every duration within the API’s 5–480', () => {
    const fills = Object.fromEntries(
      OFFERING_QUICK_FILLS.map((fill) => [fill.id, { tone: fill.tone, ...fill.values }]),
    );
    expect(fills).toEqual({
      single: {
        tone: 'sage',
        category: 'treatment',
        sessions: 1,
        validityDays: 0,
        durationMinutes: 30,
      },
      pack: {
        tone: 'lav',
        category: 'package',
        sessions: 6,
        validityDays: 180,
        durationMinutes: 45,
      },
      lhr: {
        tone: 'blush',
        category: 'lhr',
        sessions: 10,
        validityDays: 365,
        durationMinutes: 60,
      },
      consultation: {
        tone: 'sky',
        category: 'consultation',
        sessions: 1,
        validityDays: 0,
        durationMinutes: 20,
      },
    });
  });
});
