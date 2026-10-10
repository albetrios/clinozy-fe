import { z } from 'zod';

import type { ApiBody, ApiData } from '@/core/http/api.ts';
import type { operations } from '@/core/http/openapi-types.d.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

import { civilDateSchema } from './clinic-schema.ts';

/*
 * A patient's photos on clinozy-be (`/app/patients/:patient_id/images`, api-integration §5.4):
 * a photo is a stored file (`file_key`) filed in an album, with an optional stage, body part,
 * caption, visit (`appointment_id`, whose `service_label` the server joins) and treatment
 * session, taken on a civil day. A list page carries `meta.album_counts` — the live photos of
 * each album, the Private album only for a member who holds `patient:private_album:read`.
 * B1 (Q4): nothing turns a `file_key` into a URL, so a photo is shown by its name, never its
 * pixels.
 */

/** The albums, in tab order (`album`). */
export const PATIENT_PHOTO_ALBUMS = ['general', 'private', 'lhr'] as const;

/** One album. */
export type PatientPhotoAlbum = (typeof PATIENT_PHOTO_ALBUMS)[number];

/** Before or after a treatment (`stage`). */
export const PATIENT_PHOTO_STAGES = ['before', 'after'] as const;

/** One stage. */
export type PatientPhotoStage = (typeof PATIENT_PHOTO_STAGES)[number];

/** The fifteen body parts a photo can show (`body_part`; api-integration M33), as the API orders them. */
export const PATIENT_PHOTO_BODY_PARTS = [
  'face',
  'upper_lip',
  'chin',
  'neck',
  'scalp',
  'hair',
  'chest',
  'back',
  'underarm',
  'arms',
  'hands',
  'legs',
  'body',
  'full_body',
  'other',
] as const;

/** One body part. */
export type PatientPhotoBodyPart = (typeof PATIENT_PHOTO_BODY_PARTS)[number];

/** What clinozy-be files as a photo: a JPG or a PNG ("A photo is a JPG or PNG"). */
export const PATIENT_PHOTO_CONTENT_TYPES = ['image/jpeg', 'image/png'] as const;

/** The longest `display_name` the API takes. */
export const PATIENT_PHOTO_DISPLAY_NAME_MAX = 60;

/** The visit filter's "Not attached to a visit" (`has_appointment=false`). */
export const NO_PHOTO_VISIT = 'none';

/** One photo as the patient file reads it. */
export interface PatientPhoto {
  /** `pimg_…`. */
  id: string;
  patientId: string;
  /** The visit it was taken at (a checked-in or completed appointment), if any. */
  appointmentId: string | null;
  /** The treatment session it belongs to, if any. */
  patientTreatmentId: string | null;
  album: PatientPhotoAlbum;
  stage: PatientPhotoStage | null;
  /** The stored object's key — B1: there is no URL for it. */
  fileKey: string;
  /** The uploaded file's name, as the upload recorded it. */
  fileName: string;
  /** The name it was filed under (≤60). */
  displayName: string | null;
  caption: string | null;
  bodyPart: PatientPhotoBodyPart | null;
  /** The civil day it was taken, `YYYY-MM-DD`. */
  takenOn: string;
  /** Its visit's service, as the server joins it. */
  serviceLabel: string | null;
  createdAt: string;
  /** The read's stamp — a change sends it back as `expected_updated_at`. */
  updatedAt: string;
}

// ── The wire ──

type ApiPatientImage = NonNullable<
  ApiData<'/app/patients/{patient_id}/images/{patient_image_id}', 'get'>
>;
type ApiPatientImageRow = NonNullable<
  ApiData<'/app/patients/{patient_id}/images', 'get'>
>[number];

