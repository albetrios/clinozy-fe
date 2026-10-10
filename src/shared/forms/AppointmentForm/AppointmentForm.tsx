import { useNavigate, useParams } from '@tanstack/react-router';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationLead } from '@/lib/routes/leads-builders.ts';
import { isAppointmentSlotLocked } from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import { civilMonthStart } from '@/shared/api/clinic/clinic-time.ts';
import { CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  ChatColumn,
  type ChatHistoryTarget,
} from '@/shared/components/ChatColumn/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import { SkeletonRows } from '@/shared/components/SkeletonRows/index.ts';
import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { useAppointmentSlotLabel } from '@/shared/hooks/useAppointments/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useViewportTier } from '@/shared/hooks/useViewportTier/index.ts';
import { useViewportWidth } from '@/shared/hooks/useViewportWidth/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useDevicePrefsStore } from '@/shared/store/useDevicePrefsStore/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
  APPOINTMENT_FORM_TEST_IDS,
} from './appointment-form.constants.ts';
import { draftComplete, saveLabelKind } from './appointment-form-model.ts';
import { appointmentFormWidths } from './appointment-form-widths.ts';
import { footerSummary, formTitle, saveLabelText } from './appointment-form-words.ts';
import {
  type AppointmentFormExits,
  type AppointmentFormUi,
  CancelVisitConfirm,
  StatusBlock,
  StepsBlock,
  WhoBlock,
} from './AppointmentFormBlocks.tsx';
import {
  type AppointmentFormInput,
  type AppointmentFormState,
  useAppointmentFormState,
} from './use-appointment-form-state.ts';
import {
  type AppointmentSaveOutcome,
  useAppointmentSave,
} from './use-appointment-save.ts';

const K = APPOINTMENT_FORM_KEYS;
const IDS = APPOINTMENT_FORM_TEST_IDS;

/** Props for {@link AppointmentForm}. */
export interface AppointmentFormProps extends AppointmentFormInput {
  open: boolean;
  /** Every exit, once the dirty guard (Edit) has let it through. */
  onClose: () => void;
  /** Saved — the host closes the form (a new booking's day moves the page behind it, D28). */
  onSaved?: (outcome: AppointmentSaveOutcome) => void;
  /**
   * Copy (and Rebook for a No-show): the host opens a New form from this
   * booking (`create/?copyOf=`); without it the form becomes that New form itself.
   */
  onCopy?: (appointment: AppointmentRow) => void;
  /** An "Appointment #…" chip in the chat: that booking. */
  onOpenAppointment?: (appointmentId: string) => void;
}

/** The shape every opening of the form shares. */
interface SessionProps extends AppointmentFormProps {
  /** A Copy turned this opening into a New form (when the host has no `onCopy`). */
  onCopyHere: (row: AppointmentRow) => void;
}

/** Step 1 starts collapsed from a chat, a task or a Copy, and once the visit is checked in. */
function startsCollapsed(state: AppointmentFormState): boolean {
  if (state.prefill.collapsed || state.prefill.copyOf) return true;
  return (
    state.edit && state.row !== undefined && isAppointmentSlotLocked(state.row.status)
  );
}

/** The form's open and collapsed parts, and the stacked dialogs it raises. */
function useFormUi(state: AppointmentFormState) {
  // Step 1 follows the booking until the member toggles it: an Edit's booking
  // can arrive after the drawer has opened.
  const [detailsToggled, setDetailsToggled] = useState<boolean | null>(null);
  const detailsOpen = detailsToggled ?? !startsCollapsed(state);
  const setDetailsOpen = (next: boolean | ((open: boolean) => boolean)) =>
    setDetailsToggled(typeof next === 'function' ? next(detailsOpen) : next);
  const [pagedMonth, setPagedMonth] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const ui: AppointmentFormUi = {
    detailsOpen,
    setDetailsOpen,
    month: pagedMonth ?? civilMonthStart(state.draft.date ?? state.today),
    setMonth: setPagedMonth,
    askCancel: () => setAsking(true),
  };
  return {
    ui,
    asking,
    closeCancel: () => setAsking(false),
  };
}

