import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';

import {
  CANCEL_REASON_GROUPS,
  NEXT_ACTION_MOVES,
  nextAction,
} from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/clinic/appointments-contracts.ts';
import type { CancelReason } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import {
  ConfirmDialog,
  type ConfirmReasonOption,
} from '@/shared/components/ConfirmDialog/index.ts';
import {
  useCancelAppointment,
  useSetAppointmentStatus,
} from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import {
  AppointmentActionsContext,
  type AppointmentActionsValue,
} from './appointment-actions-context.ts';

/** The contract's cancel reasons as the reason confirm's chips — the popover's own set. */
const CANCEL_OPTIONS: readonly ConfirmReasonOption[] = CANCEL_REASON_GROUPS.flatMap(
  ({ reasons }) =>
    reasons.map((reason) => ({
      value: reason,
      labelKey: CLINIC_KEYS.appointments.cancelReasons[reason],
    })),
);

const CANCEL_REASONS = new Set<string>(CANCEL_OPTIONS.map((option) => option.value));
const isCancelReason = (value: string): value is CancelReason =>
  CANCEL_REASONS.has(value);

/**
 * The room's booking actions (KICKOFF §6.4 Status machine): one place for the
 * writes the Change status popover, the appointment card and the calendar
 * blocks make — each move through `useAppointments` (optimistic, the spec's
 * toasts, Undo), "Move to another time" and "Reschedule" as the drawer's
 * Reschedule mode, Rebook as a new booking from this one. "Other" needs a note
 * (`S:1154`), so it opens the shared reason confirm with Other picked.
 */
export function AppointmentActionsProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation(CLINIC_NS);
  const access = useClinicAccess();
  const navigation = useAppointmentsNavigation();
  const setStatus = useSetAppointmentStatus();
  const cancelWrite = useCancelAppointment({ announce: 'status' });
  const [askingNote, setAskingNote] = useState<AppointmentRow | null>(null);
  const canEdit = access.can('appointments', 'edit');
  const canCreate = access.can('appointments', 'create');

  const move: AppointmentActionsValue['move'] = (appointment, next) => {
    if (next === 'reschedule') {
      navigation.openAppointment(appointment.id, 'reschedule');
      return;
    }
    setStatus.mutate({ id: appointment.id, status: next });
  };

  const value: AppointmentActionsValue = {
    canEdit,
    canCreate,
    guardOptions: () => ({ now: new Date(), canEdit }),
    move,
    cancel: (appointment, reason) => {
      if (reason === 'other') {
        setAskingNote(appointment);
        return;
      }
      cancelWrite.mutate({ id: appointment.id, reason, note: null });
    },
    runNext: (appointment) => {
      const step = nextAction(appointment, clinicToday());
      if (step === 'rebook') {
        navigation.openCreate({ copyOf: appointment.id });
        return;
      }
      const next = step ? NEXT_ACTION_MOVES[step] : null;
      if (next && next !== 'cancelled') move(appointment, next);
    },
    open: (appointment) => navigation.openAppointment(appointment.id),
  };

  return (
    <AppointmentActionsContext.Provider value={value}>
      {children}
      <ConfirmDialog
        open={askingNote !== null}
        onOpenChange={(open) => {
          if (!open) setAskingNote(null);
        }}
        title={t(CLINIC_KEYS.appointments.cancelConfirm.title)}
        description={t(CLINIC_KEYS.appointments.cancelConfirm.effect)}
        confirmLabel={t(CLINIC_KEYS.appointments.cancelConfirm.action)}
        reason={{
          record: askingNote
            ? t(CLINIC_KEYS.appointments.cancelConfirm.record, {
                name: askingNote.person.name,
                service: askingNote.serviceLabel,
              })
            : undefined,
          options: CANCEL_OPTIONS,
          initial: 'other',
        }}
        onConfirm={async (choice) => {
          if (!(askingNote && isCancelReason(choice.picked.value))) return;
          await cancelWrite.mutateAsync({
            id: askingNote.id,
            reason: choice.picked.value,
            note: choice.comment || null,
          });
        }}
      />
    </AppointmentActionsContext.Provider>
  );
}
