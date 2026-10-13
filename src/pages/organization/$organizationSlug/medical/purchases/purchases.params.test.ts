import { describe, expect, it } from 'vitest';

import { purchaseOrderFilterKey, purchaseOrderParamsOf } from './purchases.params.ts';

describe('purchaseOrderParamsOf — the Purchases read from the URL', () => {
  it('hands on the search, the stage and Created, and a sort the tab has', () => {
    expect(
      purchaseOrderParamsOf({
        q: 'shree',
        stage: 'received',
        created: 'today',
        sort: 'total:desc',
      }),
    ).toEqual({
      q: 'shree',
      stage: 'received',
      created: 'today',
      sort: 'total',
      order: 'desc',
    });
  });

  it('sends no sort for a column it lacks', () => {
    expect(purchaseOrderParamsOf({ sort: 'margin:asc' })).toEqual({
      q: undefined,
      stage: undefined,
      created: undefined,
    });
  });

  it('keys the skeleton on the filters only', () => {
    expect(purchaseOrderFilterKey(purchaseOrderParamsOf({ sort: 'seq:asc' }))).toBe(
      purchaseOrderFilterKey(purchaseOrderParamsOf({})),
    );
    expect(purchaseOrderFilterKey(purchaseOrderParamsOf({ stage: 'paid' }))).not.toBe(
      purchaseOrderFilterKey(purchaseOrderParamsOf({})),
    );
  });
});
