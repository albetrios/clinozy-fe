import type {
  CheckIn,
  CheckinFeel,
  CheckinFollowed,
} from '@/shared/api/clinic/clinic-schema.ts';
import type { CheckInInput } from '@/shared/api/clinic/feedback-contracts.ts';

/** The check-in drawer's fields (`patient-file.md:171–179`). */
export interface CheckInFormValues {
  /** Required by the save ("Pick how it is now"). */
  feel: CheckinFeel | null;
  /** 1–10; 0 while not rated (A-F12). */
  score: number;
  now: string;
  followed: CheckinFollowed | null;
  followedNote: string;
  nextPlan: string;
  nextOfferingIds: string[];
}

/** A new check-in: nothing picked. */
export function newCheckInForm(): CheckInFormValues {
  return {
    feel: null,
    score: 0,
    now: '',
    followed: null,
    followedNote: '',
    nextPlan: '',
    nextOfferingIds: [],
  };
}

/** A saved check-in as the edit drawer opens it. */
export function checkInFormOf(checkIn: CheckIn): CheckInFormValues {
  return {
    feel: checkIn.feel,
    score: checkIn.score,
    now: checkIn.now ?? '',
    followed: checkIn.followed,
    followedNote: checkIn.followedNote ?? '',
    nextPlan: checkIn.nextPlan ?? '',
    nextOfferingIds: [...checkIn.nextOfferingIds],
  };
}

const textOrNull = (text: string) => text.trim() || null;

/** Where a check-in sits: the patient, the visit and treatment it follows, its words and day. */
export interface CheckInPlace {
  patientId: string;
  appointmentId: string | null;
  treatmentId: string | null;
  /** "Visit check-in · Appt #2790", "Aftercare after LHR Full Face" (`S:510`). */
  context: string;
  date: string;
}

/**
 * What a save sends — an edit keeps the record's own place. The save checks
 * the feel first ("Pick how it is now"), so a form without one never gets here.
 */
export function checkInInputOf(
  values: CheckInFormValues,
  place: CheckInPlace,
): CheckInInput {
  if (!values.feel) throw new Error('A check-in needs how it is now');
  return {
    ...place,
    feel: values.feel,
    score: values.score,
    now: textOrNull(values.now),
    followed: values.followed,
    followedNote: textOrNull(values.followedNote),
    nextPlan: textOrNull(values.nextPlan),
    nextOfferingIds: values.nextOfferingIds,
  };
}
