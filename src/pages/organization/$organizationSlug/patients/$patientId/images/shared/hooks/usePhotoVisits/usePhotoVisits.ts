import { useMemo } from 'react';

import { usePersonAppointments } from '@/shared/hooks/useAppointments/index.ts';

import { usePatientFileContext } from '../../../../shared/patient-file-context.ts';
import { type PhotoVisit, photoVisitsOf } from '../../photo-view.ts';

/**
 * The visits the patient's photos can be filed under — the visit filter's and Photo details'
 * Visit (H:4766 `visitDD`): the person's bookings (`GET /app/appointments?contact_id=`, one read
 * the file's Visits shares) that were checked in or completed, latest first. Empty until the
 * file and its bookings are read.
 */
export function usePhotoVisits(): PhotoVisit[] {
  const { file } = usePatientFileContext();
  const bookings = usePersonAppointments(file?.patient.contactId);
  const patientId = file?.patient.id ?? '';
  const { data } = bookings;
  return useMemo(() => photoVisitsOf(data ?? [], patientId), [data, patientId]);
}
