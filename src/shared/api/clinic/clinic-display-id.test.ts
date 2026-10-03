import { describe, expect, it } from 'vitest';

import { displayId } from './clinic-display-id.ts';

describe('display ids (per-org seq + the schema prefix)', () => {
  it.each([
    [displayId.patient(3508), '#3508'],
    [displayId.patientCode(412), 'PT-0412'],
    [displayId.appointment(2841), '#2841'],
    [displayId.payment(5512), 'PAY-5512'],
    [displayId.invoice(787), 'INV-787'],
    [displayId.sale(983), 'S-983'],
    [displayId.creditNote(1), 'CN-001'],
    [displayId.pendingCredit(2), 'CR-2'],
    [displayId.purchaseOrder(431), 'PO #431'],
  ])('%s', (actual, expected) => {
    expect(actual).toBe(expected);
  });
});
