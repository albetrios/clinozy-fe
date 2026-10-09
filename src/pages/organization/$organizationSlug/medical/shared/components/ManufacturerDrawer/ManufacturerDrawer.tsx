import type { TFunction } from 'i18next';
import { useId, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import type { Manufacturer, Tone } from '@/shared/api/clinic/clinic-schema.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerField,
  DrawerFieldGrid,
  DrawerInfo,
  DrawerInput,
  DrawerStepBody,
  DrawerSwatches,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import {
  type DrawerStep,
  drawerStepSummary,
} from '@/shared/components/DrawerSteps/index.ts';
import {
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import { useFormValues } from '@/shared/hooks/useFormValues/index.ts';
import { notify } from '@/shared/notify/index.ts';

import {
  useCreateManufacturer,
  useUpdateManufacturer,
} from '../../hooks/useMedicalPartners/index.ts';
import {
  type MedicalPickers,
  useMedicalPickers,
} from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import type { ManufacturerRow } from '../../medical-contracts.ts';
import { useMedicalDrawerAccess } from '../../medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import {
  MANUFACTURER_TONES,
  type ManufacturerInput,
} from '../../medical-partners-contracts.ts';
import { MedicalDeleteConfirm } from '../MedicalDeleteConfirm/index.ts';
import { MedicalPartnerPicker } from '../MedicalPartnerPicker/index.ts';

const K = MEDICAL_DRAWER_KEYS.manufacturer;

/** Five fields, none heavy: the light 560px (`medical.md:336`). */
const CONTENT_PROFILE = { fieldCount: 5 } as const;

/** The pack's brand fits a pill: a short name (the contract allows more). */
const NAME_MAX = 40;

/** The form: the name as typed (upper case), its colour, who distributes and represents it. */
interface ManufacturerFormValues {
  name: string;
  tone: Tone;
  supplierIds: string[];
  mrIds: string[];
}

/** What every use of the drawer passes. */
interface ManufacturerDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Stacked on another drawer: "Back", "Add manufacturer", no "full details" of its own. */
  stacked?: boolean;
  /** The saved record — a stacked child hands it to the field that asked. */
  onSaved?: (maker: Manufacturer) => void;
  /** Opens a supplier or MR on top for "full details"; a stacked drawer passes none. */
  openChild?: OpenMedicalChild;
  testId?: string;
}

/** Props of {@link ManufacturerDrawer}: New manufacturer, or Edit manufacturer once loaded. */
export type ManufacturerDrawerProps = ManufacturerDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { name?: string } }
    | { mode: 'edit'; manufacturer: ManufacturerRow | undefined }
  );

/** A new manufacturer: the typed name, lavender (`medical.md:213`), no connections. */
function emptyForm(prefill: { name?: string } = {}): ManufacturerFormValues {
  return {
    name: (prefill.name ?? '').trim().toUpperCase().slice(0, NAME_MAX),
    tone: 'lav',
    supplierIds: [],
    mrIds: [],
  };
}

/** A saved manufacturer's form. */
function formOf(maker: ManufacturerRow): ManufacturerFormValues {
  return {
    name: maker.name,
    tone: maker.tone,
    supplierIds: maker.suppliers.map((supplier) => supplier.id),
    mrIds: maker.mrs.map((mr) => mr.id),
  };
}

