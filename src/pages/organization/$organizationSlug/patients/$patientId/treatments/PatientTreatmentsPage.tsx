'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ERRORS_KEYS, ERRORS_NS } from '@/lib/i18n/errors.constants.ts';
import { organizationTreatmentEdit } from '@/lib/routes/patient-file-builders.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import {
  fetchTreatment,
  treatmentQueryKeys,
} from '@/shared/api/clinic/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/clinic/treatments-contracts.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useBookableTreatments } from '@/shared/hooks/useAppointments/index.ts';
import {
  type ClinicAccess,
  useClinicAccess,
} from '@/shared/hooks/useClinicAccess/index.ts';
import { usePatientPackages } from '@/shared/hooks/usePatientPackages/index.ts';
import { usePatientTreatments } from '@/shared/hooks/useTreatments/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

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
  canSpendSession,
  startingTemplate,
  TreatmentDrawer,
  type TreatmentNameChip,
  TreatmentReverseConfirm,
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
 * The member's treatment gates: recording one (`patient_treatment:create` —
 * View-as previews the Doctor, Therapist and Owner gate), changing or
 * reversing one (`patient_treatment:update`, the same gate in a preview), and
 * logging a check-in (Patients Edit).
 */
function treatmentAccessOf(access: ClinicAccess): TreatmentRowAccess {
  if (!access.isResolved)
    return { canCreate: false, canUpdate: false, canCheckIn: false };
  const canCreate = passesPatientFileGate(access, 'treatments');
  return {
    canCreate,
    canUpdate: access.previewRole
      ? canCreate
      : access.canCode('patient_treatment:update'),
    canCheckIn: access.can('patients', 'edit'),
  };
}

/**
 * What New and Edit treatment start from — the patient's last session (a
 * reversed one does not count), their packages, the name chips (the first four
 * of the clinic's active treatments, `GET /app/offerings`) and the default
 * doctor and therapist — null until each has answered (a failed read counts as
 * none, so the drawer still opens).
 */
function useTreatmentDrawerData(patientId: string) {
  const treatments = usePatientTreatments(patientId, { notifyOnError: false });
  const packages = usePatientPackages(patientId);
  const offerings = useBookableTreatments();
  const last = treatments.data?.find((treatment) => treatment.status === 'done');
  const doctor = useDefaultStaff('doctor', last?.doctorId);
  const therapist = useDefaultStaff('therapist', last?.therapistId);
  const answered = (read: { isSuccess: boolean; isError: boolean }) =>
    read.isSuccess || read.isError;
  if (!(answered(treatments) && answered(packages) && doctor.ready && therapist.ready)) {
    return null;
  }
  const names: TreatmentNameChip[] = (offerings.data ?? [])
    .slice(0, NAME_CHIPS)
    .map((offering) => ({ name: offering.name, offeringId: offering.id }));
  return {
    last,
    packages: packages.data ?? [],
    names,
    staff: { doctorId: doctor.id, therapistId: therapist.id },
  };
}

/**
 * An edit's ⚡ "Log check-in" (`patient-file.md:278, 291`): the aftercare
 * check-in for this treatment, stacked over its drawer; Back returns to the
 * treatment, whose feedback line then names the check-in. An aftercare
 * check-in follows the treatment (`treatmentId`) and is taken at no visit, so
 * it carries no booking — `appointmentId` names the visit a "Visit check-in"
 * is taken at — as the row's "Check-in" and the aftercare call's "Doing well"
 * write it.
 */
function TreatmentCheckIn({
  treatment,
  onClose,
}: {
  treatment: TreatmentRecord;
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
      appointmentId={null}
      treatmentId={treatment.id}
      today={today}
      stacked
      onClose={onClose}
    />
  );
}

/**
 * New or Edit treatment, once what it starts from is read
 * (`useTreatmentDrawerData`): writable by the member's gate on a session still
 * done; a reversed one reads only. An edit offers "Log check-in" to a member
 * who may check in. Opened from the visit flow (`?visit=open`) with a visit
 * open, a new one is the visit's session, moves the visit on, and closes back to the flow.
 */
