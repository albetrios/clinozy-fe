import type { TFunction } from 'i18next';
import { useEffect, useId, useState } from 'react';
import { Controller, useForm, type UseFormReturn, useFormState } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import { displayId } from '@/shared/api/clinic/clinic-display-id.ts';
import type { MedicineRecord } from '@/shared/api/clinic/medicines-contracts.ts';
import { SECTION_TONES } from '@/shared/clinic/clinic-tones.ts';
import {
  DrawerChips,
  DrawerField,
  DrawerFieldGrid,
  DrawerInput,
  DrawerStepBody,
  useDrawerFieldIds,
} from '@/shared/components/DrawerField/index.ts';
import type { DrawerStep } from '@/shared/components/DrawerSteps/index.ts';
import {
  type DrawerBadge,
  RecordDrawer,
  RecordDrawerPending,
} from '@/shared/components/RecordDrawer/index.ts';
import {
  RECORD_DRAWER_KEYS,
  RECORD_DRAWER_NS,
} from '@/shared/components/RecordDrawer/record-drawer.constants.ts';
import { useDrawerSave } from '@/shared/hooks/useDrawerSave/index.ts';
import { useDrawerSession } from '@/shared/hooks/useDrawerSession/index.ts';
import {
  useCreateMedicine,
  useUpdateMedicine,
} from '@/shared/hooks/useMedicines/index.ts';
import { usePaiseFormat } from '@/shared/hooks/usePaiseFormat/index.ts';
import { notify } from '@/shared/notify/index.ts';

import { useSupplierCatalogue } from '../../hooks/useMedicalLists/index.ts';
import {
  type MedicalPickers,
  useMedicalPickers,
} from '../../hooks/useMedicalPickers/index.ts';
import type { OpenMedicalChild } from '../../hooks/useMedicalStack/index.ts';
import { useLiveValues, useMedicalDrawerAccess } from '../../medical-drawer-form.ts';
import {
  MEDICAL_DRAWER_KEYS,
  MEDICAL_DRAWER_TEST_IDS,
  MEDICAL_DRAWERS_NS,
} from '../../medical-drawers.constants.ts';
import { MedicalDeleteConfirm } from '../MedicalDeleteConfirm/index.ts';
import { MedicalPartnerPicker } from '../MedicalPartnerPicker/index.ts';
import {
  bestFormRate,
  emptyMedicineForm,
  formStock,
  MEDICINE_FORM_LIMITS,
  medicineFormOf,
  type MedicineFormValues,
  medicineInputOf,
  medicineRowProblem,
  missingMedicineFields,
  mrpPaiseOf,
} from './medicine-form.ts';
import { MedicineBatchesField, MedicineRatesField } from './MedicineItemsFields.tsx';
import { MedicinePricePanel } from './MedicinePricePanel.tsx';
import { MedicineStockPanel } from './MedicineStockPanel.tsx';

const K = MEDICAL_DRAWER_KEYS.medicine;
const F = K.fields;

/**
 * The batches and supplier prices are item rows: 840px, whatever the first
 * step shows (`medical.md:336`). They sit in the second step, closed at first,
 * so the drawer says so itself.
 */
const CONTENT_PROFILE = { fieldCount: 10, hasHeavyField: true, hasItems: true } as const;

/** "Sold with": prescription only (blush) or over the counter (sage). */
type SoldWith = 'rx' | 'otc';

/** What every use of the drawer passes. */
interface MedicineDrawerBaseProps {
  open: boolean;
  /** Every exit once the dirty guard lets it through — and after a save or a delete. */
  onClose: () => void;
  /** Stacked on another drawer: "Back", "Add medicine", no "full details" of its own. */
  stacked?: boolean;
  /** The saved record — a stacked child hands it to the field that asked. */
  onSaved?: (medicine: MedicineRecord) => void;
  /** Opens a manufacturer or supplier on top for "full details"; a stacked drawer passes none. */
  openChild?: OpenMedicalChild;
  testId?: string;
}

