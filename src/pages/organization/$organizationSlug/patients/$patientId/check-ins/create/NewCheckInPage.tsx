import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import type { PatientFeedbackDialogSearch } from '../../patient-id.search.ts';
import { PATIENT_FILE_SECTION_PAGES } from '../../patient-id.sections.ts';
import { CheckInDrawer } from '../../shared/components/CheckInDrawer/index.ts';
import { usePatientFileDialog } from '../../shared/hooks/usePatientFileDialog/index.ts';
import { usePatientFileContext } from '../../shared/patient-file-context.ts';

/**
 * A new check-in — `/patients/$patientId/check-ins/create` (`S:44`; KICKOFF
 * §6.6 Drawers): the check-in drawer over the section it opened from
 * (`?from=`, Clinical notes by default), an aftercare one when `?treatment=`
 * names the treatment it follows, tied to `?appointment=` when a visit opened
 * it. Patients edit; anyone else lands back on the section with the
 * permission toast.
 */
export function NewCheckInPage() {
  const search: PatientFeedbackDialogSearch = useSearch({ strict: false });
  const { patientId, file } = usePatientFileContext();
  const access = useClinicAccess();
  const canEdit = access.isResolved ? access.can('patients', 'edit') : undefined;
  const { behind, back } = usePatientFileDialog({ canOpen: canEdit });
  const [today] = useState(() => clinicToday());
  const Section = PATIENT_FILE_SECTION_PAGES[behind];

  return (
    <>
      <Section />
      {file && canEdit ? (
        <CheckInDrawer
          patientId={patientId}
          patientName={patientName(file.patient)}
          checkIn={null}
          appointmentId={search.appointment ?? null}
          treatmentId={search.treatment ?? null}
          today={today}
          onClose={back}
        />
      ) : null}
    </>
  );
}
