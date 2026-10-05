import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/utils.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { PatientNextVisit } from '@/shared/api/clinic/patient-file-contracts.ts';
import type { PatientPackageRow } from '@/shared/api/clinic/patient-packages-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { APPOINTMENT_STATUS_TONES, TONE_CLASSES } from '@/shared/clinic/clinic-tones.ts';
import { TonePill } from '@/shared/components/Cells/index.ts';
import {
  useAppointmentSlotLabel,
  usePatientAppointments,
} from '@/shared/hooks/useAppointments/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePatientPrescriptions } from '@/shared/hooks/usePrescriptions/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';
import { Calendar, Package, Pill, Sparkles } from '@/shared/icons/index.ts';

import {
  useTableDay,
  useTableDayTime,
} from '../../../shared/components/PatientSectionTable/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';
import { useVisitWhen } from '../../../shared/patient-visit.ts';
import {
  TIMELINE_KEYS,
  TIMELINE_NS,
  TIMELINE_TEST_IDS,
} from '../../timeline.constants.ts';
import { BentoButton, BentoCard, BentoEmpty, BentoRow } from './bento-card.tsx';

/** How many records a card lists (H:4990 `slice(0, 3)`). */
const LISTED = 3;

/** How many medicines the Prescriptions card names (H:4994 `slice(0, 4)`). */
const MEDICINES_NAMED = 4;

/** What a card's head opens and adds: each none for a member who may not. */
interface CardLinks {
  onOpen: (() => void) | null;
  onNew?: { label: string; run: () => void } | null;
}

/** The next visit (H:771): the 44px date tile, "Today · 11:00 am" and "Peel · 30 min". */
function NextVisitTile({ visit }: { visit: PatientNextVisit }) {
  const { t } = useTranslation(TIMELINE_NS);
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
          {t(TIMELINE_KEYS.visits.service, {
            service: visit.serviceLabel,
            minutes: visit.durationMin,
          })}
        </span>
      </span>
    </div>
  );
}

/**
 * Visits (H:771, H:4990–4991): "Book", or "Reschedule" the next visit; the
 * next visit's tile; the last three completed visits with their status —
 * each opening Visits; "No visits yet".
 */
