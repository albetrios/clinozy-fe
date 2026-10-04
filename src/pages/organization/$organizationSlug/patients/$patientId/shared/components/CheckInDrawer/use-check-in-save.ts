import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { CheckIn } from '@/shared/api/clinic/clinic-schema.ts';
import type { CheckInSaved } from '@/shared/api/clinic/feedback-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useCreateCheckIn, useUpdateCheckIn } from '@/shared/hooks/useFeedback/index.ts';

import { CHECK_IN_KEYS, CHECK_IN_NS } from './check-in.constants.ts';
import {
  type CheckInFormValues,
  checkInInputOf,
  type CheckInPlace,
} from './check-in-form.ts';

/** The drawer's steps, as the save opens them. */
export type CheckInStepId = 'now' | 'followed' | 'next';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<CheckInFormValues>, CheckInStepId][] = [
  ['feel', 'now'],
  ['score', 'now'],
  ['now', 'now'],
  ['followed', 'followed'],
  ['followedNote', 'followed'],
  ['nextPlan', 'next'],
  ['nextOfferingIds', 'next'],
];

/** Options of {@link useCheckInSave}. */
export interface UseCheckInSaveOptions {
  form: UseFormReturn<CheckInFormValues>;
  /** The check-in an Edit opens; null for a new one. */
  checkIn: CheckIn | null;
  /** Where it sits — read at save time, once the drawer knows the treatment and the visit. */
  place: () => CheckInPlace;
  onStep: (step: CheckInStepId) => void;
  onDone: (saved: CheckInSaved) => void;
}

/**
 * The check-in's write on the shared drawer save (KICKOFF §6.6): no feel →
 * "Pick how it is now" and the first step opens; else `createCheckIn` or
 * `updateCheckIn` (`S:1648`) — the server adds the named offerings to the
 * suggestions as Planned and, for Worse or a score of 4 or less, a doctor
 * call-back due in 3 hours.
 */
export function useCheckInSave({
  form,
  checkIn,
  place,
  onStep,
  onDone,
}: UseCheckInSaveOptions) {
  const { t } = useTranslation(CHECK_IN_NS);
  const create = useCreateCheckIn({ notifyOnError: false });
  const update = useUpdateCheckIn({ notifyOnError: false });

  return useDrawerSave<CheckInFormValues, CheckInSaved>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    toastId: 'check-in-save-failed',
    check: (values) =>
      values.feel === null
        ? { fields: ['feel'], message: t(CHECK_IN_KEYS.noFeel) }
        : null,
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'now',
      ),
    write: () => {
      const input = checkInInputOf(form.getValues(), place());
      return checkIn
        ? update.mutateAsync({ id: checkIn.id, input })
        : create.mutateAsync(input);
    },
    onDone,
  });
}