/** One photo as clinozy-be answers it — the same shape on the list, the read and each write. */
export const patientImageWire = wireSchema<ApiPatientImage>()(
  z.object({
    id: z.string(),
    patient_id: z.string(),
    appointment_id: z.string().nullable(),
    patient_treatment_id: z.string().nullable(),
    album: z.enum(PATIENT_PHOTO_ALBUMS),
    stage: z.enum(PATIENT_PHOTO_STAGES).nullable(),
    file_key: z.string(),
    file_name: z.string(),
    display_name: z.string().nullable(),
    caption: z.string().nullable(),
    body_part: z.enum(PATIENT_PHOTO_BODY_PARTS).nullable(),
    taken_on: civilDateSchema,
    service_label: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
);

/** A list row — checked against the list's own type too. */
export const patientImageRowWire = wireSchema<ApiPatientImageRow>()(patientImageWire);

/** The wire photo as the file reads it. */
export function toPatientPhoto(row: z.output<typeof patientImageWire>): PatientPhoto {
  return {
    id: row.id,
    patientId: row.patient_id,
    appointmentId: row.appointment_id,
    patientTreatmentId: row.patient_treatment_id,
    album: row.album,
    stage: row.stage,
    fileKey: row.file_key,
    fileName: row.file_name,
    displayName: row.display_name,
    caption: row.caption,
    bodyPart: row.body_part,
    takenOn: row.taken_on,
    serviceLabel: row.service_label,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The name a photo goes by: its caption, else the name it was filed under, else its file's. */
export function photoName(
  photo: Pick<PatientPhoto, 'caption' | 'displayName' | 'fileName'>,
): string {
  const named = [photo.caption, photo.displayName]
    .map((name) => name?.trim())
    .find(Boolean);
  return named ?? photo.fileName;
}

// ── The list ──

/** The list answer's `meta`, which `ApiData` (the `data` only) does not reach. */
type ApiPhotoListMeta = NonNullable<
  operations['getAppPatientsBypatient_idImages']['responses'][200]['content']['application/json']['meta']
>;
type ApiAlbumCounts = NonNullable<ApiPhotoListMeta['album_counts']>;

/** `meta.album_counts` — the Private album's count only for a member who may open it. */
const albumCountsWire = wireSchema<ApiAlbumCounts>()(
  z.object({
    general: z.number().int(),
    lhr: z.number().int(),
    private: z.number().int().optional(),
  }),
);

/**
 * The list answer's `meta` as the Photos read uses it: the album counts, when told (checked
 * against the API's type above; the rest of `meta` — `pagination`, `request_id` — is read
 * through the client's envelope).
 */
export const photoListMetaWire = z.object({ album_counts: albumCountsWire.optional() });

/** The live photos in each album, as the server counts them; `private` null when it is not told. */
export interface PatientPhotoAlbumCounts {
  general: number;
  lhr: number;
  private: number | null;
}

/** The wire counts as the tabs read them; null when the answer carries none. */
export function toAlbumCounts(
  meta: z.output<typeof photoListMetaWire>,
): PatientPhotoAlbumCounts | null {
  const counts = meta.album_counts;
  if (!counts) return null;
  return { general: counts.general, lhr: counts.lhr, private: counts.private ?? null };
}

/** What a photo read filters and orders by — every field optional; none is every photo, newest first. */
export interface PatientPhotoListParams {
  album?: PatientPhotoAlbum;
  /** A visit's id, or {@link NO_PHOTO_VISIT} for the photos filed under none. */
  appointmentId?: string;
  stage?: PatientPhotoStage;
  bodyPart?: PatientPhotoBodyPart;
  /** One treatment session's photos. */
  patientTreatmentId?: string;
  /** By the day taken (the default) or by when it was filed. */
  sort?: 'takenOn' | 'createdAt';
  order?: 'asc' | 'desc';
  /** The page's size (the API's default is 25, its most 100). */
  limit?: number;
}

/** The list read's query for the params, from the page after `after`. */
export function photoListQuery(params: PatientPhotoListParams, after?: string) {
  const none = params.appointmentId === NO_PHOTO_VISIT;
  return {
    album: params.album,
    appointment_id: none ? undefined : params.appointmentId,
    has_appointment: none ? ('false' as const) : undefined,
    stage: params.stage,
    body_part: params.bodyPart,
    patient_treatment_id: params.patientTreatmentId,
    sort: params.sort
      ? ({ takenOn: 'taken_on', createdAt: 'created_at' } as const)[params.sort]
      : undefined,
    order: params.order,
    limit: params.limit,
    after,
  };
}

/** One page of photos: its rows, the next cursor, the server's total and album counts. */
export interface PatientPhotoPage {
  rows: PatientPhoto[];
  /** The next page's cursor; null on the last. */
  next: string | null;
  hasMore: boolean;
  /** `meta.pagination.estimated_total` — the photos the params match; null when not told. */
  total: number | null;
  /** `meta.album_counts`; null when not told. */
  albumCounts: PatientPhotoAlbumCounts | null;
}

// ── Writes ──

/** What Photo details may change; a field left out is left as it is. */
export interface PatientPhotoChange {
  caption?: string | null;
  takenOn?: string;
  album?: PatientPhotoAlbum;
  stage?: PatientPhotoStage | null;
  bodyPart?: PatientPhotoBodyPart | null;
  appointmentId?: string | null;
}

/** A change as `PATCH /app/patients/:patient_id/images/:patient_image_id` takes it. */
export type ApiPatientImageChange = ApiBody<
  '/app/patients/{patient_id}/images/{patient_image_id}',
  'patch'
>;

/** The change's body, carrying the read's `updated_at` (`409 record_changed` when it moved since). */
export function photoChangeBodyOf(
  change: PatientPhotoChange,
  expectedUpdatedAt: string,
): ApiPatientImageChange {
  return {
    caption: change.caption,
    taken_on: change.takenOn,
    album: change.album,
    stage: change.stage,
    body_part: change.bodyPart,
    appointment_id: change.appointmentId,
    expected_updated_at: expectedUpdatedAt,
  };
}
