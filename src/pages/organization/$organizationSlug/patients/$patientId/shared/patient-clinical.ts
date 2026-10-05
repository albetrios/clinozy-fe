import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientClinical } from '@/shared/api/clinic/patients-contracts.ts';

/*
 * The four clinical notes as chips — Complaints, Diagnosis, Treatment and
 * Future suggestions. The contract stores each as one text (≤4,000,
 * `S:313–316`); chip arrays are a backend request (Appendix F), so a chip is
 * a line until then. Clinical notes edit them; the Overview's Clinical card
 * reads them.
 */

/** One clinical list — a clinical field of the patient. */
export type ClinicalField = keyof PatientClinical;

/**
 * The four lists in their order (H:4797 `OVK`; `patient-file.md:53`):
 * Complaints blush, Diagnosis lav, Treatment suggestions sage, Future
 * suggestions sky — the Clinical notes chip cards and the Overview's
 * Clinical card.
 */
export const CLINICAL_LISTS: readonly { field: ClinicalField; tone: Tone }[] = [
  { field: 'complaints', tone: 'blush' },
  { field: 'diagnosis', tone: 'lav' },
  { field: 'treatmentSuggestions', tone: 'sage' },
  { field: 'futureSuggestions', tone: 'sky' },
];

/** A note's chips: one per line, blank lines dropped. */
export function clinicalItems(text: string | null | undefined): string[] {
  return (text ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

/** The chips as the contract stores them: one per line; none is no note. */
export function clinicalText(items: readonly string[]): string | null {
  return items.length > 0 ? items.join('\n') : null;
}