function TreatmentDrawerHost({
  treatment,
  access,
  onClose,
}: {
  /** The treatment an edit opens; null for a new one. */
  treatment: TreatmentRecord | null;
  access: TreatmentRowAccess;
  onClose: () => void;
}) {
  const { patientId } = usePatientFileContext();
  const [checkingIn, setCheckingIn] = useState(false);
  const data = useTreatmentDrawerData(patientId);
  const flow = useVisitFlowReturn();
  if (!(data && flow.ready)) return null;
  const done = treatment?.status === 'done';
  const checkInFor = treatment && done && access.canCheckIn ? treatment : null;
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
        writable={treatment ? done && access.canUpdate : access.canCreate}
        canReverse={done && access.canUpdate}
        onLogCheckIn={checkInFor ? () => setCheckingIn(true) : undefined}
        visit={
          flow.visit
            ? {
                appointmentId: flow.visit.appointmentId,
                onWritten: () => flow.advanceAfter('treatment'),
              }
            : undefined
        }
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
 * the patient's sessions newest first (`GET …/treatments`, every page) with
 * their latest check-in, a row opening Edit treatment (read-only without the
 * gate, or once reversed), its actions, and "Reverse this treatment?"; a
 * failed read says so in place, with Retry.
 */
function TreatmentsTable(access: TreatmentRowAccess) {
  const { t } = useTranslation([PATIENT_TABLE_NS, ERRORS_NS]);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  // The section shows its own failure (RetryError) below.
  const treatments = usePatientTreatments(patientId, { notifyOnError: false });
  const packages = usePatientPackages(patientId);
  const spendablePackageIds = new Set(
    (packages.data ?? []).filter(canSpendSession).map((row) => row.id),
  );
  const rows = treatments.data ?? [];
  const table = useTreatmentsTable(rows);
  const [reversing, setReversing] = useState<TreatmentRecord | null>(null);
  const rowActions = useTreatmentRowActions({
    ...access,
    spendablePackageIds,
    onReverse: setReversing,
  });

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
      {treatments.isError && !treatments.data ? (
        <RetryError
          message={t(ERRORS_KEYS.frontend.query.loadFailed, { ns: ERRORS_NS })}
          onRetry={() => void treatments.refetch()}
          isRetrying={treatments.isFetching}
        />
      ) : (
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
      )}
      {reversing ? (
        <TreatmentReverseConfirm
          treatment={reversing}
          open
          onOpenChange={(open) => {
            if (!open) setReversing(null);
          }}
          onReversed={() => setReversing(null)}
        />
      ) : null}
    </PatientSection>
  );
}

/**
 * Patient file › Treatments (KICKOFF §6.6; H:4754; `patient-file.md:48–57`):
 * the section's table in the file's content column and its URL-driven
 * dialogs (`S:38–39`): New treatment and Edit treatment (show = edit), on
 * clinozy-be (`/app/patients/:patient_id/treatments`, api-integration §5.4).
 * Recording one is `patient_treatment:create`, changing or reversing it
 * `patient_treatment:update`; anyone else reads it.
 */
export function PatientTreatmentsPage() {
  const { t } = useTranslation(TREATMENT_NS);
  const { treatmentId } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const clinicAccess = useClinicAccess();
  const access = treatmentAccessOf(clinicAccess);
  const route = usePatientRecordRoute<TreatmentRecord>({
    section: 'treatments',
    id: treatmentId,
    queryKey: (id) => treatmentQueryKeys.detail(organizationId, patientId, id),
    fetchRecord: (id) => fetchTreatment(patientId, id),
    recordLabel: t(TREATMENT_KEYS.record),
    canCreate: clinicAccess.isResolved ? access.canCreate : undefined,
  });
  const editing = route.mode === 'edit' ? route.record : undefined;

  return (
    <>
      <TreatmentsTable {...access} />
      {clinicAccess.isResolved && (route.mode === 'create' || editing) ? (
        <TreatmentDrawerHost
          key={editing?.id ?? 'new'}
          treatment={editing ?? null}
          access={access}
          onClose={route.close}
        />
      ) : null}
    </>
  );
}
