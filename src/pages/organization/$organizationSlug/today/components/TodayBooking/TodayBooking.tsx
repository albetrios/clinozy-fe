import { Suspense, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { onceAsync, useRetryableLazy } from '@/lib/lazy-module.ts';
import { CLINIC_KEYS, CLINIC_NS } from '@/shared/clinic/clinic.constants.ts';
import { SectionErrorBoundary } from '@/shared/components/WidgetErrorBoundary/index.ts';
import type { AppointmentFormPrefill } from '@/shared/forms/AppointmentForm/index.ts';
import { useAppointment } from '@/shared/hooks/useAppointments/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

/** What Today opens the shared booking form for: a new booking, or a move of one. */
export type TodayBookingRequest =
  | { mode: 'create'; prefill: AppointmentFormPrefill }
  | { mode: 'reschedule'; appointmentId: string };

/** The shared appointment form, in its own chunk — Today's first paint stays lean. */
const loadAppointmentForm = onceAsync(() =>
  import('@/shared/forms/AppointmentForm/index.ts').then((module) => ({
    default: module.AppointmentForm,
  })),
);

/** Props for {@link TodayBooking}. */
export interface TodayBookingProps {
  /** The booking to open — null keeps the form closed. */
  request: TodayBookingRequest | null;
  onClose: () => void;
}

/**
 * The shared appointment form (L-38) stacked over Today: a work-queue outcome
 * whose follow-on is a booking ("Booked a visit", "Rebooked", "Move to
 * another slot") opens it here — Today stays behind, and a save or a close
 * returns to it. A move needs Appointments Edit (else the drawer is read-only,
 * Q-A16). The form's chunk is fetched once Today has painted, so the follow-on
 * opens without a wait.
 */
export function TodayBooking({ request, onClose }: TodayBookingProps) {
  const { t } = useTranslation(CLINIC_NS);
  const access = useClinicAccess();
  const { Component: AppointmentForm, retry } = useRetryableLazy(loadAppointmentForm);
  const moving = request?.mode === 'reschedule' ? request.appointmentId : undefined;
  const booking = useAppointment(moving);

  useEffect(() => {
    // Warm the chunk; a failed fetch is retried when the form opens.
    loadAppointmentForm().catch(() => undefined);
  }, []);

  if (!request) return null;
  return (
    <SectionErrorBoundary
      title={t(CLINIC_KEYS.sections.appointments.label)}
      onReset={retry}
      testId="today-booking-error"
      variant="inline"
    >
      <Suspense fallback={null}>
        {request.mode === 'create' ? (
          <AppointmentForm
            open
            mode="create"
            prefill={request.prefill}
            onClose={onClose}
            onSaved={onClose}
          />
        ) : (
          <AppointmentForm
            open
            mode="reschedule"
            appointmentId={request.appointmentId}
            appointment={booking.data}
            readOnly={!access.can('appointments', 'edit')}
            onClose={onClose}
            onSaved={onClose}
          />
        )}
      </Suspense>
    </SectionErrorBoundary>
  );
}