/** The labels of the picked options, in their order. */
function labelsOf(options: MedicalPickers['mrs'], ids: readonly string[]) {
  const byId = new Map(options.map((option) => [option.key, option.label]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}

/** The footer's "ALVI · 2 suppliers · 1 MR" (`medical.md:219`). */
function summaryOf(values: ManufacturerFormValues, t: TFunction): string {
  const counts =
    values.supplierIds.length > 0 || values.mrIds.length > 0
      ? [
          t(K.summary.suppliers, { count: values.supplierIds.length }),
          t(K.summary.mrs, { count: values.mrIds.length }),
        ]
      : [];
  return [values.name.trim(), ...counts].filter(Boolean).join(' · ');
}

/** What every step's body reads: the form, the DOM ids' prefix, the root test id. */
interface FieldsProps {
  form: UseFormReturn<ManufacturerFormValues>;
  idPrefix: string;
  testId: string;
}

/** MANUFACTURER's body: the values, for a saved colour outside the six. */
interface MakerFieldsProps extends FieldsProps {
  values: ManufacturerFormValues;
}

/** CONNECTIONS' body: the pickers, the stack and the medicines it makes. */
interface ConnectionFieldsProps extends FieldsProps {
  pickers: MedicalPickers;
  openChild?: OpenMedicalChild;
  medicineCount: number;
}

/** What the steps' bodies read. */
type BodyProps = MakerFieldsProps & ConnectionFieldsProps;

/** MANUFACTURER: Name* (upper case) · Colour. */
function MakerFields({ form, values, idPrefix, testId }: MakerFieldsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  // A saved maker in a colour outside the six keeps it, picked, at the end.
  const tones = MANUFACTURER_TONES.includes(values.tone)
    ? MANUFACTURER_TONES
    : [...MANUFACTURER_TONES, values.tone];
  return (
    <DrawerFieldGrid>
      <DrawerField
        span="half"
        stretch={false}
        label={t(K.fields.name)}
        htmlFor={name.id}
        required
        error={name.error}
      >
        <Controller
          control={form.control}
          name="name"
          render={({ field: control }) => (
            <DrawerInput
              {...name.control}
              aria-required="true"
              capitalize={false}
              value={control.value}
              onChange={(event) => control.onChange(event.target.value.toUpperCase())}
              onBlur={control.onBlur}
              maxLength={NAME_MAX}
              autoComplete="off"
              data-testid={`${testId}-name`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(K.fields.colour)}>
        <Controller
          control={form.control}
          name="tone"
          render={({ field: control }) => (
            <DrawerSwatches
              label={t(K.fields.colour)}
              tones={tones}
              value={control.value}
              onChange={control.onChange}
              testId={`${testId}-colour`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** CONNECTIONS: Suppliers · MRs · the medicines it makes. */
function ConnectionFields({
  form,
  idPrefix,
  testId,
  pickers,
  openChild,
  medicineCount,
}: ConnectionFieldsProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const suppliers = field('supplierIds');
  const mrs = field('mrIds');
  return (
    <DrawerFieldGrid>
      <DrawerField
        label={t(K.fields.suppliers)}
        hint={t(K.fields.suppliersHint)}
        htmlFor={suppliers.id}
      >
        <Controller
          control={form.control}
          name="supplierIds"
          render={({ field: control }) => (
            <MedicalPartnerPicker
              kind="supplier"
              multiple
              id={suppliers.id}
              label={t(K.fields.suppliers)}
              value={control.value}
              onChange={control.onChange}
              pickers={pickers}
              openChild={openChild}
              testId={`${testId}-suppliers`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(K.fields.mrs)} hint={t(K.fields.mrsHint)} htmlFor={mrs.id}>
        <Controller
          control={form.control}
          name="mrIds"
          render={({ field: control }) => (
            <MedicalPartnerPicker
              kind="mr"
              multiple
              id={mrs.id}
              label={t(K.fields.mrs)}
              value={control.value}
              onChange={control.onChange}
              pickers={pickers}
              openChild={openChild}
              testId={`${testId}-mrs`}
            />
          )}
        />
      </DrawerField>
      <DrawerField label={t(K.fields.medicines)}>
        <DrawerInfo testId={`${testId}-medicines`}>
          {medicineCount > 0
            ? t(K.fields.medicineCount, { count: medicineCount })
            : t(K.fields.noMedicines)}
        </DrawerInfo>
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** The two step cards, with what each peeks while closed. */
function useSteps(body: BodyProps, readOnly: boolean): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const { values, pickers, medicineCount } = body;
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const name = values.name.trim();
  const colour = tDrawer(RECORD_DRAWER_KEYS.colours[values.tone]);
  const supplierNames = labelsOf(pickers.suppliers(), values.supplierIds);
  const mrNames = labelsOf(pickers.mrs, values.mrIds);
  const medicines =
    medicineCount > 0
      ? t(K.fields.medicineCount, { count: medicineCount })
      : t(K.fields.noMedicines);
  return [
    {
      id: 'maker',
      title: t(K.steps.maker),
      summary: drawerStepSummary([name, colour], notFilled),
      peek: [
        { kind: 'value', label: t(K.fields.name), value: name },
        { kind: 'value', label: t(K.fields.colour), value: colour, tone: values.tone },
      ],
      missing: name ? [] : [t(K.fields.name)],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <MakerFields {...body} />
        </DrawerStepBody>
      ),
    },
    {
      id: 'connections',
      title: t(K.steps.connections),
      summary: [...supplierNames, ...mrNames].slice(0, 4).join(' · ') || notFilled,
      peek: [
        {
          kind: 'multi',
          label: t(K.fields.suppliers),
          values: supplierNames.map((label) => ({ label })),
        },
        {
          kind: 'multi',
          label: t(K.fields.mrs),
          values: mrNames.map((label) => ({ label, tone: 'mint' as const })),
        },
        { kind: 'value', label: t(K.fields.medicines), value: medicines },
      ],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <ConnectionFields {...body} />
        </DrawerStepBody>
      ),
    },
  ];
}

/** The contract's fields for a form: the name trimmed, upper case. */
function inputOf(values: ManufacturerFormValues): ManufacturerInput {
  return {
    name: values.name.trim().toUpperCase(),
    tone: values.tone,
    supplierIds: values.supplierIds,
    mrIds: values.mrIds,
  };
}

/** One opening of the drawer: the form, its steps and its save. */
function ManufacturerSession({
  open,
  onClose,
  maker,
  prefill,
  stacked = false,
  onSaved,
  openChild,
  testId,
}: ManufacturerDrawerBaseProps & {
  maker: ManufacturerRow | null;
  prefill?: { name?: string };
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const idPrefix = `manufacturer-${useId().replace(/:/g, '')}`;
  const { readOnly, canDelete } = useMedicalDrawerAccess(maker !== null);
  const pickers = useMedicalPickers();
  const form = useForm<ManufacturerFormValues>({
    defaultValues: maker ? formOf(maker) : emptyForm(prefill),
  });
  const values = useFormValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('maker');
  const [deleting, setDeleting] = useState(false);

  const create = useCreateManufacturer({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const update = useUpdateManufacturer({
    notifyOnError: false,
    successMessage: t(K.saved),
  });
  const { saveState, save } = useDrawerSave<ManufacturerFormValues, Manufacturer>({
    form,
    fieldOrder: ['name', 'tone', 'supplierIds', 'mrIds'],
    toastId: 'manufacturer-save-failed',
    onField: (field) =>
      setOpenStep(field === 'name' || field === 'tone' ? 'maker' : 'connections'),
    write: () => {
      const input = inputOf(form.getValues());
      return maker
        ? update.mutateAsync({ id: maker.id, patch: input })
        : create.mutateAsync(input);
    },
    onDone: (record) => (onSaved ? onSaved(record) : onClose()),
  });

  const medicineCount = maker?.medicineCount ?? 0;
  const steps = useSteps(
    { form, values, idPrefix, testId, pickers, openChild, medicineCount },
    readOnly,
  );
  const summary = summaryOf(values, t);
  const creating = maker === null;

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(creating ? K.title.create : K.title.edit)}
        sub={t(K.sub)}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.medical}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => notify.warning(t(MEDICAL_DRAWER_KEYS.addName))}
        summary={summary}
        readOnly={readOnly}
        stacked={stacked}
        saveLabel={t(creating ? K.save : MEDICAL_DRAWER_KEYS.saveChanges)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={
          canDelete && !stacked && medicineCount === 0
            ? () => setDeleting(true)
            : undefined
        }
        dirty={isDirty}
        testId={testId}
      />
      {maker ? (
        <MedicalDeleteConfirm
          target={
            deleting
              ? { kind: 'manufacturer', id: maker.id, name: maker.name, record: summary }
              : null
          }
          onClose={() => setDeleting(false)}
          onDeleted={onClose}
        />
      ) : null}
    </>
  );
}

/**
 * New / Edit manufacturer (KICKOFF §6.7 Drawers; `medical.md:208–222`) on the
 * shared record drawer, 560px: "Manufacturer" — Name* in upper case and one
 * of six colours — then "Connections" — the suppliers that distribute it and
 * the MRs who represent it, each pickable, quick-added or created in full on
 * top — and how many medicines it makes. The links are written on the
 * suppliers and MRs; "Manufacturer saved · connections updated". Delete only
 * while no medicine names it. Stacked on another drawer it reads "Back" ·
 * "Add manufacturer" and hands the new maker back.
 */
export function ManufacturerDrawer(props: ManufacturerDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = props.testId ?? MEDICAL_DRAWER_TEST_IDS.manufacturer;
  if (props.mode === 'edit' && !props.manufacturer) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title.edit)}
        sub={t(K.sub)}
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.manufacturer)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const maker = props.mode === 'edit' ? (props.manufacturer ?? null) : null;
  return (
    <ManufacturerSession
      key={`${session}-${maker?.id ?? 'new'}`}
      {...props}
      maker={maker}
      prefill={props.mode === 'create' ? props.prefill : undefined}
      testId={testId}
    />
  );
}
