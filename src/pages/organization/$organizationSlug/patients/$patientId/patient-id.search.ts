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

/**
 * Where a review was left (`review_source`, `S:1314`) — declared here rather
 * than read from the schema module, which this entry-chunk module must not
 * pull in; `patient-id.search.test.ts` pins it to `REVIEW_SOURCE_VALUES`.
 */
export const PATIENT_REVIEW_SOURCES = [
  'google',
  'video',
  'instagram',
  'internal_form',
  'whatsapp',
] as const;

/** Validated `?…` params of the check-in and review drawers (`S:44–47`). */
export interface PatientFeedbackDialogSearch extends PatientFileDialogSearch {
  /** The visit it follows. */
  appointment?: string;
  /** The treatment an aftercare check-in follows. */
  treatment?: string;
  /** Where a new review was left; Google when none. */
  source?: (typeof PATIENT_REVIEW_SOURCES)[number];
}

/** Parse the check-in and review drawers' params; an unknown `source` is dropped. */
export function validatePatientFeedbackSearch(
  search: Record<string, unknown>,
): PatientFeedbackDialogSearch {
  return {
    ...validatePatientFileDialogSearch(search),
    appointment: textOf(search.appointment) || undefined,
    treatment: textOf(search.treatment) || undefined,
    source: oneOf(PATIENT_REVIEW_SOURCES, search.source),
  };
}

/** How many medicine names a smart note hands New prescription (H:4920). */
const RX_PREFILL_LIMIT = 10;

/** The longest medicine name the drawer takes (`RX_LIMITS.medicineName`). */
const RX_PREFILL_NAME_MAX = 120;

/** Validated `?…` params of New prescription (`S:35`). */
export interface PatientRxCreateSearch {
  /** The medicines a smart note recognised (AMBER A-F5): each a line of the new Rx. */
  medicines?: string[];
}

/** Parse New prescription's params: up to ten medicine names, blanks dropped. */
export function validatePatientRxCreateSearch(
  search: Record<string, unknown>,
): PatientRxCreateSearch {
  const names = (Array.isArray(search.medicines) ? search.medicines : [])
    .map((name) => textOf(name).slice(0, RX_PREFILL_NAME_MAX))
    .filter(Boolean)
    .slice(0, RX_PREFILL_LIMIT);
  return { medicines: names.length > 0 ? names : undefined };
}
