import { describe, expect, it } from 'vitest';

import { validateMedicalCreateSearch } from './medical.dialog-search.ts';

// Public ids as clinozy-be sends them (`<prefix>_<21 [a-z0-9]>`).
const SUPPLIER_ID = 'sup_ankur0000000000000000';
const PRESCRIPTION_ID = 'rx_rx5800000000000000000';
const CONTACT_ID = 'con_priya0000000000000000';

describe('validateMedicalCreateSearch — the create drawers’ prefills (S:50–68)', () => {
  it('reads the dialog prefills', () => {
    expect(
      validateMedicalCreateSearch({
        name: 'Azel',
        supplier: SUPPLIER_ID,
        reorder: 'low',
      }),
    ).toEqual({
      name: 'Azel',
      supplier: SUPPLIER_ID,
      reorder: 'low',
      prescription: undefined,
      customer: undefined,
      from: undefined,
    });
    expect(validateMedicalCreateSearch({ supplier: 'x', reorder: 'all' })).toMatchObject({
      supplier: undefined,
      reorder: undefined,
    });
    // New sale from Today's Dispense: the prescription, its buyer and the room to go back to.
    expect(
      validateMedicalCreateSearch({
        prescription: PRESCRIPTION_ID,
        customer: CONTACT_ID,
        from: 'today',
      }),
    ).toMatchObject({
      prescription: PRESCRIPTION_ID,
      customer: CONTACT_ID,
      from: 'today',
    });
  });

  it('drops an id that is not a public id — a retired UUID, a wrong shape', () => {
    expect(
      validateMedicalCreateSearch({
        supplier: '0b9c7a3e-2f6d-4f8a-9c1e-5d4b3a2f1e0d',
        customer: 'con_short',
      }),
    ).toMatchObject({ supplier: undefined, customer: undefined });
  });
});
