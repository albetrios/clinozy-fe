import { NewPatientPage } from './NewPatientPage.tsx';

/**
 * New patient route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution; it renders nothing (the list opens the drawer).
 */
export function Component() {
  return <NewPatientPage />;
}
