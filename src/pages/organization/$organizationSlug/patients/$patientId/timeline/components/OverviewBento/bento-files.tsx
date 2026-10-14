import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { PatientPhotoAlbum } from '@/shared/api/app/patient-images-contracts.ts';
import { photoName } from '@/shared/api/app/patient-images-contracts.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import {
  CONTACT_NOTE_MAX,
  CONTACT_NOTES_FILTER,
  useAddContactNote,
  useContactActivities,
} from '@/shared/hooks/useContactActivities/index.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';
import { usePatientReports } from '@/shared/hooks/usePatientReports/index.ts';
import { Camera, FileIcon, MessageSquare } from '@/shared/icons/index.ts';

import { useTableDay } from '../../../shared/components/PatientSectionTable/index.ts';
import { PhotoThumb } from '../../../shared/components/PhotoThumb/index.ts';
import { useStaffLookup } from '../../../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BentoButton, BentoCard, BentoReadState, BentoRow } from './bento-card.tsx';
import { type BentoRead, bentoRead } from './bento-read.ts';

/** How many records a card lists (H:4996 `slice(0, 3)`). */
const LISTED = 3;

/** How many photos the Photos card shows (H:4992 `slice(0, 8)`). */
const THUMBS = 8;

/** What a card's head opens: none for a member who may not. */
interface CardLinks {
  onOpen: (() => void) | null;
}

/** What a card's head opens and adds: each none for a member who may not. */
interface NewCardLinks extends CardLinks {
  onNew?: { label: string; run: () => void } | null;
}

/**
 * Photos (two columns wide; H:772, H:4992): "Upload"; the newest eight
 * (`GET …/images`, one page) — each the photo from its `file_url` (D86), named
 * for the reader, with its album's pill, opening Photos on that album; the server's
 * count; "No photos yet · upload the first". ("Compare" is not built — its
 * mode never rendered, H:4766.)
 */
export function PhotosBentoCard({
  onOpen,
  onUpload,
  onAlbum,
}: CardLinks & {
  onUpload: (() => void) | null;
  onAlbum: (album: PatientPhotoAlbum) => void;
}) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  // The server leaves the Private album out for a member who may not open it.
  const photos = usePatientPhotos(patientId, { limit: THUMBS });
  const rows = photos.photos.slice(0, THUMBS);
  const title = t(TIMELINE_KEYS.cards.photos);
  const testId = TIMELINE_TEST_IDS.card('photos');
  const read: BentoRead = { ...photos, retry: photos.refetch };
  return (
    <BentoCard
      card="photos"
      title={title}
      icon={Camera}
      count={photos.total ?? undefined}
      wide
      actions={
        onUpload ? (
          <BentoButton onClick={onUpload} testId={`${testId}-upload`}>
            {t(TIMELINE_KEYS.photos.upload)}
          </BentoButton>
        ) : null
      }
      onOpen={onOpen}
    >
      {rows.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(88px,1fr))] gap-2">
          {rows.map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onAlbum(photo.album)}
              title={photoName(photo)}
              aria-label={photoName(photo)}
              data-testid={`${testId}-thumb`}
              className="bg-muted hover:border-muted-foreground relative aspect-square overflow-hidden rounded-lg border transition-colors"
            >
              <PhotoThumb src={photo.fileUrl} />
              <span
                data-slot="pill"
                className="bg-card/90 text-tiny text-muted-foreground-strong absolute start-1 bottom-1 flex h-4.5 items-center rounded-full px-1.5 font-medium"
              >
                {t(TIMELINE_KEYS.photos.albums[photo.album])}
              </span>
            </button>
          ))}
        </div>
      ) : null}
      <BentoReadState
        read={read}
        empty={rows.length === 0}
        label={title}
        emptyTitle={t(TIMELINE_KEYS.photos.empty)}
        section="images"
        testId={testId}
      />
    </BentoCard>
  );
}

/**
 * Reports (H:777, H:4998): "Upload report"; the newest three (`GET …/reports`, one page) — the
 * name over "Lab · 20 Sep" — each opening Reports; the server's count; "No reports yet".
 */
