import { Outlet } from '@tanstack/react-router';
import { useId } from 'react';
import { useTranslation } from 'react-i18next';

import { TooltipProvider } from '@/shared/components/ui/tooltip.tsx';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from './appointments.constants.ts';
import { AppointmentActionsProvider } from './components/AppointmentActions/index.ts';
import { AppointmentsAgenda } from './components/AppointmentsAgenda/index.ts';
import { AppointmentsDay } from './components/AppointmentsDay/index.ts';
import { AppointmentsMonth } from './components/AppointmentsMonth/index.ts';
import { AppointmentsToolbar } from './components/AppointmentsToolbar/index.ts';
import { AppointmentsWeek } from './components/AppointmentsWeek/index.ts';
import { useAppointmentsDialogRoute } from './hooks/useAppointmentsDialogRoute/index.ts';
import { useAppointmentsView } from './hooks/useAppointmentsView/index.ts';

/**
 * Appointments room (KICKOFF §6.4). The toolbar, then the view in its card:
 * the Agenda (L-36b) or the Day, Week and Month calendars (L-37). Its dialog
 * routes — New appointment (`create/`) and the appointment drawer
 * (`$appointmentId/`) — render nothing: this page reads the URL and opens the
 * appointment form over itself (the form lands with L-38); the route already
 * answers a dead link with the page and "Appointment not found". The view
 * follows the URL (D27; Week renders Day on a phone, the URL replaced to
 * match).
 */
export function AppointmentsPage() {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const view = useAppointmentsView();
  const panelId = useId();
  useAppointmentsDialogRoute();
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
      </TooltipProvider>
    </AppointmentActionsProvider>
  );
}
