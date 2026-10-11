import { describe, expect, it } from 'vitest';

import {
  NO_PHOTO_VISIT,
  PATIENT_PHOTO_ALBUMS,
} from '@/shared/api/app/patient-images-contracts.ts';

import { NO_VISIT, PHOTO_ALBUMS, validatePatientImagesSearch } from './images.search.ts';

const VISIT = 'appt_co7tgiahg3uze2okuj98w';

describe('the Photos section’s search params', () => {
  it('spells the API’s albums and "no visit" (this module rides the entry chunk)', () => {
    expect([...PHOTO_ALBUMS]).toEqual([...PATIENT_PHOTO_ALBUMS]);
    expect(NO_VISIT).toBe(NO_PHOTO_VISIT);
  });

  it('keeps an album other than General, and drops anything else', () => {
    expect(validatePatientImagesSearch({ album: 'lhr' })).toEqual({
      album: 'lhr',
      appointment: undefined,
    });
    expect(validatePatientImagesSearch({ album: 'general' }).album).toBeUndefined();
    expect(validatePatientImagesSearch({ album: 'secret' }).album).toBeUndefined();
  });

  it('keeps a visit filter that is an appointment id or "none"', () => {
    expect(validatePatientImagesSearch({ appointment: VISIT }).appointment).toBe(VISIT);
    expect(validatePatientImagesSearch({ appointment: 'none' }).appointment).toBe('none');
    expect(
      validatePatientImagesSearch({ appointment: 'visit-1' }).appointment,
    ).toBeUndefined();
    expect(
      validatePatientImagesSearch({ appointment: '00000000-0000-4000-8000-000000002790' })
        .appointment,
    ).toBeUndefined();
  });
});
