import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/app/app-display-id.ts';
import { localDateOf } from '@/shared/api/app/app-time.ts';
import type { PatientNextVisit } from '@/shared/api/app/patient-file-contracts.ts';
import type { PatientPackageRow } from '@/shared/api/app/patient-packages-contracts.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { APPOINTMENT_STATUS_TONES, TONE_CLASSES } from '@/shared/app/app-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import { useAppClock } from '@/shared/hooks/useAppClock/index.ts';
import {
  useAppointmentSlotLabel,
  usePersonAppointments,
} from '@/shared/hooks/useAppointments/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePatientPrescriptions } from '@/shared/hooks/usePrescriptions/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';
import { Calendar, Package, Pill, Sparkles } from '@/shared/icons/index.ts';

import { useTableDay } from '../../../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { useVisitWhen } from '../../../shared/patient-visit.ts';
import {
  OVERVIEW_CARD_TONES,
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BentoButton, BentoCard, BentoReadState, BentoRow } from './bento-card.tsx';
import { bentoRead } from './bento-read.ts';

/** How many records a card lists (H:4990 `slice(0, 3)`). */
const LISTED = 3;

/** How many medicines the Prescriptions card names (H:4994 `slice(0, 4)`). */
const MEDICINES_NAMED = 4;

/** What a card's head opens: none for a member who may not. */
interface CardLinks {
  onOpen: (() => void) | null;
}

/** What a card's head opens and adds: each none for a member who may not. */
interface NewCardLinks extends CardLinks {
  onNew?: { label: string; run: () => void } | null;
}

/**
 * The next visit (H:771): the 44px date tile, its time "11:00 am" and its
 * service — the file's read names no length for it.
 */
function NextVisitTile({ visit }: { visit: PatientNextVisit }) {
  const { formatDate } = useLocaleFormat();
  const when = useVisitWhen();
  const date = localDateOf(visit.date);
  return (
    <div className="bg-channel-call-tint flex items-center gap-3 rounded-lg p-2.5">
      <span
        data-slot="visit-date"
        className="bg-card text-tone-sky-foreground flex size-11 flex-none flex-col items-center justify-center rounded-lg leading-none"
      >
        <span className="text-[length:calc(var(--text-sm)*17/14)] font-semibold tabular-nums">
          {formatDate(date, { day: 'numeric' }, { civilDay: true })}
        </span>
        <span className="mt-0.5 text-[length:calc(var(--text-xs)*19/24)] font-semibold tracking-[0.06em] uppercase">
          {formatDate(date, { month: 'short' }, { civilDay: true })}
        </span>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="text-body truncate font-semibold">{when(visit)}</span>
        <span className="text-muted-foreground-strong truncate text-xs">
          {visit.serviceLabel}
        </span>
      </span>
    </div>
  );
}

/**
 * Visits (H:771, H:4990–4991): "Book", or "Reschedule" the next visit; the
 * next visit's tile (the file's read); the person's last three completed
 * bookings with their status (`GET /app/appointments?contact_id=`) — each
 * opening Visits; "No visits yet".
 */