export function ReportsBentoCard({ onOpen, onNew }: NewCardLinks) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const day = useTableDay();
  const reports = usePatientReports(patientId, { limit: LISTED });
  const rows = reports.data?.reports ?? [];
  const title = t(TIMELINE_KEYS.cards.reports);
  const testId = TIMELINE_TEST_IDS.card('reports');
  return (
    <BentoCard
      card="reports"
      title={title}
      icon={FileIcon}
      count={reports.data?.total}
      onNew={onNew}
      onOpen={onOpen}
    >
      {rows.length > 0 ? (
        <div className="flex flex-col">
          {rows.slice(0, LISTED).map((report) => (
            <BentoRow
              key={report.id}
              title={report.name}
              sub={t(TIMELINE_KEYS.reports.sub, {
                type: t(TIMELINE_KEYS.reports.types[report.type]),
                date: day(report.date),
              })}
              onClick={() => onOpen?.()}
              testId={`${testId}-row`}
            />
          ))}
        </div>
      ) : null}
      <BentoReadState
        read={bentoRead(reports)}
        empty={rows.length === 0}
        label={title}
        emptyTitle={t(TIMELINE_KEYS.reports.empty)}
        section="reports"
        testId={testId}
      />
    </BentoCard>
  );
}

/**
 * Team notes (two columns wide; H:778, H:4999; §6 #3): the person's `note`
 * entries on clinozy-be (`GET /app/contacts/:contact_id/activities?type=note`,
 * the newest three, the server's count) with their author and time; the
 * composer — "Write a note for the team…" and "Post", Enter posting it
 * (`…/activities/add-note`) — for a member who adds notes; "No notes yet".
 */
export function NotesBentoCard({ onOpen, canPost }: CardLinks & { canPost: boolean }) {
  const { t } = useTranslation(TIMELINE_NS);
  const { file } = usePatientFileContext();
  const contactId = file?.patient.contactId;
  const notes = useContactActivities(contactId, CONTACT_NOTES_FILTER, { limit: LISTED });
  const add = useAddContactNote(contactId);
  const staff = useStaffLookup();
  const clock = useAppClock();
  const [body, setBody] = useState('');
  const rows = notes.entries.slice(0, LISTED);
  const title = t(TIMELINE_KEYS.cards.notes);
  const K = TIMELINE_KEYS.notes;
  const post = () => {
    const text = body.trim();
    if (!(text && contactId)) return;
    setBody('');
    // A refused note comes off the list (its error toasts) and back into the box.
    add.mutate({ body: text }, { onError: () => setBody((now) => now || text) });
  };
  return (
    <BentoCard
      card="notes"
      title={title}
      icon={MessageSquare}
      count={notes.total ?? undefined}
      wide
      onOpen={onOpen}
    >
      {canPost ? (
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            post();
          }}
        >
          <DrawerInput
            value={body}
            onChange={(event) => setBody(event.target.value)}
            maxLength={CONTACT_NOTE_MAX}
            placeholder={t(K.placeholder)}
            aria-label={t(K.label)}
            data-testid={TIMELINE_TEST_IDS.noteInput}
            className="bg-canvas min-w-0 flex-1 px-3"
          />
          <Button
            type="submit"
            variant="outline"
            data-testid={TIMELINE_TEST_IDS.notePost}
            className="text-body h-9 flex-none rounded-lg px-3.5"
          >
            {t(K.post)}
          </Button>
        </form>
      ) : null}
      {rows.length > 0 ? (
        <div className="flex flex-col gap-2">
          {rows.map((note) => {
            const author = staff(note.authorId);
            return (
              <div key={note.id} className="flex items-start gap-2.5">
                {author ? (
                  <PersonAvatar
                    size="chip"
                    initials={author.initials}
                    tone={author.tone}
                    className="flex-none"
                  />
                ) : null}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-body leading-[1.45] break-words">
                    {note.body}
                  </span>
                  <span className="text-caption text-muted-foreground">
                    {t(K.by, {
                      name: author ? shortPersonName(author.name) : '—',
                      date: clock.moment(note.occurredAt),
                    })}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
      <BentoReadState
        read={{ ...notes, retry: notes.refetch }}
        empty={rows.length === 0}
        label={title}
        emptyTitle={t(K.empty)}
        section="notes"
        testId={TIMELINE_TEST_IDS.card('notes')}
      />
    </BentoCard>
  );
}
