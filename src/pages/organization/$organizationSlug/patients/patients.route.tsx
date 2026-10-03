import { PatientsPage } from './PatientsPage.tsx';

/**
 * Patients route — lazy loaded. Exports `Component` for the router's lazy()
 * resolution.
 */
export function Component() {
  return <PatientsPage />;
}
