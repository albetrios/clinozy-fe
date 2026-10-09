import { useQueryClient } from '@tanstack/react-query';
import type { RefObject } from 'react';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import {
  APPOINTMENT_FORM_CANCEL_REASONS,
  type AppointmentFormCancelReason,
  cancelReasonToContract,
  isAppointmentSlotLocked,
  restoreGuard,
  transitionGuard,
} from '@/shared/api/clinic/appointment-status.ts';
import {
  appointmentQueryKeys,
  fetchBookingPerson,
} from '@/shared/api/clinic/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import type { PatientImage } from '@/shared/api/clinic/clinic-schema.ts';
import type { PatientPlan } from '@/shared/api/clinic/plan-contracts.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { toClinicPhone } from '@/shared/clinic/clinic-phone.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  OfferingSuggestions,
  type PlanCard,
} from '@/shared/components/OfferingSuggestions/index.ts';
import { PatientDrawer } from '@/shared/components/PatientDrawer/index.ts';
import { CONTACT_EDITOR_KEYS } from '@/shared/forms/ContactEditor/index.ts';
import {
  useAppointmentSlotLabel,
  useCancelAppointment,
  useRestoreAppointment,
  useSetAppointmentStatus,
  useUpdateAppointment,
} from '@/shared/hooks/useAppointments/index.ts';
import { useUpdateFixtureLead } from '@/shared/hooks/useFixtureLeads/index.ts';
import { useUpdatePatient } from '@/shared/hooks/usePatients/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';
import {
  type AppointmentDraft,
  detailsDone,
  planFlagOf,
  rescheduleNote,
  slotDone,
  type WhoDraft,
} from './appointment-form-model.ts';
import {
  cancelReasonText,
  detailsSummaryText,
  rescheduledText,
} from './appointment-form-words.ts';
import { AppointmentDetails } from './AppointmentDetails.tsx';
import { AppointmentStep } from './AppointmentStep.tsx';
import { DateTimeStep } from './DateTimeStep.tsx';
import { NotPatientCard, VisitPhotos } from './PatientSections.tsx';
import type { AppointmentFormState } from './use-appointment-form-state.ts';
import { VisitStatusSection } from './VisitStatusSection.tsx';
import { type WhoEdit, WhoSection } from './WhoSection.tsx';

const K = APPOINTMENT_FORM_KEYS;
const IDS = APPOINTMENT_FORM_TEST_IDS;
const APPT = CLINIC_KEYS.appointments;

/** The form's open and collapsed parts, and the stacked dialogs it raises. */
export interface AppointmentFormUi {
  detailsOpen: boolean;
  setDetailsOpen: (open: boolean | ((open: boolean) => boolean)) => void;
  /** The calendar's month, `YYYY-MM-01` — the draft's until the member pages it. */
  month: string;
  setMonth: (month: string) => void;
  planOpen: boolean;
  setPlanOpen: (open: boolean) => void;
  pricesShown: boolean;
  setPricesShown: (shown: boolean) => void;
  /** "Create patient record": the New patient form stacked. */
  openPatientForm: () => void;
  /** "Cancel visit": the reason confirm. */
  askCancel: () => void;
}

/** Where the form leaves to — it closes first. */
export interface AppointmentFormExits {
  openLead: (leadId: string) => void;
  /** A path under the patient file: `<patientId>/images/<imageId>` … */
  openPatientFile: (path: string) => void;
}

/** What "Save" on the inline editor writes: the patient or the lead behind the person. */
function contactWriteOf(
  who: WhoDraft,
  edit: WhoEdit,
):
  | {
      kind: 'patient';
      id: string;
      firstName: string;
      lastName: string | null;
      phone: string | null;
    }
  | { kind: 'lead'; id: string; name: string; phone: string | null }
  | null {
  const phone = edit.phone ? toClinicPhone(edit.phone) : null;
  if (who.kind === 'patient' && who.patientId) {
    const [firstName = edit.name, ...rest] = edit.name.split(/\s+/);
    return {
      kind: 'patient',
      id: who.patientId,
      firstName,
      lastName: rest.join(' ') || null,
      phone,
    };
  }
  if (who.leadId) return { kind: 'lead', id: who.leadId, name: edit.name, phone };
  return null;
}

