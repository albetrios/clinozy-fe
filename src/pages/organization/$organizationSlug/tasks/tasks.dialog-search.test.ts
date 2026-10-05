import { describe, expect, it } from 'vitest';

import { validateTaskCreateSearch } from './tasks.dialog-search.ts';

describe('validateTaskCreateSearch', () => {
  const LEAD = '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f';
  it('keeps a lead or patient id the New task is for', () => {
    expect(validateTaskCreateSearch({ lead: LEAD })).toEqual({
      lead: LEAD,
      patient: undefined,
    });
    expect(validateTaskCreateSearch({ patient: LEAD }).patient).toBe(LEAD);
  });

  it('drops anything that is not a record id', () => {
    expect(validateTaskCreateSearch({ lead: '2363', patient: 'Priti' })).toEqual({
      lead: undefined,
      patient: undefined,
    });
  });
});
