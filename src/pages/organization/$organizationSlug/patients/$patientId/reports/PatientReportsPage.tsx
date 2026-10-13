'use no memo';
// The Columns chooser reads the table's live column state through methods on
// objects that keep their identity; React Compiler memoisation would serve
// stale answers.

import { useNavigate, useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { organizationReport } from '@/lib/routes/patient-file-builders.ts';
import { appToday } from '@/shared/api/app/app-time.ts';
import {
  fetchPatientReport,
  patientReportQueryKeys,
} from '@/shared/api/app/patient-reports-api.ts';
import type { PatientReport } from '@/shared/api/app/patient-reports-contracts.ts';
import { patientName } from '@/shared/api/app/patients-contracts.ts';
import { DataTableColumnChooser } from '@/shared/components/DataTableColumnChooser/index.ts';
import type { DataTableRowAction } from '@/shared/components/DataTableRowActions/index.ts';
import { RetryError } from '@/shared/components/RetryError/index.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { usePatientReports } from '@/shared/hooks/usePatientReports/index.ts';
import { FileIcon, Trash } from '@/shared/icons/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

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

/** No reports yet — one array, so the table keeps its row model while it loads. */
const NO_REPORTS: readonly PatientReport[] = [];

/**
 * The Reports table (KICKOFF §6.6 Section tables; H:4760) in the section: the
 * patient's reports newest first — every page of `GET …/reports`, as the
 * table shows them all ("All reports loaded") — with the server's count; a
 * row opens nothing — "Open" shows the report, "Delete" (`patient:update`)
 * asks "Delete this report?".
 */
function ReportsTable({ canDelete }: { canDelete: boolean }) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const navigate = useNavigate();
  const { organizationSlug = '' } = useParams({ strict: false });
  const { patientId } = usePatientFileContext();
  const reports = usePatientReports(patientId);
  const rows = reports.data?.reports ?? NO_REPORTS;
  const total = reports.data?.total ?? 0;
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
      {reports.isError && !reports.data ? (
        // A failed first read is not an empty list: say so, with Retry.
        <RetryError onRetry={() => void reports.refetch()} />
      ) : (
        <PatientSectionTable
          section="reports"
          table={table}
          loading={reports.isPending}
          countLabel={
            total > 0 ? t(PATIENT_TABLE_KEYS.reports.count, { count: total }) : undefined
          }
          // The design's 760 less its "Uploaded by" (G4).
          minWidth={580}
          rowActions={rowActions}
        />
      )}
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
 * (`S:42–43`): Upload report and Report view (`GET …/reports/:id`, anyone who
 * reads the file — `patient:clinical_record:read`). Every write is
 * `patient:update`: Upload report and delete.
 */
export function PatientReportsPage() {
  const { t } = useTranslation(REPORT_NS);
  const { reportId } = useParams({ strict: false });
  const { patientId, file } = usePatientFileContext();
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const access = useAppAccess();
  const [today] = useState(() => appToday());
  const canWrite = access.isResolved && access.can('patients', 'edit');
  const route = usePatientRecordRoute<PatientReport>({
    section: 'reports',
    id: reportId,
    queryKey: (id) => patientReportQueryKeys.detail(organizationId, patientId, id),
    fetchRecord: (id) => fetchPatientReport({ patientId, reportId: id }),
    recordLabel: t(REPORT_KEYS.record),
    canCreate: access.isResolved ? canWrite : undefined,
  });
  const name = file ? patientName(file.patient) : '';

  return (
    <>
      <ReportsTable canDelete={canWrite} />
      {route.mode === 'create' && file && access.isResolved ? (
        <ReportDrawer
          patientId={patientId}
          patientName={name}
          today={today}
          onClose={route.close}
        />
      ) : null}
      {route.mode === 'view' && route.record && file ? (
        <ReportView report={route.record} patientName={name} onClose={route.close} />
      ) : null}
    </>
  );
}
