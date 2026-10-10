import type { TFunction } from 'i18next';
import { useState } from 'react';
import { useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { isolateValues } from '@/lib/bidi-isolate.ts';
import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { localDateOf } from '@/shared/api/clinic/clinic-time.ts';
import {
  fetchPrescription,
  prescriptionQueryKeys,
} from '@/shared/api/clinic/prescriptions-api.ts';
import type {
  PrescriptionKit,
  PrescriptionRecord,
  PrescriptionStatus,
  RxCatalog,
} from '@/shared/api/clinic/prescriptions-contracts.ts';
import { visitFlowReferrer } from '@/shared/clinic/clinic-referrer.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import type { QuickFillItem } from '@/shared/components/QuickFillRow/index.ts';
import {
  type DrawerBadge,
  RecordDrawer,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import {
  resetFormInPlace,
  useEditingRecord,
} from '@/shared/hooks/useEditingRecord/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { useLocaleFormat } from '@/shared/hooks/useLocaleFormat/index.ts';

import { useStaffMember } from '../../../shared/components/PatientStaffPicker/index.ts';
import {
  RX_KEYS,
  RX_KIT_TONES,
  RX_NS,
  RX_STATUS_TONES,
  RX_TEST_IDS,
} from '../../prescriptions.constants.ts';
import { useRxPrint } from '../RxPrintPreview/index.ts';
import { RxDeleteConfirm } from './rx-delete-confirm.tsx';
import {
  initialRxForm,
  namedRxLines,
  RX_NOTES,
  rxFieldsOf,
  rxFormLineOf,
  rxFormOf,
  type RxFormValues,
} from './rx-form.ts';
import { RxMedicinesField } from './rx-medicines-field.tsx';
import { RxNotesFields, RxPrescriptionFields } from './rx-steps.tsx';
import { rxSaveLabelKey, rxVisitMode, useRxDone } from './use-rx-done.tsx';
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

/** What the member may do in the drawer, read once by the section. */
export interface PrescriptionDrawerAccess {
  /** Write a new prescription (`patient_prescription:create`). */
  writes: boolean;
  /** Change a draft and approve it (`patient_prescription:update`; Q19). */
  approves: boolean;
  /** Delete a draft (`patient_prescription:delete`). */
  deletes: boolean;
  /** Start a medical sale (Medical's create) — of an approved prescription only. */
  sells: boolean;
}

/** Props of {@link PrescriptionDrawer}. */
export interface PrescriptionDrawerProps {
  /** The prescription an edit opens; null for a new one. */
  prescription: PrescriptionRecord | null;
  /** The patient: their name and number head the drawer. */
  patient: { id: string; name: string; seq: number };
  /** The patient's prescriptions, newest first — "Repeat last Rx #500". */
  history: readonly PrescriptionRecord[];
  catalog: RxCatalog | undefined;
  /** The member's own kits (`GET /app/prescription-kits`) — Quick fill copies their lines. */
  kits: readonly PrescriptionKit[];
  /** The doctor a new prescription starts with (the last prescribing doctor, else the member). */
  defaultDoctorId: string | null;
  access: PrescriptionDrawerAccess;
  today: string;
  /** A smart note's medicines (AMBER A-F5): a new prescription starts with a line each. */
  medicines?: readonly string[];
  /**
   * Written in the visit flow (`?visit=open`, the flow's "Write prescription"; L-64):
   * a new Rx is tied to the open visit's booking — Today's pharmacy lane — an
   * approver's save reads "Approve · print · send to pharmacy", and the approved
   * Rx prints on A4 before the drawer closes. "Save & sell" keeps the flow behind
   * the sale (`fromToday`: Today opened the flow); `onWritten` moves the visit on once a new
   * one lands (Q8).
   */
  visit?: { appointmentId: string | null; fromToday: boolean; onWritten?: () => void };
  onClose: () => void;
}

/**
 * The Quick fill chips (H:4810): Print (an edit — kept on an approved one), Repeat last Rx
 * (new), and the member's own kits, each copying its lines into the form.
 */
function quickFillItems({
  form,
  prescription,
  last,
  kits,
  print,
  t,
}: {
  form: UseFormReturn<RxFormValues>;
  prescription: PrescriptionRecord | null;
  last: PrescriptionRecord | undefined;
  kits: readonly PrescriptionKit[];
  print: () => void;
  t: TFunction;
}): QuickFillItem[] {
  const fill = (values: Partial<RxFormValues>) =>
    resetFormInPlace(
      form,
      { ...form.getValues(), ...values },
      { keepDefaultValues: true, keepErrors: true },
    );
  const items: QuickFillItem[] = [];
  if (prescription) {
    items.push({
      id: 'print',
      label: t(K.quickFill.print),
      tone: 'sage',
      keepWhenReadOnly: true,
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
  kits.forEach((kit, index) => {
    items.push({
      id: `kit-${kit.id}`,
      label: kit.name,
      tone: RX_KIT_TONES[index % RX_KIT_TONES.length],
      onSelect: () => fill({ items: kit.items.map(rxFormLineOf) }),
    });
  });
  return items;
}

/** An edit's draft read again — the stale save's "Reload". */
const readPrescription = (
  prescription: PrescriptionRecord,
  organizationId: string | null,
) => ({
  queryKey: prescriptionQueryKeys.detail(
    organizationId,
    prescription.patientId,
    prescription.id,
  ),
  queryFn: () =>
    fetchPrescription({
      patientId: prescription.patientId,
      prescriptionId: prescription.id,
    }),
});

/** What the drawer allows for the record it holds (Q19): a draft is changed by an approver only. */
function rxDrawerMode(
  record: PrescriptionRecord | null,
  access: PrescriptionDrawerAccess,
) {
  const status = record?.status ?? 'draft';
  const draft = status === 'draft';
  // A new one is a write; a draft's change is an approver's (PATCH needs `…:update`).
  const writable = record ? draft && access.approves : access.writes;
  return {
    status,
    draft,
    writable,
    deletable: record !== null && draft && access.deletes,
    // A sale fills an approved prescription only: "Save & sell" is an approver's.
    sellable: writable && access.approves && access.sells,
  };
}

/** The header's badges and the footer's summary: the medicines, the status, the doctor. */
function useRxHeader(values: RxFormValues, status: PrescriptionStatus) {
  const { t } = useTranslation(RX_NS);
  const { person: doctor, shortName: doctorName } = useStaffMember(values.doctorId);
  const medicines = t(K.medicines, { count: namedRxLines(values.items).length });
  const badges: DrawerBadge[] = [
    { id: 'medicines', label: medicines, tone: 'sage' },
    { id: 'status', label: t(K.status[status]), tone: RX_STATUS_TONES[status] },
  ];
  if (doctor) badges.push({ id: 'doctor', label: doctorName, tone: doctor.tone });
  return {
    badges,
    doctorName,
    doctorTone: doctor?.tone,
    summary: doctorName
      ? t(K.save.summary, { medicines, doctor: doctorName })
      : medicines,
  };
}

/**
 * The drawer's save (Q19): an approver's writes and approves; at the visit an approved Rx
 * prints; "Save & sell" opens the sale, back to the visit flow or the patient's prescriptions.
 */
function useRxDrawerSave({
  form,
  record,
  reload,
  patientId,
  visit,
  approves,
  onStep,
  onClose,
}: {
  form: UseFormReturn<RxFormValues>;
  record: PrescriptionRecord | null;
  reload: () => Promise<void>;
  patientId: string;
  visit: PrescriptionDrawerProps['visit'];
  approves: boolean;
  onStep: (step: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation(RX_NS);
  const { atVisit, appointmentId } = rxVisitMode(visit, record);
  const printRx = useRxPrint();
  const { saveState, save } = useRxSave({
    form,
    prescription: record,
    patientId,
    appointmentId,
    approves,
    onStep,
    onStale: record ? () => void reload() : undefined,
    onDone: useRxDone({
      editing: record !== null,
      atVisit,
      onWritten: atVisit ? visit?.onWritten : undefined,
      sellFrom: visit
        ? visitFlowReferrer(patientId, visit.fromToday)
        : `patients/${patientId}/prescriptions`,
      print: printRx,
      onClose,
    }),
  });
  // The sheet as the form stands: an approved one's is its read.
  const print = () => {
    if (record) void printRx({ ...record, ...rxFieldsOf(form.getValues()) });
  };
  const saveLabel = t(rxSaveLabelKey({ editing: record !== null, approves, atVisit }));
  return { saveState, save, saveLabel, print };
}

/**
 * The Prescription drawer — `prescriptions/create/` and
 * `prescriptions/$prescriptionId/edit/` (KICKOFF §6.6 Drawers; H:4804–4810;
 * `patient-file.md:105–121, 349–358`): 1040px, "New prescription" / "Edit
 * prescription" + "#500", "Dharti Galani · #3508", the medicine count (sage),
 * the status (Draft · Approved) and the doctor; Quick fill "Print prescription"
 * (edit) · "Repeat last Rx #500" (new) · the member's kits; three steps. An
 * approver's save is "Save & approve" (Q19), anyone else's writes a draft — no
 * medicine: "Add a medicine" — and "Save & sell" approves and hands the
 * prescription to a new medical sale (`?prescription=`, PRD Flow 2: a sale fills
 * an approved Rx). An approved prescription is final: it reads only, and prints.
 */
export function PrescriptionDrawer({
  prescription,
  patient,
  history,
  catalog,
  kits,
  defaultDoctorId,
  access,
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
  const { record, reload } = useEditingRecord({
    record: prescription,
    form,
    formOf: rxFormOf,
    read: readPrescription,
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [step, setStep] = useState<string>('prescription');
  const [deleting, setDeleting] = useState(false);
  const mode = rxDrawerMode(record, access);
  const header = useRxHeader(values, mode.status);
  const steps = useRxSteps({
    form,
    values,
    catalog,
    doctorName: header.doctorName,
    doctorTone: header.doctorTone,
    today,
    readOnly: !mode.writable,
  });
  const { saveState, save, saveLabel, print } = useRxDrawerSave({
    form,
    record,
    reload,
    patientId: patient.id,
    visit,
    approves: access.approves,
    onStep: setStep,
    onClose,
  });

  return (
    <>
      <RecordDrawer
        open
        onClose={onClose}
        title={t(record ? K.title.edit : K.title.create)}
        tag={record ? displayId.prescription(record.seq) : undefined}
        sub={t(
          K.sub,
          isolateValues({ name: patient.name, id: displayId.patient(patient.seq) }),
        )}
        badges={header.badges}
        quickFill={quickFillItems({
          form,
          prescription: record,
          last: history[0],
          kits,
          print,
          t,
        })}
        width={1040}
        tone="sage"
        steps={steps}
        openStep={step}
        onOpenStepChange={setStep}
        summary={header.summary}
        readOnly={!mode.writable}
        saveLabel={saveLabel}
        onSave={() => void save(false)}
        saveState={saveState}
        saveAndAddLabel={mode.sellable ? t(K.save.sell) : undefined}
        onSaveAndAdd={mode.sellable ? () => void save(true) : undefined}
        onDelete={mode.deletable ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={RX_TEST_IDS.drawer}
      >
        {mode.draft ? null : (
          <p
            data-testid={`${RX_TEST_IDS.drawer}-approved`}
            className="text-detail text-muted-foreground"
          >
            {t(K.approvedNote)}
          </p>
        )}
      </RecordDrawer>
      {record && mode.deletable ? (
        <RxDeleteConfirm
          prescription={record}
          open={deleting}
          onOpenChange={setDeleting}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}
