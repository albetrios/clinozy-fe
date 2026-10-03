import { NewAppointmentPage } from './NewAppointmentPage.tsx';

/**
 * New appointment route — lazy loaded. Exports `Component` for the router's
 * lazy() resolution; it renders nothing (the page opens the form).
 */
export function Component() {
  return <NewAppointmentPage />;
}
