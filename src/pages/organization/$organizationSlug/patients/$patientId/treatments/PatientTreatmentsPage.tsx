import { useParams } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import {
  fetchTreatment,
  type TreatmentDetail,
  treatmentQueryKeys,
} from '@/shared/api/clinic/treatments-api.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { useDefaultStaff } from '../shared/components/PatientStaffPicker/index.ts';
import { usePatientRecordRoute } from '../shared/hooks/usePatientRecordRoute/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import {
  startingTemplate,
  TreatmentDrawer,
  type TreatmentNameChip,
} from './components/TreatmentDrawer/index.ts';
import { TREATMENT_KEYS, TREATMENT_NS } from './treatments.constants.ts';
import { manifest } from './treatments.manifest.ts';

/** How many offerings the name field offers as chips (H:4811 `slice(0, 4)`). */
const NAME_CHIPS = 4;

/**
 * New or Edit treatment, once the patient's treatments and packages and the
 * default doctor and therapist are read; the name chips are the first four
 * offerings that are not a consultation.
 */
function TreatmentDrawerHost({
  treatment,
  writable,
  canDelete,
  onClose,
}: {
  /** The treatment an edit opens; null for a new one. */
  treatment: TreatmentDetail | null;
  writable: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const { patientId } = usePatientFileContext();
  const treatments = usePatientTreatments(patientId);
  const packages = usePatientPackages(patientId);
  const offerings = useOfferings({ notifyOnError: false });
  const last = treatments.data?.[0];
  const doctor = useDefaultStaff('doctor', last?.doctorId);
  const therapist = useDefaultStaff('therapist', last?.therapistId);
  if (!(treatments.data && packages.data && doctor.ready && therapist.ready)) {
    return null;
  }
  const names: TreatmentNameChip[] = (offerings.data ?? [])
    .filter((offering) => offering.active && offering.category !== 'consultation')
    .slice(0, NAME_CHIPS)
    .map((offering) => ({ name: offering.name, offeringId: offering.id }));
  return (
    <TreatmentDrawer
      treatment={treatment}
      patientId={patientId}
      last={last}
      packages={packages.data}
      names={names}
      staff={{ doctorId: doctor.id, therapistId: therapist.id }}
      template={startingTemplate(last)}
      writable={writable}
      canDelete={canDelete}
      onClose={onClose}
    />
  );
}

/**
 * Patient file › Treatments (KICKOFF §6.6; H:4754; `patient-file.md:48–57`):
 * the section in the file's content column — the table lands with L-43b —
 * and its URL-driven dialogs (`S:38–39`): New treatment and Edit treatment
 * (show = edit). Recording one is the Doctor and Therapist gate (`S:38–39`;
 * the Owner always passes); anyone else reads it.
 */
export function PatientTreatmentsPage() {
  const { t } = useTranslation(TREATMENT_NS);
  const { treatmentId } = useParams({ strict: false });
  const access = useClinicAccess();
  const writable = access.isResolved && passesPatientFileGate(access.roles, 'treatments');
  const route = usePatientRecordRoute<TreatmentDetail>({
    section: 'treatments',
    id: treatmentId,
    queryKey: treatmentQueryKeys.detail,
    fetchRecord: fetchTreatment,
    recordLabel: t(TREATMENT_KEYS.record),
    canCreate: access.isResolved ? writable : undefined,
  });
  const editing = route.mode === 'edit' ? route.record : undefined;

  return (
    <>
      <PatientSection section="treatments" data-testid={manifest.testId} />
      {access.isResolved && (route.mode === 'create' || editing) ? (
        <TreatmentDrawerHost
          key={editing?.treatment.id ?? 'new'}
          treatment={editing ?? null}
          writable={writable}
          canDelete={writable && access.can('patients', 'delete')}
          onClose={route.close}
        />
      ) : null}
    </>
  );
}
