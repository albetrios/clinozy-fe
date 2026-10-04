import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { appointmentQueryKeys } from '@/shared/api/clinic/appointments-api.ts';
import type {
  AppointmentConnectedLead,
  AppointmentRow,
} from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicInstant } from '@/shared/api/clinic/clinic-time.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import {
  useCreateAppointment,
  useUpdateAppointment,
} from '@/shared/hooks/useAppointments/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
} from './appointment-form.constants.ts';
import {
  type AppointmentDraft,
  type AppointmentFormMode,
  createInputOf,
  newContactPhone,
  patchOf,
  type SavedSlot,
  slotMoved,
} from './appointment-form-model.ts';

const V = APPOINTMENT_FORM_KEYS.validation;

/** What a save ended with — the form closes on either. */
export type AppointmentSaveOutcome =
  | { kind: 'created'; appointment: AppointmentRow }
  | { kind: 'updated'; appointment: AppointmentRow };

/** What the save checks before it asks (`appointments.md:249`; KICKOFF §6.4 Save). */
export type AppointmentSaveProblem =
  'who' | 'mobile' | 'slot' | 'doctor' | 'passed' | null;

/**
 * The first thing a save would refuse, checked before the request — the
 * prototype checked after "Saving…" (H:4461, §7.3): who, a new contact's
 * mobile (the contract's Lead needs one, `S:1609`), the slot, the doctor and,
 * for a new or moved slot, that it is still ahead.
 */
export function saveProblem(
  mode: AppointmentFormMode,
  draft: AppointmentDraft,
  saved: SavedSlot | null,
  now: Date,
): AppointmentSaveProblem {
  if (!draft.who) return 'who';
  if (draft.who.kind === 'new' && !newContactPhone(draft)) return 'mobile';
  if (!(draft.date && draft.time)) return 'slot';
  if (!draft.doctorId) return 'doctor';
  const checksSlot = mode !== 'edit' || slotMoved(draft, saved);
  if (checksSlot && Date.parse(clinicInstant(draft.date, draft.time)) <= now.getTime()) {
    return 'passed';
  }
  return null;
}

/** The fixture server's code, or clinozy-be's `reason`, of a refused write. */
function refusalCode(error: unknown): string | undefined {
  if (!isHttpError(error)) return undefined;
  const reason = apiErrorReason(error);
  if (reason) return reason;
  const data = error.data as { error?: { code?: unknown } } | undefined;
  return typeof data?.error?.code === 'string' ? data.error.code : undefined;
}

/** Options of {@link useAppointmentSave}. */
export interface UseAppointmentSaveOptions {
  mode: AppointmentFormMode;
  /** The saved booking (Edit, Reschedule). */
  row: AppointmentRow | null;
  /** The booking a Copy or Rebook starts from. */
  copyOf?: string;
  branchId: string | null;
  leads: readonly AppointmentConnectedLead[];
  /** A check failed: the form opens the step that holds it. */
  onProblem: (problem: Exclude<AppointmentSaveProblem, null>) => void;
  onDone: (outcome: AppointmentSaveOutcome) => void;
}

/**
 * The appointment form's write (KICKOFF §6.4 Save, §6.0 States): the checks
 * first, with their toasts — "Pick who the appointment is for", "Pick a date
 * and time", "That time has passed · pick a future slot" — then "Saving…".
 * A slot someone took meanwhile (409) toasts "Just taken · pick another slot"
 * and refreshes the grid; any other refusal toasts the server's reason and
 * keeps the draft; a dropped connection keeps it with "Not saved · your
 * changes are kept", "Retry save" and a toast whose "Retry" saves again.
 */
export function useAppointmentSave({
  mode,
  row,
  copyOf,
  branchId,
  leads,
  onProblem,
  onDone,
}: UseAppointmentSaveOptions) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, ERRORS_NS]);
  const queryClient = useQueryClient();
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const create = useCreateAppointment({ notifyOnError: false });
  const update = useUpdateAppointment({ notifyOnError: false });

  const failed = (error: unknown, retry: () => void) => {
    if (isHttpError(error) && error.status < 500) {
      setSaveState('idle');
      if (refusalCode(error) === 'slot_taken') {
        notify.error(t(V.taken));
        void queryClient.invalidateQueries({
          queryKey: [...appointmentQueryKeys.all, 'slots'],
        });
        return;
      }
      notify.error(mapApiError(error));
      return;
    }
    setSaveState('failed');
    notify.error(t(RECORD_DRAWER_KEYS.saveFailed, { ns: RECORD_DRAWER_NS }), {
      id: 'appointment-save-failed',
      action: { label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }), onClick: retry },
    });
  };

  const save = async (draft: AppointmentDraft): Promise<void> => {
    const saved = row
      ? { date: row.date, time: row.startTime, status: row.status }
      : null;
    const problem = saveProblem(mode, draft, saved, new Date());
    if (problem) {
      onProblem(problem);
      const message = {
        who: V.who,
        mobile: APPOINTMENT_FORM_KEYS.who.mobileDigits,
        slot: V.slot,
        doctor: V.doctor,
        passed: V.passed,
      }[problem];
      notify.warning(t(message));
      return;
    }
    setSaveState('saving');
    try {
      if (mode === 'create' || !row) {
        const appointment = await create.mutateAsync(
          createInputOf(draft, { branchId, leads, copyOf }),
        );
        onDone({ kind: 'created', appointment });
        return;
      }
      const { appointment } = await update.mutateAsync({
        id: row.id,
        patch: patchOf(draft, row, leads),
      });
      onDone({ kind: 'updated', appointment });
    } catch (error) {
      failed(error, () => void save(draft));
    }
  };

  return { saveState, save };
}
