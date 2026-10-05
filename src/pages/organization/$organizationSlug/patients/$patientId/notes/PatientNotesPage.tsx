import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientNote } from '@/shared/api/clinic/clinic-schema.ts';
import {
  PATIENT_NOTE_MAX,
  patientNoteInputSchema,
} from '@/shared/api/clinic/patient-notes-api.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { DrawerTextarea } from '@/shared/components/DrawerField/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  useAddPatientNote,
  useDeletePatientNote,
  usePatientNotes,
  useRestorePatientNote,
} from '@/shared/hooks/usePatientNotes/index.ts';
import { X } from '@/shared/icons/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { type StaffChip, useStaffLookup } from '../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { NOTES_KEYS, NOTES_NS, NOTES_TEST_IDS } from './notes.constants.ts';
import { manifest } from './notes.manifest.ts';

/** A note the optimistic add shows before the server's answer: no author yet. */
const isDraft = (note: PatientNote) => note.createdById === '';

/**
 * The composer (H:834): a 2-row textarea of up to 500 characters and "Add
 * note" beside it — an empty note does nothing; a note tops the list at once
 * (`addNote` is optimistic, `S:1645`).
 */
function NoteComposer({ patientId }: { patientId: string }) {
  const { t } = useTranslation(NOTES_NS);
  const [body, setBody] = useState('');
  const add = useAddPatientNote(patientId);
  const submit = () => {
    const input = { patientId, body: body.trim() };
    if (!patientNoteInputSchema.safeParse(input).success) return;
    add.mutate(input);
    setBody('');
  };
  return (
    <div className="flex items-end gap-2">
      <DrawerTextarea
        rows={2}
        maxLength={PATIENT_NOTE_MAX}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder={t(NOTES_KEYS.placeholder)}
        aria-label={t(NOTES_KEYS.label)}
        data-testid={NOTES_TEST_IDS.input}
        className="flex-1 leading-normal"
      />
      <Button
        type="button"
        onClick={submit}
        data-testid={NOTES_TEST_IDS.add}
        className="h-9 flex-none rounded-lg px-3.5"
      >
        {t(NOTES_KEYS.add)}
      </Button>
    </div>
  );
}

/**
 * One note (H:834): the author's 28px avatar, "Riya S. · Sep 24 · 15:39", the
 * note, and × "Delete note" for a member who may delete.
 */
function NoteCard({
  note,
  author,
  onDelete,
}: {
  note: PatientNote;
  author: StaffChip | null;
  onDelete: (() => void) | null;
}) {
  const { t } = useTranslation(NOTES_NS);
  const clock = useClinicClock();
  return (
    <div
      data-slot="card"
      data-testid={`${NOTES_TEST_IDS.note}-${note.id}`}
      className="bg-card flex gap-2.5 rounded-xl border p-3"
    >
      {author ? (
        <PersonAvatar
          size="list"
          initials={author.initials}
          tone={author.tone}
          className="flex-none"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col gap-0.75">
        <span className="text-caption text-muted-foreground">
          {t(NOTES_KEYS.by, {
            name: author ? shortPersonName(author.name) : '—',
            date: clock.moment(note.createdAt),
          })}
        </span>
        <p className="text-field leading-[1.45] break-words whitespace-pre-line">
          {note.body}
        </p>
      </div>
      {onDelete ? (
        <button
          type="button"
          onClick={onDelete}
          aria-label={t(NOTES_KEYS.delete)}
          title={t(NOTES_KEYS.delete)}
          data-testid={`${NOTES_TEST_IDS.delete}-${note.id}`}
          className="text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex size-7 flex-none items-center justify-center rounded-md transition-colors"
        >
          <X aria-hidden="true" className="size-4" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * Patient file › Team notes (KICKOFF §6.6; H:834; `patient-file.md:81–90`):
 * one column of at most 760px — the composer (`patients.create`), then the
 * notes newest first; × deletes one at once (`patients.delete`) with "Note
 * deleted" and Undo for 10s. "No notes yet" when there are none; the section
 * has no "New …" button.
 */
export function PatientNotesPage() {
  const { t } = useTranslation(NOTES_NS);
  const { patientId } = usePatientFileContext();
  const access = useClinicAccess();
  const notes = usePatientNotes(patientId);
  const remove = useDeletePatientNote(patientId);
  const restore = useRestorePatientNote();
  const staff = useStaffLookup();
  const canAdd = access.isResolved && access.can('patients', 'create');
  const canDelete = access.isResolved && access.can('patients', 'delete');
  const list = notes.data ?? [];
  const deleteNote = (note: PatientNote) =>
    remove.mutate(note.id, {
      onSuccess: () =>
        notify.undo(t(NOTES_KEYS.deleted), { onUndo: () => restore.mutate(note.id) }),
    });

  return (
    <PatientSection section="notes" data-testid={manifest.testId}>
      <div className="flex max-w-190 flex-col gap-2.5 px-(--table-pad-x) pt-3 pb-5">
        {canAdd ? <NoteComposer patientId={patientId} /> : null}
        {list.map((note) => (
          <NoteCard
            key={note.id}
            note={note}
            author={staff(note.createdById)}
            onDelete={canDelete && !isDraft(note) ? () => deleteNote(note) : null}
          />
        ))}
        {notes.isSuccess && list.length === 0 ? (
          <span className="text-body text-muted-foreground">{t(NOTES_KEYS.empty)}</span>
        ) : null}
      </div>
    </PatientSection>
  );
}
