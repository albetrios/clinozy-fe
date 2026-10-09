import { type ReactNode, useMemo } from 'react';

import { NEXT_ACTION_MOVES, nextAction } from '@/shared/api/clinic/appointment-status.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
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

/**
 * The room's booking actions (KICKOFF §6.4 Status machine): one place for the
 * writes the Change status popover, the appointment card and the calendar
 * blocks make — each move through `useAppointments` (optimistic, the spec's
 * toasts, Undo), "Move to another time" and "Reschedule" as the drawer's
 * Reschedule mode, Rebook as a new booking from this one. Cancel is asked
 * once, in the popover's cancel view — "Other" with its note there (L-64).
 */
export function AppointmentActionsProvider({ children }: { children: ReactNode }) {
  const access = useClinicAccess();
  const { openAppointment, openCreate } = useAppointmentsNavigation();
  const { mutate: setStatus } = useSetAppointmentStatus();
  const { mutate: cancelWrite } = useCancelAppointment({ announce: 'status' });
  const canEdit = access.can('appointments', 'edit');
  const canCreate = access.can('appointments', 'create');

  const value = useMemo<AppointmentActionsValue>(() => {
    const move: AppointmentActionsValue['move'] = (appointment, next) => {
      if (next === 'reschedule') {
        openAppointment(appointment.id, 'reschedule');
        return;
      }
      setStatus({ id: appointment.id, status: next });
    };
    return {
      canEdit,
      canCreate,
      guardOptions: () => ({ now: new Date(), canEdit }),
      move,
      cancel: (appointment, reason, note = null) => {
        const text = note?.trim() || null; // NOSONAR(S6606): a blank note is no note — "" falls back to null
        cancelWrite({ id: appointment.id, reason, note: text });
      },
      runNext: (appointment) => {
        const step = nextAction(appointment, clinicToday());
        if (step === 'rebook') {
          openCreate({ copyOf: appointment.id });
          return;
        }
        const next = step ? NEXT_ACTION_MOVES[step] : null;
        if (next && next !== 'cancelled') move(appointment, next);
      },
      open: (appointment) => openAppointment(appointment.id),
    };
  }, [canEdit, canCreate, openAppointment, openCreate, setStatus, cancelWrite]);

  return (
    <AppointmentActionsContext.Provider value={value}>
      {children}
    </AppointmentActionsContext.Provider>
  );
}
