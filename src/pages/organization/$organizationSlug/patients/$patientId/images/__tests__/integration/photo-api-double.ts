/**
 * The Photos tests' clinozy-be: `patient-images-api.ts` over an in-memory set of photos — the
 * list with its filters, cursor pages, total and album counts as the API answers them, one
 * photo (a 404 when gone), Photo details' change (a stale `expected_updated_at` is a `409
 * record_changed`), delete and restore. A suite swaps it in with `vi.mock` and seeds it with
 * {@link seedPhotos}; it never imports a component, so the mock factory can load it.
 */
import {
  NO_PHOTO_VISIT,
  type PatientPhoto,
  type PatientPhotoAlbumCounts,
  type PatientPhotoChange,
  type PatientPhotoListParams,
  type PatientPhotoPage,
} from '@/shared/api/app/patient-images-contracts.ts';
import { HttpError } from '@/shared/errors/HttpError.ts';

/** The patient the photos belong to (the shared `patientFile()` double's). */
export const PHOTO_PATIENT_ID = 'pat_priya0000000000000000';

/** A checked-in visit photos can be filed under. */
export const PHOTO_VISIT_ID = 'appt_hydra000000000000000';

/** One photo as the API answers it — IMG_5100 in General, taken 24 Sep, no visit. */
export function photoDouble(overrides: Partial<PatientPhoto> = {}): PatientPhoto {
  return {
    id: 'pimg_photo0000000000000000',
    patientId: PHOTO_PATIENT_ID,
    appointmentId: null,
    patientTreatmentId: null,
    album: 'general',
    stage: null,
    fileKey: 'organization-files/org_test/img-5100.png',
    fileName: 'IMG_5100.png',
    fileUrl:
      'https://uploads.test/organization-files/org_test/img-5100.png?X-Amz-Expires=900',
    thumbnailUrl:
      'https://uploads.test/organization-files/org_test/img-5100.thumb.webp?X-Amz-Expires=900',
    displayName: 'IMG_5100',
    caption: null,
    bodyPart: null,
    takenOn: '2026-09-24',
    serviceLabel: null,
    createdAt: '2026-09-24T06:30:00.000Z',
    updatedAt: '2026-09-24T06:30:00.000Z',
    ...overrides,
  };
}

interface StoredPhoto {
  photo: PatientPhoto;
  deleted: { reason: string; note: string | null } | null;
}

let stored: StoredPhoto[] = [];
let clock = 0;

/** Put the store back to these photos (none deleted). */
export function seedPhotos(photos: readonly PatientPhoto[]): void {
  stored = photos.map((photo) => ({ photo: { ...photo }, deleted: null }));
  clock = 0;
}

/** The store as it stands: every photo with its delete, if any. */
export function storedPhotos(): readonly StoredPhoto[] {
  return stored;
}

const notFound = () =>
  new HttpError('Patient image not found', 404, '/app/patients/images', 'GET', {
    error: {
      type: 'request_error',
      code: 'not_found',
      detail: 'Patient image not found',
    },
  });

function live(patientId: string, imageId: string): StoredPhoto {
  const row = stored.find(
    (entry) =>
      entry.photo.id === imageId &&
      entry.photo.patientId === patientId &&
      entry.deleted === null,
  );
  if (!row) throw notFound();
  return row;
}

function matches(photo: PatientPhoto, params: PatientPhotoListParams): boolean {
  if (params.album && photo.album !== params.album) return false;
  if (params.appointmentId === NO_PHOTO_VISIT && photo.appointmentId !== null) {
    return false;
  }
  if (
    params.appointmentId &&
    params.appointmentId !== NO_PHOTO_VISIT &&
    photo.appointmentId !== params.appointmentId
  ) {
    return false;
  }
  if (params.stage && photo.stage !== params.stage) return false;
  if (params.bodyPart && photo.bodyPart !== params.bodyPart) return false;
  return !(
    params.patientTreatmentId && photo.patientTreatmentId !== params.patientTreatmentId
  );
}

/** `listPatientPhotos`: the filtered photos newest first, `limit` a page (25 by default). */
export async function listPatientPhotos(
  patientId: string,
  params: PatientPhotoListParams,
  after?: string,
): Promise<PatientPhotoPage> {
  const mine = stored.filter(
    (entry) => entry.photo.patientId === patientId && entry.deleted === null,
  );
  const rows = mine
    .map((entry) => entry.photo)
    .filter((photo) => matches(photo, params))
    .sort(
      (a, b) =>
        b.takenOn.localeCompare(a.takenOn) || b.createdAt.localeCompare(a.createdAt),
    );
  const start = after ? Number(after) : 0;
  const size = params.limit ?? 25;
  const page = rows.slice(start, start + size);
  const more = start + size < rows.length;
  const count = (album: PatientPhoto['album']) =>
    mine.filter((entry) => entry.photo.album === album).length;
  const albumCounts: PatientPhotoAlbumCounts = {
    general: count('general'),
    lhr: count('lhr'),
    private: count('private'),
  };
  return {
    rows: page.map((photo) => ({ ...photo })),
    next: more ? String(start + size) : null,
    hasMore: more,
    total: rows.length,
    albumCounts,
  };
}

/** `fetchPatientPhoto`: one live photo, else a 404. */
export async function fetchPatientPhoto({
  patientId,
  imageId,
}: {
  patientId: string;
  imageId: string;
}): Promise<PatientPhoto> {
  return { ...live(patientId, imageId).photo };
}

/** `updatePatientPhoto`: what changed, refused with `409 record_changed` on a stale read. */
export async function updatePatientPhoto({
  photo,
  change,
}: {
  photo: PatientPhoto;
  change: PatientPhotoChange;
  idempotencyKey: string;
}): Promise<PatientPhoto> {
  const row = live(photo.patientId, photo.id);
  if (row.photo.updatedAt !== photo.updatedAt) {
    throw new HttpError('Conflict', 409, '/app/patients/images', 'PATCH', {
      error: {
        type: 'request_error',
        code: 'conflict',
        reason: 'record_changed',
        detail: 'This record was changed — reload and try again',
      },
    });
  }
  clock += 1;
  const defined = Object.fromEntries(
    Object.entries(change).filter(([, value]) => value !== undefined),
  ) as Partial<PatientPhoto>;
  row.photo = {
    ...row.photo,
    ...defined,
    updatedAt: `2026-10-0${Math.min(clock, 9)}T08:00:00.000Z`,
  };
  return { ...row.photo };
}

/** `deletePatientPhoto`: the photo leaves every read, its reason kept. */
export async function deletePatientPhoto({
  patientId,
  imageId,
  reason,
  note,
}: {
  patientId: string;
  imageId: string;
  reason: string;
  note: string | null;
}): Promise<void> {
  live(patientId, imageId).deleted = { reason, note };
}

/** `restorePatientPhoto`: a deleted photo comes back. */
export async function restorePatientPhoto({
  patientId,
  imageId,
}: {
  patientId: string;
  imageId: string;
  idempotencyKey: string;
}): Promise<PatientPhoto> {
  const row = stored.find(
    (entry) => entry.photo.id === imageId && entry.photo.patientId === patientId,
  );
  if (!row) throw notFound();
  row.deleted = null;
  return { ...row.photo };
}
