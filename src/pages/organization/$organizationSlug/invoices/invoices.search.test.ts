import { describe, expect, it } from 'vitest';

import { validateInvoiceSearch } from './invoices.search.ts';

describe('validateInvoiceSearch (S:93–94)', () => {
  it('holds the referrer as text — checked where it is used', () => {
    expect(validateInvoiceSearch({ from: 'today' })).toEqual({ from: 'today' });
    expect(validateInvoiceSearch({ from: 42 })).toEqual({ from: '42' });
    expect(validateInvoiceSearch({ from: { to: 'x' } })).toEqual({ from: undefined });
  });
});
