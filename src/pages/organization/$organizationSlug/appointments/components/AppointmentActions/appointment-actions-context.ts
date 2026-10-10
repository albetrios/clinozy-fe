import { createContext, useContext } from 'react';

import type {
  AppointmentGuardOptions,
  AppointmentMove,
} from '@/shared/api/clinic/appointment-status.ts';
import type {
  AppointmentCancelReason,
  AppointmentRow,
} from '@/shared/api/clinic/appointments-contracts.ts';

/** What every booking surface of the room can do to a booking (the popover, the card, the blocks). */
export interface AppointmentActionsValue {
  /** Edit on Appointments — status moves, cancel, reschedule (Q-A16). */
  canEdit: boolean;
  /** Create on Appointments — "New appointment", "book one", Rebook, slot clicks. */
  canCreate: boolean;
  /** The guards' clock and access, read when a surface opens. */
  guardOptions: () => AppointmentGuardOptions;
  /**
   * A move from the transition table: a status — its own route (optimistic; a
   * check-in's toast offers Undo for 10s) — or "Move to another time" (the
   * drawer in Reschedule). Cancel has its own write.
   */
  move: (
    appointment: AppointmentRow,
    move: Exclude<AppointmentMove, 'cancelled'>,
  ) => void;
  /**
   * Cancel with one of the API's reasons — "Other" with the note the contract
   * requires (`S:1154`), typed in the cancel view itself (L-64: one ask); the
   * toast offers Undo for 10s (a reinstate).
   */
  cancel: (
    appointment: AppointmentRow,
    reason: AppointmentCancelReason,
    note?: string | null,
  ) => void;
  /** The card's next step: Check in · Confirm · Complete, or Rebook — a new booking (Q-A6). */
  runNext: (appointment: AppointmentRow) => void;
  /** The booking's drawer. */
  open: (appointment: AppointmentRow) => void;
}

/** The room's booking actions, provided by `AppointmentActionsProvider`. */
export const AppointmentActionsContext = createContext<AppointmentActionsValue | null>(
  null,
);

/** The room's booking actions — inside `AppointmentActionsProvider`. */
export function useAppointmentActions(): AppointmentActionsValue {
  const value = useContext(AppointmentActionsContext);
  if (!value) {
    throw new Error('useAppointmentActions needs an AppointmentActionsProvider');
  }
  return value;
}
