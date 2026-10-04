import { useNavigate, useParams, useSearch } from '@tanstack/react-router';

import { organizationPatients } from '@/lib/routes/index.ts';
import { organizationPatientSection } from '@/lib/routes/patient-file-builders.ts';
import { isPatientFileSection } from '@/shared/clinic/patient-file-sections.ts';
import { PatientDrawer } from '@/shared/components/PatientDrawer/index.ts';

import type { PatientFileDialogSearch } from '../patient-id.search.ts';
import { PATIENT_FILE_SECTION_PAGES } from '../patient-id.sections.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';

/**
 * Edit patient — `/patients/$patientId/edit` (`S:34`; KICKOFF §6.6 Drawers):
 * the shared patient drawer in its edit mode over the section it opened from
 * (`?from=<section>`, AMBER A-F1), Clinical notes by default as the schema has
 * it. Saving or closing goes back to that section; Delete ("Delete this
 * record?") goes back to the Patients list. Without Patients edit the drawer
 * opens read-only.
 */
export function PatientEditPage() {
  const { organizationSlug = '', patientId = '' } = useParams({ strict: false });
  const search: PatientFileDialogSearch = useSearch({ strict: false });
  const navigate = useNavigate();
  const { file } = usePatientFileContext();
  const behind = isPatientFileSection(search.from) ? search.from : 'overview';
  const Section = PATIENT_FILE_SECTION_PAGES[behind];
  const back = () =>
    void navigate({
      ...organizationPatientSection(organizationSlug, patientId, behind),
      replace: true,
    });

  return (
    <>
      <Section />
      {file ? (
        <PatientDrawer
          mode="edit"
          open
          patient={file.patient}
          onClose={back}
          onSaved={back}
          onDeleted={() => void navigate(organizationPatients(organizationSlug))}
        />
      ) : null}
    </>
  );
}
