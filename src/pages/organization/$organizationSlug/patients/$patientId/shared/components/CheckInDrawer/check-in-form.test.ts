import { describe, expect, it } from 'vitest';

import { checkInInputOf, newCheckInForm } from './check-in-form.ts';

const PLACE = {
  patientId: 'P1',
  appointmentId: null,
  treatmentId: 'T1',
  context: 'Aftercare after LHR Full Face',
  date: '2026-10-04',
};

describe('the check-in form', () => {
  it('sends the place, the feel and the words — blanks as none', () => {
    expect(
      checkInInputOf(
        { ...newCheckInForm(), feel: 'same', score: 6, now: '  Better  ', nextPlan: ' ' },
        PLACE,
      ),
    ).toEqual({
      ...PLACE,
      feel: 'same',
      score: 6,
      now: 'Better',
      followed: null,
      followedNote: null,
      nextPlan: null,
      nextOfferingIds: [],
    });
  });

  it('never sends a check-in without a feel (A-F12 keeps 0 as no score)', () => {
    expect(() => checkInInputOf(newCheckInForm(), PLACE)).toThrow();
  });
});
