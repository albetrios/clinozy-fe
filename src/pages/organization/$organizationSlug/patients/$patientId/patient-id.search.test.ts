import { describe, expect, it } from 'vitest';

import { REVIEW_SOURCE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  PATIENT_REVIEW_SOURCES,
  validatePatientFeedbackSearch,
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

  it('keeps the check-in and review drawers’ visit, treatment and known source (S:44–47)', () => {
    expect(
      validatePatientFeedbackSearch({
        from: 'treatments',
        appointment: 'A1',
        treatment: ' T1 ',
        source: 'instagram',
      }),
    ).toEqual({
      from: 'treatments',
      appointment: 'A1',
      treatment: 'T1',
      source: 'instagram',
    });
    expect(validatePatientFeedbackSearch({ source: 'tiktok', treatment: '' })).toEqual({
      from: undefined,
      appointment: undefined,
      treatment: undefined,
      source: undefined,
    });
  });

  it('declares the review sources the schema has, in its order', () => {
    expect(PATIENT_REVIEW_SOURCES).toEqual(REVIEW_SOURCE_VALUES);
  });
});
