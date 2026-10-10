import { useParams } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { clinicToday } from '@/shared/api/clinic/clinic-time.ts';
import { feedbackQueryKeys, fetchReview } from '@/shared/api/clinic/feedback-api.ts';
import { patientName } from '@/shared/api/clinic/patients-contracts.ts';
import { useDialogRouteRecord } from '@/shared/hooks/useDialogRouteRecord/index.ts';
import { useOrganizationStore } from '@/shared/store/useOrganizationStore/index.ts';

import { PATIENT_FILE_SECTION_PAGES } from '../../../patient-id.sections.ts';
import {
  REVIEW_KEYS,
  REVIEW_NS,
  ReviewDrawer,
} from '../../../shared/components/ReviewDrawer/index.ts';
import { usePatientFileDialog } from '../../../shared/hooks/usePatientFileDialog/index.ts';
import { useReviewAccess } from '../../../shared/hooks/useReviewAccess/index.ts';
import { usePatientFileContext } from '../../../shared/patient-file-context.ts';

/**
 * A review's edit — `/patients/$patientId/reviews/$reviewId/edit` (`S:47`;
 * KICKOFF §6.6 Drawers): the review drawer, prefilled, over the section it
 * opened from (Clinical notes by default); it keeps the record's visit and
 * day. An id that names no review goes back with "Review not found · it may
 * have been deleted"; without Patients edit, back with the permission toast.
 */
export function EditReviewPage() {
  const { t } = useTranslation(REVIEW_NS);
  const { reviewId } = useParams({ strict: false });
  const { patientId, file } = usePatientFileContext();
  // Reviews have their own codes (clinozy-be D83 (4)), not the file's `patient:update`.
  const reviews = useReviewAccess();
  const canEdit = reviews.resolved ? reviews.edit : undefined;
  const { behind, back } = usePatientFileDialog({ canOpen: canEdit });
  const organizationId = useOrganizationStore((state) => state.organizationId);
  const { record } = useDialogRouteRecord({
    id: reviewId,
    queryKey: (id) => feedbackQueryKeys.review(organizationId, id),
    fetchRecord: (id) => fetchReview(patientId, id),
    recordLabel: t(REVIEW_KEYS.record),
    onMissing: back,
  });
  const [today] = useState(() => clinicToday());
  const Section = PATIENT_FILE_SECTION_PAGES[behind];

  return (
    <>
      <Section />
      {file && canEdit && record ? (
        <ReviewDrawer
          patientId={patientId}
          patientName={patientName(file.patient)}
          review={record}
          source={record.source}
          appointmentId={record.appointmentId}
          today={today}
          onClose={back}
        />
      ) : null}
    </>
  );
}
