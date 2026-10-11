import { useTranslation } from 'react-i18next';

import type { PatientReport } from '@/shared/api/app/patient-reports-contracts.ts';
import { ConfirmDialog } from '@/shared/components/ConfirmDialog/index.ts';
import {
  useDeletePatientReport,
  useRestorePatientReport,
} from '@/shared/hooks/usePatientReports/index.ts';

import {
  PATIENT_TABLE_KEYS,
  PATIENT_TABLE_NS,
} from '../../../shared/components/PatientSectionTable/index.ts';

/** Props of {@link ReportDeleteConfirm}. */
export interface ReportDeleteConfirmProps {
  report: PatientReport;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted: () => void;
}

/**
 * "Delete this report?" (KICKOFF §6.6 Section tables, Confirms; §3.5 reason
 * confirm): the report's name as the record and the delete reasons
 * (`DELETE …/reports/:patient_report_id?reason=&note=`); "Report deleted"
 * offers Undo, which restores it (`POST …/restore`, D32).
 */
export function ReportDeleteConfirm({
  report,
  open,
  onOpenChange,
  onDeleted,
}: ReportDeleteConfirmProps) {
  const { t } = useTranslation(PATIENT_TABLE_NS);
  const remove = useDeletePatientReport();
  const restore = useRestorePatientReport();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(PATIENT_TABLE_KEYS.reports.deleteTitle)}
      reason={{
        record: report.name,
        undo: {
          message: t(PATIENT_TABLE_KEYS.reports.deleted),
          onUndo: () => restore.mutate(report),
        },
      }}
      onConfirm={async ({ reason, note }) => {
        await remove.mutateAsync({ report, reason, note });
        onDeleted();
      }}
    />
  );
}
