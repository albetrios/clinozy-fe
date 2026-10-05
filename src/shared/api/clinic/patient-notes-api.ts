import { z } from 'zod';

import { compareText, validateClinicInput } from './clinic-fixture-store.ts';
import type { PatientNote } from './clinic-schema.ts';
import { patientQueryKeys } from './patients-api.ts';

/*
 * The patient file's Team notes (`addNote`, `S:1645`; KICKOFF §6.6 Team
 * notes), on the fixture world until clinozy-be serves them —
 * REPLACE_WITH_API (D6).
 */

/** TanStack Query keys for notes — under the patients' key (the file's counts). */
export const patientNoteQueryKeys = {
  all: [...patientQueryKeys.all, 'notes'] as const,
  /** One patient's notes, newest first. */
  patient: (patientId: string) =>
    [...patientNoteQueryKeys.all, 'patient', patientId] as const,
};

/** A note's length: the composer's 500, inside the contract's 2,000 (`S:468–479`). */
export const PATIENT_NOTE_MAX = 500;

/** What Add note sends. */
export const patientNoteInputSchema = z.object({
  patientId: z.uuid(),
  body: z.string().trim().min(1).max(PATIENT_NOTE_MAX),
});

/** A note's fields. */
export type PatientNoteInput = z.infer<typeof patientNoteInputSchema>;

const fixtureWorld = () => import('./fixtures/world.fixtures.ts');

/** One patient's notes, newest first (REPLACE_WITH_API). */
export async function listPatientNotes(patientId: string): Promise<PatientNote[]> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientNotes
    .snapshot((note) => note.patientId === patientId)
    .sort((a, b) => compareText(b.createdAt, a.createdAt));
}

/** Add a note for the team (`addNote`, `S:1645`; REPLACE_WITH_API) — 422 when it is blank. */
export async function addPatientNote(input: PatientNoteInput): Promise<PatientNote> {
  const { clinicFixtures } = await fixtureWorld();
  const fields = validateClinicInput(patientNoteInputSchema, input);
  await clinicFixtures.patients.get(fields.patientId);
  return clinicFixtures.patientNotes.create(fields);
}

/**
 * Delete a note at once — no confirm; "Note deleted" offers Undo (H:834).
 * The contract's delete reason is required and nothing asks for one, so the
 * note stores `not_needed` (backend request: an optional reason for a note,
 * REPLACE_WITH_API).
 */
export async function deletePatientNote(id: string): Promise<PatientNote> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientNotes.remove(id, 'not_needed', null);
}

/** Restore a deleted note — the toast's Undo (REPLACE_WITH_API). */
export async function restorePatientNote(id: string): Promise<PatientNote> {
  const { clinicFixtures } = await fixtureWorld();
  return clinicFixtures.patientNotes.restore(id);
}