/** Props of {@link MedicineDrawer}: New medicine (`?name=`), or Edit medicine once loaded. */
export type MedicineDrawerProps = MedicineDrawerBaseProps &
  (
    | { mode: 'create'; prefill?: { name?: string } }
    | { mode: 'edit'; medicine: MedicineRecord | undefined }
  );

/** What the bodies read. */
interface BodyProps {
  form: UseFormReturn<MedicineFormValues>;
  values: MedicineFormValues;
  idPrefix: string;
  testId: string;
  readOnly: boolean;
  pickers: MedicalPickers;
  suppliers: readonly { id: string; manufacturerIds: readonly string[] }[];
  openChild?: OpenMedicalChild;
}

/** MEDICINE: Name* · Manufacturer* · Composition · Sold with (`medical.md:174–177`). */
function IdentityFields({ form, idPrefix, testId, pickers, openChild }: BodyProps) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const field = useDrawerFieldIds(form, idPrefix);
  const name = field('name');
  const maker = field('manufacturerId');
  const composition = field('composition');
  return (
    <DrawerFieldGrid title={t(K.groups.medicine)}>
      <DrawerField
        span="half"
        label={t(F.name)}
        htmlFor={name.id}
        required
        error={name.error}
      >
        <DrawerInput
          {...name.control}
          {...form.register('name')}
          aria-required="true"
          maxLength={MEDICINE_FORM_LIMITS.name}
          autoComplete="off"
          data-testid={`${testId}-name`}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(F.manufacturer)}
        htmlFor={maker.id}
        required
        error={maker.error}
      >
        <Controller
          control={form.control}
          name="manufacturerId"
          render={({ field: control }) => (
            <MedicalPartnerPicker
              kind="manufacturer"
              id={maker.id}
              invalid={Boolean(maker.error)}
              label={t(F.manufacturer)}
              value={control.value}
              onChange={control.onChange}
              pickers={pickers}
              openChild={openChild}
              testId={`${testId}-manufacturer`}
            />
          )}
        />
      </DrawerField>
      <DrawerField
        span="half"
        label={t(F.composition)}
        hint={t(F.compositionHint)}
        htmlFor={composition.id}
      >
        <DrawerInput
          {...composition.control}
          {...form.register('composition')}
          maxLength={MEDICINE_FORM_LIMITS.composition}
          placeholder={t(F.compositionPlaceholder)}
          autoComplete="off"
          data-testid={`${testId}-composition`}
        />
      </DrawerField>
      <DrawerField span="half" label={t(F.soldWith)}>
        <Controller
          control={form.control}
          name="prescriptionOnly"
          render={({ field: control }) => (
            <DrawerChips<SoldWith>
              label={t(F.soldWith)}
              options={[
                { value: 'rx', label: t(F.prescriptionOnly), tone: 'blush' },
                { value: 'otc', label: t(F.overTheCounter), tone: 'sage' },
              ]}
              value={control.value ? 'rx' : 'otc'}
              onChange={(next) => {
                if (next) control.onChange(next === 'rx');
              }}
              testId={`${testId}-sold-with`}
            />
          )}
        />
      </DrawerField>
    </DrawerFieldGrid>
  );
}

/** The maker's option — its name and tone — for the header and the peek. */
function makerOf(pickers: MedicalPickers, id: string | null) {
  return pickers.manufacturers.find((option) => option.key === id) ?? null;
}

