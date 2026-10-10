import { type ReactNode, useMemo } from 'react';

import {
  type AppointmentMove,
  NEXT_ACTION_MOVES,
  nextAction,
} from '@/shared/api/clinic/appointment-status.ts';
import type { AppointmentMoveRoute } from '@/shared/api/clinic/appointments-contracts.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  useCancelAppointment,
  useMoveAppointment,
} from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import { useAppointmentsNavigation } from '../../hooks/useAppointmentsNavigation/index.ts';
import {
  AppointmentActionsContext,
  type AppointmentActionsValue,
} from './appointment-actions-context.ts';

/** The route each status move runs on clinozy-be — one route per move (api-integration §5.3). */
const MOVE_ROUTES: Readonly<
  Record<Exclude<AppointmentMove, 'cancelled' | 'reschedule'>, AppointmentMoveRoute>
> = {
  confirmed: 'confirm',
  checked_in: 'check-in',
  completed: 'complete',
  no_show: 'no-show',
};

/**
 * The room's booking actions (KICKOFF §6.4 Status machine): one place for the
 * writes the Change status popover, the appointment card and the calendar
 * blocks make — each status move its own route through `useAppointments`
 * (optimistic, the spec's toasts; a check-in's Undo), "Move to another time"
 * and "Reschedule" as the drawer's Reschedule mode, Rebook as a new booking
 * from this one. Cancel is asked once, in the popover's cancel view — "Other"
 * with its note there (L-64) — and its toast's Undo reinstates the booking.
 */
export function AppointmentActionsProvider({ children }: { children: ReactNode }) {
  const access = useClinicAccess();
  const { openAppointment, openCreate } = useAppointmentsNavigation();
  const { mutate: moveWrite } = useMoveAppointment();
  const { mutate: cancelWrite } = useCancelAppointment({ announce: 'status' });
  const canEdit = access.can('appointments', 'edit');
  const canCreate = access.can('appointments', 'create');

  const value = useMemo<AppointmentActionsValue>(() => {
    const move: AppointmentActionsValue['move'] = (appointment, next) => {
      if (next === 'reschedule') {
        openAppointment(appointment.id, 'reschedule');
        return;
      }
      moveWrite({ appointment, route: MOVE_ROUTES[next] });
    };
    return {
      canEdit,
      canCreate,
      guardOptions: () => ({ now: new Date(), canEdit }),
      move,
      cancel: (appointment, reason, note = null) => {
        const text = note?.trim() || null; // NOSONAR(S6606): a blank note is no note — "" falls back to null
        cancelWrite({ appointment, cancel: { reason, note: text } });
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
  }, [canEdit, canCreate, openAppointment, openCreate, moveWrite, cancelWrite]);

  return (
    <AppointmentActionsContext.Provider value={value}>
      {children}
    </AppointmentActionsContext.Provider>
  );
}
