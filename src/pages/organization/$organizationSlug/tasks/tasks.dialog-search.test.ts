import { describe, expect, it } from 'vitest';

import { validateTaskCreateSearch } from './tasks.dialog-search.ts';

describe('validateTaskCreateSearch', () => {
  const LEAD = 'lead_hplz5ew0h3tw99ntqf39w';
  const CONTACT = 'con_8hb15isod6txlpljrn1f7';

  it('keeps the lead or the person New task is for', () => {
    expect(validateTaskCreateSearch({ lead: LEAD })).toEqual({
      lead: LEAD,
      contact: undefined,
    });
    expect(validateTaskCreateSearch({ contact: CONTACT }).contact).toBe(CONTACT);
  });

  it('drops anything that is not a public id of its own kind', () => {
    expect(
      validateTaskCreateSearch({
        lead: CONTACT,
        contact: LEAD,
      }),
    ).toEqual({ lead: undefined, contact: undefined });
    expect(
      validateTaskCreateSearch({
        lead: '3f9b0c6e-1d2a-4c5b-8e7f-0a1b2c3d4e5f',
        contact: 'Priti',
      }),
    ).toEqual({ lead: undefined, contact: undefined });
    expect(validateTaskCreateSearch({ patient: 'pat_9e6j52vjb8uhvz44ebe94' })).toEqual({
      lead: undefined,
      contact: undefined,
    });
  });
});
