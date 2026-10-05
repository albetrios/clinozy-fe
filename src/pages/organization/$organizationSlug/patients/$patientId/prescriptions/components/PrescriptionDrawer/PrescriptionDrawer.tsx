import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Prescription, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import type { RxCatalog } from '@/shared/api/clinic/prescriptions-api.ts';
import { visitFlowReferrer } from '@/shared/clinic/clinic-referrer.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import { RecordDrawer } from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import { RX_KEYS, RX_NS, RX_TEST_IDS } from '../../prescriptions.constants.ts';
import { RxDeleteConfirm } from './rx-delete-confirm.tsx';
import {
  initialRxForm,
  namedRxLines,
  RX_KITS,
  RX_NOTES,
  rxFormLineOf,
  type RxFormValues,
  rxInputOf,
  rxKitLines,
} from './rx-form.ts';
import { RxMedicinesField } from './rx-medicines-field.tsx';
import { RxNotesFields, RxPrescriptionFields } from './rx-steps.tsx';
import { rxSaveLabelKey, rxVisitMode, useRxDone, useRxPrint } from './use-rx-done.tsx';
import { useRxSave } from './use-rx-save.ts';

const K = RX_KEYS;

/**
 * The three steps (H:4805–4808): 1 "Prescription" (Date, Doctor), 2
 * "Medicines" (the quick line and the rows), 3 "Clinical notes"; each
 * collapsed step peeks its values.
 */