export function VisitsBentoCard({
  onOpen,
  onBook,
  onReschedule,
}: CardLinks & {
  onBook: (() => void) | null;
  onReschedule: ((visit: PatientNextVisit) => void) | null;
}) {
  const { t } = useTranslation([TIMELINE_NS, APP_NS]);
  const { file } = usePatientFileContext();
  const visits = usePersonAppointments(file?.patient.contactId);
  const slot = useAppointmentSlotLabel();
  const rows = visits.data ?? [];
  const past = rows.filter((row) => row.status === 'completed').slice(0, LISTED);
  const next = file?.nextVisit ?? null;
  const title = t(TIMELINE_KEYS.cards.visits);
  const testId = TIMELINE_TEST_IDS.card('visits');
  let action = null;
  if (next && onReschedule) {
    action = (
      <BentoButton onClick={() => onReschedule(next)} testId={`${testId}-book`}>
        {t(TIMELINE_KEYS.visits.reschedule)}
      </BentoButton>
    );
  } else if (!next && onBook) {
    action = (
      <BentoButton onClick={onBook} testId={`${testId}-book`}>
        {t(TIMELINE_KEYS.visits.book)}
      </BentoButton>
    );
  }
  return (
    <BentoCard
      card="visits"
      title={title}
      icon={Calendar}
      count={rows.length}
      actions={action}
      onOpen={onOpen}
    >
      {next ? <NextVisitTile visit={next} /> : null}
      {past.length > 0 ? (
        <div className="flex flex-col">
          {past.map((row) => {
            const when = slot(row.date, row.startTime);
            return (
              <BentoRow
                key={row.id}
                title={row.serviceLabel}
                sub={`${when.day} · ${when.time}`}
                tag={{
                  label: t(APP_KEYS.appointments.statuses[row.status], {
                    ns: APP_NS,
                  }),
                  tone: APPOINTMENT_STATUS_TONES[row.status],
                }}
                onClick={() => onOpen?.()}
                testId={`${testId}-row`}
              />
            );
          })}
        </div>
      ) : null}
      <BentoReadState
        read={bentoRead(visits)}
        empty={rows.length === 0 && !next}
        label={title}
        emptyTitle={t(TIMELINE_KEYS.visits.empty)}
        testId={testId}
      />
    </BentoCard>
  );
}

/**
 * One package (H:773, H:4911–4913): its sessions as segments — used in the
 * card's ink, the next one marked — and its state as the server keeps it:
 * "All sessions done" (`used_up`), "Expired", else "Valid till …" / "No
 * expiry". "Next · 8 Oct" and "Session 2 overdue" go: the API dates no next
 * session of a package (G4).
 */
function PackageJourney({ row }: { row: PatientPackageRow }) {
  const { t } = useTranslation(TIMELINE_NS);
  const day = useTableDay();
  const K = TIMELINE_KEYS.packages;
  const { sessionsTotal: total, sessionsUsed: used } = row;
  const tone = TONE_CLASSES[OVERVIEW_CARD_TONES.packages];
  let state = row.validUntil
    ? t(K.validTill, { date: day(row.validUntil) })
    : t(K.noExpiry);
  if (row.status === 'expired') state = t(K.expired);
  if (row.status === 'used_up') state = t(K.done);
  const segment = (index: number) => {
    if (index < used) return tone.fill;
    if (index === used && row.status === 'active') return tone.dot;
    return 'bg-muted';
  };
  return (
    <div className="flex flex-col gap-2" data-status={row.status}>
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-body min-w-0 flex-1 truncate font-medium">{row.name}</span>
        <span className="text-detail flex-none font-semibold tabular-nums">
          {t(K.progress, { used, total })}
        </span>
      </div>
      <div aria-hidden="true" className="flex gap-0.75">
        {Array.from({ length: total }, (_, index) => index + 1).map((session) => (
          <span
            key={session}
            className={cn('h-1.5 flex-1 rounded-sm', segment(session - 1))}
          />
        ))}
      </div>
      <span className="text-muted-foreground-strong truncate text-xs">{state}</span>
    </div>
  );
}

/**
 * Packages (H:773, H:4993): each package the patient bought (`GET …/offerings?is_package=true`)
 * with its sessions as the server counts them; "No active packages". "Use session" goes — a
 * recorded treatment spends one (§6 #20).
 */
export function PackagesBentoCard({ onOpen }: CardLinks) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const packages = usePatientPackages(patientId);
  const rows = packages.data ?? [];
  const title = t(TIMELINE_KEYS.cards.packages);
  return (
    <BentoCard
      card="packages"
      title={title}
      icon={Package}
      count={rows.length}
      onOpen={onOpen}
    >
      {rows.map((row) => (
        <PackageJourney key={row.id} row={row} />
      ))}
      <BentoReadState
        read={bentoRead(packages)}
        empty={rows.length === 0}
        label={title}
        emptyTitle={t(TIMELINE_KEYS.packages.empty)}
        testId={TIMELINE_TEST_IDS.card('packages')}
      />
    </BentoCard>
  );
}

