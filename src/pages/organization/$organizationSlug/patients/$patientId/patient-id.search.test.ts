import { describe, expect, it } from 'vitest';

import { REVIEW_SOURCE_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import {
  PATIENT_REVIEW_SOURCES,
  validatePatientFeedbackSearch,
  validatePatientFileDialogSearch,
  validatePatientFileSearch,
  validatePatientRxCreateSearch,
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

  it('keeps `visit=open` for the visit flow and drops any other value (L-49)', () => {
    expect(validatePatientFileSearch({ visit: 'open' })).toStrictEqual({
      activity: undefined,
      visit: 'open',
    });
    expect(validatePatientFileSearch({ visit: 'closed' }).visit).toBeUndefined();
    expect(validatePatientFileSearch({ visit: ['open'] }).visit).toBeUndefined();
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

  it('keeps up to ten medicine names a smart note hands New prescription (A-F5)', () => {
    expect(
      validatePatientRxCreateSearch({
        medicines: [' Flubolt 400 ', '', {}, 'Clonix-B Lotion'],
      }),
    ).toEqual({ medicines: ['Flubolt 400', 'Clonix-B Lotion'] });
    const many = Array.from(
      { length: 12 },
      (_, index) => `Medicine ${'x'.repeat(index)}`,
    );
    expect(validatePatientRxCreateSearch({ medicines: many }).medicines).toHaveLength(10);
    expect(
      validatePatientRxCreateSearch({ medicines: ['y'.repeat(200)] }).medicines?.[0],
    ).toHaveLength(120);
    expect(validatePatientRxCreateSearch({ medicines: 'Flubolt 400' })).toEqual({
      medicines: undefined,
    });
    expect(validatePatientRxCreateSearch({})).toEqual({ medicines: undefined });
  });

  it('declares the review sources the schema has, in its order', () => {
    expect(PATIENT_REVIEW_SOURCES).toEqual(REVIEW_SOURCE_VALUES);
  });
});
