'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationTreatmentEdit } from '@/lib/routes/patient-file-builders.ts';
import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import {
  fetchTreatment,
  type TreatmentDetail,
  treatmentQueryKeys,
} from '@/shared/api/clinic/treatments-api.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useOfferings } from '@/shared/hooks/useOfferings/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import {
  usePatientTreatments,
  useTreatmentCheckIns,
} from '@/shared/hooks/useTreatments/index.ts';

import { CheckInDrawer } from '../shared/components/CheckInDrawer/index.ts';
import { PatientSection } from '../shared/components/PatientSection/index.ts';
import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  PatientSectionTable,
} from '../shared/components/PatientSectionTable/index.ts';
import { useDefaultStaff } from '../shared/components/PatientStaffPicker/index.ts';
import { usePatientRecordRoute } from '../shared/hooks/usePatientRecordRoute/index.ts';
import { useVisitFlowReturn } from '../shared/hooks/useVisitFlowReturn/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import {
  startingTemplate,
  TreatmentDeleteConfirm,
  TreatmentDrawer,
  type TreatmentNameChip,
} from './components/TreatmentDrawer/index.ts';
import {
  type TreatmentRowAccess,
  useTreatmentRowActions,
} from './hooks/useTreatmentRowActions/index.ts';
import { useTreatmentsTable } from './hooks/useTreatmentsTable/index.ts';
import { TREATMENT_KEYS, TREATMENT_NS } from './treatments.constants.ts';
import { manifest } from './treatments.manifest.ts';

/** How many offerings the name field offers as chips (H:4811 `slice(0, 4)`). */
const NAME_CHIPS = 4;

/**
 * What New and Edit treatment start from — the patient's last treatment, their
 * packages, the name chips (the first four offerings that are not a
 * consultation) and the default doctor and therapist — null until all are read.
 */
function useTreatmentDrawerData(patientId: string) {
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
  return {
    last,
    packages: packages.data,
    names,
    staff: { doctorId: doctor.id, therapistId: therapist.id },
  };
}

/**
 * An edit's ⚡ "Log check-in" (`patient-file.md:278, 291`): the aftercare
 * check-in for this treatment, stacked over its drawer; Back returns to the
 * treatment, whose feedback line then names the check-in.
 */
function TreatmentCheckIn({
  treatment,
  onClose,
}: {
  treatment: Treatment;
  onClose: () => void;
}) {
  const { patientId, file } = usePatientFileContext();
  const [today] = useState(() => clinicToday());
  if (!file) return null;
  return (
    <CheckInDrawer
      patientId={patientId}
      patientName={patientName(file.patient)}
      checkIn={null}
      appointmentId={treatment.appointmentId}
      treatmentId={treatment.id}
      today={today}
      stacked
      onClose={onClose}
    />
  );
}

/**
 * New or Edit treatment, once what it starts from is read
 * (`useTreatmentDrawerData`); an edit offers "Log check-in" to a member who
 * may check in. Opened from the visit flow (`?visit=open`) with a visit open,
 * it closes back to the flow — today's session there moves the visit to
 * Checkout.
 */
function TreatmentDrawerHost({
  treatment,
  writable,
  canDelete,
  canCheckIn,
  onClose,
}: {
  /** The treatment an edit opens; null for a new one. */
  treatment: TreatmentDetail | null;
  writable: boolean;
  canDelete: boolean;
  /** Patients Edit — the check-in's gate, as on the Treatments row. */
  canCheckIn: boolean;
  onClose: () => void;
}) {
  const { patientId } = usePatientFileContext();
  const [checkingIn, setCheckingIn] = useState(false);
  const data = useTreatmentDrawerData(patientId);
  const flow = useVisitFlowReturn();
  if (!(data && flow.ready)) return null;
  const checkInFor = treatment && canCheckIn ? treatment.treatment : null;
  return (
    <>
      <TreatmentDrawer
        treatment={treatment}
        patientId={patientId}
        last={data.last}
        packages={data.packages}
        names={data.names}
        staff={data.staff}
        template={startingTemplate(data.last)}
        writable={writable}
        canDelete={canDelete}
        onLogCheckIn={checkInFor ? () => setCheckingIn(true) : undefined}
        onClose={flow.visit ? flow.backToFlow : onClose}
      />
      {checkingIn && checkInFor ? (
        <TreatmentCheckIn treatment={checkInFor} onClose={() => setCheckingIn(false)} />
      ) : null}
    </>
  );
}

/**
 * The Treatments table (KICKOFF §6.6 Section tables; H:4754) in the section:
 * the patient's treatments newest first with their latest check-in, a row
 * opening Edit treatment (read-only without the gate), its actions, and
 * "Delete this treatment?".
 */
function TreatmentsTable(access: TreatmentRowAccess) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const treatments = usePatientTreatments(patientId);
  const checkIns = useTreatmentCheckIns(patientId);
  const rows = treatments.data ?? [];
  const table = useTreatmentsTable(rows, checkIns.data ?? {});
  const [deleting, setDeleting] = useState<Treatment | null>(null);
  const rowActions = useTreatmentRowActions({ ...access, onDelete: setDeleting });

  return (
    <PatientSection
      section="treatments"
      data-testid={manifest.testId}
      columns={
        <DataTableColumnChooser
          table={table}
          tableId={PATIENT_SECTION_TABLE_IDS.treatments}
        />
      }
      className="flex flex-col"
    >
      <PatientSectionTable
        section="treatments"
        table={table}
        loading={treatments.isPending}
        countLabel={
          rows.length > 0
            ? t(PATIENT_TABLE_KEYS.treatments.count, { count: rows.length })
            : undefined
        }
        minWidth={1260}
        onRowClick={(row) =>
          void navigate(organizationTreatmentEdit(organizationSlug, patientId, row.id))
        }
        rowActions={rowActions}
      />
      {deleting ? (
        <TreatmentDeleteConfirm
          treatment={deleting}
          open
          onOpenChange={(open) => {
            if (!open) setDeleting(null);
          }}
          onDeleted={() => setDeleting(null)}
        />
      ) : null}
    </PatientSection>
  );
}

/**
 * Patient file › Treatments (KICKOFF §6.6; H:4754; `patient-file.md:48–57`):
 * the section's table in the file's content column and its URL-driven
 * dialogs (`S:38–39`): New treatment and Edit treatment (show = edit).
 * Recording one is the Doctor and Therapist gate (`S:38–39`; the Owner always
 * passes); anyone else reads it.
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
      <TreatmentsTable
        writable={writable}
        canDelete={writable && access.can('patients', 'delete')}
        canCheckIn={access.isResolved && access.can('patients', 'edit')}
      />
      {access.isResolved && (route.mode === 'create' || editing) ? (
        <TreatmentDrawerHost
          key={editing?.treatment.id ?? 'new'}
          treatment={editing ?? null}
          writable={writable}
          canDelete={writable && access.can('patients', 'delete')}
          canCheckIn={access.can('patients', 'edit')}
          onClose={route.close}
        />
      ) : null}
    </>
  );
}
