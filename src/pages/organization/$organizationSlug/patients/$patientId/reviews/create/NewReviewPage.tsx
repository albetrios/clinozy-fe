import { useSearch } from '@tanstack/react-router';
import { useState } from 'react';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';

import { validatePatientFeedbackSearch } from '../../patient-id.dialog-search.ts';
import { PATIENT_FILE_SECTION_PAGES } from '../../patient-id.sections.ts';
import { ReviewDrawer } from '../../shared/components/ReviewDrawer/index.ts';
import { usePatientFileDialog } from '../../shared/hooks/usePatientFileDialog/index.ts';
import { useReviewAccess } from '../../shared/hooks/useReviewAccess/index.ts';
import { usePatientFileContext } from '../../shared/patient-file-context.ts';

/**
 * Log a review — `/patients/$patientId/reviews/create` (`S:46`; KICKOFF §6.6
 * Drawers): the review drawer over the section it opened from (`?from=`,
 * Clinical notes by default), on the source `?source=` names (Google when
 * none) and tied to `?appointment=` when a visit opened it. Patients edit;
 * anyone else lands back on the section with the permission toast.
 */
export function NewReviewPage() {
  // The route keeps the raw values (its search is typed only); parsed here.
  const search = validatePatientFeedbackSearch(useSearch({ strict: false }));
  const { patientId, file } = usePatientFileContext();
  // Reviews have their own codes (clinozy-be D83 (4)), not the file's `patient:update`.
  const reviews = useReviewAccess();
  const canEdit = reviews.resolved ? reviews.log : undefined;
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
