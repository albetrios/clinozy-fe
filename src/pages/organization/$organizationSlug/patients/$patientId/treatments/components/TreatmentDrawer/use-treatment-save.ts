import { useQueryClient } from '@tanstack/react-query';
import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { patientPackageQueryKeys } from '@/shared/api/app/patient-packages-api.ts';
import { treatmentQueryKeys } from '@/shared/api/app/treatments-api.ts';
import type { TreatmentRecord } from '@/shared/api/app/treatments-contracts.ts';
import { notifyError } from '@/shared/errors/errorHandler.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import {
  useCreateTreatment,
  useUpdateTreatment,
} from '@/shared/hooks/useTreatments/index.ts';

import { TREATMENT_KEYS, TREATMENT_NS } from '../../treatments.constants.ts';
import { treatmentFieldsOf, type TreatmentFormValues } from './treatment-form.ts';

/** The drawer's steps, as the save opens them. */
type TreatmentStepId = 'session' | 'details' | 'aftercare';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<TreatmentFormValues>, TreatmentStepId][] = [
  ['name', 'session'],
  ['offeringId', 'session'],
  ['packageId', 'session'],
  ['sessionNumber', 'session'],
  ['doctorId', 'session'],
  ['therapistId', 'session'],
  ['areas', 'details'],
  ['parameters', 'details'],
  ['remark', 'aftercare'],
  ['aftercareCall', 'aftercare'],
];

/** The API's names the form spells differently. */
const SERVER_FIELDS = {
  bodyParts: 'areas',
  doctorMembershipId: 'doctorId',
  therapistMembershipId: 'therapistId',
  patientOfferingId: 'packageId',
} as const;

/** Options of {@link useTreatmentSave}. */
export interface UseTreatmentSaveOptions {
  form: UseFormReturn<TreatmentFormValues>;
  /** The treatment an edit saves; a new one has none. */
  treatment: TreatmentRecord | null;
  patientId: string;
  /**
   * The open visit (the visit flow): a new treatment is written at its booking and `onWritten`
   * moves it on once it lands (Q8). An edit, or a drawer outside the flow, is neither.
   */
  visit?: { appointmentId: string; onWritten: () => void };
  onStep: (step: TreatmentStepId) => void;
  /** Someone saved the treatment since the drawer read it: read it again. */
  onStale: () => void;
  onDone: (treatment: TreatmentRecord) => void;
}

/**
 * The Treatment drawer's write on the shared drawer save (KICKOFF §6.0,
 * §6.6): nothing is required in the UI — a blank name saves as "Treatment"
 * (A-F11) — then `POST …/treatments` (a package session spent on the server)
 * or `PATCH …/treatments/:id` with the read's `updated_at`. The server's field
 * errors outline their fields and open their step.
 */
export function useTreatmentSave({
  form,
  treatment,
  patientId,
  visit,
  onStep,
  onStale,
  onDone,
}: UseTreatmentSaveOptions) {
  const { t } = useTranslation(TREATMENT_NS);
  const queryClient = useQueryClient();
  const create = useCreateTreatment({ notifyOnError: false });
  const update = useUpdateTreatment({ notifyOnError: false });
  const atVisit = treatment ? null : (visit ?? null);

  return useDrawerSave<TreatmentFormValues, TreatmentRecord>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    serverFields: SERVER_FIELDS,
    toastId: 'treatment-save-failed',
    onStale,
    // The package has no session left or is past its date (`offering_used_up`,
    // `offering_expired`), or the session was reversed meanwhile: the server's
    // words, and the packages and sessions read again.
    onConflict: (error) => {
      notifyError(error, { id: 'treatment-save-failed' });
      void queryClient.invalidateQueries({ queryKey: patientPackageQueryKeys.all });
      void queryClient.invalidateQueries({ queryKey: treatmentQueryKeys.all });
    },
    onField: (field) =>
      onStep(
        FIELD_STEPS.find(
          ([name]) => field === name || field.startsWith(`${name}.`),
        )?.[1] ?? 'details',
      ),
    write: async () => {
      const values = form.getValues();
      const fields = treatmentFieldsOf(values, t(TREATMENT_KEYS.record));
      return treatment
        ? update.mutateAsync({ treatment, fields })
        : create.mutateAsync({
            patientId,
            input: {
              ...fields,
              packageId: values.packageId,
              appointmentId: atVisit?.appointmentId ?? null,
            },
          });
    },
    onDone: (saved) => {
      onDone(saved);
      atVisit?.onWritten();
    },
  });
}
