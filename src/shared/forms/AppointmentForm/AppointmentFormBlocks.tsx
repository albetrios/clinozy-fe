import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import {
  APPOINTMENT_FORM_CANCEL_REASONS,
  type AppointmentFormCancelReason,
  cancelReasonToContract,
  isAppointmentSlotLocked,
  restoreGuard,
} from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { contactQueryKeys, fetchContact } from '@/shared/api/clinic/contacts-api.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  CONTACT_EDITOR_KEYS,
  contactFieldsOf,
  contactValueOf,
  emptyContactValue,
} from '@/shared/forms/ContactEditor/index.ts';
import {
  useAppointmentSlotLabel,
  useCancelAppointment,
  useReinstateAppointment,
} from '@/shared/hooks/useAppointments/index.ts';
import { useUpdateContact } from '@/shared/hooks/useContacts/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';
import {
  detailsDone,
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
  /** "Cancel visit": the reason confirm. */
  askCancel: () => void;
}

/** Where the form leaves to — it closes first. */
export interface AppointmentFormExits {
  openLead: (leadId: string) => void;
  /** A path under the patient file: `<patientId>/<section>` (a chat history chip). */
  openPatientFile: (path: string) => void;
}

/**
 * The search's pick, and the inline Name · Mobile editor's save: a known person's contact
 * (`PATCH /app/contacts/:contact_id` with its every other number and field as read), a new
 * person's draft.
 */
function useWhoActions(state: AppointmentFormState) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((store) => store.organizationId);
  const updateContact = useUpdateContact({
    successMessage: t(CONTACT_EDITOR_KEYS.updated),
  });
  const { change } = state;

  const pickWho = (next: WhoDraft | null) => change({ kind: 'who', who: next });

  const saveContact = async (who: WhoDraft, edit: WhoEdit) => {
    if (who.kind === 'new' || !who.contactId) {
      change({ kind: 'who', who: { ...who, name: edit.name } });
      if (edit.phone) change({ kind: 'newPhone', digits: edit.phone });
      return;
    }
    const contactId = who.contactId;
    const contact = await queryClient.query({
      queryKey: contactQueryKeys.one(organizationId, contactId),
      queryFn: () => fetchContact(contactId),
    });
    const value = contactValueOf(contact);
    const [primary, ...others] = value.phones;
    const phones = edit.phone
      ? [{ digits: edit.phone, whatsapp: primary?.whatsapp ?? true }, ...others]
      : value.phones;
    const { firstName, lastName } = emptyContactValue(edit.name);
    const saved = await updateContact.mutateAsync({
      contact,
      fields: contactFieldsOf({ ...value, firstName, lastName, phones }),
    });
    change({
      kind: 'who',
      who: { ...who, name: saved.name, phone: saved.primaryPhone },
    });
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
      canChange={state.mode === 'create' && !state.readOnly}
      disabled={state.inert}
      onOpenLead={exits.openLead}
      onSaveContact={saveContact}
    />
  );
}

/** Visit status in Edit: the tiles, the cancelled banner and Restore, Copy and Cancel visit. */
export function StatusBlock({
  state,
  row,
  ui,
  onCopy,
}: {
  state: AppointmentFormState;
  row: AppointmentRow;
  ui: AppointmentFormUi;
  onCopy?: () => void;
}) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const slotLabel = useAppointmentSlotLabel();
  const restore = useReinstateAppointment();
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
        notify.warning(t(APPT.guards.needsPatient, { ns: CLINIC_NS }))
      }
      cancelReason={cancelReasonText(t, row)}
      onRestore={canRestore ? () => restore.mutate(row) : undefined}
      restoring={restore.isPending}
      rescheduled={rescheduledText(t, note, slotLabel)}
      onCopy={onCopy}
      onCancelVisit={cancellable ? ui.askCancel : undefined}
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
          staff={state.staff}
          treatments={state.treatments}
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
          choice.comment || null,
        );
        await cancel.mutateAsync({ appointment: row, cancel: contract });
      }}
    />
  );
}
