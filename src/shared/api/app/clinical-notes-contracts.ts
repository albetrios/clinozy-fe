import { z } from 'zod';

import type { ApiData } from '@/core/http/api.ts';
import { wireSchema } from '@/core/http/wire-schema.ts';

/*
 * A patient's clinical notes on clinozy-be (`/app/patients/:patient_id/clinical-notes`,
 * api-integration §5.4): one short note per chip — a complaint, a finding, a diagnosis, a
 * treatment or future suggestion, a safety check. A note is never edited: a chip is added
 * (`POST`) or removed (a delete with its reason, Q24), and a restore brings a removed one back.
 */

/** The kinds of clinical note, as the API names them. */
const CLINICAL_NOTE_KIND_VALUES = [
  'complaint',
  'finding',
  'diagnosis',
  'treatment_suggestion',
  'future_suggestion',
  'safety_check',
] as const;

/** One kind of clinical note. */
export type ClinicalNoteKind = (typeof CLINICAL_NOTE_KIND_VALUES)[number];

type ApiClinicalNote = NonNullable<
  ApiData<'/app/patients/{patient_id}/clinical-notes/{patient_clinical_note_id}', 'get'>
>;

/** One note as clinozy-be answers it — every field present in the live answer. */
export const clinicalNoteWire = wireSchema<ApiClinicalNote>()(
  z.object({
    id: z.string(),
    patient_id: z.string(),
    kind: z.enum(CLINICAL_NOTE_KIND_VALUES),
    text: z.string(),
    appointment_id: z.string().nullable(),
    patient_diagnosis_id: z.string().nullable(),
    added_at: z.string(),
  }),
);

/** One clinical note as the patient file reads it. */
export interface ClinicalNote {
  /** `pcn_…`. */
  id: string;
  patientId: string;
  kind: ClinicalNoteKind;
  text: string;
  /** The visit it was written in, when it was. */
  appointmentId: string | null;
  /** The catalogue diagnosis it names (`/app/patient-diagnoses`), when it does. */
  diagnosisId: string | null;
  /** When it was added (ISO 8601). */
  addedAt: string;
}

/** A note on the wire as the file reads it. */
export function toClinicalNote(row: z.output<typeof clinicalNoteWire>): ClinicalNote {
  return {
    id: row.id,
    patientId: row.patient_id,
    kind: row.kind,
    text: row.text,
    appointmentId: row.appointment_id,
    diagnosisId: row.patient_diagnosis_id,
    addedAt: row.added_at,
  };
}
