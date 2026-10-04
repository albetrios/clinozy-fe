import { describe, expect, it } from 'vitest';

import {
  validatePatientFileDialogSearch,
  validatePatientFileSearch,
} from './patient-id.search.ts';

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

  it('keeps a drawer’s `from` as text, for the drawer to check', () => {
    expect(validatePatientFileDialogSearch({ from: 'visits' })).toEqual({
      from: 'visits',
    });
    expect(validatePatientFileDialogSearch({ from: '' })).toEqual({ from: undefined });
    expect(validatePatientFileDialogSearch({ from: ['visits'] })).toEqual({
      from: undefined,
    });
  });
});