function useRxSteps({
  form,
  values,
  catalog,
  doctorName,
  doctorTone,
  today,
  readOnly,
}: {
  form: UseFormReturn<RxFormValues>;
  values: RxFormValues;
  catalog: RxCatalog | undefined;
  doctorName: string;
  /** The doctor's tone — the peek shows them as a pill (H:3832). */
  doctorTone: Tone | undefined;
  today: string;
  readOnly: boolean;
}): DrawerStep[] {
  const { t } = useTranslation(RX_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { formatDate } = useLocaleFormat();
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const date = formatDate(
    localDateOf(values.date),
    { day: 'numeric', month: 'short', year: 'numeric' },
    { civilDay: true },
  );
  const named = namedRxLines(values.items).length;
  return [
    {
      id: 'prescription',
      title: t(K.steps.prescription),
      summary: drawerStepSummary([date, doctorName], notFilled),
      peek: [
        { kind: 'value', label: t(K.date), value: date },
        {
          kind: 'value',
          label: t(K.doctor),
          value: doctorName || undefined,
          tone: doctorTone,
        },
      ],
      content: (
        <RxPrescriptionFields
          form={form}
          values={values}
          readOnly={readOnly}
          today={today}
        />
      ),
    },
    {
      id: 'medicines',
      title: t(K.steps.medicines),
      summary: drawerStepSummary(
        [named ? t(K.medicines, { count: named }) : ''],
        notFilled,
      ),
      peek: [
        {
          kind: 'items',
          label: t(K.items.label),
          names: namedRxLines(values.items).map((line) => line.medicineName),
        },
      ],
      content: (
        <RxMedicinesField
          form={form}
          items={values.items}
          catalog={catalog}
          readOnly={readOnly}
        />
      ),
    },
    {
      id: 'notes',
      title: t(K.steps.notes),
      summary: drawerStepSummary(
        RX_NOTES.map((note) => values[note.field].trim()),
        notFilled,
      ),
      peek: RX_NOTES.map((note) => ({
        kind: 'value' as const,
        label: t(K.notes[note.label]),
        value: values[note.field].trim() || undefined,
      })),
      content: <RxNotesFields form={form} readOnly={readOnly} />,
    },
  ];
}

/** Props of {@link PrescriptionDrawer}. */
export interface PrescriptionDrawerProps {
  /** The prescription an edit opens; null for a new one. */
  prescription: Prescription | null;
  /** The patient: their name and number head the drawer. */
  patient: { id: string; name: string; seq: number };
  /** The patient's prescriptions, newest first — "Repeat last Rx #500". */
  history: readonly Prescription[];
  catalog: RxCatalog | undefined;
  /** The doctor a new prescription starts with (the last prescribing doctor). */
  defaultDoctorId: string | null;
  /** Doctor, Admin, Owner (`S:35, 37`); anyone else reads it. */
  writable: boolean;
  canDelete: boolean;
  today: string;
  /** A smart note's medicines (AMBER A-F5): a new prescription starts with a line each. */
  medicines?: readonly string[];
  /**
   * Written in the visit flow (`?visit=open`, the flow's "Write prescription"; L-64):
   * a new Rx is tied to the open visit's booking — Today's pharmacy lane and
   * Medical's "Prescriptions to fill" — its save reads "Approve · print · send
   * to pharmacy", and the saved Rx prints on A4 before the drawer closes; the
   * visit moves on (the server's rule, `advanceVisitAfter`). "Save & sell"
   * keeps the flow behind the sale (`fromToday`: Today opened the flow).
   */
  visit?: { appointmentId: string | null; fromToday: boolean };
  onClose: () => void;
}

/** The Quick fill chips (H:4810): Print (edit), Repeat last Rx (new), the three kits. */
function quickFillItems({
  form,
  prescription,
  last,
  catalog,
  print,
  t,
}: {
  form: UseFormReturn<RxFormValues>;
  prescription: Prescription | null;
  last: Prescription | undefined;
  catalog: RxCatalog | undefined;
  print: () => void;
  t: TFunction;
}): QuickFillItem[] {
  const fill = (values: Partial<RxFormValues>) =>
    form.reset(
      { ...form.getValues(), ...values },
      { keepDefaultValues: true, keepErrors: true },
    );
  const items: QuickFillItem[] = [];
  if (prescription) {
    items.push({
      id: 'print',
      label: t(K.quickFill.print),
      tone: 'sage',
      onSelect: print,
    });
  } else if (last) {
    items.push({
      id: 'repeat',
      label: t(K.quickFill.repeat, { number: displayId.prescription(last.seq) }),
      tone: 'sky',
      onSelect: () =>
        fill({ items: last.items.map(rxFormLineOf), advice: last.advice ?? '' }),
    });
  }
  for (const kit of RX_KITS) {
    items.push({
      id: kit.id,
      label: t(K.quickFill.kits[kit.id]),
      tone: kit.tone,
      onSelect: () =>
        fill({
          items: rxKitLines(kit, catalog?.medicines ?? [], () => t(K.kit.reapply)),
          ...(kit.advice ? { advice: t(K.kit.avoidSun) } : {}),
        }),
    });
  }
  return items;
}

/**
 * The Prescription drawer — `prescriptions/create/` and
 * `prescriptions/$prescriptionId/edit/` (KICKOFF §6.6 Drawers; H:4804–4810;
 * `patient-file.md:105–121, 349–358`): 1040px, "New prescription" / "Edit
 * prescription" + "#500", "Dharti Galani · #3508", the medicine count (sage)
 * and the doctor; Quick fill "Print prescription" (edit) · "Repeat last Rx
 * #500" (new) · the three kits; three steps. "Save prescription" / "Save
 * changes" — no medicine: "Add a medicine" — and "Save & sell", which saves
 * and hands the prescription to a new medical sale (`?prescription=`, PRD
 * Flow 2; the sale is L-50c's). View only without the Rx gate.
 */
export function PrescriptionDrawer({
  prescription,
  patient,
  history,
  catalog,
  defaultDoctorId,
  writable,
  canDelete,
  today,
  medicines: smartNoteMedicines = [],
  visit,
  onClose,
}: PrescriptionDrawerProps) {
  const { t } = useTranslation(RX_NS);
  const form = useForm<RxFormValues>({
    defaultValues: initialRxForm({
      prescription,
      today,
      doctorId: defaultDoctorId,
      medicines: smartNoteMedicines,
      catalog: catalog?.medicines ?? [],
    }),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('prescription');
  const [deleting, setDeleting] = useState(false);

  const { person: doctor, shortName: doctorName } = useStaffMember(values.doctorId);
  const medicines = t(K.medicines, { count: namedRxLines(values.items).length });
  const steps = useRxSteps({
    form,
    values,
    catalog,
    doctorName,
    doctorTone: doctor?.tone,
    today,
    readOnly: !writable,
  });

  const { approving, appointmentId } = rxVisitMode(visit, prescription);
  const printRx = useRxPrint(patient.id, values.doctorId);
  const { saveState, save } = useRxSave({
    form,
    prescription,
    patientId: patient.id,
    appointmentId,
    onStep: setStep,
    onDone: useRxDone({
      editing: prescription !== null,
      approving,
      sellFrom: visit
        ? visitFlowReferrer(patient.id, visit.fromToday)
        : `patients/${patient.id}/prescriptions`,
      print: printRx,
      onClose,
    }),
  });

  const print = () => {
    if (!prescription) return;
    const input = rxInputOf(form.getValues(), {
      patientId: patient.id,
      appointmentId: prescription.appointmentId,
      followUpDate: prescription.followUpDate,
    });
    void printRx({ ...prescription, ...input });
  };

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(prescription ? K.title.edit : K.title.create)}
        tag={prescription ? displayId.prescription(prescription.seq) : undefined}
        sub={t(K.sub, { name: patient.name, id: displayId.patient(patient.seq) })}
        badges={[
          { id: 'medicines', label: medicines, tone: 'sage' },
          ...(doctor ? [{ id: 'doctor', label: doctorName, tone: doctor.tone }] : []),
        ]}
        quickFill={quickFillItems({
          form,
          prescription,
          last: history[0],
          catalog,
          print,
          t,
        })}
        width={1040}
        tone="sage"
        steps={steps}
        openStep={step}
        onOpenStepChange={setStep}
        summary={
          doctorName ? t(K.save.summary, { medicines, doctor: doctorName }) : medicines
        }
        readOnly={!writable}
        saveLabel={t(rxSaveLabelKey(prescription !== null, approving))}
        onSave={() => void save(false)}
        saveState={saveState}
        saveAndAddLabel={t(K.save.sell)}
        onSaveAndAdd={() => void save(true)}
        onDelete={prescription && canDelete ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={RX_TEST_IDS.drawer}
      />
      {prescription && canDelete ? (
        <RxDeleteConfirm
          prescription={prescription}
          open={deleting}
          onOpenChange={setDeleting}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}
