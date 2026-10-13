/**
 * URL search params of the patient file (consumed by routeTree's
 * `validateSearch`; KICKOFF §6.6, §4). This module rides the entry chunk, so
 * it is the shared readers and the file's literals — nothing else; the file's
 * dialog routes' params are `patient-id.dialog-search.ts`'s.
 */
import { oneOf } from '@/lib/routes/search-params.ts';

/** The Activity column in a link: open or closed (D19 › Activity default). */
const PATIENT_FILE_ACTIVITY = ['open', 'closed'] as const;

/** One Activity state a link can carry. */
export type PatientFileActivity = (typeof PATIENT_FILE_ACTIVITY)[number];

/** The visit flow in a link (D18): `open` shows it in place of the Overview. */
const PATIENT_FILE_VISIT = ['open'] as const;

/** Validated `?…` params of the file layout, and so of every section. */
export interface PatientFileSearch {
  /**
   * The Patients row and ⌘K send `open` from `md` and `closed` below; every
   * other link leaves it out and the column keeps the state it was last left
   * in this session.
   */
  activity?: PatientFileActivity;
  /**
   * `timeline?visit=open` — the visit flow (KICKOFF §6.6, L-49). Only the
   * Overview reads it; a section's own link leaves it out, so it never follows
   * the member elsewhere.
   */
  visit?: (typeof PATIENT_FILE_VISIT)[number];
}

/** Parse the file layout's params; an unknown `activity` or `visit` is dropped. */
export function validatePatientFileSearch(
  search: Record<string, unknown>,
): PatientFileSearch {
  return {
    activity: oneOf(PATIENT_FILE_ACTIVITY, search.activity),
    visit: oneOf(PATIENT_FILE_VISIT, search.visit),
  };
}
