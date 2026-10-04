import { PatientEditPage } from './PatientEditPage.tsx';

/**
 * Edit patient route — lazy loaded. Exports `Component`: the section it
 * opened from, with the patient drawer over it.
 */
export function Component() {
  return <PatientEditPage />;
}
