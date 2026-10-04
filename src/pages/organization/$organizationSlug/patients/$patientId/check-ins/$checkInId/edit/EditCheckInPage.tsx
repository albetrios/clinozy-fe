import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { feedbackQueryKeys, fetchCheckIn } from '@/shared/api/clinic/feedback-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';

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
  const access = useClinicAccess();
  const canEdit = access.isResolved ? access.can('patients', 'edit') : undefined;
  const { behind, back } = usePatientFileDialog({ canOpen: canEdit });
  const { record } = useDialogRouteRecord({
    id: checkInId,
    queryKey: feedbackQueryKeys.checkIn,
    fetchRecord: fetchCheckIn,
    recordLabel: t(CHECK_IN_KEYS.record),
    onMissing: back,
  });
  const [today] = useState(() => clinicToday());
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