export function VisitsBentoCard({
  onOpen,
  onBook,
  onReschedule,
}: CardLinks & {
  onBook: (() => void) | null;
  onReschedule: ((visit: PatientNextVisit) => void) | null;
}) {
  const { t } = useTranslation([TIMELINE_NS, CLINIC_NS]);
  const { patientId, file } = usePatientFileContext();
  const visits = usePatientAppointments(patientId);
  const slot = useAppointmentSlotLabel();
  const rows = visits.data ?? [];
  const past = rows.filter((row) => row.status === 'completed').slice(0, LISTED);
  const next = file?.nextVisit ?? null;
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
      title={t(TIMELINE_KEYS.cards.visits)}
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
                  label: t(CLINIC_KEYS.appointments.statuses[row.status], {
                    ns: CLINIC_NS,
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
      {visits.isSuccess && rows.length === 0 ? (
        <BentoEmpty testId={`${testId}-empty`}>
          {t(TIMELINE_KEYS.visits.empty)}
        </BentoEmpty>
      ) : null}
    </BentoCard>
  );
}

/** One package's journey (H:773, H:4911–4913): its sessions as segments and what comes next. */
function PackageJourney({
  row,
  late,
  onUse,
}: {
  row: PatientPackageRow;
  late: boolean;
  onUse: ((row: PatientPackageRow) => void) | null;
}) {
  const { t } = useTranslation(TIMELINE_NS);
  const day = useTableDay();
  const K = TIMELINE_KEYS.packages;
  const { sessionsTotal: total, sessionsUsed: used } = row.package;
  const tone = row.offering?.tone ?? 'lav';
  const done = used >= total;
  let next = row.nextVisit
    ? t(K.next, { date: day(row.nextVisit, true) })
    : t(K.validTill, { date: day(row.package.validUntil) });
  if (late) next = t(K.overdue, { session: used + 1 });
  if (done) next = t(K.done);
  const segment = (index: number) => {
    if (index < used) return TONE_CLASSES[tone].fill;
    if (index === used) return late ? TONE_CLASSES.blush.fill : TONE_CLASSES[tone].dot;
    return 'bg-muted';
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-body min-w-0 flex-1 truncate font-medium">
          {row.offering?.name ?? '—'}
        </span>
        <span className="text-detail flex-none font-semibold tabular-nums">
          {t(K.progress, { used: Math.min(used, total), total })}
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
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-xs',
            late && !done ? 'text-tone-blush-foreground' : 'text-muted-foreground-strong',
          )}
        >
          {next}
        </span>
        {onUse ? (
          <BentoButton
            onClick={() => onUse(row)}
            testId={`${TIMELINE_TEST_IDS.card('packages')}-use`}
          >
            {t(K.use)}
          </BentoButton>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Packages (H:773, H:4993): each package's sessions as segments — used in
 * the tone's ink, the next in blush when the follow-up is overdue — "Next ·
 * 8 Oct" / "Session 2 overdue" / "All sessions done", "Use session"; "No
 * active packages".
 */
export function PackagesBentoCard({
  onOpen,
  onUse,
}: CardLinks & { onUse: ((row: PatientPackageRow) => void) | null }) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId, file } = usePatientFileContext();
  const packages = usePatientPackages(patientId);
  const rows = packages.data ?? [];
  const followUp = file?.patient.followUpAt ?? null;
  const late = followUp !== null && followUp < new Date().toISOString();
  return (
    <BentoCard
      card="packages"
      title={t(TIMELINE_KEYS.cards.packages)}
      icon={Package}
      count={rows.length}
      onOpen={onOpen}
    >
      {rows.map((row) => (
        <PackageJourney key={row.package.id} row={row} late={late} onUse={onUse} />
      ))}
      {packages.isSuccess && rows.length === 0 ? (
        <BentoEmpty testId={`${TIMELINE_TEST_IDS.card('packages')}-empty`}>
          {t(TIMELINE_KEYS.packages.empty)}
        </BentoEmpty>
      ) : null}
    </BentoCard>
  );
}

/**
 * Prescriptions (H:774, H:4994): "New prescription"; the latest "Rx #500"
 * with its date, up to four medicines and its advice; "No prescriptions yet".
 */
export function PrescriptionsBentoCard({ onOpen, onNew }: CardLinks) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const day = useTableDay();
  const prescriptions = usePatientPrescriptions(patientId);
  const rows = prescriptions.data ?? [];
  const [latest] = rows;
  const testId = TIMELINE_TEST_IDS.card('prescriptions');
  return (
    <BentoCard
      card="prescriptions"
      title={t(TIMELINE_KEYS.cards.prescriptions)}
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
            {latest.items.slice(0, MEDICINES_NAMED).map((item) => (
              <TonePill
                key={item.medicineName}
                tone="sage"
                className="max-w-full truncate"
              >
                {item.medicineName}
              </TonePill>
            ))}
          </div>
          {latest.advice ? (
            <span className="text-muted-foreground-strong text-xs">{latest.advice}</span>
          ) : null}
        </div>
      ) : null}
      {prescriptions.isSuccess && rows.length === 0 ? (
        <BentoEmpty testId={`${testId}-empty`}>
          {t(TIMELINE_KEYS.prescriptions.empty)}
        </BentoEmpty>
      ) : null}
    </BentoCard>
  );
}

/**
 * Treatments (H:775, H:4995): "New treatment"; the last three — the name
 * over "Session 2 · 24 Sep 2026 · 15:00", as the Treatments table writes the
 * day — each opening its edit drawer; "No treatments yet".
 */
export function TreatmentsBentoCard({
  onOpen,
  onNew,
  onEdit,
}: CardLinks & { onEdit: (treatmentId: string) => void }) {
  const { t } = useTranslation(TIMELINE_NS);
  const { patientId } = usePatientFileContext();
  const dayTime = useTableDayTime();
  const treatments = usePatientTreatments(patientId);
  const rows = treatments.data ?? [];
  const testId = TIMELINE_TEST_IDS.card('treatments');
  return (
    <BentoCard
      card="treatments"
      title={t(TIMELINE_KEYS.cards.treatments)}
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
                session: row.sessionNo,
                date: dayTime(row.performedAt),
              })}
              onClick={() => onEdit(row.id)}
              testId={`${testId}-row`}
            />
          ))}
        </div>
      ) : null}
      {treatments.isSuccess && rows.length === 0 ? (
        <BentoEmpty testId={`${testId}-empty`}>
          {t(TIMELINE_KEYS.treatments.empty)}
        </BentoEmpty>
      ) : null}
    </BentoCard>
  );
}
