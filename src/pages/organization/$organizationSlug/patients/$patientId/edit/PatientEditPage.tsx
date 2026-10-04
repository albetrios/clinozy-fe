import { useNavigate, useParams } from '@tanstack/react-router';

import { organizationPatients } from '@/lib/routes/index.ts';
import { PatientDrawer } from '@/shared/components/PatientDrawer/index.ts';

import { PATIENT_FILE_SECTION_PAGES } from '../patient-id.sections.ts';
import { usePatientFileDialog } from '../shared/hooks/usePatientFileDialog/index.ts';
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
  const { organizationSlug = '' } = useParams({ strict: false });
  const navigate = useNavigate();
  const { file } = usePatientFileContext();
  const { behind, back } = usePatientFileDialog();
  const Section = PATIENT_FILE_SECTION_PAGES[behind];

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
