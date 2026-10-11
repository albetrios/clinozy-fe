import { z } from 'zod';

import { api } from '@/core/http/api.ts';

import type { DeleteReason } from './clinic-schema.ts';
import {
  PATIENT_PHOTO_DISPLAY_NAME_MAX,
  patientImageRowWire,
  patientImageWire,
  type PatientPhoto,
  type PatientPhotoAlbum,
  type PatientPhotoChange,
  type PatientPhotoListParams,
  type PatientPhotoPage,
  photoChangeBodyOf,
  photoListMetaWire,
  photoListQuery,
  toAlbumCounts,
  toPatientPhoto,
} from './patient-images-contracts.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * A patient's photos on clinozy-be (`/app/patients/:patient_id/images`, api-integration §5.4):
 * a page of the list for its filters, with the server's total and album counts; one photo; an
 * attach of an uploaded file; a change carrying the read's `updated_at`; delete with its reason
 * and restore. Every write carries the action's key. Each photo carries its 15-minute `file_url`
 * (D86).
 */

/**
 * TanStack Query keys for the photos — under the patients' key, so a patient write refreshes
 * them; each carries the organization and the patient.
 */
export const patientImageQueryKeys = {
  all: [...patientQueryKeys.all, 'images'] as const,
  /** Everything of one patient's photos — a photo write invalidates it. */
  patient: (organizationId: string | null, patientId: string) =>
    [...patientImageQueryKeys.all, organizationId, patientId] as const,
  list: (
    organizationId: string | null,
    patientId: string,
    params: PatientPhotoListParams,
  ) =>
    [
      ...patientImageQueryKeys.patient(organizationId, patientId),
      'list',
      params,
    ] as const,
  detail: (organizationId: string | null, patientId: string, imageId: string) =>
    [
      ...patientImageQueryKeys.patient(organizationId, patientId),
      'detail',
      imageId,
    ] as const,
};

/** One page of the patient's photos for the params; `after` is the cursor. */
export async function listPatientPhotos(
  patientId: string,
  params: PatientPhotoListParams,
  after?: string,
): Promise<PatientPhotoPage> {
  const response = await api.get('/app/patients/{patient_id}/images', {
    params: { patient_id: patientId },
    query: photoListQuery(params, after),
  });
  const rows = z.array(patientImageRowWire).parse(response.data ?? []);
  const pagination = response.meta?.pagination;
  const meta = photoListMetaWire.safeParse(response.meta ?? {});
  return {
    rows: rows.map(toPatientPhoto),
    next: pagination?.has_more ? (pagination.next ?? null) : null,
    hasMore: pagination?.has_more === true && Boolean(pagination.next),
    total: pagination?.estimated_total ?? null,
    albumCounts: meta.success ? toAlbumCounts(meta.data) : null,
  };
}

/** One photo — a 404 when it is deleted, unknown, or in an album the member may not open. */
export async function fetchPatientPhoto({
  patientId,
  imageId,
}: {
  patientId: string;
  imageId: string;
}): Promise<PatientPhoto> {
  const response = await api.get('/app/patients/{patient_id}/images/{patient_image_id}', {
    params: { patient_id: patientId, patient_image_id: imageId },
  });
  return toPatientPhoto(patientImageWire.parse(response.data));
}

/** "IMG_5100.jpg" → "IMG_5100", cut to the API's 60: the name a new photo is filed under. */
function displayNameOf(fileName: string): string {
  const bare = fileName.replace(/\.[a-z0-9]+$/i, '') || fileName;
  return bare.slice(0, PATIENT_PHOTO_DISPLAY_NAME_MAX);
}

/**
 * File an uploaded photo on a patient (`POST /app/patients/:patient_id/images`) — the storage
 * key the upload tray confirmed, into an album (General unless told), named as the file was
 * (without its extension), taken today (the server's default). One photo per call; its key is
 * the stored object's, so a retried attach files it once. The server takes a JPG or PNG only.
 */
export async function attachPatientImage({
  patientId,
  fileKey,
  fileName,
  album = 'general',
  appointmentId,
}: {
  patientId: string;
  fileKey: string;
  /** The file's name as it was picked. */
  fileName: string;
  album?: PatientPhotoAlbum;
  /** The visit the photo was taken at (checked in or completed). */
  appointmentId?: string;
}): Promise<PatientPhoto> {
  const response = await api.post('/app/patients/{patient_id}/images', {
    params: { patient_id: patientId },
    body: {
      file_key: fileKey,
      album,
      display_name: displayNameOf(fileName),
      appointment_id: appointmentId,
    },
    idempotencyKey: `image:${fileKey}`,
  });
  return toPatientPhoto(patientImageWire.parse(response.data));
}

/**
 * Save Photo details (`PATCH …/images/:patient_image_id`) — only what changed, with the read's
 * `updated_at`: `409 record_changed` when someone saved it since. A visit must be one of the
 * patient's, checked in or completed; the date taken can't be in the future (400 on the field).
 */
export async function updatePatientPhoto({
  photo,
  change,
  idempotencyKey,
}: {
  photo: PatientPhoto;
  change: PatientPhotoChange;
  idempotencyKey: string;
}): Promise<PatientPhoto> {
  const response = await api.patch(
    '/app/patients/{patient_id}/images/{patient_image_id}',
    {
      params: { patient_id: photo.patientId, patient_image_id: photo.id },
      body: photoChangeBodyOf(change, photo.updatedAt),
      idempotencyKey,
    },
  );
  return toPatientPhoto(patientImageWire.parse(response.data));
}

/** Delete a photo with the confirm's reason (restorable — "Photo deleted" offers Undo). */
export async function deletePatientPhoto({
  patientId,
  imageId,
  reason,
  note,
}: {
  patientId: string;
  imageId: string;
  reason: DeleteReason;
  note: string | null;
}): Promise<void> {
  await api.delete('/app/patients/{patient_id}/images/{patient_image_id}', {
    params: { patient_id: patientId, patient_image_id: imageId },
    reason,
    note: note ?? undefined,
  });
}

/** Put a deleted photo back — the Undo of "Photo deleted" (`409 record_not_deleted` when it is not). */
export async function restorePatientPhoto({
  patientId,
  imageId,
  idempotencyKey,
}: {
  patientId: string;
  imageId: string;
  idempotencyKey: string;
}): Promise<PatientPhoto> {
  const response = await api.post(
    '/app/patients/{patient_id}/images/{patient_image_id}/restore',
    { params: { patient_id: patientId, patient_image_id: imageId }, idempotencyKey },
  );
  return toPatientPhoto(patientImageWire.parse(response.data));
}
