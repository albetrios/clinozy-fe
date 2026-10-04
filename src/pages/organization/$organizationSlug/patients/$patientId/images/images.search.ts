/**
 * URL search params of the Photos section (consumed by routeTree's
 * `validateSearch`; KICKOFF §6.6 Photos). This module rides the entry chunk,
 * so the albums are spelled here — `images.search.test.ts` pins them to the
 * contract's `image_album`.
 */
import { oneOf, RECORD_ID, textOf } from '@/lib/routes/search-params.ts';

/** The photo albums, in tab order. */
export const PHOTO_ALBUMS = ['general', 'private', 'lhr'] as const;

/** One album. */
export type PhotoAlbum = (typeof PHOTO_ALBUMS)[number];

/** The visit filter's "Not attached to a visit". */
export const NO_VISIT = 'none';

/** Validated `?…` params of the Photos section, and so of the viewer and Photo details. */
export interface PatientImagesSearch {
  /** The album on screen; General when absent. */
  album?: Exclude<PhotoAlbum, 'general'>;
  /** The visit filter: a visit's id, or "none" — every photo of the album when absent. */
  appointment?: string;
}

/** Parse the Photos section's params; General and an unknown value are dropped. */
export function validatePatientImagesSearch(
  search: Record<string, unknown>,
): PatientImagesSearch {
  const album = oneOf(PHOTO_ALBUMS, search.album);
  const visit = textOf(search.appointment);
  return {
    album: album === 'general' ? undefined : album,
    appointment: visit === NO_VISIT || RECORD_ID.test(visit) ? visit : undefined,
  };
}
