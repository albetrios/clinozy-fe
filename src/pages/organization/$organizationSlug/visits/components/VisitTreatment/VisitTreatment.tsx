import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { addCivilDays } from '@/shared/api/clinic/clinic-time.ts';
import type { VisitDetail } from '@/shared/api/clinic/visits-contracts.ts';
import { personFullName, shortPersonName } from '@/shared/components/Cells/index.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import { useBookableStaff } from '@/shared/hooks/useAppointments/index.ts';
import { useClinicClock } from '@/shared/hooks/useClinicClock/index.ts';
import {
  useRecordVisitSession,
  useRestoreVisitSession,
  useReverseVisitSession,
} from '@/shared/hooks/useVisits/index.ts';
import { notify } from '@/shared/notify/index.ts';

import type { VisitSave } from '../../hooks/useVisitSave/index.ts';
import { useVisitDraft } from '../../store/useVisitDraftStore/index.ts';
import { VISIT_KEYS, VISIT_NS, VISIT_TEST_IDS } from '../../visits.constants.ts';
import { NeedsPatient } from '../VisitSheet/needs-patient.tsx';
import { AreaPills, SessionHead, SettingsTable } from './session-parts.tsx';
import { type TreatmentView, treatmentView, useCivilDay } from './treatment-view.ts';
import { VisitPhotos } from './visit-photos.tsx';

const K = VISIT_KEYS.treatment;
const ids = VISIT_TEST_IDS.treatment;

/** The day-2 feedback call a session's aftercare sets (`today.md:107`). */
const FEEDBACK_AFTER_DAYS = 2;

/** Props of {@link VisitTreatment}. */
export interface VisitTreatmentProps {
  detail: VisitDetail;
  save: VisitSave;
}

/** A staff member's short name by id ("Kiran P.", "Dr. Nisha"), from the bookable team. */
function useStaffName(): (id: string | null) => string | null {
  const staff = useBookableStaff().data ?? [];
  return (id) => {
    const member = staff.find((candidate) => candidate.id === id);
    return member ? shortPersonName(personFullName(member)) : null;
  };
}

/**
 * The recorded box (`today.md:107`): "✓ Session <k> recorded · <n> left ·
 * feedback call <day> (<therapist>) · Reverse with reason" — the reason
 * confirm soft-deletes the session, its toast's Undo restores it.
 */
function SessionRecorded({
  detail,
  treatment,
  view,
  therapist,
}: {
  detail: VisitDetail;
  treatment: Treatment;
  view: TreatmentView;
  therapist: string | null;
}) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const civilDay = useCivilDay();
  const reverse = useReverseVisitSession();
  const restore = useRestoreVisitSession();
  const [reversing, setReversing] = useState(false);
  const visitId = detail.visit.id;
  const callDay = addCivilDays(clock.dayOf(treatment.performedAt), FEEDBACK_AFTER_DAYS);
  const call = t(therapist ? K.call : K.callDay, {
    day: civilDay(callDay, { weekday: 'short', day: 'numeric', month: 'short' }),
    therapist,
  });

  return (
    <>
      <p
        data-testid={ids.recorded}
        className="text-body bg-tone-sage border-tone-sage-border text-tone-sage-foreground rounded-lg border px-3 py-2.5"
      >
        {t(detail.pack ? K.recorded : K.recordedOpen, {
          session: treatment.sessionNo,
          left: view.left,
          call,
        })}{' '}
        ·{' '}
        <button
          type="button"
          onClick={() => setReversing(true)}
          data-testid={ids.reverse}
          className="underline underline-offset-2"
        >
          {t(K.reverse)}
        </button>
      </p>
      <ConfirmDialog
        open={reversing}
        onOpenChange={setReversing}
        title={t(K.reverseTitle)}
        confirmLabel={t(K.reverse)}
        reason={{
          record: t(K.session, { session: treatment.sessionNo }),
          undo: {
            message: t(K.reversed, { session: treatment.sessionNo }),
            onUndo: () => restore.mutate({ visitId, treatmentId: treatment.id }),
          },
        }}
        onConfirm={async ({ reason, note }) => {
          await reverse.mutateAsync({ visitId, reason, note });
        }}
      />
    </>
  );
}

