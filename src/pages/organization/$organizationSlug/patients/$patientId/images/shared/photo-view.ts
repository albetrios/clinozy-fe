import type {
  PatientPhoto,
  PatientPhotoVisit,
} from '@/shared/api/clinic/patient-images-api.ts';

import { NO_VISIT, type PhotoAlbum } from '../images.search.ts';

/** Photos an album reveals at a time — "Load more" adds as many (`patient-file.md:67`). */
export const PHOTOS_PAGE = 12;

/**
 * The photos an album shows under the visit filter, in the read's order
 * (newest first): every photo (no filter), those under no visit
 * (`none`), or one visit's.
 */
export function photosInView(
  photos: readonly PatientPhoto[],
  album: PhotoAlbum,
  appointment: string | undefined,
): PatientPhoto[] {
  return photos.filter((photo) => {
    if (photo.album !== album) return false;
    if (appointment === undefined) return true;
    if (appointment === NO_VISIT) return photo.appointmentId === null;
    return photo.appointmentId === appointment;
  });
}

/** One day of photos: the day, its photos, and the visit its first photo is filed under. */
export interface PhotoDay {
  /** The civil date, `YYYY-MM-DD`. */
  date: string;
  photos: PatientPhoto[];
  visit: PatientPhotoVisit | null;
}

/** The photos grouped by the day they were taken, newest day first (H:4789 `gMap`). */
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
    visit: dayPhotos[0]?.visit ?? null,
  }));
}

/** A visit the filter offers, with how many photos it holds. */
export interface PhotoVisitOption {
  visit: PatientPhotoVisit;
  count: number;
}

/**
 * The visits the filter offers (H:4766 `visitDD`): the patient's visits that
 * hold a photo in any album the member sees, latest first, each with its
 * photo count.
 */
export function visitsWithPhotos(
  visits: readonly PatientPhotoVisit[],
  photos: readonly PatientPhoto[],
): PhotoVisitOption[] {
  return visits.flatMap((visit) => {
    const count = photos.filter(
      (photo) => photo.appointmentId === visit.appointmentId,
    ).length;
    return count > 0 ? [{ visit, count }] : [];
  });
}

/**
 * The photo `step` places from `id` in the list, wrapping at both ends
 * (H:4785 `goLb`); none when the photo is not in it.
 */
export function photoAt(
  list: readonly PatientPhoto[],
  id: string,
  step: number,
): PatientPhoto | null {
  const index = list.findIndex((photo) => photo.id === id);
  if (index < 0 || list.length === 0) return null;
  return list[(index + step + list.length * Math.abs(step)) % list.length] ?? null;
}
