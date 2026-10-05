import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Treatment } from '@/shared/api/clinic/clinic-schema.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import {
  useCreateTreatment,
  useUpdateTreatment,
} from '@/shared/hooks/useTreatments/index.ts';

import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import { type TreatmentFormValues, treatmentInputOf } from './treatment-form.ts';

/** The drawer's steps, as the save opens them. */
type TreatmentStepId = 'session' | 'details' | 'aftercare';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<TreatmentFormValues>, TreatmentStepId][] = [
  ['name', 'session'],
  ['sessionNo', 'session'],
  ['doctorId', 'session'],
  ['therapistId', 'session'],
  ['areas', 'details'],
  ['params', 'details'],
  ['remark', 'aftercare'],
  ['aftercareCall', 'aftercare'],
];

/** The contract's names the form spells differently. */
const SERVER_FIELDS = { bodyParts: 'areas' } as const;

/** Options of {@link useTreatmentSave}. */
export interface UseTreatmentSaveOptions {
  form: UseFormReturn<TreatmentFormValues>;
  /** The treatment an edit saves; a new one has none. */
  treatment: Treatment | null;
  patientId: string;
  onStep: (step: TreatmentStepId) => void;
  onDone: (treatment: Treatment) => void;
}

/**
 * The Treatment drawer's write on the shared drawer save (KICKOFF §6.0,
 * §6.6): nothing is required in the UI — a blank name saves as "Treatment"
 * (A-F11) — then `createTreatment` / `updateTreatment` (`S:1642`), which
 * schedules the aftercare call and counts a package session.
 */
export function useTreatmentSave({
  form,
  treatment,
  patientId,
  onStep,
  onDone,
}: UseTreatmentSaveOptions) {
  const { t } = useTranslation(TREATMENT_NS);
  const create = useCreateTreatment({ notifyOnError: false });
  const update = useUpdateTreatment({ notifyOnError: false });

  return useDrawerSave<TreatmentFormValues, Treatment>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    serverFields: SERVER_FIELDS,
    toastId: 'treatment-save-failed',
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'details',
      ),
    write: async () => {
      const input = treatmentInputOf(form.getValues(), {
        patientId,
        appointmentId: treatment?.appointmentId ?? null,
        performedAt: treatment?.performedAt ?? new Date().toISOString(),
        fallbackName: t(TREATMENT_KEYS.record),
      });
      return treatment
        ? update.mutateAsync({ id: treatment.id, input })
        : create.mutateAsync(input);
    },
    onDone: (saved) => onDone(saved),
  });
}
