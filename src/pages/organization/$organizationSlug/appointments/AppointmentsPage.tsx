import { Outlet } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { APPOINTMENTS_KEYS, APPOINTMENTS_NS } from './appointments.constants.ts';
import { useAppointmentsDialogRoute } from './hooks/useAppointmentsDialogRoute/index.ts';
import { useAppointmentsView } from './hooks/useAppointmentsView/index.ts';

/**
 * Appointments room. Its dialog routes — New appointment (`create/`) and the
 * appointment drawer (`$appointmentId/`) — render nothing: this page reads the
 * URL and opens the appointment form over itself (the form lands with L-38);
 * the route already answers a dead link with the page and "Appointment not
 * found". The view follows the URL (D27; Week renders Day on a phone, the URL
 * replaced to match). The views themselves are built in their own rows
 * (L-36b, L-37).
 */
export function AppointmentsPage() {
  const { t } = useTranslation(APPOINTMENTS_NS);
  const view = useAppointmentsView();
  useAppointmentsDialogRoute();
  return (
    <section
      data-testid="appointments-page"
      data-view={view}
      className="flex min-h-0 flex-1 flex-col"
    >
      <h1 className="sr-only md:not-sr-only md:px-(--room-header-pad-x) md:pt-4 md:text-xl md:font-semibold">
        {t(APPOINTMENTS_KEYS.manifest.title)}
      </h1>
      <Outlet />
    </section>
  );
}
