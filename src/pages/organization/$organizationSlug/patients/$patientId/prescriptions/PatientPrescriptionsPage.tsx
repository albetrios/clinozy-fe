'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationPrescriptionEdit } from '@/lib/routes/patient-file-builders.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import { patientName } from '@/shared/api/app/patients-contracts.ts';
import {
  fetchPrescription,
  prescriptionQueryKeys,
} from '@/shared/api/app/prescriptions-api.ts';
import type { PrescriptionRecord } from '@/shared/api/app/prescriptions-contracts.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import {
  usePatientPrescriptions,
  usePrescriptionAccess,
  usePrescriptionKits,
  useRxCatalog,
} from '@/shared/hooks/usePrescriptions/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { validatePatientRxCreateSearch } from '../patient-id.dialog-search.ts';
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
  PrescriptionDrawer,
  type PrescriptionDrawerAccess,
  RxDeleteConfirm,
} from './components/PrescriptionDrawer/index.ts';
import { RxPrintPreview, useRxSheet } from './components/RxPrintPreview/index.ts';
import { usePrescriptionRowActions } from './hooks/usePrescriptionRowActions/index.ts';
import { usePrescriptionsTable } from './hooks/usePrescriptionsTable/index.ts';
import { RX_KEYS, RX_NS } from './prescriptions.constants.ts';
import { manifest } from './prescriptions.manifest.ts';

/** The print preview, once the sheet's patient, doctor, clinic and branch are read. */
function RxPreview({
  prescription,
  onClose,
}: {
  prescription: PrescriptionRecord;
  onClose: () => void;
}) {
  const sheet = useRxSheet(prescription);
  if (!sheet) return null;
  return <RxPrintPreview prescription={prescription} sheet={sheet} onClose={onClose} />;
}

/**
 * New or Edit prescription, once the patient's prescriptions, the medicines, the member's kits
 * and the default doctor are read; a new one opened from a smart note starts with the
 * medicines it named (`?medicines=`, AMBER A-F5). Opened from the visit flow (`?visit=open`)
 * with a visit open, a new one is written at that visit and closes back to the flow.
 */
function RxDrawerHost({
  prescription,
  access,
  onClose,
}: {
  /** The prescription an edit opens; null for a new one. */
  prescription: PrescriptionRecord | null;
  access: PrescriptionDrawerAccess;
  onClose: () => void;
}) {
  const { patientId, file } = usePatientFileContext();
  // New prescription's route keeps the raw values (typed only); parsed here.
  const search = validatePatientRxCreateSearch(useSearch({ strict: false }));
  const [today] = useState(() => appToday());
  const history = usePatientPrescriptions(patientId);
  const catalog = useRxCatalog(patientId);
  // A member's kits list for a member who writes (`patient_prescription:create`).
  const kits = usePrescriptionKits({ enabled: access.writes });
  const doctor = useDefaultStaff('doctor', history.data?.[0]?.doctorId);
  const flow = useVisitFlowReturn();
  const kitsReady = !(access.writes && kits.isPending);
  if (!(file && history.data && doctor.ready && flow.ready && kitsReady)) return null;
  return (
    <PrescriptionDrawer
      prescription={prescription}
      patient={{ id: patientId, name: patientName(file.patient), seq: file.patient.seq }}
      history={history.data}
      catalog={catalog.data}
      kits={kits.data ?? []}
      defaultDoctorId={doctor.id}
      access={access}
      today={today}
      medicines={prescription ? undefined : search.medicines}
      visit={
        flow.visit
          ? {
              appointmentId: flow.visit.appointmentId,
              fromToday: flow.fromToday,
              onWritten: () => flow.advanceAfter('prescription'),
            }
          : undefined
      }
      onClose={flow.visit ? flow.backToFlow : onClose}
    />
  );
}

/**
 * The Prescriptions table (KICKOFF §6.6 Section tables; H:4753) in the
 * section: the patient's prescriptions newest first, a row opening Edit
 * prescription (read-only once approved, or without the gate), its actions,
 * and "Delete this prescription?" — or the read's failure with Retry.
 */
function PrescriptionsTable({ access }: { access: PrescriptionDrawerAccess }) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId, viewable } = usePatientFileContext();
  // Read once the member's sections are known (`patient_prescription:read`); a failure shows
  // in place, with Retry.
  const prescriptions = usePatientPrescriptions(patientId, {
    enabled: viewable.includes('prescriptions'),
    notifyOnError: false,
  });
  const rows = prescriptions.data ?? [];
  const table = usePrescriptionsTable(rows);
  const [deleting, setDeleting] = useState<PrescriptionRecord | null>(null);
  const rowActions = usePrescriptionRowActions({ ...access, onDelete: setDeleting });

  return (
    <PatientSection
      section="prescriptions"
      data-testid={manifest.testId}
      columns={
        <DataTableColumnChooser
          table={table}
          tableId={PATIENT_SECTION_TABLE_IDS.prescriptions}
        />
      }
      className="flex flex-col"
    >
      {prescriptions.isError ? (
        <RetryError
          onRetry={() => void prescriptions.refetch()}
          isRetrying={prescriptions.isFetching}
        />
      ) : (
        <PatientSectionTable
          section="prescriptions"
          table={table}
          loading={prescriptions.isPending}
          countLabel={
            rows.length > 0
              ? t(PATIENT_TABLE_KEYS.prescriptions.count, { count: rows.length })
              : undefined
          }
          minWidth={1100}
          onRowClick={(row) =>
            void navigate(
              organizationPrescriptionEdit(organizationSlug, patientId, row.id),
            )
          }
          rowActions={rowActions}
        />
      )}
      {deleting ? (
        <RxDeleteConfirm
          prescription={deleting}
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
 * Patient file › Prescriptions (KICKOFF §6.6; H:4753; `patient-file.md:34–46`)
 * on clinozy-be (`/app/patients/:patient_id/prescriptions`, §5.4): the
 * section's table in the file's content column and its URL-driven dialogs
 * (`S:35–37`): New prescription, the print preview, Edit prescription. Writing
 * one is `patient_prescription:create`; an approver (`…:update`) saves and
 * approves (Q19); anyone else reads it.
 */
export function PatientPrescriptionsPage() {
  const { t } = useTranslation(RX_NS);
  const { prescriptionId } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const appAccess = useAppAccess();
  const rx = usePrescriptionAccess();
  const access: PrescriptionDrawerAccess = {
    writes: rx.writes,
    approves: rx.approves,
    deletes: rx.deletes,
    sells: appAccess.isResolved && appAccess.can('medical', 'create'),
  };
  const route = usePatientRecordRoute<PrescriptionRecord>({
    section: 'prescriptions',
    id: prescriptionId,
    queryKey: (id) => prescriptionQueryKeys.detail(organizationId, patientId, id),
    fetchRecord: (id) => fetchPrescription({ patientId, prescriptionId: id }),
    recordLabel: t(RX_KEYS.record),
    canCreate: rx.resolved ? rx.writes : undefined,
  });
  const editing = route.mode === 'edit' ? route.record : undefined;

  return (
    <>
      <PrescriptionsTable access={access} />
      {rx.resolved && (route.mode === 'create' || editing) ? (
        <RxDrawerHost
          key={editing?.id ?? 'new'}
          prescription={editing ?? null}
          access={access}
          onClose={route.close}
        />
      ) : null}
      {route.mode === 'view' && route.record ? (
        <RxPreview prescription={route.record} onClose={route.close} />
      ) : null}
    </>
  );
}