/** The step cards: "Medicine, price & stock" → "Batches & supplier prices" (`medical.md:433`). */
function useSteps(body: BodyProps): DrawerStep[] {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const { t: tDrawer } = useTranslation(RECORD_DRAWER_NS);
  const formatPaise = usePaiseFormat();
  const { values, pickers, readOnly } = body;
  const notFilled = tDrawer(RECORD_DRAWER_KEYS.step.notFilled);
  const name = values.name.trim();
  const maker = makerOf(pickers, values.manufacturerId);
  const composition = values.composition.trim();
  const mrp = mrpPaiseOf(values);
  const mrpText = mrp > 0 ? formatPaise(mrp) : '';
  const soldWith = values.prescriptionOnly ? t(F.prescriptionOnly) : t(F.overTheCounter);
  const supplierById = new Map(
    pickers.suppliers().map((option) => [option.key, option.label]),
  );
  const missing = missingMedicineFields(values).map((field) => {
    if (field === 'name') return t(F.name);
    return field === 'mrp' ? t(K.price.mrp) : t(F.manufacturer);
  });
  return [
    {
      id: 'medicine',
      title: t(K.steps.main),
      summary:
        [name, maker?.label, mrpText, `${values.gstPct}%`].filter(Boolean).join(' · ') ||
        notFilled,
      peek: [
        { kind: 'value', label: t(F.name), value: name },
        {
          kind: 'value',
          label: t(F.manufacturer),
          value: maker?.label,
          tone: maker?.tone,
        },
        { kind: 'value', label: t(F.composition), value: composition },
        {
          kind: 'value',
          label: t(F.soldWith),
          value: soldWith,
          tone: values.prescriptionOnly ? 'blush' : 'sage',
        },
        { kind: 'value', label: t(K.price.mrp), value: mrpText },
        { kind: 'value', label: t(K.price.gst), value: `${values.gstPct}%` },
        { kind: 'value', label: t(K.stock.reorderAt), value: String(values.minStock) },
        { kind: 'value', label: t(K.stock.fillUpTo), value: String(values.maxStock) },
      ],
      missing,
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <IdentityFields {...body} />
          <DrawerFieldGrid title={t(K.groups.price)}>
            <MedicinePricePanel {...body} />
            <MedicineStockPanel {...body} />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
    {
      id: 'batches',
      title: t(K.steps.batches),
      summary: t(K.batches.total, { count: formStock(values) }),
      peek: [
        {
          kind: 'items',
          label: t(K.batches.title),
          names: values.batches.map((batch) => batch.batchNo.trim()).filter(Boolean),
        },
        {
          kind: 'items',
          label: t(K.rates.title),
          names: values.supplierRates.flatMap(
            (row) => supplierById.get(row.supplierId) ?? [],
          ),
        },
      ],
      content: (
        <DrawerStepBody readOnly={readOnly}>
          <DrawerFieldGrid title={t(K.batches.title)}>
            <MedicineBatchesField {...body} />
          </DrawerFieldGrid>
          <DrawerFieldGrid title={t(K.rates.title)}>
            <MedicineRatesField {...body} />
          </DrawerFieldGrid>
        </DrawerStepBody>
      ),
    },
  ];
}

/** The header's sub line and badges (`medical.md:338`; H:5375). */
function useHeader(values: MedicineFormValues, pickers: MedicalPickers) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const formatPaise = usePaiseFormat();
  const maker = makerOf(pickers, values.manufacturerId);
  const composition = values.composition.trim();
  const makerName = maker?.label ?? '';
  const sub = composition
    ? t(K.sub, { maker: makerName, composition })
    : t(K.subNoComposition, { maker: makerName });
  const best = bestFormRate(values);
  const bestSupplier = best
    ? (pickers.suppliers().find((option) => option.key === best.supplierId)?.label ?? '')
    : '';
  const badges: DrawerBadge[] = [
    ...(maker ? [{ id: 'maker', label: maker.label, tone: maker.tone }] : []),
    { id: 'stock', label: t(K.badges.inStock, { count: formStock(values) }) },
    ...(best
      ? [
          {
            id: 'best',
            label: t(K.badges.best, {
              rate: formatPaise(best.rate),
              supplier: bestSupplier,
            }),
            tone: 'sage' as const,
          },
        ]
      : []),
  ];
  return { sub, badges };
}

