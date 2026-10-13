import { describe, expect, it } from 'vitest';

import { PAYMENT_DIRECTION_VALUES, PAYMENT_MODE_VALUES } from './app-schema.ts';
import { LEDGER_FILTER_VALUES } from './ledger-filter-values.ts';
import { LEDGER_KIND_VALUES } from './payments-contracts.ts';

describe('the ledger filters’ values, declared for the entry chunk', () => {
  it('match the contract’s enums', () => {
    expect(LEDGER_FILTER_VALUES.direction).toEqual(PAYMENT_DIRECTION_VALUES);
    expect(LEDGER_FILTER_VALUES.kind).toEqual(LEDGER_KIND_VALUES);
    expect(LEDGER_FILTER_VALUES.mode).toEqual(PAYMENT_MODE_VALUES);
  });
});
