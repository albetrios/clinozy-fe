import { PatientFileLayout } from './PatientFileLayout.tsx';

/**
 * Patient file route — lazy loaded (through `patient-id.sections.ts`, the
 * file's one import from the entry chunk). Exports `Component`: the layout
 * over the open section.
 */
export function Component() {
  return <PatientFileLayout />;
}
