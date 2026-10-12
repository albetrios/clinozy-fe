import { useQueryClient } from '@tanstack/react-query';

import {
  clinicalNoteQueryKeys,
  createClinicalNote,
  deleteClinicalNote,
  listClinicalNotes,
  restoreClinicalNote,
} from '@/shared/api/app/clinical-notes-api.ts';
import type {
  ClinicalNote,
  ClinicalNoteKind,
} from '@/shared/api/app/clinical-notes-contracts.ts';
import { useAppMutation } from '@/shared/hooks/useAppMutation/index.ts';
import { useAppQuery } from '@/shared/hooks/useAppQuery/index.ts';
import type { CrudMutationOptions } from '@/shared/hooks/useCreate/index.ts';
import { useOrganizationId } from '@/shared/store/useOrganizationStore/index.ts';

/** A note in its place among the others: by when it was added, as the list answers. */
function withNote(notes: readonly ClinicalNote[], note: ClinicalNote): ClinicalNote[] {
  return [...notes.filter((row) => row.id !== note.id), note].sort((a, b) =>
    a.addedAt.localeCompare(b.addedAt),
  );
}

/**
 * Keep a patient's cached notes in step with a write that landed, and refetch them — so a chip
 * stays on screen from the write to the refetch instead of blinking out between the two.
 */
function useNotesCache() {
  const queryClient = useQueryClient();
  const organizationId = useOrganizationId();
  return (
    patientId: string,
    change: (notes: readonly ClinicalNote[]) => ClinicalNote[],
  ) => {
    const queryKey = clinicalNoteQueryKeys.list(organizationId, patientId);
    queryClient.setQueryData<ClinicalNote[]>(queryKey, (notes) =>
      notes ? change(notes) : notes,
    );
    void queryClient.invalidateQueries({ queryKey });
  };
}

// ── Reads ──

/**
 * A patient's clinical notes, every kind, oldest first (`GET …/clinical-notes`, every page);
 * idle without a patient or an organization, or when `enabled` is false — a member without
 * `patient:clinical_record:read` asks nothing. No toast of its own: the cards show the failure
 * with Retry in place.
 */
export function useClinicalNotes(
  patientId: string | undefined,
  { enabled = true }: { enabled?: boolean } = {},
) {
  const organizationId = useOrganizationId();
  return useAppQuery({
    queryKey: clinicalNoteQueryKeys.list(organizationId, patientId ?? ''),
    queryFn: () => listClinicalNotes(patientId ?? ''),
    enabled: enabled && Boolean(patientId) && organizationId !== null,
    // Shown in place: the cards' Retry.
    notifyOnError: false,
  });
}

// ── Writes ──

/** What adding a note sends: whose, which kind, its text. */
export interface ClinicalNoteCreateVars {
  patientId: string;
  kind: ClinicalNoteKind;
  text: string;
}

/**
 * Add a note — one chip, one `POST`. Not optimistic here (the chip cards show the chip while it
 * saves); the saved note joins the patient's cached notes as it lands, and the person's activity
 * refreshes. No toast of its own.
 */
export function useCreateClinicalNote(
  options: CrudMutationOptions<ClinicalNote, ClinicalNoteCreateVars> = {},
) {
  const updateNotes = useNotesCache();
  return useAppMutation<ClinicalNote, ClinicalNoteCreateVars>({
    mutationFn: (vars, action) => createClinicalNote({ ...vars, ...action }),
    // The person's activity: the server writes a `system` entry for a new note
    // (`messageQueryKeys`, named here so the hook does not load the messages module).
    invalidateKeys: [['app', 'messages']],
    ...options,
    onSuccess: async (note, vars) => {
      updateNotes(vars.patientId, (notes) => withNote(notes, note));
      await options.onSuccess?.(note, vars);
    },
  });
}

/** What removing a note sends: whose, and which. */
export interface ClinicalNoteVars {
  patientId: string;
  noteId: string;
}

/**
 * Remove a chip — a delete with the reason `not_needed` (Q24): a chip is removed with its ×, no
 * confirm, so there is no reason to ask. The note leaves the cached notes as the delete lands. No
 * toast of its own: the caller's "removed" offers Undo ({@link useRestoreClinicalNote}).
 */
export function useRemoveClinicalNote(
  options: CrudMutationOptions<void, ClinicalNoteVars> = {},
) {
  const updateNotes = useNotesCache();
  return useAppMutation<void, ClinicalNoteVars>({
    mutationFn: ({ patientId, noteId }) =>
      deleteClinicalNote({ patientId, noteId, reason: 'not_needed' }),
    ...options,
    onSuccess: async (data, vars) => {
      updateNotes(vars.patientId, (notes) =>
        notes.filter((note) => note.id !== vars.noteId),
      );
      await options.onSuccess?.(data, vars);
    },
  });
}

/** Put a removed note back — the Undo of its "removed" toast; it returns to its place. Silent. */
export function useRestoreClinicalNote(
  options: CrudMutationOptions<ClinicalNote, ClinicalNoteVars> = {},
) {
  const updateNotes = useNotesCache();
  return useAppMutation<ClinicalNote, ClinicalNoteVars>({
    mutationFn: (vars, action) => restoreClinicalNote({ ...vars, ...action }),
    ...options,
    onSuccess: async (note, vars) => {
      updateNotes(vars.patientId, (notes) => withNote(notes, note));
      await options.onSuccess?.(note, vars);
    },
  });
}
