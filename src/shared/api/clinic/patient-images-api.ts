import { z } from 'zod';

import {
  clinicHttpError,
  definedFields,
  validateClinicInput,
} from './clinic-fixture-store.ts';
import {
  type AppointmentStatus,
  bodyPartSchema,
  civilDateSchema,
  type DeleteReason,
  imageAlbumSchema,
  type PatientImage,
} from './clinic-schema.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * A patient's photos (`listImages` / `updateImage`, `S:1632, 1643`), on the
 * fixture world until clinozy-be serves them — every call is REPLACE_WITH_API
 * (D6). The contract pages an album by 60; "Load more · 4 left" and the counts
 * need per-album totals (a backend request, KICKOFF §6.6), so the build reads
 * the patient's photos at once and reveals them 12 at a time.
 */

/** TanStack Query keys of the photos — under the patients key, so a patient write refreshes them. */
export const patientImageQueryKeys = {
  all: [...patientQueryKeys.all, 'images'] as const,
  list: (patientId: string, privateAlbum: boolean) =>
    [...patientImageQueryKeys.all, patientId, { privateAlbum }] as const,
};

/** A visit a photo can be filed under — the patient's appointment, as the Photos filter and Photo details name it. */
export interface PatientPhotoVisit {
  appointmentId: string;
  seq: number;
  /** The visit's civil date, `YYYY-MM-DD`. */
  date: string;
  serviceLabel: string;
  status: AppointmentStatus;
}

/** One photo as the Photos section reads it: the contract's image and the visit it is filed under. */
export interface PatientPhoto extends PatientImage {
  visit: PatientPhotoVisit | null;
}

/** A patient's photos, newest first, and their visits, latest first (derived display, `S:432`). */
export interface PatientPhotos {
  photos: PatientPhoto[];
  visits: PatientPhotoVisit[];
}

/** The name a photo goes by: its caption, else its file name (`S:429–432`). */
export function photoName(photo: Pick<PatientImage, 'caption' | 'fileName'>): string {
  return (photo.caption?.trim() ?? '') || photo.fileName;
}

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** Newest photo first: by the day it was taken, then by when it was filed. */
const byTakenDesc = (a: PatientImage, b: PatientImage) =>
  b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt);

/**
 * A patient's photos and their visits (`listImages`, `S:1632`; REPLACE_WITH_API).
 * Without the Private album (Doctor and Admin only, `S:40`) its photos are
 * left out, as the server will leave them out. A deleted or unknown patient
 * answers 404.
 */
export async function listPatientPhotos(
  patientId: string,
  { privateAlbum }: { privateAlbum: boolean },
): Promise<PatientPhotos> {
  const { clinicFixtures } = await fixtureWorld();
  await clinicFixtures.patients.get(patientId);
  const visits = clinicFixtures.appointments
    .snapshot((appointment) => appointment.patientId === patientId)
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    )
    .map((appointment): PatientPhotoVisit => ({
      appointmentId: appointment.id,
      seq: appointment.seq,
      date: appointment.date,
      serviceLabel: appointment.serviceLabel,
      status: appointment.status,
    }));
  const visitOf = new Map(visits.map((visit) => [visit.appointmentId, visit]));
  const photos = clinicFixtures.patientImages
    .snapshot(
      (image) =>
        image.patientId === patientId && (privateAlbum || image.album !== 'private'),
    )
    .sort(byTakenDesc)
    .map((image) => ({
      ...image,
      visit: image.appointmentId ? (visitOf.get(image.appointmentId) ?? null) : null,
    }));
  return { photos, visits };
}

/** What Photo details may change (`updateImage`, `S:1643`): blank fields are left out. */
const patientPhotoPatchSchema = z
  .object({
    /** Shown over the file name; at most 60 in the drawer (the contract allows 200). */
    caption: z.string().trim().min(1).max(60),
    takenOn: civilDateSchema,
    album: imageAlbumSchema,
    bodyPart: bodyPartSchema.nullable(),
    appointmentId: z.uuid().nullable(),
  })
  .partial();
/** A Photo details save. */
export type PatientPhotoPatch = z.infer<typeof patientPhotoPatchSchema>;

/**
 * Save Photo details (`updateImage`, `S:1643`; REPLACE_WITH_API). A visit
 * must be this patient's; an unknown photo answers 404.
 */
export async function updatePatientPhoto(
  id: string,
  patch: PatientPhotoPatch,
): Promise<PatientImage> {
  const fields = validateClinicInput(patientPhotoPatchSchema, definedFields(patch));
  const { clinicFixtures } = await fixtureWorld();
  const photo = await clinicFixtures.patientImages.get(id);
  if (fields.appointmentId) {
    const [visit] = clinicFixtures.appointments.snapshot(
      (appointment) => appointment.id === fields.appointmentId,
    );
    if (visit?.patientId !== photo.patientId) {
      throw clinicHttpError(422, 'validation', 'Pick one of this patient’s visits', {
        appointmentId: ['Pick one of this patient’s visits'],
      });
    }
  }
  return clinicFixtures.patientImages.update(id, fields);
}

/** Delete a photo with the confirm's reason (`S:1490–1496`; REPLACE_WITH_API). */
export async function deletePatientPhoto(
  id: string,
  reason: DeleteReason,
  note: string | null,
): Promise<PatientImage> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientImages.remove(id, reason, note);
}

/** Put a deleted photo back — the Undo of "Photo deleted" (D32; REPLACE_WITH_API). */
export async function restorePatientPhoto(id: string): Promise<PatientImage> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientImages.restore(id);
}
