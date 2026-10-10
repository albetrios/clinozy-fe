import { useState } from 'react';

import type { PatientRecord } from '@/shared/api/clinic/patients-contracts.ts';
import {
  useClinicalNotes,
  useCreateClinicalNote,
  useRemoveClinicalNote,
  useRestoreClinicalNote,
} from '@/shared/hooks/useClinicalNotes/index.ts';

import {
  type ClinicalChip,
  type ClinicalField,
  clinicalKindOf,
  clinicalNotesByField,
} from '../../patient-clinical.ts';
import { usePatientFileContext } from '../../patient-file-context.ts';

/** What the chip cards read and write. */
export interface ClinicalLists {
  /**
   * Whether the member may read the clinical record (`patient:clinical_record:read`, the
   * Clinical notes section's code) — nothing clinical shows, nor is asked for, otherwise.
   */
  readable: boolean;
  /** The notes are not read yet — the file is loading, or their read is in flight. */
  isLoading: boolean;
  /** The notes could not be read, and there is no earlier copy to show. */
  isError: boolean;
  /** Read the notes again — the cards' Retry. */
  retry: () => void;
  /** A list's chips: its notes, then the ones still saving; a chip being removed is gone already. */
  items: (field: ClinicalField) => readonly ClinicalChip[];
  /** Add a chip — one note, shown at once; a refused write takes it away again (its error toasts). */
  add: (field: ClinicalField, text: string) => void;
  /**
   * Add several chips — the Overview's smart note: one note each, a chip its list already holds
   * (any case) left as it is; how many were added.
   */
  addAll: (entries: readonly { field: ClinicalField; text: string }[]) => number;
  /**
   * Remove a chip at once — its note deleted with the reason `not_needed` (Q24); `true` once it
   * is, `false` when refused (the chip comes back, the error toasts) or still saving.
   */
  remove: (chip: ClinicalChip) => Promise<boolean>;
  /** Bring a removed chip back — the Undo of its "removed" toast (`…/restore`). */
  restore: (chip: ClinicalChip) => void;
}

/** A chip whose note is still being written. */
interface SavingChip {
  patientId: string;
  field: ClinicalField;
  text: string;
  /** Its key until the note has an id. */
  key: string;
}

/** Whether two chips read the same, any case. */
const sameText = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

/** `set` without `id`. */
function without(set: ReadonlySet<string>, id: string): ReadonlySet<string> {
  const next = new Set(set);
  next.delete(id);
  return next;
}

/** The chips still saving, once the one under `key` has landed or failed. */
const withoutSaving = (key: string) => (current: readonly SavingChip[]) =>
  current.filter((chip) => chip.key !== key);

/** The notes added in this file's session, with one more ("1 new"). */
const withAdded = (id: string) => (current: ReadonlySet<string>) =>
  new Set(current).add(id);

/**
 * The clinical chip cards' state on the patient's clinical notes (KICKOFF §6.6 Clinical notes;
 * `GET` / `POST` / `DELETE …/clinical-notes`, api-integration §5.4): one note per chip, never
 * edited. An add shows its chip before its `POST` lands and drops it if refused; a remove hides
 * the chip before its delete lands and puts it back if refused. "Added since the last visit"
 * has no marker on a note, so the chips added here, in this visit to the file, stand in for it.
 * Reads only for a member who may read the clinical record.
 */
export function useClinicalLists(
  patient: Pick<PatientRecord, 'id'> | undefined,
): ClinicalLists {
  const { viewable } = usePatientFileContext();
  const readable = viewable.includes('overview');
  const patientId = patient?.id;
  const notes = useClinicalNotes(patientId, { enabled: readable });
  const create = useCreateClinicalNote();
  const removeNote = useRemoveClinicalNote();
  const restoreNote = useRestoreClinicalNote();
  const [saving, setSaving] = useState<readonly SavingChip[]>([]);
  const [removing, setRemoving] = useState<ReadonlySet<string>>(new Set());
  const [added, setAdded] = useState<ReadonlySet<string>>(new Set());
  const byField = clinicalNotesByField(notes.data ?? []);

  const items = (field: ClinicalField): ClinicalChip[] => [
    ...byField[field]
      .filter((note) => !removing.has(note.id))
      .map((note) => ({
        id: note.id,
        text: note.text,
        pending: false,
        fresh: added.has(note.id),
      })),
    ...saving
      .filter((chip) => chip.patientId === patientId && chip.field === field)
      .map((chip) => ({ id: chip.key, text: chip.text, pending: true, fresh: true })),
  ];

  /** Write one chip's note, showing the chip until it lands. */
  const save = (field: ClinicalField, text: string) => {
    if (!patientId) return;
    const key = `saving:${field}:${text}`;
    setSaving((current) => [...current, { patientId, field, text, key }]);
    void create
      .mutateAsync({ patientId, kind: clinicalKindOf(field), text })
      .then(
        (note) => setAdded(withAdded(note.id)),
        () => undefined,
      )
      .finally(() => setSaving(withoutSaving(key)));
  };

  return {
    readable,
    isLoading: readable && notes.isPending,
    isError: notes.isError && notes.data === undefined,
    retry: () => void notes.refetch(),
    items,
    add: save,
    addAll: (entries) => {
      const fresh: { field: ClinicalField; text: string }[] = [];
      for (const entry of entries) {
        const known = [
          ...items(entry.field).map((chip) => chip.text),
          ...fresh.filter((chip) => chip.field === entry.field).map((chip) => chip.text),
        ];
        if (!known.some((text) => sameText(text, entry.text))) fresh.push(entry);
      }
      for (const { field, text } of fresh) save(field, text);
      return fresh.length;
    },
    remove: async (chip) => {
      if (!patientId || chip.pending) return false;
      setRemoving((current) => new Set(current).add(chip.id));
      try {
        await removeNote.mutateAsync({ patientId, noteId: chip.id });
        return true;
      } catch {
        // Refused: the error toasted, and the chip shows again.
        return false;
      } finally {
        setRemoving((current) => without(current, chip.id));
      }
    },
    restore: (chip) => {
      if (patientId) restoreNote.mutate({ patientId, noteId: chip.id });
    },
  };
}
