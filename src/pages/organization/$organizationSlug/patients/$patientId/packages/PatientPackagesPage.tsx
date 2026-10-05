import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import {
  PATIENT_SECTION_KEYS,
  PATIENT_SECTION_NS,
  PatientSection,
} from '../shared/components/PatientSection/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { AddPackageDrawer } from './components/AddPackageDrawer/index.ts';
import { manifest } from './packages.manifest.ts';

/**
 * Patient file › Packages (KICKOFF §6.6; H:833; `patient-file.md:70–79`): the
 * section in the file's content column, under its header — the package cards
 * land with L-43b — and "Add package", which opens its drawer as component
 * state (no route, D24). Adding one writes to the patient (`patients.create`).
 */
export function PatientPackagesPage() {
  const { t } = useTranslation(PATIENT_SECTION_NS);
  const { patientId, file } = usePatientFileContext();
  const access = useClinicAccess();
  const [adding, setAdding] = useState(false);
  const canAdd = access.isResolved && access.can('patients', 'create');

  return (
    <>
      <PatientSection
        section="packages"
        data-testid={manifest.testId}
        primary={
          canAdd
            ? {
                label: t(PATIENT_SECTION_KEYS.primary.packages),
                onSelect: () => setAdding(true),
              }
            : null
        }
      />
      {adding && file ? (
        <AddPackageDrawer
          patientId={patientId}
          patientName={patientName(file.patient)}
          onClose={() => setAdding(false)}
        />
      ) : null}
    </>
  );
}
