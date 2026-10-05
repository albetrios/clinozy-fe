import { describe, expect, it } from 'vitest';

import { validatePatientFileSearch } from './patient-id.search.ts';

describe('the patient file’s search params', () => {
  it('keeps a known `activity` and drops anything else', () => {
    expect(validatePatientFileSearch({ activity: 'open' })).toEqual({ activity: 'open' });
    expect(validatePatientFileSearch({ activity: 'closed' })).toEqual({
      activity: 'closed',
    });
    expect(validatePatientFileSearch({ activity: 'wide' })).toEqual({
      activity: undefined,
    });
    expect(validatePatientFileSearch({})).toEqual({ activity: undefined });
  });

  it('keeps `visit=open` for the visit flow and drops any other value (L-49)', () => {
    expect(validatePatientFileSearch({ visit: 'open' })).toStrictEqual({
      activity: undefined,
      visit: 'open',
    });
    expect(validatePatientFileSearch({ visit: 'closed' }).visit).toBeUndefined();
    expect(validatePatientFileSearch({ visit: ['open'] }).visit).toBeUndefined();
  });
});
