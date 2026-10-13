import { describe, expect, it } from 'vitest';

import { validateMedicalCreateSearch } from './medical.dialog-search.ts';

const ID = '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d';

describe('validateMedicalCreateSearch — the create drawers’ prefills (S:50–68)', () => {
  it('reads the dialog prefills', () => {
    expect(
      validateMedicalCreateSearch({ name: 'Azel', supplier: ID, reorder: 'low' }),
    ).toEqual({
      name: 'Azel',
      supplier: ID,
      reorder: 'low',
      prescription: undefined,
      customer: undefined,
      from: undefined,
    });
    expect(validateMedicalCreateSearch({ supplier: 'x', reorder: 'all' })).toMatchObject({
      supplier: undefined,
      reorder: undefined,
    });
    // New sale from Today's Dispense: the prescription and the room to go back to.
    expect(
      validateMedicalCreateSearch({ prescription: ID, from: 'today' }),
    ).toMatchObject({ prescription: ID, from: 'today' });
  });
});
