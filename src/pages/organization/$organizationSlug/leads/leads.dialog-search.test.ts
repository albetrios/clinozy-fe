import { describe, expect, it } from 'vitest';

import { validateLeadCreateSearch } from './leads.dialog-search.ts';

describe('validateLeadCreateSearch — the New lead prefill (S:23)', () => {
  it('keeps the name and the mobile, the mobile as E.164', () => {
    expect(
      validateLeadCreateSearch({ name: ' Rhea Shah ', phone: '98250 11241' }),
    ).toEqual({
      name: 'Rhea Shah',
      phone: '+919825011241',
    });
    expect(validateLeadCreateSearch({ phone: '+919825011241' }).phone).toBe(
      '+919825011241',
    );
    // The router parses `?phone=9825011241` into a number.
    expect(validateLeadCreateSearch({ phone: 9825011241 }).phone).toBe('+919825011241');
  });

  it('drops a mobile that is not one and a name past the contract’s 120 characters', () => {
    expect(validateLeadCreateSearch({ name: 'x'.repeat(121), phone: '12345' })).toEqual({
      name: undefined,
      phone: undefined,
    });
    expect(validateLeadCreateSearch({})).toEqual({ name: undefined, phone: undefined });
  });
});
