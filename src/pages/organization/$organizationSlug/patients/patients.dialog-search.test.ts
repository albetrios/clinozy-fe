import { describe, expect, it } from 'vitest';

import { validatePatientCreateSearch } from './patients.dialog-search.ts';

/** A lead on clinozy-be — a public id, `lead_<21 [a-z0-9]>`. */
const LEAD = 'lead_anaya0000000000000000';

describe('validatePatientCreateSearch (S:31)', () => {
  it('reads the prefill: the name as given, the mobile as E.164', () => {
    expect(
      validatePatientCreateSearch({ name: 'Priya Shah', phone: '98765 43210' }),
    ).toEqual({ name: 'Priya Shah', phone: '+919876543210', fromLead: undefined });
  });

  it('keeps the lead it came from — a public id', () => {
    expect(validatePatientCreateSearch({ fromLead: LEAD }).fromLead).toBe(LEAD);
  });

  it('drops a long name, a mobile that is not one and an id that is not a lead’s', () => {
    expect(
      validatePatientCreateSearch({
        name: 'x'.repeat(121),
        phone: '12345',
        fromLead: 'appt_riya00000000000000000',
      }),
    ).toEqual({ name: undefined, phone: undefined, fromLead: undefined });
  });
});
