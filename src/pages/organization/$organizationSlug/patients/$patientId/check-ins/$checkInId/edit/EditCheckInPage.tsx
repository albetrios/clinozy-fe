import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { appToday } from '@/shared/api/app/app-time.ts';
import { feedbackQueryKeys, fetchCheckIn } from '@/shared/api/app/feedback-api.ts';
import { patientName } from '@/shared/api/app/patients-contracts.ts';
import { useAppAccess } from '@/shared/hooks/useAppAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PATIENT_FILE_SECTION_PAGES } from '../../../patient-id.sections.ts';
import {
  CHECK_IN_KEYS,
  CHECK_IN_NS,
  CheckInDrawer,
} from '../../../shared/components/CheckInDrawer/index.ts';
import { usePatientFileDialog } from '../../../shared/hooks/usePatientFileDialog/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';

/**
 * A check-in's edit — `/patients/$patientId/check-ins/$checkInId/edit`
 * (`S:45`; KICKOFF §6.6 Drawers): the check-in drawer, prefilled, over the
 * section it opened from (Clinical notes by default); it keeps the record's
 * visit, treatment and day. An id that names no check-in goes back with
 * "Check-in not found · it may have been deleted"; without Patients edit,
 * back with the permission toast.
 */
export function EditCheckInPage() {
  const { t } = useTranslation(CHECK_IN_NS);
  const { checkInId } = useParams({ strict: false });
  const { patientId, file } = usePatientFileContext();
  const access = useAppAccess();
  const canEdit = access.isResolved ? access.can('patients', 'edit') : undefined;
  const { behind, back } = usePatientFileDialog({ canOpen: canEdit });
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const { record } = useDialogRouteRecord({
    id: checkInId,
    queryKey: (id) => feedbackQueryKeys.checkIn(organizationId, id),
    fetchRecord: (id) => fetchCheckIn(patientId, id),
    recordLabel: t(CHECK_IN_KEYS.record),
    onMissing: back,
  });
  const [today] = useState(() => appToday());
  const Section = PATIENT_FILE_SECTION_PAGES[behind];

  return (
    <>
      <Section />
      {file && canEdit && record ? (
        <CheckInDrawer
          patientId={patientId}
          patientName={patientName(file.patient)}
          checkIn={record}
          appointmentId={record.appointmentId}
          treatmentId={record.treatmentId}
          today={today}
          onClose={back}
        />
      ) : null}
    </>
  );
}
