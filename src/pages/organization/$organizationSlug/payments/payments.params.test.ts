import { describe, expect, it } from 'vitest';

import { ledgerListParamsOf } from './payments.params.ts';

const BRANCH = '00000000-0000-4000-8000-0000000b0001';

describe('ledgerListParamsOf', () => {
  it('reads the filters, the header’s branches and Day close’s day', () => {
    expect(
      ledgerListParamsOf(
        {
          direction: 'paid',
          kind: ['expense'],
          mode: ['cash'],
          created: 'today',
          q: 'tea',
        },
        { branchIds: [BRANCH], day: '2026-10-02' },
      ),
    ).toEqual({
      direction: 'paid',
      kind: ['expense'],
      mode: ['cash'],
      created: 'today',
      q: 'tea',
      day: '2026-10-02',
      branchIds: [BRANCH],
    });
  });

  it('reads every branch when the header names none', () => {
    expect(ledgerListParamsOf({}, { branchIds: [] })).toMatchObject({
      branchIds: undefined,
      day: undefined,
    });
  });
});
