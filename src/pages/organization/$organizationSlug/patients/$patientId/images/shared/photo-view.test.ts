import { describe, expect, it } from 'vitest';

import type {
  PatientPhoto,
  PatientPhotoVisit,
} from '@/shared/api/clinic/patient-images-api.ts';

import { photoAt, photoDays, photosInView, visitsWithPhotos } from './photo-view.ts';

const VISIT: PatientPhotoVisit = {
  appointmentId: '00000000-0000-4000-8000-000000002790',
  seq: 2790,
  date: '2026-09-24',
  serviceLabel: 'Hydrafacial',
  status: 'completed',
};

function photo(id: string, fields: Partial<PatientPhoto> = {}): PatientPhoto {
  return {
    id,
    organizationId: 'org',
    createdAt: '2026-09-24T06:30:00.000Z',
    updatedAt: '2026-09-24T06:30:00.000Z',
    createdById: 'user',
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
    patientId: 'patient',
    appointmentId: null,
    album: 'general',
    fileUrl: 'https://files.example/a.jpg',
    fileName: id,
    bodyPart: null,
    takenOn: '2026-09-24',
    caption: null,
    visit: null,
    ...fields,
  };
}

const FILED = { appointmentId: VISIT.appointmentId, visit: VISIT };
const PHOTOS = [
  photo('a', FILED),
  photo('b', { ...FILED, album: 'lhr' }),
  photo('c', { takenOn: '2026-09-20' }),
  photo('d', { ...FILED, takenOn: '2026-09-20' }),
];

describe('photosInView', () => {
  it('keeps an album’s photos, all of them, those under no visit, or one visit’s', () => {
    expect(photosInView(PHOTOS, 'general', undefined).map((p) => p.id)).toEqual([
      'a',
      'c',
      'd',
    ]);
    expect(photosInView(PHOTOS, 'general', 'none').map((p) => p.id)).toEqual(['c']);
    expect(photosInView(PHOTOS, 'general', VISIT.appointmentId).map((p) => p.id)).toEqual(
      ['a', 'd'],
    );
    expect(photosInView(PHOTOS, 'private', undefined)).toEqual([]);
  });
});

describe('photoDays', () => {
  it('groups photos by the day they were taken, with the first one’s visit', () => {
    const days = photoDays(photosInView(PHOTOS, 'general', undefined));
    expect(days.map((day) => [day.date, day.photos.map((p) => p.id)])).toEqual([
      ['2026-09-24', ['a']],
      ['2026-09-20', ['c', 'd']],
    ]);
    expect(days[0]?.visit).toBe(VISIT);
    expect(days[1]?.visit).toBeNull();
  });
});

describe('visitsWithPhotos', () => {
  it('offers the visits that hold a photo, with their counts', () => {
    const other = { ...VISIT, appointmentId: 'other', seq: 2800 };
    expect(visitsWithPhotos([other, VISIT], PHOTOS)).toEqual([
      { visit: VISIT, count: 3 },
    ]);
  });
});

describe('photoAt', () => {
  it('steps through the list, wrapping at both ends', () => {
    const list = photosInView(PHOTOS, 'general', undefined);
    expect(photoAt(list, 'a', 1)?.id).toBe('c');
    expect(photoAt(list, 'd', 1)?.id).toBe('a');
    expect(photoAt(list, 'a', -1)?.id).toBe('d');
    expect(photoAt(list, 'missing', 1)).toBeNull();
  });
});
