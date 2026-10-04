import { describe, expect, it } from 'vitest';

import { OFFERING_CATEGORY_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  ALL_BRANCHES,
  OFFERING_CATEGORY_FILTER,
  OFFERING_SORT_KEYS,
  validateOfferingCreateSearch,
  validateOfferingsSearch,
} from './offerings.search.ts';

const BRANCH = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';
const OFFER = '9a8b7c6d-5e4f-4a3b-8c2d-1e0f9a8b7c6d';

describe('the contract’s values, declared for the entry chunk', () => {
  it('match the contract’s categories', () => {
    expect(OFFERING_CATEGORY_FILTER).toEqual(OFFERING_CATEGORY_VALUES);
  });

  it('leaves the contract’s specialty unanswered — accepted as it stands, unused (Q-O6)', () => {
    expect(validateOfferingsSearch({ specialty: 'skin' })).not.toHaveProperty(
      'specialty',
    );
  });
});

describe('validateOfferingsSearch (S:98, D22)', () => {
  it('answers every key, all empty for a bare URL', () => {
    expect(validateOfferingsSearch({})).toEqual({
      q: undefined,
      category: undefined,
      offer: undefined,
      branch: undefined,
      status: undefined,
      created: undefined,
      sort: undefined,
    });
  });

  it('keeps a search, categories, offers, branches, statuses, a Created filter and a sort', () => {
    expect(
      validateOfferingsSearch({
        q: '  laser ',
        category: ['package', 'lhr'],
        offer: [OFFER],
        branch: [BRANCH, ALL_BRANCHES],
        status: ['inactive'],
        created: 'last_7',
        sort: 'price:desc',
      }),
    ).toMatchObject({
      q: 'laser',
      category: ['package', 'lhr'],
      offer: [OFFER],
      branch: [BRANCH, ALL_BRANCHES],
      status: ['inactive'],
      created: 'last_7',
      sort: 'price:desc',
    });
  });

  it('reads a single value and a comma list as the shared readers do', () => {
    expect(validateOfferingsSearch({ category: 'package' }).category).toEqual([
      'package',
    ]);
    expect(validateOfferingsSearch({ status: 'active,inactive' }).status).toEqual([
      'active',
      'inactive',
    ]);
  });

  it('drops what the URL cannot hold', () => {
    expect(
      validateOfferingsSearch({
        q: '',
        category: ['massage'],
        offer: ['GLOW20'],
        branch: ['vesu'],
        status: ['paused'],
        created: 'last_year',
        sort: 'offer:asc',
      }),
    ).toEqual({
      q: undefined,
      category: undefined,
      offer: undefined,
      branch: undefined,
      status: undefined,
      created: undefined,
      sort: undefined,
    });
  });

  it('cuts the search at 80 characters and accepts every sortable column', () => {
    expect(validateOfferingsSearch({ q: 'x'.repeat(90) }).q).toHaveLength(80);
    for (const key of OFFERING_SORT_KEYS) {
      expect(validateOfferingsSearch({ sort: `${key}:asc` }).sort).toBe(`${key}:asc`);
    }
  });
});

describe('validateOfferingCreateSearch (S:99)', () => {
  it('prefills the name it was asked with', () => {
    expect(validateOfferingCreateSearch({ name: ' Hydra facial ' })).toEqual({
      name: 'Hydra facial',
    });
  });

  it('drops an empty or over-long name', () => {
    expect(validateOfferingCreateSearch({})).toEqual({ name: undefined });
    expect(validateOfferingCreateSearch({ name: 'x'.repeat(121) })).toEqual({
      name: undefined,
    });
  });
});
