import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { PatientCheckIn } from '@/shared/api/app/feedback-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateCheckIn, useUpdateCheckIn } from '@/shared/hooks/useFeedback/index.ts';

import { CHECK_IN_KEYS, CHECK_IN_NS } from './check-in.constants.ts';
import { checkInFieldsOf, type CheckInFormValues } from './check-in-form.ts';

/** The drawer's steps, as the save opens them. */
export type CheckInStepId = 'now' | 'followed' | 'next';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<CheckInFormValues>, CheckInStepId][] = [
  ['feel', 'now'],
  ['score', 'now'],
  ['currentState', 'now'],
  ['followed', 'followed'],
  ['followedNote', 'followed'],
  ['nextPlan', 'next'],
  ['nextOfferingIds', 'next'],
];

/** Where a new check-in sits: the patient, the visit and the treatment it follows, its day. */
interface CheckInPlace {
  patientId: string;
  appointmentId: string | null;
  treatmentId: string | null;
  date: string;
}

/** Options of {@link useCheckInSave}. */
export interface UseCheckInSaveOptions {
  form: UseFormReturn<CheckInFormValues>;
  /** The check-in an Edit opens, as last read; null for a new one. */
  checkIn: PatientCheckIn | null;
  place: CheckInPlace;
  onStep: (step: CheckInStepId) => void;
  /** Someone saved it since the drawer read it (`409 record_changed`): read it again. */
  onStale?: () => void;
  onDone: (saved: PatientCheckIn) => void;
}

/**
 * The check-in's write on the shared drawer save (KICKOFF §6.6): no feel →
 * "Pick how it is now", no score → "Pick the patient’s score" (Q18), and the
 * first step opens; else `POST …/check-ins` or a stale-checked `PATCH`. The
 * server plans the named offerings and, for Worse or a score of 4 or less,
 * opens the doctor call-back; its field errors land on the fields.
 */
export function useCheckInSave({
  form,
  checkIn,
  place,
  onStep,
  onStale,
  onDone,
}: UseCheckInSaveOptions) {
  const { t } = useTranslation(CHECK_IN_NS);
  const create = useCreateCheckIn({ notifyOnError: false });
  const update = useUpdateCheckIn({ notifyOnError: false });

  return useDrawerSave<CheckInFormValues, PatientCheckIn>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    toastId: 'check-in-save-failed',
    check: (values) => {
      if (values.feel === null) {
        return { fields: ['feel'], message: t(CHECK_IN_KEYS.noFeel) };
      }
      if (values.score < 1) {
        return { fields: ['score'], message: t(CHECK_IN_KEYS.noScore) };
      }
      return null;
    },
    onStale,
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'now',
      ),
    write: () => {
      const values = form.getValues();
      const fields = checkInFieldsOf(values);
      return checkIn
        ? update.mutateAsync({ checkIn, fields })
        : create.mutateAsync({
            patientId: place.patientId,
            input: {
              ...fields,
              appointmentId: place.appointmentId,
              treatmentId: place.treatmentId,
              date: place.date,
              nextOfferingIds: values.nextOfferingIds,
            },
          });
    },
    onDone,
  });
}
