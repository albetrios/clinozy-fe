import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import {
  fetchPatientReport,
  type PatientReportDetail,
  patientReportQueryKeys,
} from '@/shared/api/clinic/patient-reports-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import { PatientSection } from '../shared/components/PatientSection/index.ts';
import { usePatientRecordRoute } from '../shared/hooks/usePatientRecordRoute/index.ts';
import { usePatientFileContext } from '../shared/patient-file-context.ts';
import { ReportDrawer } from './components/ReportDrawer/index.ts';
import { ReportView } from './components/ReportView/index.ts';
import { REPORT_KEYS, REPORT_NS } from './reports.constants.ts';
import { manifest } from './reports.manifest.ts';

/**
 * Patient file › Reports (KICKOFF §6.6; H:4760; `patient-file.md:34–46`): the
 * section in the file's content column — the table lands with L-43b — and its
 * URL-driven dialogs (`S:42–43`): Upload report (`patients.edit`) and Report
 * view (anyone who reads the file).
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
      <PatientSection section="reports" data-testid={manifest.testId} />
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
