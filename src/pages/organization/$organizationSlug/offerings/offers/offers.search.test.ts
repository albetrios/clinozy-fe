import { describe, expect, it } from 'vitest';

import { OFFER_STATUS_VALUES } from '@/shared/api/clinic/offerings-contracts.ts';

import { OFFER_STATE_FILTER, validateOffersSearch } from './offers.search.ts';

const BRANCH = 'brn_thsaog1i8bv6m9rd9ucoy';

describe('validateOffersSearch (S:101)', () => {
  it('declares the statuses in the API’s order', () => {
    expect(OFFER_STATE_FILTER).toEqual(OFFER_STATUS_VALUES);
  });

  it('answers every key, all empty for a bare URL', () => {
    expect(validateOffersSearch({})).toEqual({
      q: undefined,
      status: undefined,
      branch: undefined,
      created: undefined,
    });
  });

  it('keeps a search, states, branches and a Created filter', () => {
    expect(
      validateOffersSearch({
        q: 'glow',
        status: ['live', 'paused'],
        branch: ['all', BRANCH],
        created: '2026-09-01..2026-09-30',
      }),
    ).toEqual({
      q: 'glow',
      status: ['live', 'paused'],
      branch: ['all', BRANCH],
      created: '2026-09-01..2026-09-30',
    });
  });

  it('drops what the URL cannot hold — a sort included, the tab keeps its order', () => {
    expect(
      validateOffersSearch({
        status: ['running'],
        branch: ['Vesu', '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f'],
        sort: 'name:asc',
      }),
    ).toEqual({ q: undefined, status: undefined, branch: undefined, created: undefined });
  });
});