/** The toast a missing field raises when Save opens its step. */
function missingToast(values: MedicineFormValues, t: TFunction): string | null {
  const [first] = missingMedicineFields(values);
  if (first === 'name') return t(MEDICAL_DRAWER_KEYS.addName);
  if (first === 'mrp') return t(K.toasts.enterMrp);
  return first ? t(K.toasts.pickManufacturer) : null;
}

/** The row rules' toasts (`medical.md:182`). */
function rowProblemMessage(
  rule: 'rates' | 'batchNo' | 'expiry',
  t: TFunction,
): { field: string; toast: string } {
  if (rule === 'rates')
    return { field: t(K.rates.rateMissing), toast: t(K.toasts.enterRates) };
  if (rule === 'batchNo') {
    return { field: t(K.batches.batchMissing), toast: t(K.batches.batchMissing) };
  }
  return { field: t(K.batches.expiryInvalid), toast: t(K.batches.expiryInvalid) };
}

/**
 * A new medicine starts on the first manufacturer (`medical.md:175`): set
 * once the makers have loaded, as the field's own default, so it does not
 * count as an edit.
 */
function useFirstMaker(
  form: UseFormReturn<MedicineFormValues>,
  pickers: MedicalPickers,
  creating: boolean,
) {
  const first = pickers.manufacturers[0]?.key;
  useEffect(() => {
    if (creating && first && form.getValues('manufacturerId') === null) {
      form.resetField('manufacturerId', { defaultValue: first });
    }
  }, [creating, first, form]);
}

/** The write: a create or a save, its toast, and whose the record is after. */
function useMedicineSave(
  form: UseFormReturn<MedicineFormValues>,
  medicine: MedicineRecord | null,
  onDone: (record: MedicineRecord) => void,
  openStep: (step: string) => void,
) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const create = useCreateMedicine({
    notifyOnError: false,
    successMessage: (record) => t(K.toasts.added, { name: record.name }),
  });
  const update = useUpdateMedicine({
    notifyOnError: false,
    successMessage: (record) => t(K.toasts.saved, { name: record.name }),
  });
  return useDrawerSave<MedicineFormValues, MedicineRecord>({
    form,
    fieldOrder: [
      'name',
      'manufacturerId',
      'composition',
      'mrp',
      'gstPct',
      'minStock',
      'maxStock',
      'batches',
      'supplierRates',
    ],
    toastId: 'medicine-save-failed',
    check: (values) => {
      form.clearErrors(['batches', 'supplierRates']);
      const problem = medicineRowProblem(values);
      if (!problem) return null;
      const message = rowProblemMessage(problem.rule, t);
      // Each cell carries its own words ("Enter this supplier’s rate"); the
      // toast says what to do about them all.
      for (const path of problem.fields) {
        form.setError(path, { type: 'client', message: message.field });
      }
      openStep('batches');
      return { fields: [], message: message.toast };
    },
    onField: (field) =>
      openStep(
        field.startsWith('batches') || field.startsWith('supplierRates')
          ? 'batches'
          : 'medicine',
      ),
    write: () => {
      const input = medicineInputOf(form.getValues());
      return medicine
        ? update.mutateAsync({ id: medicine.id, patch: input })
        : create.mutateAsync(input);
    },
    onDone,
  });
}

