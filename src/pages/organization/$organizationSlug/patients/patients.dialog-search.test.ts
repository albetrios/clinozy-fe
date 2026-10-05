import { describe, expect, it } from 'vitest';

import { validatePatientCreateSearch } from './patients.dialog-search.ts';

const LEAD = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';

describe('validatePatientCreateSearch (S:31)', () => {
  it('reads the prefill: the name as given, the mobile as E.164, the lead it came from', () => {
    expect(
      validatePatientCreateSearch({
        name: 'Priya Shah',
        phone: '98765 43210',
        fromLead: LEAD,
      }),
    ).toEqual({ name: 'Priya Shah', phone: '+919876543210', fromLead: LEAD });
  });

  it('drops a long name, a mobile that is not one and an id that is not one', () => {
    expect(
      validatePatientCreateSearch({
        name: 'x'.repeat(121),
        phone: '12345',
        fromLead: '42',
      }),
    ).toEqual({ name: undefined, phone: undefined, fromLead: undefined });
  });
});