/** The person behind a pick — what the usual doctor is looked up by. */
const personIdOf = (who: WhoDraft | null) =>
  who && who.kind !== 'new' ? (who.patientId ?? who.leadId) : null;

/** The search's pick, with the patient's usual doctor (`S:335`), and the inline contact editor's save. */
function useWhoActions(state: AppointmentFormState) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const queryClient = useQueryClient();
  const updated = t(CONTACT_EDITOR_KEYS.updated);
  const updatePatient = useUpdatePatient({ successMessage: updated });
  const updateLead = useUpdateFixtureLead({ successMessage: updated });
  const { change, draft, prefill } = state;

  const pickWho = (next: WhoDraft | null) => {
    change({ kind: 'who', who: next });
    const id = personIdOf(next);
    // The usual doctor — unless the prefill named one or a slot is already picked.
    if (!id || prefill.doctorId || draft.time) return;
    void queryClient
      .query({
        queryKey: appointmentQueryKeys.person(id),
        queryFn: () => fetchBookingPerson(id),
      })
      .then((found) => {
        if (found.usualDoctorId)
          change({ kind: 'doctor', doctorId: found.usualDoctorId });
      })
      .catch(() => undefined);
  };

  const saveContact = async (who: WhoDraft, edit: WhoEdit) => {
    const write = contactWriteOf(who, edit);
    if (write?.kind === 'patient') {
      await updatePatient.mutateAsync({
        id: write.id,
        patch: {
          firstName: write.firstName,
          lastName: write.lastName,
          ...(write.phone ? { phone: write.phone } : {}),
        },
      });
    } else if (write?.kind === 'lead') {
      await updateLead.mutateAsync({
        id: write.id,
        patch: { name: write.name, ...(write.phone ? { phone: write.phone } : {}) },
      });
    } else {
      notify.success(updated);
    }
    const phone = edit.phone ? toClinicPhone(edit.phone) : null;
    change({ kind: 'who', who: { ...who, name: edit.name, phone: phone ?? who.phone } });
    if (who.kind === 'new' && edit.phone)
      change({ kind: 'newPhone', digits: edit.phone });
  };

  return { pickWho, saveContact };
}

/** Who the booking is for — the search in New, the person's card after (H:2748–2755). */
export function WhoBlock({
  state,
  exits,
}: {
  state: AppointmentFormState;
  exits: AppointmentFormExits;
}) {
  const { pickWho, saveContact } = useWhoActions(state);
  return (
    <WhoSection
      draft={state.draft}
      onChange={(next) => {
        if (next.kind === 'who') pickWho(next.who);
        else state.change(next);
      }}
      leads={state.leads}
      canChange={state.mode === 'create' && !state.readOnly}
      disabled={state.inert}
      onOpenLead={exits.openLead}
      onSaveContact={saveContact}
    />
  );
}

