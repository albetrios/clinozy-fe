'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationReport } from '@/lib/routes/patient-file-builders.ts';
import type { PatientReport } from '@/shared/api/clinic/clinic-schema.ts';
import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  fetchPatientReport,
  type PatientReportDetail,
  patientReportQueryKeys,
} from '@/shared/api/clinic/patient-reports-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { usePatientReports } from '@/shared/hooks/usePatientReports/index.ts';
import { FileIcon, Trash } from '@/shared/icons/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import {
  PATIENT_SECTION_TABLE_IDS,
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
  PatientSectionTable,
} from '../shared/components/PatientSectionTable/index.ts';
import { usePatientRecordRoute } from '../shared/hooks/usePatientRecordRoute/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { ReportDeleteConfirm } from './components/ReportDeleteConfirm/index.ts';
import { ReportDrawer } from './components/ReportDrawer/index.ts';
import { ReportView } from './components/ReportView/index.ts';
import { useReportsTable } from './hooks/useReportsTable/index.ts';
import { REPORT_KEYS, REPORT_NS } from './reports.constants.ts';
import { manifest } from './reports.manifest.ts';

/**
 * The Reports table (KICKOFF §6.6 Section tables; H:4760) in the section: the
 * patient's reports newest first; a row opens nothing — "Open" shows the
 * report, "Delete" (`patients.delete`) asks "Delete this report?".
 */
function ReportsTable({ canDelete }: { canDelete: boolean }) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const reports = usePatientReports(patientId);
  const rows = reports.data ?? [];
  const table = useReportsTable(rows);
  const [deleting, setDeleting] = useState<PatientReport | null>(null);
  const rowActions = (report: PatientReport): DataTableRowAction[] => [
    {
      id: 'open',
      label: t(PATIENT_TABLE_KEYS.actions.open),
      icon: FileIcon,
      onSelect: () =>
        void navigate(organizationReport(organizationSlug, patientId, report.id)),
    },
    ...(canDelete
      ? [
          {
            id: 'delete',
            label: t(PATIENT_TABLE_KEYS.actions.delete),
            icon: Trash,
            destructive: true,
            onSelect: () => setDeleting(report),
          },
        ]
      : []),
  ];

  return (
    <PatientSection
      section="reports"
      data-testid={manifest.testId}
      columns={
        <DataTableColumnChooser
          table={table}
          tableId={PATIENT_SECTION_TABLE_IDS.reports}
        />
      }
      className="flex flex-col"
    >
      <PatientSectionTable
        section="reports"
        table={table}
        loading={reports.isPending}
        countLabel={
          rows.length > 0
            ? t(PATIENT_TABLE_KEYS.reports.count, { count: rows.length })
            : undefined
        }
        minWidth={760}
        rowActions={rowActions}
      />
      {deleting ? (
        <ReportDeleteConfirm
          report={deleting}
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
 * Patient file › Reports (KICKOFF §6.6; H:4760; `patient-file.md:34–46`): the
 * section's table in the file's content column and its URL-driven dialogs
 * (`S:42–43`): Upload report (`patients.edit`) and Report view (anyone who
 * reads the file).
 */
export function PatientReportsPage() {
  const { t } = useTranslation(REPORT_NS);
  const { reportId } = useParams({ strict: false });
  const { patientId, file } = usePatientFileContext();
  const access = useClinicAccess();
  const [today] = useState(() => clinicToday());
  const route = usePatientRecordRoute<PatientReportDetail>({
    section: 'reports',
    id: reportId,
    queryKey: patientReportQueryKeys.detail,
    fetchRecord: fetchPatientReport,
    recordLabel: t(REPORT_KEYS.record),
    canCreate: access.isResolved ? access.can('patients', 'edit') : undefined,
  });
  const name = file ? patientName(file.patient) : '';

  return (
    <>
      <ReportsTable canDelete={access.isResolved && access.can('patients', 'delete')} />
      {route.mode === 'create' && file && access.isResolved ? (
        <ReportDrawer
          patientId={patientId}
          patientName={name}
          today={today}
          onClose={route.close}
        />
      ) : null}
      {route.mode === 'view' && route.record && file ? (
        <ReportView detail={route.record} patientName={name} onClose={route.close} />
      ) : null}
    </>
  );
}
