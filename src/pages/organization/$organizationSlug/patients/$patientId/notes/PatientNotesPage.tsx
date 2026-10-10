import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateText } from '@/lib/bidi-isolate.ts';
import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import type { ContactActivityEntry } from '@/shared/api/clinic/contact-activities-api.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { DrawerTextarea } from '@/shared/components/DrawerField/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  CONTACT_NOTE_MAX,
  CONTACT_NOTES_FILTER,
  useAddContactNote,
  useContactActivities,
  useContactActivityAccess,
} from '@/shared/hooks/useContactActivities/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { type StaffChip, useStaffLookup } from '../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { NOTES_KEYS, NOTES_NS, NOTES_TEST_IDS } from './notes.constants.ts';
import { manifest } from './notes.manifest.ts';

/** How many notes a page reads — "Load more" reads the next. */
const PAGE_SIZE = 25;

/**
 * The composer (H:834): a 2-row textarea of up to 500 characters and "Add
 * note" beside it — an empty note does nothing; a note tops the list at once
 * (optimistic, `…/activities/add-note`), and a refused one goes back into the
 * box (its error toasts).
 */
function NoteComposer({ contactId }: { contactId: string | undefined }) {
  const { t } = useTranslation(NOTES_NS);
  const [body, setBody] = useState('');
  const add = useAddContactNote(contactId);
  const submit = () => {
    const text = body.trim();
    if (!(text && contactId)) return;
    setBody('');
    add.mutate({ body: text }, { onError: () => setBody((now) => now || text) });
  };
  return (
    <div className="flex items-end gap-2">
      <DrawerTextarea
        rows={2}
        maxLength={CONTACT_NOTE_MAX}
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

/** One note (H:834): the author's 28px avatar, "Riya S. · Sep 24 · 15:39" and the note. */
function NoteCard({
  note,
  author,
}: {
  note: ContactActivityEntry;
  author: StaffChip | null;
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
            // The author isolated; the moment is the rule's (its time isolated within).
            name: author ? isolateText(shortPersonName(author.name)) : '—',
            date: clock.moment(note.occurredAt),
          })}
        </span>
        <p className="text-field leading-[1.45] break-words whitespace-pre-line">
          {note.body}
        </p>
      </div>
    </div>
  );
}

/**
 * Patient file › Team notes (KICKOFF §6.6; H:834; `patient-file.md:81–90`;
 * §6 #3): one column of at most 760px — the composer, then the person's notes
 * newest first, a page at a time. A team note is a `note` entry of the
 * person's activity on clinozy-be (`GET /app/contacts/:contact_id/activities
 * ?type=note`, `contact_activity:read`; added with `…/add-note`,
 * `contact_activity:create`); it shows in the Activity column too. There is
 * no delete and so no Undo — the API has no route for either (G4). "No notes
 * yet" when there are none; the section has no "New …" button.
 */
export function PatientNotesPage() {
  const { t } = useTranslation([NOTES_NS, ERRORS_NS]);
  const { file } = usePatientFileContext();
  const access = useContactActivityAccess();
  const contactId = file?.patient.contactId;
  const notes = useContactActivities(contactId, CONTACT_NOTES_FILTER, {
    limit: PAGE_SIZE,
    enabled: access.reads,
  });
  const staff = useStaffLookup();
  const list = notes.entries;

  return (
    <PatientSection section="notes" data-testid={manifest.testId}>
      <div className="flex max-w-190 flex-col gap-2.5 px-(--table-pad-x) pt-3 pb-5">
        {access.writes ? <NoteComposer contactId={contactId} /> : null}
        {access.reads ? (
          <>
            {list.map((note) => (
              <NoteCard key={note.id} note={note} author={staff(note.authorId)} />
            ))}
            {notes.isPending && list.length === 0 ? (
              <SkeletonRows rows={3} avatar label={t(NOTES_KEYS.title)} />
            ) : null}
            {notes.isError && list.length === 0 ? (
              <RetryError
                message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
                onRetry={notes.refetch}
              />
            ) : null}
            {notes.hasNextPage ? (
              <Button
                type="button"
                variant="outline"
                onClick={notes.fetchNextPage}
                isLoading={notes.isFetchingNextPage}
                data-testid={NOTES_TEST_IDS.more}
                className="h-9 self-center rounded-lg px-3.5"
              >
                {t(NOTES_KEYS.loadMore)}
              </Button>
            ) : null}
            {notes.isSuccess && list.length === 0 ? (
              <EmptyState
                variant="inline"
                title={t(NOTES_KEYS.empty)}
                className="text-body"
              />
            ) : null}
          </>
        ) : null}
      </div>
    </PatientSection>
  );
}
