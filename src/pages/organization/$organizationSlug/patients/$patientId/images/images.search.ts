/**
 * URL search params of the Photos section (consumed by routeTree's
 * `validateSearch`; KICKOFF §6.6 Photos). This module rides the entry chunk,
 * so the albums are spelled here — `images.search.test.ts` pins them to the
 * API's `album` (`PATIENT_PHOTO_ALBUMS`).
 */
import { oneOf, PUBLIC_ID, textOf } from '@/lib/routes/search-params.ts';

/** The photo albums, in tab order. */
export const PHOTO_ALBUMS = ['general', 'private', 'lhr'] as const;

/** One album. */
export type PhotoAlbum = (typeof PHOTO_ALBUMS)[number];

/** The visit filter's "Not attached to a visit" (`NO_PHOTO_VISIT`, `has_appointment=false`). */
export const NO_VISIT = 'none';

/** How many photos a comparison takes (change-patient-overview-photos `BRIEF.md:32–46`). */
export const PHOTO_COMPARE = { min: 2, max: 8 } as const;

/** Validated `?…` params of the Photos section, and so of the viewer and Photo details. */
export interface PatientImagesSearch {
  /** The album on screen; General when absent. */
  album?: Exclude<PhotoAlbum, 'general'>;
  /** The visit filter: a visit's id (`appt_…`), or "none" — every photo of the album when absent. */
  appointment?: string;
  /** The comparison open over the section: 2–8 photo ids (`pimg_…`), comma-joined. */
  compare?: string;
}

/** The photos a `?compare=` names: distinct public ids, the first eight; none below two. */
export function compareIdsOf(value: unknown): string[] {
  const ids = [
    ...new Set(
      textOf(value)
        .split(',')
        .map((id) => id.trim())
        .filter((id) => PUBLIC_ID.test(id)),
    ),
  ].slice(0, PHOTO_COMPARE.max);
  return ids.length >= PHOTO_COMPARE.min ? ids : [];
}

/** Parse the Photos section's params; General, an unknown value and a comparison of fewer than two are dropped. */
export function validatePatientImagesSearch(
  search: Record<string, unknown>,
): PatientImagesSearch {
  const album = oneOf(PHOTO_ALBUMS, search.album);
  const visit = textOf(search.appointment);
  const compare = compareIdsOf(search.compare);
  return {
    album: album === 'general' ? undefined : album,
    appointment: visit === NO_VISIT || PUBLIC_ID.test(visit) ? visit : undefined,
    compare: compare.length > 0 ? compare.join(',') : undefined,
  };
}
