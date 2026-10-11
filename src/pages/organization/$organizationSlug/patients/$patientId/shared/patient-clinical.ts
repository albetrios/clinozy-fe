import type { Tone } from '@/shared/api/app/app-schema.ts';
import type {
  ClinicalNote,
  ClinicalNoteKind,
} from '@/shared/api/app/clinical-notes-contracts.ts';

/*
 * The four clinical lists as chips — Complaints, Diagnosis, Treatment and Future suggestions —
 * each chip one clinical note of its kind on clinozy-be (api-integration §5.4), never edited:
 * added or removed. The API's findings and safety checks have no card in the design
 * (`patient-file.md:53`), so the file shows none. Clinical notes edit them; the Overview's
 * Clinical card reads them and its smart note adds to them.
 */

/**
 * The four lists in their order (H:4797 `OVK`; `patient-file.md:53`) and the note kind each
 * holds: Complaints blush, Diagnosis lav, Treatment suggestions sage, Future suggestions sky —
 * the Clinical notes chip cards and the Overview's Clinical card.
 */
export const CLINICAL_LISTS = [
  { field: 'complaints', kind: 'complaint', tone: 'blush' },
  { field: 'diagnosis', kind: 'diagnosis', tone: 'lav' },
  { field: 'treatmentSuggestions', kind: 'treatment_suggestion', tone: 'sage' },
  { field: 'futureSuggestions', kind: 'future_suggestion', tone: 'sky' },
] as const satisfies readonly { field: string; kind: ClinicalNoteKind; tone: Tone }[];

/** One clinical list — a chip card. */
export type ClinicalField = (typeof CLINICAL_LISTS)[number]['field'];

/** One chip of a list. */
export interface ClinicalChip {
  /** The note's id (`pcn_…`); a chip still saving has a key of its own. */
  id: string;
  text: string;
  /** Still saving: shown, but not yet a note that can be removed. */
  pending: boolean;
  /**
   * Added since the last visit — ringed, and counted in the "1 new" pill. The API marks no
   * note as new, so the chips added in this visit to the file stand in for it.
   */
  fresh: boolean;
}

const KIND_OF = Object.fromEntries(
  CLINICAL_LISTS.map(({ field, kind }) => [field, kind]),
) as Record<ClinicalField, ClinicalNoteKind>;

/** The note kind a list holds. */
export function clinicalKindOf(field: ClinicalField): ClinicalNoteKind {
  return KIND_OF[field];
}

/** The notes of each list, in their order — a finding or a safety check is in none. */
export function clinicalNotesByField(
  notes: readonly ClinicalNote[],
): Record<ClinicalField, ClinicalNote[]> {
  return Object.fromEntries(
    CLINICAL_LISTS.map(({ field, kind }) => [
      field,
      notes.filter((note) => note.kind === kind),
    ]),
  ) as Record<ClinicalField, ClinicalNote[]>;
}
