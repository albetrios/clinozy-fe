import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { ImageAlbum } from '@/shared/api/clinic/clinic-schema.ts';
import { photoName } from '@/shared/api/clinic/patient-images-api.ts';
import { patientNoteInputSchema } from '@/shared/api/clinic/patient-notes-api.ts';
import type { PatientInvoiceRow } from '@/shared/api/clinic/payments-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { PersonAvatar, shortPersonName } from '@/shared/components/Cells/index.ts';
import { DrawerInput } from '@/shared/components/DrawerField/index.ts';
import { EmptyState } from '@/shared/components/EmptyState/index.ts';
import { Button } from '@/shared/components/ui/button.tsx';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import {
  useAddPatientNote,
  usePatientNotes,
} from '@/shared/hooks/usePatientNotes/index.ts';
import { usePatientPhotos } from '@/shared/hooks/usePatientPhotos/index.ts';
import { usePatientReports } from '@/shared/hooks/usePatientReports/index.ts';
import {
  usePatientInvoices,
  usePatientPayments,
} from '@/shared/hooks/usePayments/index.ts';
import {
  Camera,
  Eye,
  EyeOff,
  FileIcon,
  MessageSquare,
  Receipt,
} from '@/shared/icons/index.ts';

import { useTableDay } from '../../../shared/components/PatientSectionTable/index.ts';
import { PhotoThumb } from '../../../shared/components/PhotoThumb/index.ts';
import { useStaffLookup } from '../../../shared/hooks/useStaffLookup/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BentoButton, BentoCard, BentoRow } from './bento-card.tsx';

/** How many records a card lists (H:4996 `slice(0, 3)`). */
const LISTED = 3;

/** How many photos the Photos card shows (H:4992 `slice(0, 8)`). */
const THUMBS = 8;

/** A team note's most (H:778 `maxLength`). */
const NOTE_MAX = 500;

/** What a card's head opens and adds: each none for a member who may not. */
interface CardLinks {
  onOpen: (() => void) | null;
  onNew?: { label: string; run: () => void } | null;
}

/**
 * Photos (two columns wide; H:772, H:4992): "Upload"; up to eight thumbnails
 * with their album's pill, each opening Photos on that album; "No photos yet
 * · upload the first". ("Compare" is not built — its mode never rendered,
 * H:4766.)
 */
export function PhotosBentoCard({
  onOpen,
  onUpload,
  onAlbum,
  privateAlbum,
}: CardLinks & {
  onUpload: (() => void) | null;
  onAlbum: (album: ImageAlbum) => void;
  privateAlbum: boolean;
}) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const photos = usePatientPhotos(patientId, { privateAlbum });
  const rows = photos.data?.photos ?? [];
  const testId = TIMELINE_TEST_IDS.card('photos');
  return (
    <BentoCard
      card="photos"
      title={t(TIMELINE_KEYS.cards.photos)}
      icon={Camera}
      count={rows.length}
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
          {rows.slice(0, THUMBS).map((photo) => (
            <button
              key={photo.id}
              type="button"
              onClick={() => onAlbum(photo.album)}
              title={photoName(photo)}
              aria-label={photoName(photo)}
              data-testid={`${testId}-thumb`}
              className="bg-muted hover:border-muted-foreground relative aspect-square overflow-hidden rounded-lg border transition-colors"
            >
              <PhotoThumb fileUrl={photo.fileUrl} fit="cover" />
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
      {photos.isSuccess && rows.length === 0 ? (
        <EmptyState
          variant="inline"
          testId={`${testId}-empty`}
          title={t(TIMELINE_KEYS.photos.empty)}
        />
      ) : null}
    </BentoCard>
  );
}

/** Due or Paid (H:776): its label over the amount, Due tinted while something is owed. */
function MoneyTile({
  label,
  amount,
  owed = false,
  eye,
}: {
  label: string;
  amount: string;
  owed?: boolean;
  eye?: { label: string; shown: boolean; onToggle: () => void };
}) {
  const Eyes = eye?.shown ? EyeOff : Eye;
  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 rounded-lg p-2.5',
        owed ? 'bg-destructive-tint' : 'bg-canvas',
      )}
    >
      <span className="text-caption text-muted-foreground">{label}</span>
      <span className="flex items-center gap-1">
        <span
          className={cn(
            'text-[length:calc(var(--text-base)*15/16)] font-semibold tabular-nums',
            owed && 'text-tone-blush-foreground',
          )}
        >
          {amount}
        </span>
        {eye ? (
          <button
            type="button"
            onClick={eye.onToggle}
            aria-label={eye.label}
            aria-pressed={eye.shown}
            title={eye.label}
            data-testid={`${TIMELINE_TEST_IDS.card('billing')}-eye`}
            className="text-muted-foreground hover:bg-foreground/5 flex size-5.5 items-center justify-center rounded-md transition-colors"
          >
            <Eyes aria-hidden="true" className="size-3.5" />
          </button>
        ) : null}
      </span>
    </div>
  );
}

/**
 * Billing (H:776, H:4996–4997): "New invoice"; Due (masked with the file,
 * its eye) and Paid; the last three invoices ("Clinic invoice #1042", "24 Sep
 * · ₹ ••••", Due blush / Paid sage), each opening the invoice; "Collect
 * payment" while something is owed.
 */
