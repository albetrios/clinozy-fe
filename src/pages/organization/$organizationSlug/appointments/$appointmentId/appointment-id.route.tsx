import { AppointmentPage } from './AppointmentPage.tsx';

/**
 * Appointment drawer route — lazy loaded. Exports `Component` for the router's
 * lazy() resolution; it renders nothing (the page opens the drawer).
 */
export function Component() {
  return <AppointmentPage />;
}
