import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { appInstant } from '@/shared/api/app/app-time.ts';
import { appointmentQueryKeys } from '@/shared/api/app/appointments-api.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import { appPhoneProblem } from '@/shared/app/app-phone-field.ts';
import type { DrawerSaveState } from '@/shared/components/DrawerFooter/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { apiErrorReason, mapApiError } from '@/shared/errors/errorHandler.ts';
import { isHttpError } from '@/shared/errors/HttpError.ts';
import {
  contactFieldsOf,
  emptyContactValue,
} from '@/shared/forms/ContactEditor/index.ts';
import {
  useCopyAppointment,
  useCreateAppointment,
  useMoveAppointment,
  useUpdateAppointment,
} from '@/shared/hooks/useAppointments/index.ts';
import { useCreateContact } from '@/shared/hooks/useContacts/index.ts';
import { notify } from '@/shared/notify/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import {
  APPOINTMENT_FORM_KEYS,
  APPOINTMENT_FORM_NS,
} from './appointment-form.constants.ts';
import {
  type AppointmentDraft,
  type AppointmentFormMode,
  copiesAsIs,
  createInputOf,
  moveRouteOf,
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
  'who' | 'mobile' | 'mobileStart' | 'slot' | 'doctor' | 'passed' | 'branch' | null;

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
  if (draft.who.kind === 'new' && !newContactPhone(draft)) {
    // Ten digits that no Indian mobile starts with say so — not "needs 10 digits".
    return appPhoneProblem(draft.newPhone) === 'start' ? 'mobileStart' : 'mobile';
  }
  if (!(draft.date && draft.time)) return 'slot';
  if (!draft.doctorId) return 'doctor';
  const checksSlot = mode !== 'edit' || slotMoved(draft, saved);
  if (checksSlot && Date.parse(appInstant(draft.date, draft.time)) <= now.getTime()) {
    return 'passed';
  }
  return null;
}

/** The slot refusals (`409`): the grid is read again, and each says why in the server's words. */
const SLOT_REFUSALS = new Set([
  'slot_taken',
  'slot_in_past',
  'slot_closed',
  'slot_outside_hours',
]);

/** Options of {@link useAppointmentSave}. */
export interface UseAppointmentSaveOptions {
  mode: AppointmentFormMode;
  /** The saved booking (Edit, Reschedule). */
  row: AppointmentRow | null;
  /** The booking a Copy or Rebook starts from. */
  source?: AppointmentRow;
  branchId: string | null;
  /** A check failed: the form opens the step that holds it. */
  onProblem: (problem: Exclude<AppointmentSaveProblem, null>) => void;
  onDone: (outcome: AppointmentSaveOutcome) => void;
}

/**
 * The appointment form's write (KICKOFF §6.4 Save, §6.0 States): the checks
 * first, with their toasts — "Pick who the appointment is for", "Pick a date
 * and time", "That time has passed · pick a future slot" — then "Saving…".
 * New: a new person becomes a contact first (`POST /app/contacts`); a Copy
 * that changed nothing but the slot books again through `…/copy`. Edit: the
 * changed fields (`PATCH`, with the read's `updated_at`), then the tile's
 * move (`…/confirm`, `/check-in`, `/complete`). A slot someone took meanwhile
 * toasts "Just taken · pick another slot"; the other slot refusals and any
 * other 4xx toast the server's reason — the grid is read again and the draft
 * kept; a dropped connection keeps it with "Not saved · your changes are
 * kept", "Retry save" and a toast whose "Retry" saves again.
 */
export function useAppointmentSave({
  mode,
  row,
  source,
  branchId,
  onProblem,
  onDone,
}: UseAppointmentSaveOptions) {
  const { t } = useTranslation([APPOINTMENT_FORM_NS, ERRORS_NS]);
  const queryClient = useQueryClient();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const [saveState, setSaveState] = useState<DrawerSaveState>('idle');
  const createContact = useCreateContact({ notifyOnError: false });
  const create = useCreateAppointment({ notifyOnError: false });
  const copy = useCopyAppointment({ notifyOnError: false });
  const update = useUpdateAppointment({ notifyOnError: false });
  const move = useMoveAppointment({ notifyOnError: false });

  const failed = (error: unknown, retry: () => void) => {
    if (isHttpError(error) && error.status < 500) {
      setSaveState('idle');
      const reason = apiErrorReason(error);
      if (reason && SLOT_REFUSALS.has(reason)) {
        void queryClient.invalidateQueries({
          queryKey: appointmentQueryKeys.slotDays(organizationId),
        });
      }
      notify.error(reason === 'slot_taken' ? t(V.taken) : mapApiError(error));
      return;
    }
    setSaveState('failed');
    notify.error(t(RECORD_DRAWER_KEYS.saveFailed, { ns: RECORD_DRAWER_NS }), {
      id: 'appointment-save-failed',
      action: { label: t(ERRORS_KEYS.widget.retry, { ns: ERRORS_NS }), onClick: retry },
    });
  };

  /** The contact a new booking points at — a new person's is created first. */
  const contactIdOf = async (draft: AppointmentDraft): Promise<string> => {
    const who = draft.who;
    if (who?.contactId) return who.contactId;
    const phone = newContactPhone(draft);
    const contact = await createContact.mutateAsync(
      contactFieldsOf(emptyContactValue(who?.name ?? '', phone)),
    );
    return contact.id;
  };

  /** Book: a Copy as is through `…/copy`, else a new booking for the contact. */
  const book = async (draft: AppointmentDraft, branch: string) => {
    if (source && copiesAsIs(draft, source, branch)) {
      return copy.mutateAsync({
        appointmentId: source.id,
        date: draft.date ?? '',
        startTime: draft.time ?? '',
      });
    }
    const contactId = await contactIdOf(draft);
    return create.mutateAsync(createInputOf(draft, { branchId: branch, contactId }));
  };

  /** Edit: the changed fields, then the tile's move. */
  const edit = async (draft: AppointmentDraft, saved: AppointmentRow) => {
    const fields = patchOf(draft, saved);
    const route = moveRouteOf(draft, saved);
    let appointment = saved;
    if (Object.keys(fields).length > 0) {
      appointment = await update.mutateAsync({ appointment, fields });
    }
    if (route) appointment = await move.mutateAsync({ appointment, route });
    return appointment;
  };

  const save = async (draft: AppointmentDraft): Promise<void> => {
    const saved = row
      ? { date: row.date, time: row.startTime, status: row.status }
      : null;
    const creating = mode === 'create' || !row;
    const problem =
      saveProblem(mode, draft, saved, new Date()) ??
      (creating && !branchId ? 'branch' : null);
    if (problem) {
      onProblem(problem);
      const message = {
        who: V.who,
        mobile: APPOINTMENT_FORM_KEYS.who.mobileDigits,
        mobileStart: APPOINTMENT_FORM_KEYS.who.mobileStart,
        slot: V.slot,
        doctor: V.doctor,
        passed: V.passed,
        branch: V.branch,
      }[problem];
      notify.warning(t(message));
      return;
    }
    setSaveState('saving');
    try {
      if (creating) {
        const appointment = await book(draft, branchId ?? '');
        onDone({ kind: 'created', appointment });
        return;
      }
      onDone({ kind: 'updated', appointment: await edit(draft, row) });
    } catch (error) {
      failed(error, () => void save(draft));
    }
  };

  return { saveState, save };
}
