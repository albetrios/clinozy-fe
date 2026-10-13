import { describe, expect, it } from 'vitest';

import {
  CREDIT_DIRECTION_VALUES,
  CREDIT_STATUS_VALUES,
} from '@/shared/api/app/app-schema.ts';

import { PENDING_FILTER_VALUES, validatePendingSearch } from './pending.search.ts';

describe('the contract’s values, declared for the entry chunk', () => {
  it('match the contract’s enums', () => {
    expect(PENDING_FILTER_VALUES.direction).toEqual(CREDIT_DIRECTION_VALUES);
    expect(PENDING_FILTER_VALUES.status).toEqual(CREDIT_STATUS_VALUES);
  });
});

describe('validatePendingSearch (S:88)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validatePendingSearch({
        direction: 'give',
        status: 'open,used',
        created: 'this_month',
        q: ' CR-2 ',
      }),
    ).toEqual({
      direction: ['give'],
      status: ['open', 'used'],
      created: 'this_month',
      q: 'CR-2',
    });
  });

  it('drops what it can’t hold', () => {
    expect(
      validatePendingSearch({ direction: 'lend', status: ['closed'], created: 'soon' }),
    ).toEqual({
      direction: undefined,
      status: undefined,
      created: undefined,
      q: undefined,
    });
  });
});
