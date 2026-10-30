import { useState } from 'react';

import { nextLiveBooking } from '@/shared/api/app/appointment-status.ts';
import type { AppointmentRow } from '@/shared/api/app/appointments-contracts.ts';
import type { LeadRecord } from '@/shared/api/app/leads-contracts.ts';
import {
  type AppointmentFormPrefill,
  leadBookingPrefill,
} from '@/shared/forms/AppointmentForm/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import {
  useAppointmentSlotLabel,
  usePersonAppointments,
} from '@/shared/hooks/useAppointments/index.ts';

import type {
  LeadBookedVisit,
  LeadProgressBooking,
} from '../../components/LeadFormFields/index.ts';

/**
 * How Progress shows a booking: "Tomorrow · 11:00 am", "Consultation · Dr Mehta", and — for a
 * member who edits Appointments — Reschedule and Cancel.
 */
function bookedVisitOf({
  row,
  slot,
  edits,
  onReschedule,
  onCancel,
}: {
  row: AppointmentRow;
  slot: { day: string; time: string };
  edits: boolean;
  onReschedule: (row: AppointmentRow) => void;
  onCancel: (row: AppointmentRow) => void;
}): LeadBookedVisit {
  const visit: LeadBookedVisit = {
    when: `${slot.day} · ${slot.time}`,
    what: [row.serviceLabel, row.doctor?.name].filter(Boolean).join(' · '),
  };
  if (!edits) return visit;
  return {
    ...visit,
    onReschedule: () => onReschedule(row),
    onCancel: () => onCancel(row),
  };
}

/** The booking form the lead drawer has open: a new booking for the person, or another slot for one. */
export type LeadBookingForm =
  | { mode: 'create'; prefill: AppointmentFormPrefill }
  | { mode: 'reschedule'; appointment: AppointmentRow };

/** What {@link useLeadBooking} gives the lead drawer. */
export interface LeadBookingState {
  /** Progress's booking: the step that books, the booking still to happen and its actions. */
  progress: LeadProgressBooking;
  /** "Book an appointment" with a reason (the chat's) — absent for a member who does not book. */
  book?: (reason: string | null) => void;
  /** The booking form open over the drawer, or null. */
  form: LeadBookingForm | null;
  closeForm: () => void;
  /** The booking whose cancel is being confirmed, or null. */
  cancelling: AppointmentRow | null;
  closeCancel: () => void;
}

/**
 * The lead drawer's bookings (clinozy-be L11): the person's next booking still to happen — read
 * for a member who reads Appointments — shown on Progress as "Booked · <when>" with Reschedule
 * and Cancel for a member who edits them; the Appointment scheduled step and the chat's "Book an
 * appointment" open a new booking for a member who books (`canBook`). The server moves the lead:
 * a booking to Appointment scheduled, a cancel back to Follow-up — every appointment write
 * refetches the leads.
 */
export function useLeadBooking({
  lead,
  canBook,
}: {
  lead: Pick<LeadRecord, 'contactId' | 'interests'>;
  canBook: boolean;
}): LeadBookingState {
  const access = useAppAccess();
  const reads = access.can('appointments', 'view');
  const edits = access.can('appointments', 'edit');
  const visits = usePersonAppointments(reads ? lead.contactId : undefined);
  const slotLabel = useAppointmentSlotLabel();
  const [form, setForm] = useState<LeadBookingForm | null>(null);
  const [cancelling, setCancelling] = useState<AppointmentRow | null>(null);

  // Undefined while unknown (loading, or not ours to read): the server still holds the status.
  const next = visits.data ? nextLiveBooking(visits.data) : undefined;
  const book = canBook
    ? (reason: string | null) =>
        setForm({ mode: 'create', prefill: leadBookingPrefill(lead, reason) })
    : undefined;
  const visit =
    next &&
    bookedVisitOf({
      row: next,
      slot: slotLabel(next.date, next.startTime),
      edits,
      onReschedule: (appointment) => setForm({ mode: 'reschedule', appointment }),
      onCancel: setCancelling,
    });
  const onBook = book && (() => book(null));

  return {
    progress: { onBook, visit },
    book,
    form,
    closeForm: () => setForm(null),
    cancelling,
    closeCancel: () => setCancelling(null),
  };
}
