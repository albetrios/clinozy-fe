import { Outlet } from '@tanstack/react-router';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';
import { AppointmentForm } from '@/shared/forms/AppointmentForm/index.ts';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from './appointments.constants.ts';
import { AppointmentActionsProvider } from './components/AppointmentActions/index.ts';
import { AppointmentsAgenda } from './components/AppointmentsAgenda/index.ts';
import { AppointmentsDay } from './components/AppointmentsDay/index.ts';
import { AppointmentsMonth } from './components/AppointmentsMonth/index.ts';
import { AppointmentsToolbar } from './components/AppointmentsToolbar/index.ts';
import { AppointmentsWeek } from './components/AppointmentsWeek/index.ts';
import { useAppointmentsDialogRoute } from './hooks/useAppointmentsDialogRoute/index.ts';
import { useAppointmentsNavigation } from './hooks/useAppointmentsNavigation/index.ts';
import { useAppointmentsView } from './hooks/useAppointmentsView/index.ts';

/**
 * The appointment form over the page while the URL names a dialog route:
 * `create/` in New mode (a chat or task `source` starts step 1 collapsed),
 * `$appointmentId/` in Edit or Reschedule. A new booking closes onto its day;
 * Copy opens `create/?copyOf=`, a chat's "Appointment #…" chip that booking.
 */
function AppointmentDialog() {
  const { dialog, close } = useAppointmentsDialogRoute();
  const navigation = useAppointmentsNavigation();
  if (dialog.kind === 'none') return null;
  if (dialog.kind === 'create') {
    const { prefill } = dialog;
    return (
      <AppointmentForm
        open
        mode="create"
        prefill={{
          whoId: prefill.who,
          date: prefill.date,
          time: prefill.time,
          doctorId: prefill.doctorId,
          copyOf: prefill.copyOf,
          collapsed: prefill.source !== undefined,
        }}
        onClose={() => close()}
        onSaved={(outcome) => close({ date: outcome.appointment.date })}
      />
    );
  }
  return (
    <AppointmentForm
      open
      mode={dialog.mode}
      appointmentId={dialog.appointmentId}
      appointment={dialog.appointment}
      readOnly={dialog.readOnly}
      onClose={() => close()}
      onSaved={() => close()}
      onCopy={(appointment) => navigation.openCreate({ copyOf: appointment.id })}
      onOpenAppointment={(id) => navigation.openAppointment(id)}
    />
  );
}

/**
 * Appointments room (KICKOFF §6.4). The toolbar, then the view in its card:
 * the Agenda (L-36b) or the Day, Week and Month calendars (L-37). Its dialog
 * routes — New appointment (`create/`) and the appointment drawer
 * (`$appointmentId/`) — render nothing: this page reads the URL and opens the
 * appointment form over itself (L-38); the route already answers a dead link
 * with the page and "Appointment not found". The view follows the URL (D27;
 * Week renders Day on a phone, the URL replaced to match).
 */
export function AppointmentsPage() {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const view = useAppointmentsView();
  const panelId = useId();
  return (
    <AppointmentActionsProvider>
      <TooltipProvider>
        <section
          data-testid="appointments-page"
          data-view={view}
          className="bg-canvas flex min-h-0 flex-1 flex-col"
        >
          <AppointmentsToolbar view={view} panelId={panelId} />
          <div
            id={panelId}
            role="tabpanel"
            aria-label={t(APPOINTMENTS_KEYS.toolbar.views[view])}
            className="m-(--room-card-margin) flex min-h-0 flex-1 flex-col"
          >
            {view === 'agenda' ? <AppointmentsAgenda /> : null}
            {view === 'day' ? <AppointmentsDay /> : null}
            {view === 'week' ? <AppointmentsWeek /> : null}
            {view === 'month' ? <AppointmentsMonth /> : null}
          </div>
          <Outlet />
        </section>
        <AppointmentDialog />
      </TooltipProvider>
    </AppointmentActionsProvider>
  );
}
