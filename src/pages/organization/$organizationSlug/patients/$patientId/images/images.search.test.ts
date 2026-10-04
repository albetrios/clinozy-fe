import { describe, expect, it } from 'vitest';

import { IMAGE_ALBUM_VALUES } from '@/shared/api/clinic/clinic-schema.ts';

import { PHOTO_ALBUMS, validatePatientImagesSearch } from './images.search.ts';

const VISIT = '00000000-0000-4000-8000-000000002790';

describe('the Photos section’s search params', () => {
  it('spells the contract’s albums (this module rides the entry chunk)', () => {
    expect([...PHOTO_ALBUMS]).toEqual([...IMAGE_ALBUM_VALUES]);
  });

  it('keeps an album other than General, and drops anything else', () => {
    expect(validatePatientImagesSearch({ album: 'lhr' })).toEqual({
      album: 'lhr',
      appointment: undefined,
    });
    expect(validatePatientImagesSearch({ album: 'general' }).album).toBeUndefined();
    expect(validatePatientImagesSearch({ album: 'secret' }).album).toBeUndefined();
  });

  it('keeps a visit filter that is a visit id or "none"', () => {
    expect(validatePatientImagesSearch({ appointment: VISIT }).appointment).toBe(VISIT);
    expect(validatePatientImagesSearch({ appointment: 'none' }).appointment).toBe('none');
    expect(
      validatePatientImagesSearch({ appointment: 'visit-1' }).appointment,
    ).toBeUndefined();
  });
});