/** One opening of the drawer: the form, its steps and its save. */
function MedicineSession({
  open,
  onClose,
  medicine,
  prefill,
  stacked = false,
  onSaved,
  openChild,
  testId,
}: MedicineDrawerBaseProps & {
  medicine: MedicineRecord | null;
  prefill?: { name?: string };
  testId: string;
}) {
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const idPrefix = `medicine-${useId().replace(/:/g, '')}`;
  const { readOnly, canDelete } = useMedicalDrawerAccess(medicine !== null);
  const pickers = useMedicalPickers();
  const suppliers = useSupplierCatalogue().data ?? [];
  const form = useForm<MedicineFormValues>({
    defaultValues: medicine
      ? medicineFormOf(medicine)
      : emptyMedicineForm({ ...prefill, manufacturerId: pickers.manufacturers[0]?.key }),
  });
  useFirstMaker(form, pickers, medicine === null);
  const values = useLiveValues(form);
  const { isDirty } = useFormState({ control: form.control });
  const [openStep, setOpenStep] = useState<string>('medicine');
  const [deleting, setDeleting] = useState(false);

  const { saveState, save } = useMedicineSave(
    form,
    medicine,
    (record) => (onSaved ? onSaved(record) : onClose()),
    (step) => setOpenStep(step),
  );
  const header = useHeader(values, pickers);
  const steps = useSteps({
    form,
    values,
    idPrefix,
    testId,
    readOnly,
    pickers,
    suppliers,
    openChild,
  });
  const summary = values.name.trim();

  return (
    <>
      <RecordDrawer
        open={open}
        onClose={onClose}
        title={t(medicine ? K.title.edit : K.title.create)}
        tag={medicine ? displayId.medicine(medicine.seq) : undefined}
        sub={header.sub}
        badges={header.badges}
        content={CONTENT_PROFILE}
        tone={SECTION_TONES.medical}
        steps={steps}
        openStep={openStep}
        onOpenStepChange={setOpenStep}
        onMissing={() => {
          const message = missingToast(form.getValues(), t);
          if (message) notify.warning(message);
        }}
        summary={summary}
        readOnly={readOnly}
        stacked={stacked}
        saveLabel={t(medicine ? MEDICAL_DRAWER_KEYS.saveChanges : K.save)}
        onSave={() => void save()}
        saveState={saveState}
        onDelete={canDelete && !stacked ? () => setDeleting(true) : undefined}
        dirty={isDirty}
        testId={testId}
      />
      {medicine ? (
        <MedicalDeleteConfirm
          target={
            deleting
              ? {
                  kind: 'medicine',
                  id: medicine.id,
                  name: medicine.name,
                  record: summary,
                }
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
 * New / Edit medicine (KICKOFF §6.7 Drawers; `medical.md:170–188`) on the
 * shared record drawer, 840px. "Medicine, price & stock": Name*, the
 * manufacturer* (pill options with their counts; quick-added or created in
 * full on top), Composition ("used for substitutes"), Sold with; the price
 * panel — MRP incl. GST, the GST rate, the live split and margin — and the
 * stock levels. "Batches & supplier prices": the batches with their total,
 * and who sells it at what. The header names the maker and composition, its
 * badges the maker, the stock and the best price. "Added …" / "Saved …"; a
 * quick record loses its "Needs MRP and composition" flag; edit adds Delete.
 * Stacked on another drawer it reads "Back" · "Add medicine" and hands the new
 * medicine back.
 */
export function MedicineDrawer(props: MedicineDrawerProps) {
  const { session } = useDrawerSession(props.open);
  const { t } = useTranslation(MEDICAL_DRAWERS_NS);
  const testId = props.testId ?? MEDICAL_DRAWER_TEST_IDS.medicine;
  if (props.mode === 'edit' && !props.medicine) {
    return (
      <RecordDrawerPending
        open={props.open}
        onClose={props.onClose}
        title={t(K.title.edit)}
        sub=""
        recordLabel={t(MEDICAL_DRAWER_KEYS.records.medicine)}
        content={CONTENT_PROFILE}
        testId={testId}
      />
    );
  }
  const medicine = props.mode === 'edit' ? (props.medicine ?? null) : null;
  return (
    <MedicineSession
      key={`${session}-${medicine?.id ?? 'new'}`}
      {...props}
      medicine={medicine}
      prefill={props.mode === 'create' ? props.prefill : undefined}
      testId={testId}
    />
  );
}
