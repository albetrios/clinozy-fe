import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { useClinicAccess } from '@/shared/hooks/useClinicAccess/index.ts';

import type { PatientFeedbackDialogSearch } from '../../patient-id.search.ts';
import { PATIENT_FILE_SECTION_PAGES } from '../../patient-id.sections.ts';
import { ReviewDrawer } from '../../shared/components/ReviewDrawer/index.ts';
import { usePatientFileDialog } from '../../shared/hooks/usePatientFileDialog/index.ts';
import { usePatientFileContext } from '../../shared/patient-file-context.ts';

/**
 * Log a review — `/patients/$patientId/reviews/create` (`S:46`; KICKOFF §6.6
 * Drawers): the review drawer over the section it opened from (`?from=`,
 * Clinical notes by default), on the source `?source=` names (Google when
 * none) and tied to `?appointment=` when a visit opened it. Patients edit;
 * anyone else lands back on the section with the permission toast.
 */
export function NewReviewPage() {
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
        <ReviewDrawer
          patientId={patientId}
          patientName={patientName(file.patient)}
          review={null}
          source={search.source ?? null}
          appointmentId={search.appointment ?? null}
          today={today}
          onClose={back}
        />
      ) : null}
    </>
  );
}