/** Visit status in Edit: the tiles, the cancelled banner and Restore, the plan flag, Copy and Cancel visit. */
export function StatusBlock({
  state,
  row,
  plan,
  ui,
  onCopy,
  onPlan,
}: {
  state: AppointmentFormState;
  row: AppointmentRow;
  plan: PatientPlan | undefined;
  ui: AppointmentFormUi;
  onCopy?: () => void;
  /** The plan flag: the suggestions card opened and scrolled to. */
  onPlan: () => void;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const slotLabel = useAppointmentSlotLabel();
  const restore = useRestoreAppointment();
  const { draft, canEdit } = state;
  const canRestore = restoreGuard(row, { now: new Date(), canEdit }).allowed;
  const cancellable =
    canEdit && !['cancelled', 'completed', 'no_show'].includes(row.status);
  const note = rescheduleNote(draft, state.saved);
  return (
    <VisitStatusSection
      saved={row.status}
      draft={draft.status}
      date={draft.date ?? row.date}
      today={state.today}
      isPatient={state.isPatient}
      canEdit={canEdit}
      onPick={(status) => {
        state.change({ kind: 'status', status });
        if (isAppointmentSlotLocked(status)) ui.setDetailsOpen(false);
      }}
      onNeedsPatient={() =>
        notify.warning(t(APPT.guards.needsPatient, { ns: CLINIC_NS }), {
          action: { label: t(K.status.createPatient), onClick: ui.openPatientForm },
        })
      }
      cancelReason={cancelReasonText(t, row)}
      onRestore={canRestore ? () => restore.mutate(row.id) : undefined}
      restoring={restore.isPending}
      rescheduled={rescheduledText(t, note, slotLabel)}
      onCopy={onCopy}
      onCancelVisit={cancellable ? ui.askCancel : undefined}
      plan={planFlagOf(
        {
          edit: state.edit,
          isPatient: state.isPatient,
          status: draft.status,
          appointmentId: row.id,
        },
        plan?.suggestions,
      )}
      onPlan={onPlan}
    />
  );
}

/** Step 1 Appointment and step 2 Date & time (H:2763–2794). */
export function StepsBlock({
  state,
  ui,
  idPrefix,
}: {
  state: AppointmentFormState;
  ui: AppointmentFormUi;
  idPrefix: string;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const slotLabel = useAppointmentSlotLabel();
  const { draft, locked } = state;
  const doctor = state.staff.find((member) => member.id === draft.doctorId);
  const lockedSummary =
    locked && draft.date && draft.time
      ? t(K.slot.lockedSummary, slotLabel(draft.date, draft.time))
      : undefined;
  return (
    <>
      <AppointmentStep
        number={1}
        title={t(K.details.title)}
        open={ui.detailsOpen}
        done={detailsDone(draft)}
        summary={detailsSummaryText(t, draft, doctor)}
        hint={ui.detailsOpen ? undefined : t(K.details.open)}
        onToggle={() => ui.setDetailsOpen((open) => !open)}
        bodyClassName="gap-4 px-4 pt-1 pb-4.5"
        testId={IDS.details}
        toggleTestId={IDS.detailsToggle}
      >
        <AppointmentDetails
          draft={draft}
          onChange={state.change}
          packages={state.packages}
          staff={state.staff}
          offerings={state.offerings}
          disabled={state.inert}
          idPrefix={idPrefix}
        />
      </AppointmentStep>
      <AppointmentStep
        number={2}
        title={t(K.slot.title)}
        open={!locked}
        done={slotDone(draft)}
        summary={lockedSummary}
        hint={locked ? t(K.slot.locked) : undefined}
        onToggle={locked ? () => notify.info(t(K.slot.lockedToast)) : undefined}
        bodyClassName="px-4 pb-4"
        testId={IDS.slot}
        toggleTestId={IDS.slotToggle}
      >
        <DateTimeStep
          draft={draft}
          onChange={state.change}
          saved={state.saved}
          slots={state.slots}
          slotStep={state.slotStep}
          onSlotStepChange={state.setSlotStep}
          month={ui.month}
          onMonthChange={ui.setMonth}
          today={state.today}
          disabled={state.inert}
        />
      </AppointmentStep>
    </>
  );
}

/**
 * A patient's visit in Edit: its photos (check in first) and the offering
 * suggestions; for a lead or contact, step 3 "Not a patient yet" (H:2795–2826).
 */
export function PatientBlock({
  state,
  row,
  planCard,
  planRef,
  ui,
  exits,
}: {
  state: AppointmentFormState;
  row: AppointmentRow;
  planCard: PlanCard;
  /** The suggestions card — the plan flag scrolls to it. */
  planRef: RefObject<HTMLDivElement | null>;
  ui: AppointmentFormUi;
  exits: AppointmentFormExits;
}) {
  const setStatus = useSetAppointmentStatus();
  const { draft, canEdit } = state;
  const who = draft.who;
  if (!who || row.status === 'cancelled') return null;
  if (!state.isPatient) {
    return <NotPatientCard onCreate={canEdit ? ui.openPatientForm : undefined} />;
  }
  const subject = {
    status: row.status,
    date: row.date,
    startTime: row.startTime,
    isPatient: true,
  };
  const canCheckIn =
    canEdit && transitionGuard(subject, 'checked_in', { now: new Date() }).allowed;
  const openPhoto = (photo: PatientImage, edit: boolean) =>
    exits.openPatientFile(`${photo.patientId}/images/${photo.id}${edit ? '/edit' : ''}`);
  return (
    <>
      <VisitPhotos
        appointmentId={row.id}
        firstName={who.name.split(/\s+/)[0] ?? who.name}
        open={isAppointmentSlotLocked(row.status)}
        onCheckIn={
          canCheckIn
            ? () => setStatus.mutate({ id: row.id, status: 'checked_in' })
            : undefined
        }
        canPrivate={state.roles.some((role) =>
          ['doctor', 'admin', 'owner'].includes(role),
        )}
        canEdit={canEdit}
        onOpenPhoto={(photo) => openPhoto(photo, false)}
        onEditPhoto={(photo) => openPhoto(photo, true)}
      />
      {planCard.props ? (
        <div ref={planRef}>
          <OfferingSuggestions
            variant="form"
            open={ui.planOpen}
            onOpenChange={ui.setPlanOpen}
            pricesShown={ui.pricesShown}
            onPricesShownChange={ui.setPricesShown}
            {...planCard.props}
          />
        </div>
      ) : null}
    </>
  );
}

/**
 * "Create patient record" (H:6039): the New patient form stacked — the mobile,
 * care types and reason prefilled, the lead linked — and the booking linked to
 * the new patient; "<name> is now a patient · you can mark Completed".
 */
export function StackedPatientForm({
  draft,
  row,
  open,
  onClose,
}: {
  draft: AppointmentDraft;
  row: AppointmentRow;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const link = useUpdateAppointment({ successMessage: undefined });
  const who = draft.who;
  if (!who) return null;
  return (
    <PatientDrawer
      mode="quick"
      open={open}
      onClose={onClose}
      prefill={{
        name: who.name,
        phone: who.phone ?? undefined,
        leadId: who.leadId ?? undefined,
        types: /lhr|laser/i.test(draft.serviceLabel) ? ['lhr'] : ['aesthetic'],
        notes: draft.reason,
      }}
      createdMessage={() => t(K.notPatient.done, { name: who.name })}
      onPick={(patient) => {
        onClose();
        link.mutate({ id: row.id, patch: { patientId: patient.id } });
      }}
    />
  );
}

/** The cancel confirm's reasons — the form's own set (`appointments.md:225`). */
const FORM_CANCEL_OPTIONS = APPOINTMENT_FORM_CANCEL_REASONS.map((value) => ({
  value,
  labelKey: APPT.formCancelReasons[value],
}));

/** "Cancel visit" → "Cancel this appointment?" with the form's reasons (H:4145). */
export function CancelVisitConfirm({
  row,
  open,
  onClose,
}: {
  row: AppointmentRow;
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useTranslation(CLINIC_NS);
  const cancel = useCancelAppointment();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      title={t(APPT.cancelConfirm.title)}
      description={t(APPT.cancelConfirm.effect)}
      confirmLabel={t(APPT.cancelConfirm.action)}
      reason={{
        record: t(
          APPT.cancelConfirm.record,
          isolateValues({ name: row.person.name, service: row.serviceLabel }),
        ),
        options: FORM_CANCEL_OPTIONS,
      }}
      onConfirm={async (choice) => {
        const contract = cancelReasonToContract(
          choice.picked.value as AppointmentFormCancelReason,
          { note: choice.comment || null, label: choice.picked.label },
        );
        await cancel.mutateAsync({ id: row.id, ...contract });
      }}
    />
  );
}
