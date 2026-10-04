import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { patientRef } from './fixtures/patients.fixtures.ts';
import { clinicFixtures, resetClinicFixtures } from './fixtures/world.fixtures.ts';
import {
  deletePatientPhoto,
  listPatientPhotos,
  patientImageQueryKeys,
  photoName,
  restorePatientPhoto,
  updatePatientPhoto,
} from './patient-images-api.ts';
import { patientQueryKeys } from './patients-api.ts';

const DHARTI = patientRef('Dharti Galani');
const VARUN = patientRef('Varun Bhimani');

beforeEach(() => resetClinicFixtures());
afterEach(() => resetClinicFixtures());

describe('patient photos (S:1632, 1643)', () => {
  it('sits under the patients key, so a patient write refreshes the photos', () => {
    expect(patientImageQueryKeys.list(DHARTI, true).slice(0, 2)).toEqual([
      ...patientQueryKeys.all,
    ]);
  });

  it('reads a patient’s photos newest first, each with the visit it is filed under', async () => {
    const { photos, visits } = await listPatientPhotos(VARUN, { privateAlbum: true });
    expect(photos).toHaveLength(6);
    expect(photos.map((photo) => photo.takenOn)).toEqual(
      [...photos.map((photo) => photo.takenOn)].sort().reverse(),
    );
    const filed = photos.find((photo) => photo.appointmentId !== null);
    expect(filed?.visit).toMatchObject({ appointmentId: filed?.appointmentId });
    expect(filed?.visit?.serviceLabel).toBeTruthy();
    expect(visits.map((visit) => visit.date)).toEqual(
      [...visits.map((visit) => visit.date)].sort().reverse(),
    );
  });

  it('leaves the Private album out for a member who can’t open it (S:40)', async () => {
    const all = await listPatientPhotos(DHARTI, { privateAlbum: true });
    const open = await listPatientPhotos(DHARTI, { privateAlbum: false });
    expect(all.photos.map((photo) => photo.album).sort()).toEqual([
      'general',
      'lhr',
      'private',
    ]);
    expect(open.photos.map((photo) => photo.album)).not.toContain('private');
  });

  it('names a photo by its caption, else its file name', () => {
    expect(photoName({ caption: 'Left cheek', fileName: 'IMG_1' })).toBe('Left cheek');
    expect(photoName({ caption: '  ', fileName: 'IMG_1' })).toBe('IMG_1');
    expect(photoName({ caption: null, fileName: 'IMG_1' })).toBe('IMG_1');
  });

  it('saves Photo details, refusing a visit of another patient', async () => {
    const { photos, visits } = await listPatientPhotos(DHARTI, { privateAlbum: true });
    const photo = photos[0];
    if (!photo) throw new Error('no photo');
    const saved = await updatePatientPhoto(photo.id, {
      caption: 'Left cheek before peel',
      album: 'lhr',
      bodyPart: 'face',
      appointmentId: visits[0]?.appointmentId ?? null,
      takenOn: '2026-09-20',
    });
    expect(saved).toMatchObject({
      caption: 'Left cheek before peel',
      album: 'lhr',
      takenOn: '2026-09-20',
    });
    const [otherVisit] = clinicFixtures.appointments.snapshot(
      (appointment) => appointment.patientId === VARUN,
    );
    await expect(
      updatePatientPhoto(photo.id, { appointmentId: otherVisit?.id ?? null }),
    ).rejects.toMatchObject({ status: 422 });
    await expect(
      updatePatientPhoto(photo.id, { caption: 'x'.repeat(61) }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('deletes a photo with its reason and puts it back', async () => {
    const { photos } = await listPatientPhotos(DHARTI, { privateAlbum: true });
    const photo = photos[0];
    if (!photo) throw new Error('no photo');
    await deletePatientPhoto(photo.id, 'other', 'Blurry / retake');
    expect(
      (await listPatientPhotos(DHARTI, { privateAlbum: true })).photos.map((p) => p.id),
    ).not.toContain(photo.id);
    await restorePatientPhoto(photo.id);
    expect(
      (await listPatientPhotos(DHARTI, { privateAlbum: true })).photos.map((p) => p.id),
    ).toContain(photo.id);
  });

  it('answers 404 for an unknown patient', async () => {
    await expect(
      listPatientPhotos('00000000-0000-4000-8000-000000000000', { privateAlbum: true }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
