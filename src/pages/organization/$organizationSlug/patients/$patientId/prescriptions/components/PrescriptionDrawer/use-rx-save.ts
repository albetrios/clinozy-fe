import type { FieldPath, UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { PrescriptionRecord } from '@/shared/api/clinic/prescriptions-contracts.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import {
  useCreatePrescription,
  useUpdatePrescription,
} from '@/shared/hooks/usePrescriptions/index.ts';

import { RX_KEYS, RX_NS } from '../../prescriptions.constants.ts';
import {
  namedRxLines,
  rxFieldsOf,
  type RxFormLine,
  type RxFormValues,
} from './rx-form.ts';

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

/** A row's fields, in its order. */
const ROW_FIELDS = ['medicineName', 'dose', 'when', 'where', 'qty', 'remarks'] as const;

/** A line field the server names (camelCased), as the row's control that holds it. */
const LINE_FIELD_OF_SERVER: Readonly<Record<string, (typeof ROW_FIELDS)[number]>> = {
  medicineName: 'medicineName',
  medicineId: 'medicineName',
  doseMorning: 'dose',
  doseAfternoon: 'dose',
  doseNight: 'dose',
  isSos: 'dose',
  meal: 'when',
  timing: 'when',
  timingText: 'when',
  bodyPart: 'where',
  bodyPartText: 'where',
  quantity: 'qty',
  remarks: 'remarks',
};

/**
 * Where the server's field names land on the form: the doctor and the day under the form's
 * names, and each sent line (`items.<n>.…`, the named rows only — blank rows are not sent) on
 * the row it came from.
 */
function rxServerFields(items: readonly RxFormLine[]) {
  const rows = items.flatMap((item, index) =>
    item.medicineName.trim() === '' ? [] : [index],
  );
  const fields: Record<string, FieldPath<RxFormValues>> = {
    doctorMembershipId: 'doctorId',
    prescriptionDate: 'date',
  };
  rows.forEach((row, sent) => {
    for (const [server, field] of Object.entries(LINE_FIELD_OF_SERVER)) {
      fields[`items.${sent}.${server}`] = `items.${row}.${field}`;
    }
  });
  const order = FIELD_STEPS.flatMap(([field]): FieldPath<RxFormValues>[] =>
    field === 'items'
      ? [
          'items',
          ...rows.flatMap((row) =>
            ROW_FIELDS.map((name): FieldPath<RxFormValues> => `items.${row}.${name}`),
          ),
        ]
      : [field],
  );
  return { fields, order };
}

/** Options of {@link useRxSave}. */
export interface UseRxSaveOptions {
  form: UseFormReturn<RxFormValues>;
  /** The draft an edit saves; a new one has none. */
  prescription: PrescriptionRecord | null;
  patientId: string;
  /** The booking a new Rx is written at — the open visit's, in the visit flow. */
  appointmentId?: string | null;
  /** The member approves (Q19): the save approves what it wrote. */
  approves: boolean;
  onStep: (step: RxStepId) => void;
  /** The write went through; `sell` when it was "Save & sell". */
  onDone: (prescription: PrescriptionRecord, sell: boolean) => void;
  /** Someone saved the draft meanwhile (`409 record_changed`): load it again. */
  onStale?: () => void;
}

/**
 * The Prescription drawer's write on the shared drawer save (KICKOFF §6.0, §6.6): no medicine
 * named → "Add a medicine" and step 2 opens; else `POST …/prescriptions` or the draft's `PATCH`
 * with its `updated_at`, then `POST …/approve` for an approver (Q19). The server's field errors
 * land on the form — a line's on its row — and open their step.
 */
export function useRxSave({
  form,
  prescription,
  patientId,
  appointmentId = null,
  approves,
  onStep,
  onDone,
  onStale,
}: UseRxSaveOptions) {
  const { t } = useTranslation(RX_NS);
  const create = useCreatePrescription({ notifyOnError: false });
  const update = useUpdatePrescription({ notifyOnError: false });
  const server = rxServerFields(form.getValues('items'));

  return useDrawerSave<RxFormValues, PrescriptionRecord>({
    form,
    fieldOrder: server.order,
    serverFields: server.fields,
    toastId: 'rx-save-failed',
    check: (values) =>
      namedRxLines(values.items).length === 0
        ? { fields: ['items'], message: t(RX_KEYS.save.noMedicine) }
        : null,
    onField: (field) => onStep(rxStepOf(field)),
    onStale,
    write: async () => {
      const fields = rxFieldsOf(form.getValues());
      return prescription
        ? update.mutateAsync({ prescription, fields, approve: approves })
        : create.mutateAsync({ patientId, fields, appointmentId, approve: approves });
    },
    onDone,
  });
}