/** "Copied · pick a date and time" once, when a New form opens from a Copy (H:4147). */
function useCopiedToast(state: AppointmentFormState) {
  const { t } = useTranslation(APPOINTMENT_FORM_NS);
  const shown = useRef(false);
  const copying = state.mode === 'create' && Boolean(state.prefill.copyOf);
  useEffect(() => {
    if (!copying || shown.current) return;
    shown.current = true;
    notify.success(t(K.copied));
  }, [copying, t]);
}

/** Where the form leaves to — it closes first, then navigates. */
function useFormExits(onClose: () => void): AppointmentFormExits {
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  return {
    openLead: (leadId) => {
      onClose();
      void navigate(organizationLead(organizationSlug, leadId));
    },
    openPatientFile: (path) => {
      onClose();
      void navigate({ href: `/organization/${organizationSlug}/patients/${path}` });
    },
  };
}

/** The person's thread for the chat column: their contact's activity. */
function chatPersonOf(state: AppointmentFormState) {
  const contactId = state.draft.who?.contactId;
  return contactId ? ({ kind: 'contact', contactId } as const) : null;
}

/**
 * The chat column beside the form in Edit from `md` (H:2737): the person's
 * thread; its "Appointment #…" chips open that booking, the rest the file.
 */
function useChatAside(
  state: AppointmentFormState,
  props: Pick<AppointmentFormProps, 'onOpenAppointment'>,
  exits: AppointmentFormExits,
) {
  const phone = useViewportTier() === 'phone';
  const viewportWidth = useViewportWidth();
  const chatPreference = useDevicePrefsStore((store) => store.leadChatWidth);
  const person = chatPersonOf(state);
  const who = state.draft.who;
  const show = state.edit && !phone && person !== null && who !== null;
  const widths = appointmentFormWidths(viewportWidth, chatPreference, show);
  const openHistory = (target: ChatHistoryTarget) => {
    if (target.kind === 'appointment') props.onOpenAppointment?.(target.appointmentId);
    else exits.openPatientFile(`${target.patientId}/${target.section}`);
  };
  if (!(show && person && who)) return { total: widths.total, aside: undefined };
  return {
    total: widths.total,
    aside: {
      width: widths.chat,
      content: (
        <div data-testid={IDS.chat} className="flex h-full min-h-0 flex-col">
          <ChatColumn
            person={person}
            contact={{ name: who.name, phone: who.phone, isPatient: state.isPatient }}
            onOpenHistory={openHistory}
          />
        </div>
      ),
    },
  };
}

/** The footer's words: the summary and the primary's label. */
function useFooterWords(state: AppointmentFormState) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const slotLabel = useAppointmentSlotLabel();
  const { draft } = state;
  const doctor = state.staff.find((member) => member.id === draft.doctorId);
  const slot =
    draft.date && draft.time ? slotLabel(draft.date, draft.time) : { day: '', time: '' };
  return {
    summary: state.started ? footerSummary(t, draft, doctor) : undefined,
    saveLabel: saveLabelText(t, saveLabelKind(state.mode, draft, state.saved), slot),
  };
}

/** The save: checked, sent, then the host closes (or the form, without `onSaved`). */
function useFormSave(
  state: AppointmentFormState,
  ui: AppointmentFormUi,
  props: Pick<AppointmentFormProps, 'onSaved' | 'onClose'>,
) {
  const { onSaved, onClose } = props;
  return useAppointmentSave({
    mode: state.mode,
    row: state.row ?? null,
    source: state.mode === 'create' ? state.source : undefined,
    branchId: state.branchId,
    onProblem: (problem) => {
      if (problem === 'doctor') ui.setDetailsOpen(true);
    },
    onDone: (outcome) => (onSaved ? onSaved(outcome) : onClose()),
  });
}