/**
 * Prescriptions (H:774, H:4994): "New prescription"; the latest "Rx #500"
 * with its date, up to four of its medicines and its advice; "No
 * prescriptions yet".
 */
export function PrescriptionsBentoCard({ onOpen, onNew }: NewCardLinks) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const day = useTableDay();
  // The card shows its own failure (BentoReadState).
  const prescriptions = usePatientPrescriptions(patientId, { notifyOnError: false });
  const rows = prescriptions.data ?? [];
  const [latest] = rows;
  // A medicine is free text: two lines may name the same one — one pill each name.
  const medicines = [...new Set(latest?.items.map((item) => item.medicineName))];
  const title = t(TIMELINE_KEYS.cards.prescriptions);
  const testId = TIMELINE_TEST_IDS.card('prescriptions');
  return (
    <BentoCard
      card="prescriptions"
      title={title}
      icon={Pill}
      count={rows.length}
      onNew={onNew}
      onOpen={onOpen}
    >
      {latest ? (
        <div
          data-testid={`${testId}-latest`}
          className="bg-canvas flex flex-col gap-2 rounded-lg p-2.5"
        >
          <span className="text-muted-foreground flex justify-between gap-2 text-xs">
            <span className="text-foreground font-semibold">
              {t(TIMELINE_KEYS.prescriptions.title, {
                number: displayId.prescription(latest.seq),
              })}
            </span>
            {day(latest.date)}
          </span>
          <div className="flex flex-wrap gap-1">
            {medicines.slice(0, MEDICINES_NAMED).map((name) => (
              <TonePill key={name} tone="sage" className="max-w-full truncate">
                {name}
              </TonePill>
            ))}
          </div>
          {latest.advice ? (
            <span className="text-muted-foreground-strong text-xs">{latest.advice}</span>
          ) : null}
        </div>
      ) : null}
      <BentoReadState
        read={bentoRead(prescriptions)}
        empty={rows.length === 0}
        label={title}
        emptyTitle={t(TIMELINE_KEYS.prescriptions.empty)}
        testId={testId}
      />
    </BentoCard>
  );
}

/**
 * Treatments (H:775, H:4995): "New treatment"; the last three sessions done —
 * a reversed one stays in Treatments, marked — the name over "Session 2 · 24
 * Sep 2026 · 15:00" (the server's session number), each opening its edit
 * drawer; "No treatments yet".
 */
export function TreatmentsBentoCard({
  onOpen,
  onNew,
  onEdit,
}: NewCardLinks & { onEdit: (treatmentId: string) => void }) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const clock = useAppClock();
  // The card shows its own failure (BentoReadState).
  const treatments = usePatientTreatments(patientId, { notifyOnError: false });
  const rows = (treatments.data ?? []).filter((row) => row.status === 'done');
  const title = t(TIMELINE_KEYS.cards.treatments);
  const testId = TIMELINE_TEST_IDS.card('treatments');
  return (
    <BentoCard
      card="treatments"
      title={title}
      icon={Sparkles}
      count={rows.length}
      onNew={onNew}
      onOpen={onOpen}
    >
      {rows.length > 0 ? (
        <div className="flex flex-col">
          {rows.slice(0, LISTED).map((row) => (
            <BentoRow
              key={row.id}
              title={row.name}
              sub={t(TIMELINE_KEYS.treatments.sub, {
                session: row.sessionNumber,
                date: clock.moment(row.performedAt),
              })}
              onClick={() => onEdit(row.id)}
              testId={`${testId}-row`}
            />
          ))}
        </div>
      ) : null}
      <BentoReadState
        read={bentoRead(treatments)}
        empty={rows.length === 0}
        label={title}
        emptyTitle={t(TIMELINE_KEYS.treatments.empty)}
        testId={testId}
      />
    </BentoCard>
  );
}
