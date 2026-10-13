import type { AppointmentStatus } from '@/shared/api/app/app-schema.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import type {
  PatientPhoto,
  PatientPhotoListParams,
} from '@/shared/api/app/patient-images-contracts.ts';

import { NO_VISIT, type PhotoAlbum } from '../images.search.ts';

/** Photos a page reads — "Load more" reads as many again (`patient-file.md:67`). */
export const PHOTOS_PAGE = 12;

/**
 * The read of an album under the visit filter (`?album=&appointment=`), a page of 12: the
 * section and the viewer ask for exactly this, so they share one cached list.
 */
export function photoListParamsOf(
  album: PhotoAlbum,
  appointment: string | undefined,
): PatientPhotoListParams {
  return appointment === undefined
    ? { album, limit: PHOTOS_PAGE }
    : { album, appointmentId: appointment, limit: PHOTOS_PAGE };
}

/** Whether the visit filter keeps a photo: every photo, those under no visit, or one visit's. */
export function photoMatchesVisit(
  photo: Pick<PatientPhoto, 'appointmentId'>,
  appointment: string | undefined,
): boolean {
  if (appointment === undefined) return true;
  if (appointment === NO_VISIT) return photo.appointmentId === null;
  return photo.appointmentId === appointment;
}

/** One day of photos: the day, its photos, and the service of the visit its first is filed under. */
export interface PhotoDay {
  /** The civil date, `YYYY-MM-DD`. */
  date: string;
  photos: PatientPhoto[];
  /** The server's `service_label` of the first photo's visit; null under no visit. */
  serviceLabel: string | null;
}

/** The photos grouped by the day they were taken, in the read's order (H:4789 `gMap`). */
export function photoDays(photos: readonly PatientPhoto[]): PhotoDay[] {
  const days = new Map<string, PatientPhoto[]>();
  for (const photo of photos) {
    const day = days.get(photo.takenOn);
    if (day) day.push(photo);
    else days.set(photo.takenOn, [photo]);
  }
  return [...days].map(([date, dayPhotos]) => ({
    date,
    photos: dayPhotos,
    serviceLabel: dayPhotos[0]?.serviceLabel ?? null,
  }));
}

/** A visit a photo can be filed under, as the visit filter and Photo details name it. */
export interface PhotoVisit {
  appointmentId: string;
  /** "#2790". */
  seq: number;
  /** The visit's civil date, `YYYY-MM-DD`. */
  date: string;
  serviceLabel: string;
  status: AppointmentStatus;
}

/** The statuses the API files a photo under: a visit the patient came to. */
const PHOTO_VISIT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'checked_in',
  'completed',
]);

/**
 * The visits a photo can be filed under (H:4766 `visitDD`): the patient's own bookings that
 * were checked in or completed — the API refuses any other — latest first.
 */
export function photoVisitsOf(
  appointments: readonly AppointmentRow[],
  patientId: string,
): PhotoVisit[] {
  return appointments
    .filter(
      (appointment) =>
        appointment.patientId === patientId &&
        PHOTO_VISIT_STATUSES.has(appointment.status),
    )
    .sort(
      (a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime),
    )
    .map((appointment) => ({
      appointmentId: appointment.id,
      seq: appointment.seq,
      date: appointment.date,
      serviceLabel: appointment.serviceLabel,
      status: appointment.status,
    }));
}

/**
 * The photo `step` places from `id` among the photos read so far, wrapping at the ends only
 * when every page is read (`complete`); none when the photo is not among them or the step runs
 * past the photos read (the next page has them).
 */
export function photoAt(
  list: readonly PatientPhoto[],
  id: string,
  step: 1 | -1,
  complete: boolean,
): PatientPhoto | null {
  const index = list.findIndex((photo) => photo.id === id);
  if (index < 0) return null;
  const next = index + step;
  if (next >= 0 && next < list.length) return list[next] ?? null;
  if (!complete) return null;
  return list[(next + list.length) % list.length] ?? null;
}
