import { useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import {
  APPOINTMENT_FORM_CANCEL_REASONS,
  type AppointmentFormCancelReason,
  cancelReasonToContract,
  isAppointmentSlotLocked,
  restoreGuard,
} from '@/shared/api/app/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import { contactQueryKeys, fetchContact } from '@/shared/api/app/contacts-api.ts';
import { APP_KEYS, APP_NS } from '@/shared/app/app.constants.ts';
import { SECTION_TONES } from '@/shared/app/app-tones.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import type { DrawerPeekItem } from '@/shared/components/DrawerSteps/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { Button } from '@/shared/components/ui/button.tsx';
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
import { cancelReasonText, rescheduledText } from './appointment-form-words.ts';
import { AppointmentDetails } from './AppointmentDetails.tsx';
import { AppointmentStep } from './AppointmentStep.tsx';
import { DateTimeStep } from './DateTimeStep.tsx';
import type { AppointmentFormState } from './use-appointment-form-state.ts';
import { VisitStatusSection } from './VisitStatusSection.tsx';
import { type WhoEdit, WhoSection } from './WhoSection.tsx';

const K = APPOINTMENT_FORM_KEYS;
const IDS = APPOINTMENT_FORM_TEST_IDS;
const APPT = APP_KEYS.appointments;

/** The form's step cards: step 1 Appointment, step 2 Date & time — '' when both are folded. */
export type AppointmentStepId = 'details' | 'slot' | '';

/** The form's open and collapsed parts, and the stacked dialogs it raises. */
export interface AppointmentFormUi {
  /** The one open step card. */
  openStep: AppointmentStepId;
  setOpenStep: (step: AppointmentStepId) => void;
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
      canChange={state.mode === 'create' && !state.readOnly && !state.prefill.lockedWho}
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
  const { t } = useTranslation([APPOINTMENT_FORM_NS, APP_NS]);
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
        if (isAppointmentSlotLocked(status)) ui.setOpenStep('');
      }}
      onNeedsPatient={() => notify.warning(t(APPT.guards.needsPatient, { ns: APP_NS }))}
      cancelReason={cancelReasonText(t, row)}
      onRestore={canRestore ? () => restore.mutate(row) : undefined}
      restoring={restore.isPending}
      rescheduled={rescheduledText(t, note, slotLabel)}
      onCopy={onCopy}
      onCancelVisit={cancellable ? ui.askCancel : undefined}
    />
  );
}

/** What each collapsed step card summarises — the values the save sends. */
function useStepPeeks(state: AppointmentFormState) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const slotLabel = useAppointmentSlotLabel();
  const { draft } = state;
  const doctor = state.staff.find((member) => member.id === draft.doctorId);
  const slot = draft.date && draft.time ? slotLabel(draft.date, draft.time) : null;
  const details: DrawerPeekItem[] = [
    { kind: 'value', label: t(K.details.type), value: draft.serviceLabel.trim() },
    { kind: 'value', label: t(K.details.doctor), value: doctor?.name },
    {
      kind: 'value',
      label: t(K.details.length),
      value: t(K.footer.minutes, { minutes: draft.durationMin }),
    },
    { kind: 'value', label: t(K.details.reason), value: draft.reason.trim() },
    { kind: 'value', label: t(K.details.notes), value: draft.notes.trim() },
  ];
  const time: DrawerPeekItem[] = [
    { kind: 'value', label: t(K.slot.date), value: slot?.day },
    { kind: 'value', label: t(K.slot.time), value: slot?.time },
  ];
  return {
    details,
    slot: time,
    lockedLine: slot ? t(K.slot.lockedSummary, slot) : undefined,
  };
}

/**
 * Step 1 Appointment and step 2 Date & time (H:2763–2794), as every drawer's
 * step cards: one open at a time, step 1 ending with "Next: Date & time →";
 * after check-in step 2 is locked — a tap explains why.
 */
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
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { draft, locked } = state;
  const peeks = useStepPeeks(state);
  const tone = SECTION_TONES.appointments;
  const toggle = (step: Exclude<AppointmentStepId, ''>) =>
    ui.setOpenStep(ui.openStep === step ? '' : step);
  const hint = (done: boolean) =>
    tDrawer(done ? RECORD_DRAWER_KEYS.step.edit : RECORD_DRAWER_KEYS.step.open);
  const detailsIsDone = detailsDone(draft);
  const slotIsDone = slotDone(draft);
  return (
    <>
      <AppointmentStep
        number={1}
        total={2}
        title={t(K.details.title)}
        open={ui.openStep === 'details'}
        done={detailsIsDone}
        peek={peeks.details}
        hint={hint(detailsIsDone)}
        tone={tone}
        onToggle={() => toggle('details')}
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
        {locked ? null : (
          <div className="flex justify-end">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-testid={IDS.detailsNext}
              className="text-detail h-8 max-w-full rounded-lg px-3"
              onClick={() => ui.setOpenStep('slot')}
            >
              <span className="truncate">
                {tDrawer(RECORD_DRAWER_KEYS.step.next, { step: t(K.slot.title) })}
              </span>
            </Button>
          </div>
        )}
      </AppointmentStep>
      <AppointmentStep
        number={2}
        total={2}
        title={t(K.slot.title)}
        open={!locked && ui.openStep === 'slot'}
        done={slotIsDone}
        locked={locked}
        peek={peeks.slot}
        line={locked ? peeks.lockedLine : undefined}
        hint={locked ? t(K.slot.locked) : hint(slotIsDone)}
        tone={tone}
        onToggle={
          locked ? () => notify.info(t(K.slot.lockedToast)) : () => toggle('slot')
        }
        bodyClassName="px-4 pb-4"
        testId={IDS.slot}
        toggleTestId={IDS.slotToggle}
      >
        <DateTimeStep
          draft={draft}
          onChange={state.change}
          saved={state.saved}
          slots={state.slots}
          slotsStatus={state.slotsStatus}
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
  const { t } = useTranslation(APP_NS);
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
