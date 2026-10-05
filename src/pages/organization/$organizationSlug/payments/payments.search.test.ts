import { describe, expect, it } from 'vitest';

import { roomFilterValues } from '@/shared/components/RoomToolbar/RoomFilters/room-filters.ts';

import { LEDGER_FILTER_FIELDS } from './payments.constants.ts';
import { validatePaymentsSearch } from './payments.search.ts';

describe('validatePaymentsSearch (S:84)', () => {
  it('keeps what the URL can hold and answers every key', () => {
    expect(
      validatePaymentsSearch({
        direction: 'paid',
        kind: 'expense,refund',
        mode: ['cash', 'upi'],
        created: 'last_7',
        q: '  PAY-5512 ',
      }),
    ).toEqual({
      direction: 'paid',
      kind: ['expense', 'refund'],
      mode: ['cash', 'upi'],
      created: 'last_7',
      q: 'PAY-5512',
    });
  });

  it('drops what it can’t hold — and the schema’s unused followUp and sort', () => {
    const search = validatePaymentsSearch({
      direction: 'sideways',
      kind: ['reversal', 'receipt'],
      mode: 'cheque',
      created: 'someday',
      q: 'x'.repeat(200),
      followUp: 'today',
      sort: 'amount:desc',
    });
    expect(search).toEqual({
      direction: undefined,
      kind: ['receipt'],
      mode: undefined,
      created: undefined,
      q: 'x'.repeat(80),
    });
    expect(Object.keys(validatePaymentsSearch({}))).toEqual([
      'direction',
      'kind',
      'mode',
      'created',
      'q',
    ]);
  });

  it('reads back into the Filters popover through the shared readers', () => {
    expect(
      roomFilterValues(
        LEDGER_FILTER_FIELDS,
        validatePaymentsSearch({ direction: 'received', mode: 'card' }),
      ),
    ).toEqual({ direction: ['received'], mode: ['card'] });
  });
});
