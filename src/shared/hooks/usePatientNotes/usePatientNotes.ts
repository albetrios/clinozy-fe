import type { PatientNote } from '@/shared/api/clinic/clinic-schema.ts';
import {
  addPatientNote,
  deletePatientNote,
  listPatientNotes,
  type PatientNoteInput,
  patientNoteQueryKeys,
  restorePatientNote,
} from '@/shared/api/clinic/patient-notes-api.ts';
import { patientQueryKeys } from '@/shared/api/clinic/patients-api.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';

/** One patient's Team notes, newest first (KICKOFF §6.6); idle without a patient. */
export function usePatientNotes(patientId: string) {
  return useAppQuery({
    queryKey: patientNoteQueryKeys.patient(patientId),
    queryFn: () => listPatientNotes(patientId),
    enabled: patientId !== '',
  });
}

/** The note the composer shows at once, until the server's comes back. */
function draftNote(input: PatientNoteInput): PatientNote {
  const now = new Date().toISOString();
  return {
    id: `draft-${now}`,
    patientId: input.patientId,
    body: input.body.trim(),
    organizationId: '',
    createdAt: now,
    updatedAt: now,
    createdById: '',
    deletedAt: null,
    deleteReason: null,
    deleteNote: null,
  };
}

/**
 * Add note — optimistic (`addNote`, `S:1645`): it tops the list at once and
 * goes back if the write is refused; then every patient read refreshes (the
 * file's counts, the Activity line).
 */
export function useAddPatientNote(
  patientId: string,
  options: CrudMutationOptions<PatientNote, PatientNoteInput> = {},
) {
  return useAppMutation<PatientNote, PatientNoteInput, PatientNote[]>({
    mutationFn: addPatientNote,
    invalidateKeys: [patientQueryKeys.all],
    optimistic: {
      queryKey: patientNoteQueryKeys.patient(patientId),
      update: (previous, input) => [draftNote(input), ...(previous ?? [])],
    },
    ...options,
  });
}

/**
 * Delete a note at once — optimistic, no confirm (H:834). No toast of its
 * own: the section raises "Note deleted" with Undo, which runs
 * {@link useRestorePatientNote}.
 */
export function useDeletePatientNote(
  patientId: string,
  options: CrudMutationOptions<PatientNote, string> = {},
) {
  return useAppMutation<PatientNote, string, PatientNote[]>({
    mutationFn: deletePatientNote,
    invalidateKeys: [patientQueryKeys.all],
    optimistic: {
      queryKey: patientNoteQueryKeys.patient(patientId),
      update: (previous, id) => previous?.filter((note) => note.id !== id),
    },
    ...options,
  });
}

/** Restore a deleted note — the toast's Undo. */
export function useRestorePatientNote(
  options: CrudMutationOptions<PatientNote, string> = {},
) {
  return useAppMutation<PatientNote, string>({
    mutationFn: restorePatientNote,
    invalidateKeys: [patientQueryKeys.all],
    ...options,
  });
}