export function BillingBentoCard({
  onOpen,
  onNew,
  onInvoice,
  onCollect,
}: CardLinks & {
  onInvoice: (invoice: PatientInvoiceRow) => void;
  onCollect: (() => void) | null;
}) {
  const { t } = useTranslation([TIMELINE_NS, CLINIC_NS]);
  const { patientId, file, masked, toggleMasked } = usePatientFileContext();
  const day = useTableDay();
  const formatPaise = usePaiseFormat();
  const invoices = usePatientInvoices(patientId);
  const payments = usePatientPayments(patientId);
  const K = TIMELINE_KEYS.billing;
  const money = (paise: number) => (masked ? t(K.masked) : formatPaise(paise));
  const due = file?.due ?? 0;
  const paid = (payments.data ?? []).reduce(
    (sum, row) => sum + (row.direction === 'received' ? row.amount : -row.amount),
    0,
  );
  const rows = invoices.data ?? [];
  const testId = TIMELINE_TEST_IDS.card('billing');
  return (
    <BentoCard
      card="billing"
      title={t(TIMELINE_KEYS.cards.billing)}
      icon={Receipt}
      count={rows.length}
      onNew={onNew}
      onOpen={onOpen}
    >
      <div className="grid grid-cols-2 gap-2">
        <MoneyTile
          label={t(K.due)}
          amount={money(due)}
          owed={due > 0}
          eye={{
            label: t(masked ? K.show : K.hide),
            shown: !masked,
            onToggle: toggleMasked,
          }}
        />
        <MoneyTile label={t(K.paid)} amount={money(paid)} />
      </div>
      {rows.length > 0 ? (
        <div className="flex flex-col">
          {rows.slice(0, LISTED).map((invoice) => (
            <BentoRow
              key={invoice.id}
              title={t(K.invoice, {
                type: t(CLINIC_KEYS.invoiceTypes[invoice.type], { ns: CLINIC_NS }),
                number: displayId.invoiceNumber(invoice.seq),
              })}
              sub={t(K.sub, {
                date: day(invoice.date, true),
                amount: money(invoice.bill),
              })}
              tag={{
                label: t(
                  CLINIC_KEYS.invoiceStatuses[invoice.due > 0 ? 'unpaid' : 'paid'],
                  { ns: CLINIC_NS },
                ),
                tone: invoice.due > 0 ? 'blush' : 'sage',
              }}
              onClick={() => onInvoice(invoice)}
              testId={`${testId}-row`}
            />
          ))}
        </div>
      ) : null}
      {due > 0 && onCollect ? (
        <Button
          type="button"
          onClick={onCollect}
          data-testid={`${testId}-collect`}
          className="text-body h-9 w-full rounded-lg"
        >
          {t(K.collect)}
        </Button>
      ) : null}
    </BentoCard>
  );
}

/**
 * Reports (H:777, H:4998): "Upload report"; the last three — the name over
 * "Lab · 20 Sep" — each opening Reports; "No reports yet".
 */
export function ReportsBentoCard({ onOpen, onNew }: CardLinks) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const day = useTableDay();
  const reports = usePatientReports(patientId);
  const rows = reports.data ?? [];
  const testId = TIMELINE_TEST_IDS.card('reports');
  return (
    <BentoCard
      card="reports"
      title={t(TIMELINE_KEYS.cards.reports)}
      icon={FileIcon}
      count={rows.length}
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
      {reports.isSuccess && rows.length === 0 ? (
        <EmptyState
          variant="inline"
          testId={`${testId}-empty`}
          title={t(TIMELINE_KEYS.reports.empty)}
        />
      ) : null}
    </BentoCard>
  );
}

/**
 * Team notes (two columns wide; H:778, H:4999): the composer — "Write a note
 * for the team…" and "Post", Enter posting it — for a member who adds notes;
 * the last three notes with their author and time; "No notes yet".
 */
export function NotesBentoCard({ onOpen, canPost }: CardLinks & { canPost: boolean }) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const notes = usePatientNotes(patientId);
  const add = useAddPatientNote(patientId);
  const staff = useStaffLookup();
  const clock = useClinicClock();
  const [body, setBody] = useState('');
  const rows = notes.data ?? [];
  const K = TIMELINE_KEYS.notes;
  const post = () => {
    const input = { patientId, body: body.trim() };
    if (!patientNoteInputSchema.safeParse(input).success) return;
    add.mutate(input);
    setBody('');
  };
  return (
    <BentoCard
      card="notes"
      title={t(TIMELINE_KEYS.cards.notes)}
      icon={MessageSquare}
      count={rows.length}
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
            maxLength={NOTE_MAX}
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
          {rows.slice(0, LISTED).map((note) => {
            const author = staff(note.createdById);
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
                      date: clock.moment(note.createdAt),
                    })}
                  </span>
                </span>
              </div>
            );
          })}
        </div>
      ) : null}
      {notes.isSuccess && rows.length === 0 ? (
        <EmptyState
          variant="inline"
          testId={`${TIMELINE_TEST_IDS.card('notes')}-empty`}
          title={t(K.empty)}
        />
      ) : null}
    </BentoCard>
  );
}
