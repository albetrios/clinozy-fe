import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Prescription } from '@/shared/api/clinic/clinic-schema.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import {
  useCreatePrescription,
  useUpdatePrescription,
} from '@/shared/hooks/usePrescriptions/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import { namedRxLines, type RxFormValues, rxInputOf } from './rx-form.ts';

/** The drawer's steps, as the save opens them. */
export type RxStepId = 'prescription' | 'medicines' | 'notes';

/** The form's fields in the drawer's order, each with its step. */
const FIELD_STEPS: readonly [FieldPath<RxFormValues>, RxStepId][] = [
  ['date', 'prescription'],
  ['doctorId', 'prescription'],
  ['items', 'medicines'],
  ['advice', 'notes'],
  ['labReport', 'notes'],
  ['procedureToday', 'notes'],
];

/** The step that holds a field (a row's field opens Medicines). */
function rxStepOf(field: string): RxStepId {
  return (
    FIELD_STEPS.find(([name]) => field === name || field.startsWith(`${name}.`))?.[1] ??
    'medicines'
  );
}

/** Options of {@link useRxSave}. */
export interface UseRxSaveOptions {
  form: UseFormReturn<RxFormValues>;
  /** The prescription an edit saves; a new one has none. */
  prescription: Prescription | null;
  patientId: string;
  /** The booking a new Rx is written at — the open visit's, in the visit flow. */
  appointmentId?: string | null;
  onStep: (step: RxStepId) => void;
  /** The write went through; `sell` when it was "Save & sell". */
  onDone: (prescription: Prescription, sell: boolean) => void;
}

/**
 * The Prescription drawer's write on the shared drawer save (KICKOFF §6.0,
 * §6.6): no medicine named → "Add a medicine" and step 2 opens; else
 * `createPrescription` / `updatePrescription` (`S:1641`), names the store
 * lacks becoming quick medicines server-side (Q-M4).
 */
export function useRxSave({
  form,
  prescription,
  patientId,
  appointmentId = null,
  onStep,
  onDone,
}: UseRxSaveOptions) {
  const { t } = useTranslation(RX_NS);
  const create = useCreatePrescription({ notifyOnError: false });
  const update = useUpdatePrescription({ notifyOnError: false });

  return useDrawerSave<RxFormValues, Prescription>({
    form,
    fieldOrder: FIELD_STEPS.map(([field]) => field),
    toastId: 'rx-save-failed',
    check: (values) =>
      namedRxLines(values.items).length === 0
        ? { fields: ['items'], message: t(RX_KEYS.save.noMedicine) }
        : null,
    onField: (field) => onStep(rxStepOf(field)),
    write: async () => {
      const input = rxInputOf(form.getValues(), {
        patientId,
        appointmentId: prescription ? prescription.appointmentId : appointmentId,
        followUpDate: prescription?.followUpDate ?? null,
      });
      return prescription
        ? update.mutateAsync({ id: prescription.id, input })
        : create.mutateAsync(input);
    },
    onDone,
  });
}