/** The form's sections, in order — Edit adds the status tiles. */
function FormBody({
  state,
  ui,
  exits,
  onCopy,
}: {
  state: AppointmentFormState;
  ui: AppointmentFormUi;
  exits: AppointmentFormExits;
  onCopy?: (row: AppointmentRow) => void;
}) {
  const idPrefix = `appointment-${useId().replace(/:/g, '')}`;
  const row = state.edit ? state.row : undefined;
  return (
    <div data-testid={IDS.form} className="@container flex flex-col gap-3">
      <WhoBlock state={state} exits={exits} />
      {row ? (
        <StatusBlock
          state={state}
          row={row}
          ui={ui}
          onCopy={onCopy ? () => onCopy(row) : undefined}
        />
      ) : null}
      <StepsBlock state={state} ui={ui} idPrefix={idPrefix} />
    </div>
  );
}

/** One opening of the form: its draft, its checks and its writes. */
function AppointmentFormSession(props: SessionProps) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, CLINIC_NS]);
  const state = useAppointmentFormState(props);
  const { ui, asking, closeCancel } = useFormUi(state);
  useCopiedToast(state);
  const exits = useFormExits(props.onClose);
  const { saveState, save } = useFormSave(state, ui, {
    onSaved: props.onSaved,
    onClose: props.onClose,
  });
  const chat = useChatAside(state, { onOpenAppointment: props.onOpenAppointment }, exits);
  const footer = useFooterWords(state);
  const { row, draft } = state;
  const title = formTitle(t, state.mode, row);
  const copy = props.onCopy ?? props.onCopyHere;
  return (
    <>
      <RecordDrawer
        open={props.open}
        onClose={props.onClose}
        title={title}
        sub={t(K.sub)}
        testId={state.mode === 'create' ? IDS.createDrawer : IDS.drawer}
        panelWidth={chat.total}
        aside={chat.aside}
        closeStyle="form"
        compactFooter
        summary={footer.summary}
        readOnly={state.readOnly}
        saveLabel={footer.saveLabel}
        onSave={state.started && !state.closed ? () => void save(draft) : undefined}
        saveState={saveState}
        saveDisabled={state.edit && !state.dirty}
        saveIncomplete={!draftComplete(draft)}
        dirty={state.mode !== 'create' && state.dirty}
      >
        <TooltipProvider>
          {state.started ? (
            <FormBody
              state={state}
              ui={ui}
              exits={exits}
              onCopy={state.readOnly ? undefined : copy}
            />
          ) : (
            <SkeletonRows rows={6} label={title} rowClassName="h-9" />
          )}
        </TooltipProvider>
      </RecordDrawer>
      {row ? <CancelVisitConfirm row={row} open={asking} onClose={closeCancel} /> : null}
    </>
  );
}

/**
 * The appointment form (KICKOFF §6.4; `appointments.md:57–101, 121–133`,
 * H:2741–2866, H:5983–6051) — New, Edit and Reschedule on the record drawer:
 * who the booking is for (the contact search, their card, their open lead),
 * the Visit status tiles in Edit, step 1 Appointment and step 2 Date & time
 * with the server's free slots, and the person's chat column beside it all in
 * Edit from `md`. A visit's photos and the plan's suggestions come back with
 * the patient file on clinozy-be (api-integration §5.4, B1); "Not a patient
 * yet" went — the check-in opens the patient file. The width follows
 * `appointmentFormWidths` — never wider than the window minus its 56px
 * gutter, so the floating × always shows. Every opening starts a fresh draft;
 * a closed form renders nothing and loads nothing.
 */
export function AppointmentForm(props: AppointmentFormProps) {
  const { session } = useDrawerSession(props.open);
  // A Copy made in this opening turns it into that New form; the next opening forgets it.
  const [copied, setCopied] = useState<{ session: number; row: AppointmentRow } | null>(
    null,
  );
  if (!props.open) return null;
  const copyOf = copied?.session === session ? copied.row : null;
  const sessionKey = [
    session,
    copyOf?.id ?? props.mode,
    props.appointmentId ??
      props.appointment?.id ??
      props.prefill?.copyOf ??
      props.prefill?.whoId ??
      '',
  ].join(':');
  return (
    <AppointmentFormSession
      key={sessionKey}
      {...props}
      {...(copyOf
        ? {
            mode: 'create' as const,
            prefill: { copyOf: copyOf.id },
            appointment: undefined,
          }
        : {})}
      onCopyHere={(row) => setCopied({ session, row })}
    />
  );
}
