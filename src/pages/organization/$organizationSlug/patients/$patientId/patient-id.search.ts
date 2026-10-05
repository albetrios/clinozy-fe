/**
 * URL search params of the patient file (consumed by routeTree's
 * `validateSearch`; KICKOFF §6.6, §4). This module rides the entry chunk, so
 * it is the shared readers and two literals — nothing else.
 */
import { oneOf, textOf } from '@/lib/routes/search-params.ts';

/** The Activity column in a link: open or closed (D19 › Activity default). */
const PATIENT_FILE_ACTIVITY = ['open', 'closed'] as const;

/** One Activity state a link can carry. */
export type PatientFileActivity = (typeof PATIENT_FILE_ACTIVITY)[number];

/** Validated `?…` params of the file layout, and so of every section. */
export interface PatientFileSearch {
  /**
   * The Patients row and ⌘K send `open` from `md` and `closed` below; every
   * other link leaves it out and the column keeps the state it was last left
   * in this session.
   */
  activity?: PatientFileActivity;
}

/** Parse the file layout's params; an unknown `activity` is dropped. */
export function validatePatientFileSearch(
  search: Record<string, unknown>,
): PatientFileSearch {
  return { activity: oneOf(PATIENT_FILE_ACTIVITY, search.activity) };
}

/** Validated `?…` params of a file-level drawer (`edit/`, `S:34`). */
export interface PatientFileDialogSearch {
  /**
   * The section the drawer opened over (AMBER A-F1) — kept as text here and
   * checked where it is used: anything but a section shows Clinical notes.
   */
  from?: string;
}

/** Parse a file-level drawer's `from`. */
export function validatePatientFileDialogSearch(
  search: Record<string, unknown>,
): PatientFileDialogSearch {
  return { from: textOf(search.from) || undefined };
}
