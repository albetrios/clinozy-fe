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

/** Validated `?…` params of the Photos section, and so of the viewer and Photo details. */
export interface PatientImagesSearch {
  /** The album on screen; General when absent. */
  album?: Exclude<PhotoAlbum, 'general'>;
  /** The visit filter: a visit's id (`appt_…`), or "none" — every photo of the album when absent. */
  appointment?: string;
  /**
   * The comparison open over the section: photo ids (`pimg_…`), comma-joined. Typed
   * here and not parsed: this module rides the entry chunk, and the router passes an
   * unvalidated param through (`search.strict` is off), so the page reads it with
   * `compareIdsOf` (`shared/photo-compare.ts`), which takes any value.
   */
  compare?: string;
}

/** Parse the Photos section's params; General and an unknown value are dropped. */
export function validatePatientImagesSearch(
  search: Record<string, unknown>,
): PatientImagesSearch {
  const album = oneOf(PHOTO_ALBUMS, search.album);
  const visit = textOf(search.appointment);
  return {
    album: album === 'general' ? undefined : album,
    appointment: visit === NO_VISIT || PUBLIC_ID.test(visit) ? visit : undefined,
  };
}
