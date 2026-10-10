import { describe, expect, it } from 'vitest';

import { checkInFieldsOf, checkInFormOf, newCheckInForm } from './check-in-form.ts';

describe('the check-in form', () => {
  it('sends the feel, the score and the words — blanks as none', () => {
    expect(
      checkInFieldsOf({
        ...newCheckInForm(),
        feel: 'same',
        score: 6,
        currentState: '  Better  ',
        followedNote: '',
        nextPlan: ' ',
      }),
    ).toEqual({
      feel: 'same',
      score: 6,
      currentState: 'Better',
      followed: null,
      followedNote: null,
      nextPlan: null,
    });
  });

  it('never sends a check-in without a feel or a score (Q18: 1–10, no “not rated”)', () => {
    expect(() => checkInFieldsOf(newCheckInForm())).toThrow();
    expect(() => checkInFieldsOf({ ...newCheckInForm(), feel: 'better' })).toThrow();
  });

  it('opens a saved one on its own words', () => {
    expect(
      checkInFormOf({
        id: 'chk_saved',
        patientId: 'pat_priya',
        appointmentId: null,
        treatmentId: null,
        context: 'Visit · 24 Sep',
        feel: 'worse',
        score: 3,
        scoreChange: -4,
        followed: 'partly',
        followedNote: null,
        currentState: 'Itching',
        nextPlan: null,
        nextOfferingIds: ['off_a'],
        date: '2026-09-24',
        needsAction: true,
        actions: [],
        createdAt: '2026-09-24T05:00:00.000Z',
        updatedAt: '2026-09-24T05:00:00.000Z',
      }),
    ).toEqual({
      feel: 'worse',
      score: 3,
      currentState: 'Itching',
      followed: 'partly',
      followedNote: '',
      nextPlan: '',
      nextOfferingIds: ['off_a'],
    });
  });
});
