'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useNavigate, useParams, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationPrescriptionEdit } from '@/lib/routes/patient-file-builders.ts';
import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import {
  fetchPrescription,
  prescriptionQueryKeys,
} from '@/shared/api/clinic/prescriptions-api.ts';
import { passesPatientFileGate } from '@/shared/clinic/patient-file-sections.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import {
  usePatientPrescriptions,
  useRxCatalog,
  useRxSheetContext,
} from '@/shared/hooks/usePrescriptions/index.ts';

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
  RxDeleteConfirm,
} from './components/PrescriptionDrawer/index.ts';
import { RxPrintPreview } from './components/RxPrintPreview/index.ts';
import {
  type PrescriptionRowAccess,
  usePrescriptionRowActions,
} from './hooks/usePrescriptionRowActions/index.ts';
import { usePrescriptionsTable } from './hooks/usePrescriptionsTable/index.ts';
import { RX_KEYS, RX_NS } from './prescriptions.constants.ts';
import { manifest } from './prescriptions.manifest.ts';

/** The print preview, once the sheet's patient, doctor, clinic and branch are read. */
function RxPreview({
  prescription,
  onClose,
}: {
  prescription: Prescription;
  onClose: () => void;
}) {
  const sheet = useRxSheetContext(prescription.patientId, prescription.doctorId);
  if (!sheet.data) return null;
  return (
    <RxPrintPreview prescription={prescription} sheet={sheet.data} onClose={onClose} />
  );
}

/**
 * New or Edit prescription, once the patient's history, the catalog and the
 * default doctor are read; a new one opened from a smart note starts with
 * the medicines it named (`?medicines=`, AMBER A-F5). Opened from the visit
 * flow (`?visit=open`) with a visit open, a new one is written at that visit —
 * "Approve · print · send to pharmacy" — and closes back to the flow.
 */
function RxDrawerHost({
  prescription,
  writable,
  canDelete,
  onClose,
}: {
  /** The prescription an edit opens; null for a new one. */
  prescription: Prescription | null;
  writable: boolean;
  canDelete: boolean;
  onClose: () => void;
}) {
  const { patientId, file } = usePatientFileContext();
  // New prescription's route keeps the raw values (typed only); parsed here.
  const search = validatePatientRxCreateSearch(useSearch({ strict: false }));
  const [today] = useState(() => clinicToday());
  const history = usePatientPrescriptions(patientId);
  const catalog = useRxCatalog(patientId);
  const doctor = useDefaultStaff('doctor', history.data?.[0]?.doctorId);
  const flow = useVisitFlowReturn();
  if (!(file && history.data && doctor.ready && flow.ready)) return null;
  return (
    <PrescriptionDrawer
      prescription={prescription}
      patient={{ id: patientId, name: patientName(file.patient), seq: file.patient.seq }}
      history={history.data}
      catalog={catalog.data}
      defaultDoctorId={doctor.id}
      writable={writable}
      canDelete={canDelete}
      today={today}
      medicines={prescription ? undefined : search.medicines}
      visit={
        flow.visit
          ? { appointmentId: flow.visit.appointmentId, fromToday: flow.fromToday }
          : undefined
      }
      onClose={flow.visit ? flow.backToFlow : onClose}
    />
  );
}

/**
 * The Prescriptions table (KICKOFF §6.6 Section tables; H:4753) in the
 * section: the patient's prescriptions newest first, a row opening Edit
 * prescription (read-only without the Rx gate), its actions, and "Delete
 * this prescription?".
 */
function PrescriptionsTable(access: PrescriptionRowAccess) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const prescriptions = usePatientPrescriptions(patientId);
  const rows = prescriptions.data ?? [];
  const table = usePrescriptionsTable(rows);
  const [deleting, setDeleting] = useState<Prescription | null>(null);
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
          void navigate(organizationPrescriptionEdit(organizationSlug, patientId, row.id))
        }
        rowActions={rowActions}
      />
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
 * Patient file › Prescriptions (KICKOFF §6.6; H:4753; `patient-file.md:34–46`):
 * the section's table in the file's content column and its URL-driven
 * dialogs (`S:35–37`): New prescription, the print preview, Edit
 * prescription. Writing one is the Doctor and Admin gate (`S:35, 37`; the
 * Owner always passes); anyone else reads it.
 */
export function PatientPrescriptionsPage() {
  const { t } = useTranslation(RX_NS);
  const { prescriptionId } = useParams({ strict: false });
  const access = useClinicAccess();
  const writable =
    access.isResolved && passesPatientFileGate(access.roles, 'prescriptions');
  const route = usePatientRecordRoute<Prescription>({
    section: 'prescriptions',
    id: prescriptionId,
    queryKey: prescriptionQueryKeys.detail,
    fetchRecord: fetchPrescription,
    recordLabel: t(RX_KEYS.record),
    canCreate: access.isResolved ? writable : undefined,
  });
  const editing = route.mode === 'edit' ? route.record : undefined;

  return (
    <>
      <PrescriptionsTable
        writable={writable}
        canDelete={writable && access.can('patients', 'delete')}
        canSell={access.isResolved && access.can('medical', 'create')}
      />
      {access.isResolved && (route.mode === 'create' || editing) ? (
        <RxDrawerHost
          key={editing?.id ?? 'new'}
          prescription={editing ?? null}
          writable={writable}
          canDelete={writable && access.can('patients', 'delete')}
          onClose={route.close}
        />
      ) : null}
      {route.mode === 'view' && route.record ? (
        <RxPreview prescription={route.record} onClose={route.close} />
      ) : null}
    </>
  );
}
