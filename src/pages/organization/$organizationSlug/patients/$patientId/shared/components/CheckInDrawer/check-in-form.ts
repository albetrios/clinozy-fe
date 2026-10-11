import type { CheckinFeel, CheckinFollowed } from '@/shared/api/app/app-schema.ts';
import type {
  CheckInFields,
  PatientCheckIn,
} from '@/shared/api/app/feedback-contracts.ts';

/** The check-in drawer's fields (`patient-file.md:171–179`). */
export interface CheckInFormValues {
  /** Required by the save ("Pick how it is now"). */
  feel: CheckinFeel | null;
  /** 1–10; 0 until one is picked — the save asks for it (Q18). */
  score: number;
  /** How it is now, in their words. */
  currentState: string;
  followed: CheckinFollowed | null;
  followedNote: string;
  nextPlan: string;
  /** The offerings a new check-in puts in the plan; an edit shows the ones it planned. */
  nextOfferingIds: string[];
}

/** A new check-in: nothing picked. */
export function newCheckInForm(): CheckInFormValues {
  return {
    feel: null,
    score: 0,
    currentState: '',
    followed: null,
    followedNote: '',
    nextPlan: '',
    nextOfferingIds: [],
  };
}

/** A saved check-in as the edit drawer opens it. */
export function checkInFormOf(checkIn: PatientCheckIn): CheckInFormValues {
  return {
    feel: checkIn.feel,
    score: checkIn.score,
    currentState: checkIn.currentState ?? '',
    followed: checkIn.followed,
    followedNote: checkIn.followedNote ?? '',
    nextPlan: checkIn.nextPlan ?? '',
    nextOfferingIds: [...checkIn.nextOfferingIds],
  };
}

const textOrNull = (text: string) => text.trim() || null;

/**
 * What a save sends — blanks as none. The save asks for the feel and the score first
 * ("Pick how it is now", "Pick the patient’s score"), so a form without them never gets here.
 */
export function checkInFieldsOf(values: CheckInFormValues): CheckInFields {
  if (!values.feel || values.score < 1) {
    throw new Error('A check-in needs how it is now and a score');
  }
  return {
    feel: values.feel,
    score: values.score,
    currentState: textOrNull(values.currentState),
    followed: values.followed,
    followedNote: textOrNull(values.followedNote),
    nextPlan: textOrNull(values.nextPlan),
  };
}