/**
 * Visit sheet › Treatment (KICKOFF §6.13; `today.md:95–108, 260–262`;
 * H:2581–2622, H:4624–4626): the session — its head, the package's bar and
 * line, the doctor's instruction (the consult's plan), the settings against
 * the last session's (each today ≤ 20) and the areas treated — and "Complete
 * session <k> of <m>": one write (one package session; its day-2 feedback call
 * follows), the recorded box in its place, the card on to Checkout, the sheet
 * open. The photo comparison beside it. Two columns from `md`, one below.
 */
export function VisitTreatment({ detail, save }: VisitTreatmentProps) {
  const { t } = useTranslation(VISIT_NS);
  const clock = useClinicClock();
  const civilDay = useCivilDay();
  const staffName = useStaffName();
  const { draft, update } = useVisitDraft(detail.visit.id);
  const record = useRecordVisitSession();

  if (!detail.person.patientId) return <NeedsPatient />;

  const { pack, treatment, lastTreatment } = detail;
  const view = treatmentView(detail, draft);
  const therapist = staffName(view.therapistId);

  const onComplete = () => {
    if (record.isPending) return;
    const params = Object.fromEntries(
      view.settings.map((key) => [key, view.todayOf(key)]),
    );
    void save.run(
      () =>
        record.mutateAsync({ visitId: detail.visit.id, params, bodyParts: view.areas }),
      ({ treatment: saved }) => {
        update({ settings: {}, areas: null });
        const callDay = addCivilDays(clock.dayOf(saved.performedAt), FEEDBACK_AFTER_DAYS);
        const values = {
          session: saved.sessionNo,
          total: view.total ?? 0,
          name: detail.person.name,
          left: view.left,
          day: civilDay(callDay, { weekday: 'short' }),
        };
        notify.success(t(pack ? K.recordedToast : K.recordedToastOpen, values));
      },
    );
  };

  let completeLabel = t(K.completeOpen, { session: view.session });
  if (record.isPending) completeLabel = t(K.recording);
  else if (view.total)
    completeLabel = t(K.complete, { session: view.session, total: view.total });

  return (
    <div
      data-testid={ids.root}
      className="grid h-full min-h-0 grid-cols-1 max-md:h-auto md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]"
    >
      <div className="flex min-h-0 flex-col gap-3 overflow-auto px-5 py-3.5 max-md:overflow-visible max-md:px-3">
        <SessionHead
          view={view}
          pack={pack}
          recorded={treatment !== null}
          therapist={therapist}
          instruction={detail.visit.note?.plan || null}
        />
        <SettingsTable
          view={view}
          lastSession={lastTreatment?.sessionNo ?? null}
          lastValue={(key) => lastTreatment?.params[key] ?? null}
          readOnly={treatment !== null}
          onChange={(key, value) =>
            update((current) => ({ settings: { ...current.settings, [key]: value } }))
          }
        />
        <AreaPills
          areas={view.areas}
          readOnly={treatment !== null}
          onChange={(areas) => update({ areas })}
        />
        {treatment ? (
          <SessionRecorded
            detail={detail}
            treatment={treatment}
            view={view}
            therapist={therapist}
          />
        ) : (
          <>
            <button
              type="button"
              aria-disabled={record.isPending}
              onClick={onComplete}
              data-testid={ids.complete}
              className="bg-tone-sage border-tone-sage-dot text-tone-sage-foreground rounded-lg border px-3.5 py-2.5 text-sm font-medium max-md:min-h-11"
            >
              {completeLabel}
            </button>
            <p className="text-muted-foreground-strong text-xs leading-[1.45]">
              {t(K.completeNote)}
            </p>
          </>
        )}
      </div>
      <VisitPhotos detail={detail} />
    </div>
  );
}
